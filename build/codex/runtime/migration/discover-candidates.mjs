#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CANDIDATES } from "../baseline/build-constitution.mjs";

const ADR_SHAPED = /^(\d{4}-[a-z0-9][a-z0-9-]*\.md|.*adr.*\.md)$/i;

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// A menu, not a decision. Lists filenames shaped like a decision or ADR in
// every known candidate directory. Reads no content and adopts nothing — the
// caller must still get the user to confirm a subset before touching any of
// these paths.
export async function listCandidates(root) {
  const found = [];
  for (const candidate of CANDIDATES) {
    const directory = join(root, candidate);
    if (!(await isDirectory(directory))) continue;
    const entries = await readdir(directory);
    for (const name of entries.filter((entry) => ADR_SHAPED.test(entry)).sort()) {
      found.push(`${candidate}/${name}`);
    }
  }
  return found;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listCandidates(process.cwd())
    .then((found) => {
      if (found.length === 0) {
        process.stderr.write("No candidates found in any known ADR directory.\n");
        return;
      }
      process.stdout.write(`${found.join("\n")}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
