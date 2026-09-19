import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { listCandidates } from "../migration/discover-candidates.mjs";

// Read only when a repository has no decision record. Listing is not
// designating: everything found here reaches the packet as a pointer for a
// human to read, and becomes binding only through /arch-crew:sources or
// /arch-crew:migrate.
//
// Names are matched against real directory entries, not stat()ed by spelling:
// on a case-insensitive filesystem, stat("ARCHITECTURE.md") also finds
// architecture.md, and one file would be reported under two names.
const TOP_LEVEL = { "": new Set(["architecture.md", "design.md"]), docs: new Set(["architecture.md", "design.md"]) };
const WHOLE_DIRECTORIES = ["docs/architecture", "docs/design"];
const GENERATED = new Set(["constitution.md", "migration-report.md"]);

async function markdownIn(root, directory, accept) {
  try {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && accept(entry.name.toLowerCase()))
      .map((entry) => (directory ? `${directory}/${entry.name}` : entry.name));
  } catch {
    return [];
  }
}

export async function findArchitectureDocuments(root) {
  const found = new Set();
  for (const [directory, names] of Object.entries(TOP_LEVEL)) {
    for (const path of await markdownIn(root, directory, (name) => names.has(name))) found.add(path);
  }
  for (const directory of WHOLE_DIRECTORIES) {
    const accept = (name) => name.endsWith(".md") && !GENERATED.has(name);
    for (const path of await markdownIn(root, directory, accept)) found.add(path);
  }
  for (const path of await listCandidates(root)) found.add(path);
  return [...found].sort();
}
