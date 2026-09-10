import { findConfigFiles, readLines } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";
import { matchesScope } from "../drift/globs.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CONFIG_CANDIDATES = [".gitleaks.toml", "gitleaks.toml"];

// TOML subset: we only track [[rules]] array-of-tables headers and, inside
// each, a single-line id = "..." field. Regex patterns, entropy, tags and
// allowlists are opaque. A multi-line string ("""/''') inside a [[rules]]
// block before its id line is the one construct that could hide or misplace
// an id, so it is the only thing rejected loudly.
class UnreadableConfig extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

function unquote(value) {
  const quoted = /^"([^"]*)"$|^'([^']*)'$/.exec(value.trim());
  return quoted ? (quoted[1] ?? quoted[2]) : null;
}

export function extractIds(text, path) {
  const lines = text.split("\n");
  const ids = [];
  let inRulesBlock = false;
  let idFoundForCurrentBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (raw.includes("\t")) throw new UnreadableConfig(`${path}: tabs are not supported`, line);
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (/^\[\[rules\]\]$/.test(trimmed)) {
      inRulesBlock = true;
      idFoundForCurrentBlock = false;
      continue;
    }
    if (/^\[.*\]$/.test(trimmed)) {
      inRulesBlock = false;
      continue;
    }
    if (!inRulesBlock) continue;

    const field = /^([A-Za-z_][\w-]*)\s*=\s*(.+)$/.exec(trimmed);
    if (!field) continue;

    if (field[1] === "id") {
      const value = unquote(field[2]);
      if (value === null) {
        throw new UnreadableConfig(`${path}: unsupported id value (expected a quoted string)`, line);
      }
      ids.push({ id: value, line });
      idFoundForCurrentBlock = true;
      continue;
    }

    if (!idFoundForCurrentBlock && /^("""|''')/.test(field[2].trim())) {
      throw new UnreadableConfig(`${path}: a multi-line string appears before this rule's id`, line);
    }
  }

  return ids;
}

async function resolve(root, contract) {
  const files = await findConfigFiles(root, CONFIG_CANDIDATES);
  if (files.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no gitleaks config found" };
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
      return { resolved: true, location: { file }, evidence: `gitleaks contract '${contract}' in ${file}:${match.line}` };
    }
  }
  if (unreadable.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `no [[rules]] id '${contract}' in any readable config; unreadable: ${unreadable.join("; ")}`,
    };
  }
  return { resolved: false, reason: "unbound", evidence: `no [[rules]] id '${contract}' in ${files.join(", ")}` };
}

// gitleaks scans the whole repository in one pass and reports every
// finding's own RuleID, so a single scan settles every rule at once.
// --exit-code 0 means "no leaks of any rule", already conclusive for this
// contract; a nonzero exit means the report must be checked for this one.
// --config is passed explicitly, pointing at the exact file resolve() read:
// gitleaks only auto-discovers a config file named ".gitleaks.toml", so
// without this a repo whose config is named "gitleaks.toml" (a candidate
// this adapter also accepts) would silently be scanned with the tool's
// built-in ruleset instead of the file the contract was actually bound
// against.
//
// Every finding names its own `File`, so — unlike import-linter or
// dependency-cruiser — this adapter CAN confine its verdict to the calling
// rule's `scope`: a decision with a narrow `scope` must never see a `fail`
// for a secret gitleaks found somewhere else entirely (check-rules.mjs's
// `scopeCoverage` field is what tells a JSON consumer this happened). Pass
// no `scope` (or an empty one) to fall back to the old, unfiltered
// repository-wide behaviour.
async function run(root, contract, resolution, { scope = [] } = {}) {
  const reportDirectory = await mkdtemp(join(tmpdir(), "arch-crew-gitleaks-"));
  const reportPath = join(reportDirectory, "report.json");
  try {
    const result = await spawnTool(
      "gitleaks",
      [
        "detect",
        "--source", ".",
        "--config", resolution.location.file,
        "--no-git",
        "--report-format", "json",
        "--report-path", reportPath,
        "--exit-code", "1",
      ],
      { cwd: root },
    );
    if (!result.available) {
      return { status: "unavailable", evidence: "gitleaks is not on PATH" };
    }
    if (result.exitCode === 0) {
      return { status: "pass", evidence: `gitleaks found no secrets matching '${contract}'` };
    }
    let findings = [];
    try {
      findings = JSON.parse(await readFile(reportPath, "utf8"));
    } catch {
      return { status: "error", evidence: "gitleaks exited nonzero but its report was not parseable JSON" };
    }
    const hits = findings.filter((finding) => finding.RuleID === contract);
    if (hits.length === 0) {
      return { status: "pass", evidence: `gitleaks found findings, but none for rule '${contract}'` };
    }
    if (scope.length === 0) {
      const hit = hits[0];
      return { status: "fail", evidence: `gitleaks matched rule '${contract}' at ${hit.File}:${hit.StartLine}` };
    }
    const inScope = hits.filter((hit) => matchesScope(hit.File, scope, `gitleaks#${contract}`));
    if (inScope.length > 0) {
      const hit = inScope[0];
      return { status: "fail", evidence: `gitleaks matched rule '${contract}' at ${hit.File}:${hit.StartLine}` };
    }
    const outside = hits[0];
    return {
      status: "pass",
      evidence:
        `gitleaks matched rule '${contract}', but only outside this rule's scope ` +
        `(e.g. ${outside.File}:${outside.StartLine}); not a violation of this scoped rule`,
    };
  } finally {
    await rm(reportDirectory, { recursive: true, force: true });
  }
}

// scopeAware: true means check-rules.mjs may hand run() a rule's `scope` and
// trust it to have been honoured (see the run() comment above) — the
// contract behind the JSON `scopeCoverage` field.
export default { tool: "gitleaks", configCandidates: CONFIG_CANDIDATES, scopeAware: true, resolve, run };
