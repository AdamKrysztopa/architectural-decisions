#!/usr/bin/env node

// `arch mode` -- read or set the HUMAN DOCUMENTATION MODE.
//
// This is the verb the documentation-mode requirement asks for: the choice is
// the user's, it is explicit, and it is persisted in a file they can read and
// diff. Nothing infers it, and nothing changes it as a side effect of another
// operation.
//
//   arch mode                                  print the selected mode
//   arch mode adr [--dir docs/architecture/decisions]
//   arch mode living --document docs/architecture/overview.md [--document ...]
//
// Setting `living` requires at least one document, because in that mode the
// document IS the human record: a living mode with no living document would be
// a mode with no record in it.

import { readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CONFIG_FILENAME, MODES, readConfig, resolveProjectPath, writeConfig } from "./config.mjs";
import { resolveRecord } from "./record.mjs";

const USAGE =
  "Usage: arch mode [adr|living] [--dir <path>] [--document <path>]...\n" +
  "\n" +
  "  (no argument)   print the selected documentation mode and where the record lives\n" +
  "  adr             many ADR files are the human record; --dir names their directory\n" +
  "  living          one or several living architecture documents are the human record;\n" +
  "                  --document names each one (repeatable, required)\n";

function parseArgs(argv) {
  const options = { mode: null, dir: null, documents: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (MODES.includes(argument)) {
      if (options.mode) throw new Error(`mode given twice ('${options.mode}' and '${argument}')`);
      options.mode = argument;
    } else if (argument === "--dir") {
      options.dir = argv[index + 1];
      if (!options.dir) throw new Error("--dir needs a path");
      index += 1;
    } else if (argument === "--document") {
      const path = argv[index + 1];
      if (!path) throw new Error("--document needs a path");
      options.documents.push(path);
      index += 1;
    } else {
      throw new Error(`Unknown argument '${argument}'.\n\n${USAGE}`);
    }
  }
  return options;
}

async function report(cwd) {
  const config = await readConfig(cwd);
  const record = await resolveRecord(cwd);
  const lines = [`Documentation mode: ${record.mode}${config.present ? "" : " (default; no arch-crew.json)"}`];

  if (record.mode === "living") {
    lines.push("Human record: living architecture documents");
    for (const path of record.documents) lines.push(`  - ${relative(cwd, path) || path}`);
  } else {
    lines.push("Human record: one ADR file per decision");
    lines.push(`  - ${relative(cwd, record.directory) || record.directory}`);
  }

  lines.push(`Machine rollup: ${relative(cwd, record.rollup) || record.rollup}`);
  lines.push(`Decisions loaded: ${record.decisions.length} (${record.decisions.filter((d) => d.status === "active").length} active)`);
  if (record.errors.length > 0) {
    lines.push("Errors:");
    for (const error of record.errors) lines.push(`  - ${error}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  return record.errors.length > 0 ? 1 : 0;
}

export async function run(argv, cwd = process.cwd()) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  if (!options.mode) {
    if (options.dir || options.documents.length > 0) {
      process.stderr.write(`--dir and --document only mean something with a mode.\n\n${USAGE}`);
      return 1;
    }
    return report(cwd);
  }

  if (options.mode === "living" && options.documents.length === 0) {
    process.stderr.write(
      "Selecting 'living' needs at least one --document: in this mode the document is the human record.\n",
    );
    return 1;
  }
  if (options.mode === "adr" && options.documents.length > 0) {
    process.stderr.write("--document only means something in 'living' mode.\n");
    return 1;
  }
  if (options.mode === "living" && options.dir) {
    process.stderr.write("--dir only means something in 'adr' mode.\n");
    return 1;
  }

  // A living document that does not exist is refused here rather than accepted
  // and reported as an error by every later command. Switching modes is the one
  // moment the user is looking at this decision.
  for (const path of options.documents) {
    const resolved = resolveProjectPath(cwd, path, "--document");
    try {
      if (!(await stat(resolved)).isFile()) throw new Error("not a file");
      await readFile(resolved, "utf8");
    } catch {
      process.stderr.write(`No living architecture document at ${path}\n`);
      return 1;
    }
  }

  const documentation = { mode: options.mode };
  if (options.mode === "living") {
    documentation.documents = options.documents;
  } else if (options.dir) {
    documentation.decisions = options.dir;
  }

  try {
    await writeConfig(cwd, { documentation });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  process.stdout.write(`Documentation mode set to '${options.mode}' in ${CONFIG_FILENAME}.\n`);
  return report(cwd);
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
