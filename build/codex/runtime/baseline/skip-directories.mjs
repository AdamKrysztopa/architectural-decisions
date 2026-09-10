// Directories every tree-walk in this package skips: dependency caches and
// VCS internals add no signal about the architecture and can be enormous,
// and the drift queue (".arch-crew", matching runtime/drift/queue.mjs's
// QUEUE_DIRECTORY — duplicated as a literal here, not imported, so this
// foundational module never depends on the drift sub-project; a test pins
// the two constants equal) is machine-generated bookkeeping, not source.
//
// runtime/checkers/text.mjs (a checker adapter's own config-candidate walk)
// and runtime/migration/inventory.mjs (reverse discovery's file-count
// evidence) both walk the repository tree and must agree on this set, or
// the same repository yields two different totals — "N of M modules do X" —
// depending only on which walk happened to answer.
export const SKIP_DIRECTORIES = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", ".tox", ".arch-crew"]);
