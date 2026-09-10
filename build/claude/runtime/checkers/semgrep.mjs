import { findConfigFiles, readLines } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";
import { matchesScope } from "../drift/globs.mjs";

const CONFIG_CANDIDATES = [".semgrep.yml", "semgrep.yml", ".semgrep/**.yml", "rules/**.yml", "sgconfig.yml"];

// We do not parse semgrep/ast-grep YAML in general — patterns, messages and
// metadata are opaque and skipped without inspection. We only track the
// indentation of the "rules:" list and, inside each item, its "id:" field.
// Anything that could hide or shift a rule boundary (a tab, a document
// separator) or corrupt the id itself (an anchor/alias) is rejected loudly.
class UnreadableConfig extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

function unquote(value) {
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);
  return quoted ? (quoted[1] ?? quoted[2]) : value;
}

export function extractIds(text, path) {
  const lines = text.split("\n");
  const ids = [];
  let rulesIndent = null;
  let itemIndent = null;
  let pendingItem = null;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (raw.includes("\t")) throw new UnreadableConfig(`${path}: tabs are not supported`, line);
    // A document separator is only a problem while we are actively tracking
    // a "rules:" list (rulesIndent !== null): it could open a second
    // document that hides another "rules:" list, or otherwise corrupt where
    // the current list ends. A bare "---" before any "rules:" key has been
    // seen — the ordinary, idiomatic YAML document-start marker — is
    // harmless and must not be rejected.
    if (rulesIndent !== null && /^(---|\.\.\.)\s*$/.test(raw)) {
      throw new UnreadableConfig(`${path}: multi-document YAML is not supported`, line);
    }
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;

    const topLevel = /^(\s*)rules:\s*$/.exec(raw);
    if (topLevel && topLevel[1] === "") {
      rulesIndent = 0;
      itemIndent = null;
      pendingItem = null;
      continue;
    }
    if (rulesIndent === null) continue;

    const indent = raw.match(/^\s*/)[0].length;
    if (indent <= rulesIndent && raw.trim() !== "") {
      rulesIndent = null;
      itemIndent = null;
      pendingItem = null;
      continue;
    }

    const item = /^(\s*)-\s?(.*)$/.exec(raw);
    if (item && (itemIndent === null || item[1].length === itemIndent)) {
      itemIndent = item[1].length;
      pendingItem = { indent: itemIndent };
      const rest = item[2];
      if (rest === "") continue;
      const idField = /^id:\s*(.+)$/.exec(rest);
      if (idField) {
        const value = idField[1].trim();
        if (/^[&*]/.test(value)) {
          throw new UnreadableConfig(`${path}: an anchor/alias on an id value is not supported`, line);
        }
        ids.push({ id: unquote(value), line });
        pendingItem = null;
      }
      continue;
    }

    if (pendingItem !== null) {
      const fieldIndent = itemIndent + 2;
      const field = new RegExp(`^ {${fieldIndent}}id:\\s*(.+)$`).exec(raw);
      if (field) {
        const value = field[1].trim();
        if (/^[&*]/.test(value)) {
          throw new UnreadableConfig(`${path}: an anchor/alias on an id value is not supported`, line);
        }
        ids.push({ id: unquote(value), line });
        pendingItem = null;
        continue;
      }
      if (indent === fieldIndent && /^[&*|>]/.test(raw.trim())) {
        throw new UnreadableConfig(`${path}: unsupported YAML construct before this rule's id`, line);
      }
    }
  }

  return ids;
}

async function resolve(root, contract) {
  const files = await findConfigFiles(root, CONFIG_CANDIDATES);
  if (files.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no semgrep/ast-grep config found" };
  }
  const unreadable = [];
  for (const file of files) {
    const text = (await readLines(root, file)).join("\n");
    let ids;
    try {
      ids = extractIds(text, file);
    } catch (error) {
      if (error instanceof UnreadableConfig) {
        unreadable.push(error.message);
        continue;
      }
      throw error;
    }
    const match = ids.find((entry) => entry.id === contract);
    if (match) {
      return { resolved: true, location: { file }, evidence: `semgrep contract '${contract}' in ${file}:${match.line}` };
    }
  }
  if (unreadable.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `no rule id '${contract}' in any readable config; unreadable: ${unreadable.join("; ")}`,
    };
  }
  return { resolved: false, reason: "unbound", evidence: `no rule id '${contract}' in ${files.join(", ")}` };
}

// semgrep --json is the one output mode with a stable check_id per finding;
// the human-readable terminal report is not parsed.
//
// Every finding names its own `path`, so — unlike import-linter or
// dependency-cruiser — this adapter CAN confine its verdict to the calling
// rule's `scope`: a decision with a narrow `scope` must never see a `fail`
// for a match semgrep found somewhere else entirely (check-rules.mjs's
// `scopeCoverage` field is what tells a JSON consumer this happened). Pass
// no `scope` (or an empty one) to fall back to the old, unfiltered
// repository-wide behaviour.
async function run(root, contract, resolution, { scope = [] } = {}) {
  const result = await spawnTool("semgrep", ["--config", resolution.location.file, "--json", "--quiet", "."], { cwd: root });
  if (!result.available) {
    return { status: "unavailable", evidence: "semgrep is not on PATH" };
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { status: "error", evidence: "semgrep did not produce parseable JSON output" };
  }
  const hits = (report.results ?? []).filter((finding) => finding.check_id === contract);
  if (hits.length === 0) {
    return { status: "pass", evidence: `semgrep reported no match for '${contract}'` };
  }
  if (scope.length === 0) {
    const hit = hits[0];
    return { status: "fail", evidence: `semgrep matched '${contract}' at ${hit.path}:${hit.start?.line}` };
  }
  const inScope = hits.filter((hit) => matchesScope(hit.path, scope, `semgrep#${contract}`));
  if (inScope.length > 0) {
    const hit = inScope[0];
    return { status: "fail", evidence: `semgrep matched '${contract}' at ${hit.path}:${hit.start?.line}` };
  }
  const outside = hits[0];
  return {
    status: "pass",
    evidence:
      `semgrep matched '${contract}', but only outside this rule's scope ` +
      `(e.g. ${outside.path}:${outside.start?.line}); not a violation of this scoped rule`,
  };
}

// scopeAware: true means check-rules.mjs may hand run() a rule's `scope` and
// trust it to have been honoured (see the run() comment above) — the
// contract behind the JSON `scopeCoverage` field.
export default { tool: "semgrep", configCandidates: CONFIG_CANDIDATES, scopeAware: true, resolve, run };
