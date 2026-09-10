// The one seam between the HUMAN DOCUMENTATION MODE and everything that
// enforces anything.
//
// Every consumer of the machine enforcement layer -- the constitution rollup,
// check-rules, the drift drain, rule injection, staleness -- calls this and
// gets the same `{ decisions, errors }` it used to get from
// loadDecisions(directory). It cannot tell which mode produced them, and that
// is the point: the mode is a fact about where the *human* record lives, and
// no verification behaviour is allowed to vary with it.
//
// Precedence, highest first:
//   1. An explicit --dir. A caller that names a directory means that
//      directory, in every mode. This is what keeps every existing test, the
//      fixtures, and `arch check --dir` working unchanged.
//   2. The persisted mode in arch-crew.json.
//   3. No config at all -> `adr` with a discovered directory, which is exactly
//      what this package did before modes existed.
//
// One thing --dir does NOT override: where the generated rollup goes. That is
// `documentation.rollup` when set, and a per-mode default otherwise.

import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { discoverDirectory } from "./build-constitution.mjs";
import { loadDecisions, validateDecisions } from "./decisions.mjs";
import { loadLivingDocuments } from "./living.mjs";
import { readConfig, resolveProjectPath } from "./config.mjs";

// The configured rollup path, or null for "wherever this mode puts it by
// default". A project states this once, in arch-crew.json, and it holds in
// every mode and for every invocation -- including one given an explicit
// --dir, because --dir says which directory the rules are read FROM and says
// nothing about where the generated summary of them belongs.
//
// It exists because the living-mode default lands constitution.md IN the
// directory holding the authored documents, where a project whose test asserts
// "every *.md under docs/adr is an authored ADR" cannot have it. The adr-mode
// default has never had that problem: there the rollup lands one level ABOVE
// the decisions directory.
function configuredRollup(root, config) {
  return config.rollup ? resolveProjectPath(root, config.rollup, "documentation.rollup") : null;
}

// A directory-backed record. The missing-directory case is reported as a flag
// rather than thrown, because every caller already has its own wording for it
// ("No decisions directory at ...") and its own exit code.
async function fromDirectory(directory, extra, rollupOverride = null) {
  let missing = false;
  try {
    missing = !(await stat(directory)).isDirectory();
  } catch {
    missing = true;
  }
  const loaded = missing ? { decisions: [], errors: [] } : await loadDecisions(directory);
  return {
    ...loaded,
    directory,
    rollup: rollupOverride ?? join(dirname(directory), "constitution.md"),
    documents: [],
    missingDirectory: missing,
    ...extra,
  };
}

function display(root, path) {
  const rel = relative(root, path);
  return !rel || rel.startsWith("..") || isAbsolute(rel) ? path : rel.split("\\").join("/");
}

export async function resolveRecord(root, { dir = null } = {}) {
  const config = await readConfig(root);

  // An explicit directory is a direct instruction about the machine layer, and
  // it overrides the mode without changing it: the config still says what the
  // human record is, we were simply told where to read rules from this time.
  if (dir) {
    const directory = isAbsolute(dir) ? dir : resolve(root, dir);
    return fromDirectory(directory, { mode: config.mode, config }, configuredRollup(root, config));
  }

  if (config.mode === "living") {
    const documents = config.documents.map((path) =>
      resolveProjectPath(root, path, "documentation.documents"),
    );
    const { decisions, errors } = await loadLivingDocuments(documents, (path) => display(root, path));
    return {
      decisions,
      // The cross-decision checks (duplicate ids, duplicate rule ids, dangling
      // superseded_by) are run in both modes, over whatever parsed. A living
      // document that declares the same rule id in two sections is exactly as
      // broken as two ADR files that do.
      errors: [...errors, ...validateDecisions(decisions)],
      mode: "living",
      // By default the rollup lands beside the human record it summarises,
      // which is where a reader of that record will look for it. A project
      // that keeps its documents in a directory no generated file may enter
      // says so with documentation.rollup, and that wins.
      directory: dirname(documents[0]),
      rollup: configuredRollup(root, config) ?? join(dirname(documents[0]), "constitution.md"),
      documents,
      missingDirectory: false,
      config,
    };
  }

  const directory = config.decisions
    ? resolveProjectPath(root, config.decisions, "documentation.decisions")
    : await discoverDirectory(root);
  return fromDirectory(directory, { mode: "adr", config }, configuredRollup(root, config));
}
