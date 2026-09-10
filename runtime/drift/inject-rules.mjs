#!/usr/bin/env node

// SessionStart hook. Prints the active rule list so a session starts knowing the
// baseline. This is an optimisation, not the mechanism: `shared/recording-decisions.md`
// section 1 already tells every skill to read the same file, and that path works on
// every host. SessionStart adds plain stdout to the model's context, so no JSON
// envelope is built -- one less way to fail schema validation.

import { readFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { resolveRecord } from "../baseline/record.mjs";
import { queueDirectory, resolveRoot } from "./queue.mjs";

// SessionStart output shares the 10,000-character cap on hook output strings.
const BUDGET = 7000;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// build-constitution.mjs is the one module that writes constitution.md, always
// beside whichever decisions directory discoverDirectory resolves to (see its
// own `run()`: `join(dirname(directory), "constitution.md")`). Deriving this
// hook's path from that same function, rather than maintaining a private list
// of candidate locations, is what keeps the two in agreement: a private list
// here previously named two paths the generator never writes to and omitted
// two of the four layouts the generator actually supports (`docs/adr` and
// `doc/adr`, whose rollup lands at `docs/constitution.md` and
// `doc/constitution.md` respectively -- one directory up from the decisions
// directory, not beside it).
async function findConstitution(root) {
  // Via the mode-aware seam, so the injected rules follow the rollup wherever
  // the selected documentation mode puts it -- beside the decisions directory
  // in `adr` mode, beside the living document in `living` mode.
  const { rollup: path } = await resolveRecord(root);
  try {
    if ((await stat(path)).isFile()) return { path, relative: relative(root, path) };
  } catch {
    // No constitution at the resolved location.
  }
  return null;
}

// Everything between "## Rules" and the next level-2 heading. If the heading is
// absent the section is null and the caller falls back to a pointer -- it never
// guesses at the file's structure.
export function extractRules(text) {
  const start = text.indexOf("\n## Rules\n");
  if (start === -1) return null;
  const body = text.slice(start + "\n## Rules\n".length);
  const end = body.search(/\n## /);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

function truncate(section) {
  if (section.length <= BUDGET) return section;
  const cut = section.lastIndexOf("\n### ", BUDGET);
  const kept = section.slice(0, cut === -1 ? BUDGET : cut).trimEnd();
  const shown = (kept.match(/^### /gm) ?? []).length;
  const total = (section.match(/^### /gm) ?? []).length;
  return `${kept}\n\n… ${total - shown} more rules not shown; read the constitution for the rest.`;
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    // A hook that cannot read its input still injects from the resolved root.
  }

  const root = resolveRoot(process.env, input, process.cwd());
  try {
    await mkdir(queueDirectory(root), { recursive: true });
  } catch {
    // Injection does not depend on the queue directory existing.
  }

  const found = await findConstitution(root);
  if (!found) {
    process.stdout.write(
      "arch-crew: this repository has no architecture constitution yet. Run the generator that ships with the plugin — runtime/baseline/build-constitution.mjs — after a decision is recorded.\n",
    );
    return;
  }

  const text = await readFile(found.path, "utf8");
  const section = extractRules(text);
  if (!section) {
    process.stdout.write(
      `arch-crew: ${found.relative} exists but carries no '## Rules' section. Read it directly before recommending.\n`,
    );
    return;
  }

  process.stdout.write(
    [
      `arch-crew — active architectural rules, from ${found.relative}:`,
      "",
      truncate(section),
      "",
      "These are the rules already in force. Do not re-litigate a recorded decision; supersede it instead.",
      "Freshness is not asserted here: run build-constitution.mjs --check to confirm the rollup matches its decision files.",
      "",
    ].join("\n"),
  );
}

main().catch(() => {}).finally(() => {
  process.exitCode = 0;
});
