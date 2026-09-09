#!/usr/bin/env node

import { copyFile, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = [
  { source: "shared/recording-decisions.md", reference: "recording-decisions.md" },
  { source: "shared/observing-drift.md", reference: "observing-drift.md" },
];

async function skillNames() {
  return (await readdir(join(repositoryRoot, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function syncShared({ check = false } = {}) {
  const names = await skillNames();
  const drifted = [];

  for (const { source, reference } of SHARED) {
    const sourcePath = join(repositoryRoot, source);
    const contents = await readFile(sourcePath);
    for (const name of names) {
      const destination = join(repositoryRoot, "skills", name, "references", reference);
      let current = null;
      try {
        current = await readFile(destination);
      } catch {
        current = null;
      }
      if (current !== null && current.equals(contents)) continue;
      drifted.push(destination);
      if (!check) await copyFile(sourcePath, destination);
    }
  }

  return drifted;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  syncShared({ check })
    .then((drifted) => {
      if (check && drifted.length > 0) {
        process.stderr.write(`Shared references are out of sync:\n${drifted.join("\n")}\n`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(check ? "Shared references are in sync\n" : `Synced ${drifted.length} file(s)\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
