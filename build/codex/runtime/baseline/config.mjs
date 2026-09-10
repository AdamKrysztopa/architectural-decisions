// The project's persisted answer to two questions the runtime must never guess:
// which HUMAN DOCUMENTATION MODE this repository keeps its architecture record
// in, and which artifacts the team has designated authoritative.
//
// One committed JSON file at the project root. No database, no cache, no
// second store: a config that has to be kept in sync with a cache is a config
// that will be out of sync with it. Absent config is a complete, valid answer
// -- `adr` mode with a discovered decisions directory and no designated
// sources -- so a repository that never runs `arch mode` behaves exactly as it
// did before this file existed.
//
// The mode governs the HUMAN layer only. Rules, scopes, severities,
// verified_by bindings and the generated rollup are MACHINE ENFORCEMENT
// METADATA and are identical in both modes; see docs/documentation-modes.md
// for the authority model that separation buys.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeAtomically } from "./write-atomically.mjs";

export const CONFIG_FILENAME = "arch-crew.json";
export const MODES = ["adr", "living"];
export const DEFAULT_MODE = "adr";
export const DEFAULT_DECISIONS_DIRECTORY = "docs/architecture/decisions";

export class ConfigError extends Error {
  constructor(message) {
    super(`${CONFIG_FILENAME}: ${message}`);
    this.name = "ConfigError";
  }
}

export function configPath(root) {
  return join(root, CONFIG_FILENAME);
}

function asStringList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ConfigError(`${field} must be a list`);
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new ConfigError(`${field} must be a list of non-empty strings`);
    }
  }
  return value;
}

// A path a *user* wrote, resolved against the project root. Refused if it
// climbs out of the repository or is absolute: the config designates artifacts
// inside this project, and a config that can name /etc/passwd is a config that
// can be used to make the runtime read it.
export function resolveProjectPath(root, path, field) {
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) {
    throw new ConfigError(`${field} '${path}' must be relative to the project root`);
  }
  const normalized = path.split("\\").join("/");
  if (normalized.split("/").includes("..")) {
    throw new ConfigError(`${field} '${path}' must not climb above the project root`);
  }
  return join(root, normalized);
}

export function normalizeConfig(raw, { source = CONFIG_FILENAME } = {}) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError("must contain a JSON object");
  }

  const documentation = raw.documentation ?? {};
  if (documentation === null || typeof documentation !== "object" || Array.isArray(documentation)) {
    throw new ConfigError("documentation must be an object");
  }

  const mode = documentation.mode ?? DEFAULT_MODE;
  if (!MODES.includes(mode)) {
    throw new ConfigError(`documentation.mode is '${mode}'; expected one of ${MODES.join(", ")}`);
  }

  const documents = asStringList(documentation.documents, "documentation.documents");
  if (mode === "living" && documents.length === 0) {
    throw new ConfigError("documentation.mode is 'living' but documentation.documents names no document");
  }

  const decisions = documentation.decisions ?? null;
  if (decisions !== null && (typeof decisions !== "string" || decisions.trim() === "")) {
    throw new ConfigError("documentation.decisions must be a path");
  }

  // Where the generated rollup goes. Null means the default, which differs by
  // mode: beside the decisions directory in `adr`, beside the documents in
  // `living`. That living-mode default drops a generated file INTO a directory
  // of authored documents, which a project may reasonably forbid, so the path
  // is configurable and nothing else about the rollup changes with it.
  const rollup = documentation.rollup ?? null;
  if (rollup !== null && (typeof rollup !== "string" || rollup.trim() === "")) {
    throw new ConfigError("documentation.rollup must be a path");
  }
  if (rollup !== null && !rollup.endsWith(".md")) {
    throw new ConfigError(`documentation.rollup '${rollup}' must name a Markdown file`);
  }

  return {
    source,
    present: true,
    mode,
    // Where the machine layer lives in `adr` mode. Null means "discover it",
    // which is what every repository without a config has always done.
    decisions,
    // The human record in `living` mode: one or several living architecture
    // documents. Empty in `adr` mode, where each decision file is its own
    // human record.
    documents,
    // Null means "wherever this mode puts it by default". See resolveRecord.
    rollup,
    sources: raw.sources ?? [],
  };
}

// A repository with no config is not misconfigured, so this never throws for
// absence. It throws for a config that exists and is wrong, because silently
// falling back to the default would mean the mode the user selected is not the
// mode the runtime is in -- which is the whole defect this file exists to fix.
export async function readConfig(root) {
  let text;
  try {
    text = await readFile(configPath(root), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        source: null,
        present: false,
        mode: DEFAULT_MODE,
        decisions: null,
        documents: [],
        rollup: null,
        sources: [],
      };
    }
    throw error;
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`is not valid JSON (${error.message})`);
  }
  return normalizeConfig(raw);
}

// Rewrites the file while preserving every key this version does not know
// about, so a newer package's config survives an older package touching it.
export async function writeConfig(root, changes) {
  let existing = {};
  try {
    existing = JSON.parse(await readFile(configPath(root), "utf8"));
    if (existing === null || typeof existing !== "object" || Array.isArray(existing)) existing = {};
  } catch {
    // Absent or unreadable: write a fresh config.
  }

  const next = { version: 1, ...existing, ...changes };
  if (changes.documentation) {
    next.documentation = { ...(existing.documentation ?? {}), ...changes.documentation };
  }
  // Validate what we are about to persist, so `arch mode` can never write a
  // config that `readConfig` will then refuse.
  normalizeConfig(next);
  await writeAtomically(configPath(root), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
