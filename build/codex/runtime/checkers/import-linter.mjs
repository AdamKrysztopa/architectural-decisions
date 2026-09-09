import { findConfigFiles, readLines } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";

const CONFIG_CANDIDATES = [".importlinter", "setup.cfg", "tox.ini", "pyproject.toml"];

class UnreadableConfig extends Error {}

function unquote(value) {
  const quoted = /^"([^"]*)"$|^'([^']*)'$/.exec(value.trim());
  return quoted ? (quoted[1] ?? quoted[2]) : value.trim();
}

// INI subset (.importlinter, setup.cfg, tox.ini): section headers
// "[importlinter:contract:<label>]" and, inside one, a single-line
// "name = ..." field. Every other key (type, layers, containers, ...) is
// opaque. A continuation line (an indented value spanning multiple physical
// lines, which configparser allows) is the one INI construct that could hide
// a "name =" line inside a value; encountering one before the section's name
// is found is rejected loudly. A tab is not, on its own, rejected: every
// regex below treats a tab exactly like a space (`\s`), so a tab-indented
// continuation line under an already-found "name =" (configparser accepts
// this for e.g. a multi-line "layers =" value) is read correctly, and the
// continuation-before-name guard already catches the one case a tab could
// otherwise help hide.
export function extractContractNamesIni(text, path) {
  const lines = text.split("\n");
  const names = [];
  let inContractSection = false;
  let nameFoundForSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    if (raw.trim() === "" || raw.trim().startsWith("#") || raw.trim().startsWith(";")) continue;

    const section = /^\[([^\]]+)\]\s*$/.exec(raw);
    if (section) {
      inContractSection = /^importlinter:contract:/.test(section[1]);
      nameFoundForSection = false;
      continue;
    }
    if (!inContractSection) continue;

    if (/^\s/.test(raw) && !/^[^\s]+\s*=/.test(raw.trimStart())) {
      if (!nameFoundForSection) {
        throw new UnreadableConfig(`${path}:${line}: a continuation line appears before this contract's name`);
      }
      continue;
    }

    const field = /^([\w.-]+)\s*=\s*(.*)$/.exec(raw.trim());
    if (!field) continue;
    if (field[1] === "name") {
      names.push({ name: field[2].trim(), line });
      nameFoundForSection = true;
    }
  }

  return names;
}

// TOML subset (pyproject.toml): "[[tool.importlinter.contracts]]" array of
// tables, single-line "name = "..."" field. Same discipline as gitleaks.mjs's
// TOML reader (Task 6): a multi-line string before the name is rejected. As
// in the INI reader above, a bare tab is not itself rejected — it parses
// identically to a space here, and a tab elsewhere in the file (an unrelated
// table, e.g. `[tool.black]`) is never even inspected once this reader is
// tracking a different table.
export function extractContractNamesToml(text, path) {
  const lines = text.split("\n");
  const names = [];
  let inContractsBlock = false;
  let nameFoundForBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (/^\[\[tool\.importlinter\.contracts\]\]$/.test(trimmed)) {
      inContractsBlock = true;
      nameFoundForBlock = false;
      continue;
    }
    if (/^\[.*\]$/.test(trimmed)) {
      inContractsBlock = false;
      continue;
    }
    if (!inContractsBlock) continue;

    const field = /^([A-Za-z_][\w-]*)\s*=\s*(.+)$/.exec(trimmed);
    if (!field) continue;
    if (field[1] === "name") {
      names.push({ name: unquote(field[2]), line });
      nameFoundForBlock = true;
      continue;
    }
    if (!nameFoundForBlock && /^("""|''')/.test(field[2].trim())) {
      throw new UnreadableConfig(`${path}:${line}: a multi-line string appears before this contract's name`);
    }
  }

  return names;
}

async function resolve(root, contract) {
  const files = await findConfigFiles(root, CONFIG_CANDIDATES);
  if (files.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no import-linter config found" };
  }

  const unreadable = [];
  for (const file of files) {
    const text = (await readLines(root, file)).join("\n");
    let entries;
    try {
      entries = file.endsWith(".toml") ? extractContractNamesToml(text, file) : extractContractNamesIni(text, file);
    } catch (error) {
      if (error instanceof UnreadableConfig) {
        unreadable.push(error.message);
        continue;
      }
      throw error;
    }
    const match = entries.find((entry) => entry.name === contract);
    if (match) {
      return { resolved: true, evidence: `import-linter contract '${contract}' in ${file}:${match.line}` };
    }
  }
  if (unreadable.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `no contract named '${contract}' in any readable config; unreadable: ${unreadable.join("; ")}`,
    };
  }
  return { resolved: false, reason: "unbound", evidence: `no contract named '${contract}' in ${files.join(", ")}` };
}

// lint-imports checks every contract in one pass and prints one line per
// contract; there is no "just check this one" flag. We run the whole config
// (as import-linter's own discovery would) and read that contract's own line
// out of the report — never inferred from the exit code alone, which only
// says "something in this config failed".
const REPORT_LINE = /^(.+?)\s+(KEPT|BROKEN)\s*$/;

async function run(root, contract) {
  const result = await spawnTool("lint-imports", [], { cwd: root });
  if (!result.available) {
    return { status: "unavailable", evidence: "lint-imports is not on PATH" };
  }
  for (const line of result.stdout.split("\n")) {
    const match = REPORT_LINE.exec(line.trim());
    if (match && match[1] === contract) {
      return match[2] === "KEPT"
        ? { status: "pass", evidence: `lint-imports reported '${contract}' KEPT` }
        : { status: "fail", evidence: `lint-imports reported '${contract}' BROKEN:\n${result.stdout.slice(-2000)}` };
    }
  }
  return {
    status: "error",
    evidence: `lint-imports ran but its report never mentioned '${contract}'; the output format may have changed`,
  };
}

export default { tool: "import-linter", configCandidates: CONFIG_CANDIDATES, resolve, run };
