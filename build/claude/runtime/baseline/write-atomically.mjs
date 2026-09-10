import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Write-temp-then-rename: a reader never observes a half-written file, and a
// process that dies mid-write leaves only an orphaned `.tmp` file behind,
// never a corrupt `path`. Shared by build-constitution.mjs and
// build-migration-report.mjs, the two callers that persist a generated file.
export async function writeAtomically(path, contents) {
  const temporary = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}
