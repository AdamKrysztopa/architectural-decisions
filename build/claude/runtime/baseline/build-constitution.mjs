#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decisionFilenames, loadDecisions, parseDecision } from "./decisions.mjs";
import { renderConstitution } from "./constitution.mjs";
import { promoteInDocument } from "./living.mjs";
import { resolveRecord } from "./record.mjs";
import { writeAtomically } from "./write-atomically.mjs";

export const CANDIDATES = ["docs/adr", "docs/architecture/decisions", "doc/adr", "adr"];
const DEFAULT_DIRECTORY = "docs/architecture/decisions";

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// Empty when the directory is missing or empty -- decisions.mjs's
// decisionFilenames() throws on a missing directory, but discovery only ever
// calls this on a directory it already confirmed exists via isDirectory, and
// an existing-but-empty directory is a real, distinguishable case here.
async function existingDecisionFilenames(path) {
  try {
    return await decisionFilenames(path);
  } catch {
    return [];
  }
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
    for (const name of await existingDecisionFilenames(path)) {
      try {
        parseDecision(await readFile(join(path, name), "utf8"), name);
        return path;
      } catch {
        // This file doesn't parse; keep looking within this directory, then move on.
      }
    }
  }

  for (const path of existing) {
    if ((await existingDecisionFilenames(path)).length > 0) return path;
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

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  // The rollup is MACHINE ENFORCEMENT METADATA and is generated identically in
  // both documentation modes. What changes is only where the decisions were
  // read from: separate ADR files, or the sections of a living architecture
  // document. Nothing below this line knows which.
  const { decisions, errors, mode, directory, rollup, missingDirectory } = await resolveRecord(cwd, { dir: options.dir });

  if (missingDirectory) {
    process.stderr.write(`No decisions directory at ${directory}\n`);
    return 1;
  }

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }

  const rendered = renderConstitution(decisions, { mode });
  const target = rollup;

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

export function promoteStatusLine(text, id, filename) {
  const lines = text.split("\n");
  if (lines[0] !== "---") throw new Error(`${filename}: not a decision file (no frontmatter)`);
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new Error(`${filename}: frontmatter never closes`);

  for (let index = 1; index < close; index += 1) {
    const match = /^status:\s*(.+)$/.exec(lines[index]);
    if (!match) continue;
    const current = match[1].trim();
    if (current === "active") throw new Error(`${filename}: decision ${id} is already active`);
    if (current === "superseded") throw new Error(`${filename}: decision ${id} is superseded and cannot be promoted`);
    lines[index] = "status: active";
    return lines.join("\n");
  }
  throw new Error(`${filename}: frontmatter has no 'status' field`);
}

// Two-phase for the same reason the `adr` path is: every requested id is
// resolved and checked against the documents as they sit on disk before any
// document is written, so a second id's failure never leaves the first one
// flipped.
async function promoteInLiving(record, ids) {
  const edits = new Map();
  const promoted = [];

  for (const id of ids) {
    let done = false;
    for (const path of record.documents) {
      const text = edits.get(path) ?? (await readFile(path, "utf8"));
      let next;
      try {
        next = promoteInDocument(text, id, path);
      } catch (error) {
        process.stderr.write(`${error.message}\n`);
        return 1;
      }
      if (next === null) continue;
      edits.set(path, next);
      promoted.push({ id, path });
      done = true;
      break;
    }
    if (!done) {
      process.stderr.write(
        `No decision numbered ${String(id).padStart(4, "0")} in ${record.documents.join(", ")}\n`,
      );
      return 1;
    }
  }

  for (const [path, text] of edits) await writeAtomically(path, text);
  for (const { id, path } of promoted) {
    process.stdout.write(`Promoted ${String(id).padStart(4, "0")} to active in ${path}\n`);
  }
  process.stdout.write("Regenerate the rollup: arch constitution\n");
  return 0;
}

export async function runPromote(argv, cwd = process.cwd()) {
  const ids = [];
  let dir = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dir") {
      dir = argv[index + 1];
      if (!dir) throw new Error("--dir needs a path");
      index += 1;
    } else if (/^\d+$/.test(argv[index])) {
      ids.push(Number(argv[index]));
    } else {
      throw new Error(`Unknown promote argument '${argv[index]}'`);
    }
  }
  if (ids.length === 0) throw new Error("promote needs at least one decision id, e.g. 'promote 0007 0009'");

  // In `living` mode the decision is a section of a living architecture
  // document, not a file of its own. Promotion is the same explicit human act
  // in both modes -- and it is the act the reviewer's "authoritative only after
  // explicit human approval" requirement names -- so it is available in both.
  if (!dir) {
    const record = await resolveRecord(cwd);
    if (record.mode === "living") return promoteInLiving(record, ids);
  }

  const directory = dir
    ? (isAbsolute(dir) ? dir : resolve(cwd, dir))
    : await discoverDirectory(cwd);
  if (!(await isDirectory(directory))) {
    process.stderr.write(`No decisions directory at ${directory}\n`);
    return 1;
  }

  // Sorted so which file "wins" an id collision is never filesystem-order
  // dependent, and collected (not overwritten) so a duplicate NNNN prefix is
  // refused up front instead of silently mutating whichever file readdir
  // happened to list first.
  const names = await decisionFilenames(directory);
  const byId = new Map();
  const collisions = new Map();
  for (const name of names) {
    const match = /^(\d{4})-/.exec(name);
    if (!match) continue;
    const id = Number(match[1]);
    if (byId.has(id)) {
      collisions.set(id, [...(collisions.get(id) ?? [byId.get(id)]), name]);
    } else {
      byId.set(id, name);
    }
  }
  if (collisions.size > 0) {
    for (const [id, declaredBy] of collisions) {
      process.stderr.write(
        `decision ${String(id).padStart(4, "0")} is declared by both ${declaredBy.join(" and ")}\n`,
      );
    }
    return 1;
  }

  // Two-phase: validate every requested id against the file as it currently
  // sits on disk, writing nothing yet. Only once every id in this invocation
  // is known-promotable do we write any of them — so a later id's failure
  // (already active, superseded, unknown) never leaves an earlier id flipped
  // on disk while the run reports failure.
  const planned = [];
  for (const id of ids) {
    const name = byId.get(id);
    if (!name) {
      process.stderr.write(`No decision numbered ${String(id).padStart(4, "0")} in ${directory}\n`);
      return 1;
    }
    const path = join(directory, name);
    let updated;
    try {
      updated = promoteStatusLine(await readFile(path, "utf8"), id, name);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    planned.push({ path, updated });
  }

  for (const { path, updated } of planned) {
    await writeAtomically(path, updated);
  }

  const { decisions, errors } = await loadDecisions(directory);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }
  const target = join(dirname(directory), "constitution.md");
  await writeAtomically(target, renderConstitution(decisions));
  process.stdout.write(`Promoted ${ids.map((id) => String(id).padStart(4, "0")).join(", ")}; wrote ${target}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const invocation = argv[0] === "promote" ? runPromote(argv.slice(1)) : run(argv);
  invocation
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
