#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDecision, validateDecisions } from "./decisions.mjs";
import { renderConstitution } from "./constitution.mjs";

const CANDIDATES = ["docs/adr", "docs/architecture/decisions", "doc/adr", "adr"];
const DEFAULT_DIRECTORY = "docs/architecture/decisions";
const DECISION_FILENAME = /^\d{4}-[a-z0-9][a-z0-9-]*\.md$/;

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// Filenames in `path` shaped like a decision file (NNNN-slug.md), regardless of
// whether their contents parse. Empty when the directory is missing or empty.
async function decisionFilenames(path) {
  let entries;
  try {
    entries = await readdir(path);
  } catch {
    return [];
  }
  return entries.filter((name) => DECISION_FILENAME.test(name)).sort();
}

// Discovery favors a directory that actually holds schema decisions over one that
// merely exists, so a legacy prose ADR directory (same NNNN-slug.md filename shape,
// no schema frontmatter) does not shadow a real `docs/architecture/decisions/`.
// 1. First existing CANDIDATES directory holding at least one file that PARSES.
// 2. Else, first existing CANDIDATES directory holding at least one NNNN-slug.md
//    file at all — even if every one of them fails to parse, so that failure stays
//    loud instead of silently falling through to an empty default.
// 3. Else, the default directory.
export async function discoverDirectory(root) {
  const existing = [];
  for (const candidate of CANDIDATES) {
    const path = join(root, candidate);
    if (await isDirectory(path)) existing.push(path);
  }

  for (const path of existing) {
    for (const name of await decisionFilenames(path)) {
      try {
        parseDecision(await readFile(join(path, name), "utf8"), name);
        return path;
      } catch {
        // This file doesn't parse; keep looking within this directory, then move on.
      }
    }
  }

  for (const path of existing) {
    if ((await decisionFilenames(path)).length > 0) return path;
  }

  return join(root, DEFAULT_DIRECTORY);
}

function parseArgs(argv) {
  const options = { check: false, dir: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--check") {
      options.check = true;
    } else if (argv[index] === "--dir") {
      options.dir = argv[index + 1];
      if (!options.dir) throw new Error("--dir needs a path");
      index += 1;
    } else {
      throw new Error(`Unknown argument '${argv[index]}'. Usage: build-constitution.mjs [--dir <path>] [--check]`);
    }
  }
  return options;
}

async function loadDecisions(directory) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".md") && name !== "constitution.md")
    .sort();

  const decisions = [];
  const errors = [];
  for (const name of names) {
    try {
      decisions.push(parseDecision(await readFile(join(directory, name), "utf8"), name));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { decisions, errors: [...errors, ...validateDecisions(decisions)] };
}

async function writeAtomically(path, contents) {
  const temporary = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  const directory = options.dir
    ? (isAbsolute(options.dir) ? options.dir : resolve(cwd, options.dir))
    : await discoverDirectory(cwd);

  if (!(await isDirectory(directory))) {
    process.stderr.write(`No decisions directory at ${directory}\n`);
    return 1;
  }

  const { decisions, errors } = await loadDecisions(directory);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }

  const rendered = renderConstitution(decisions);
  const target = join(dirname(directory), "constitution.md");

  if (options.check) {
    let current = null;
    try {
      current = await readFile(target, "utf8");
    } catch {
      process.stderr.write(`${target} does not exist; run without --check to generate it\n`);
      return 2;
    }
    if (current !== rendered) {
      process.stderr.write(`${target} is stale; run without --check to regenerate it\n`);
      return 2;
    }
    return 0;
  }

  await writeAtomically(target, rendered);
  process.stdout.write(`Wrote ${target} (${decisions.filter((d) => d.status === "active").length} active decisions)\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
