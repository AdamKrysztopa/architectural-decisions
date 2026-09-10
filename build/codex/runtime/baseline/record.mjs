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

import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { discoverDirectory } from "./build-constitution.mjs";
import { loadDecisions, validateDecisions } from "./decisions.mjs";
import { loadLivingDocuments } from "./living.mjs";
import { readConfig, resolveProjectPath } from "./config.mjs";

// A directory-backed record. The missing-directory case is reported as a flag
// rather than thrown, because every caller already has its own wording for it
// ("No decisions directory at ...") and its own exit code.
async function fromDirectory(directory, extra) {
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
    rollup: join(dirname(directory), "constitution.md"),
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
    return fromDirectory(directory, { mode: config.mode, config });
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
      // The rollup lands beside the human record it summarises, which is where
      // a reader of that record will look for it.
      directory: dirname(documents[0]),
      rollup: join(dirname(documents[0]), "constitution.md"),
      documents,
      missingDirectory: false,
      config,
    };
  }

  const directory = config.decisions
    ? resolveProjectPath(root, config.decisions, "documentation.decisions")
    : await discoverDirectory(root);
  return fromDirectory(directory, { mode: "adr", config });
}
