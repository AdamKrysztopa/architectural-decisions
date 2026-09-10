import { findConfigFiles, readLines } from "./text.mjs";

// ast-grep's rule-file schema is NOT the same shape semgrep uses: a semgrep
// config nests rules under a top-level "rules:" list, but an ast-grep rule
// file declares one rule per YAML document as a top-level (column-0) "id:"
// field — several rules in one file are separated by a "---" document
// marker, which is a normal boundary here, not an error. The project root
// also names where those rule files live via "sgconfig.yml"'s "ruleDirs:"
// list, so that is read first; only when no sgconfig.yml is found (or it
// declares no ruleDirs) do we fall back to the conventional bare-glob
// locations.
const SGCONFIG_CANDIDATE = "sgconfig.yml";
const FALLBACK_CANDIDATES = [".ast-grep/**.yml", ".ast-grep/**.yaml", "rules/**.yml", "rules/**.yaml"];

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

// One rule per YAML document: a column-0 "id:" field. "---"/"..." mark a
// document boundary and reset the per-document state; they are never
// rejected here the way semgrep.mjs's reader rejects them, because in an
// ast-grep rule file they are the expected, idiomatic way to hold several
// rules in one file. An anchor/alias attached to the id value itself is
// still rejected, for the same reason semgrep.mjs rejects it: it is the one
// construct that could silently corrupt the extracted id.
export function extractDocumentIds(text, path) {
  const lines = text.split("\n");
  const ids = [];
  let idFoundForDocument = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (raw.includes("\t")) throw new UnreadableConfig(`${path}: tabs are not supported`, line);

    if (/^(---|\.\.\.)\s*$/.test(raw)) {
      idFoundForDocument = false;
      continue;
    }
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;

    const field = /^id:\s*(.+)$/.exec(raw);
    if (!field) continue;
    const value = field[1].trim();
    if (/^[&*]/.test(value)) {
      throw new UnreadableConfig(`${path}: an anchor/alias on an id value is not supported`, line);
    }
    if (idFoundForDocument) {
      throw new UnreadableConfig(`${path}: more than one top-level id in the same YAML document`, line);
    }
    ids.push({ id: unquote(value), line });
    idFoundForDocument = true;
  }

  return ids;
}

// "ruleDirs:" as either an inline list ("ruleDirs: [a, b]") or a block list
// ("ruleDirs:\n  - a\n  - b"). Every other sgconfig.yml key is opaque.
export function parseRuleDirs(text) {
  const dirs = [];
  let inRuleDirs = false;
  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    const inline = /^ruleDirs:\s*\[(.*)\]\s*$/.exec(trimmed);
    if (inline) {
      for (const part of inline[1].split(",")) {
        const value = unquote(part.trim());
        if (value) dirs.push(value);
      }
      inRuleDirs = false;
      continue;
    }
    if (/^ruleDirs:\s*$/.test(trimmed)) {
      inRuleDirs = true;
      continue;
    }
    if (inRuleDirs) {
      const item = /^-\s*(.+)$/.exec(trimmed);
      if (item) {
        dirs.push(unquote(item[1].trim()));
        continue;
      }
      inRuleDirs = false;
    }
  }
  return dirs;
}

async function ruleFileCandidates(root) {
  const sgconfigFiles = await findConfigFiles(root, [SGCONFIG_CANDIDATE]);
  if (sgconfigFiles.length === 0) return FALLBACK_CANDIDATES;

  const text = (await readLines(root, sgconfigFiles[0])).join("\n");
  const ruleDirs = parseRuleDirs(text);
  if (ruleDirs.length === 0) return FALLBACK_CANDIDATES;

  return ruleDirs.flatMap((dir) => [`${dir}/**.yml`, `${dir}/**.yaml`]);
}

async function resolve(root, contract) {
  const files = await findConfigFiles(root, await ruleFileCandidates(root));
  if (files.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no ast-grep rule files found" };
  }

  const unreadable = [];
  for (const file of files) {
    const text = (await readLines(root, file)).join("\n");
    let ids;
    try {
      ids = extractDocumentIds(text, file);
    } catch (error) {
      if (error instanceof UnreadableConfig) {
        unreadable.push(error.message);
        continue;
      }
      throw error;
    }
    const match = ids.find((entry) => entry.id === contract);
    if (match) {
      return { resolved: true, location: { file }, evidence: `ast-grep contract '${contract}' in ${file}:${match.line}` };
    }
  }
  if (unreadable.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `no rule id '${contract}' in any readable rule file; unreadable: ${unreadable.join("; ")}`,
    };
  }
  return { resolved: false, reason: "unbound", evidence: `no rule id '${contract}' in ${files.join(", ")}` };
}

// Not implemented in this release: ast-grep's JSON output shape is less
// stable across versions than semgrep's, and no scenario in this release
// depends on it. --run always reports the rule unavailable rather than
// guessing at an output format; a stated v1 limitation, not a silent gap.
// `scope` is still accepted (and ignored) so the signature already matches
// gitleaks.mjs/semgrep.mjs: whenever --run is implemented, its findings will
// carry their own file path just like theirs, and it must filter against
// `scope` the same way before reporting `fail` — never widen `scopeAware`
// below without that filtering in place.
async function run(root, contract, resolution, { scope } = {}) {
  void scope;
  return { status: "unavailable", evidence: "ast-grep --run is not implemented in this release; static resolution only" };
}

// scopeAware: true documents the intended contract for when --run lands
// (see above); it changes nothing today because run() never reports
// anything but "unavailable", so no verdict is ever produced to misattribute.
export default {
  tool: "ast-grep",
  configCandidates: [SGCONFIG_CANDIDATE, ...FALLBACK_CANDIDATES],
  scopeAware: true,
  resolve,
  run,
};
