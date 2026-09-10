#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CANDIDATES } from "../baseline/build-constitution.mjs";

// Nothing here is a filename *shape* test. An earlier version accepted only
// `NNNN-slug.md` (four digits) or a name containing "adr", which silently hid
// a whole three-digit ADR set: the directory was found, every file in it was
// skipped, and the empty result was indistinguishable from a repository that
// genuinely records nothing. Since listing is not adopting -- the caller must
// still get a human to confirm a subset -- a wider menu costs nothing and a
// narrower one loses the user's decisions.
//
// So: every `*.md` in a known ADR directory, minus the handful of names that
// live in such a directory without ever being a decision. Excluded by NAME,
// never by shape.
const NOT_A_CANDIDATE = new Set(["constitution.md", "migration-report.md", "readme.md", "template.md"]);

function isCandidate(entry) {
  if (!entry.isFile()) return false;
  const name = entry.name.toLowerCase();
  return name.endsWith(".md") && !NOT_A_CANDIDATE.has(name);
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// A menu, not a decision. Lists every Markdown file in every known candidate
// directory that is not one of the known non-decision names. Reads no content
// and adopts nothing: the caller must still get the user to confirm a subset
// before touching any of these paths.
export async function listCandidates(root) {
  const found = [];
  for (const candidate of CANDIDATES) {
    const directory = join(root, candidate);
    if (!(await isDirectory(directory))) continue;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const name of entries.filter(isCandidate).map((entry) => entry.name).sort()) {
      found.push(`${candidate}/${name}`);
    }
  }
  return found;
}

// The `run(argv, cwd)` shape every other CLI in this package exports, so one
// dispatcher can delegate to all of them without special-casing this one.
// "No candidates" exits 0, not 1: an empty repository is a correct answer to
// this question, not a failure of it. A caller distinguishes the two cases by
// stdout being empty, and test/migration.test.mjs pins that contract.
export async function run(argv, cwd = process.cwd()) {
  let root = cwd;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") {
      root = isAbsolute(argv[index + 1]) ? argv[index + 1] : resolve(cwd, argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument '${argv[index]}'. Usage: discover-candidates.mjs [--root <path>]`);
    }
  }

  const found = await listCandidates(root);
  if (found.length === 0) {
    process.stderr.write("No candidates found in any known ADR directory.\n");
    return 0;
  }
  process.stdout.write(`${found.join("\n")}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
