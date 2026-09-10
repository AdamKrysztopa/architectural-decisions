import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skillsRoot = join(repositoryRoot, "skills");

async function skillNames() {
  return (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// The canonical "finding" definition every SKILL.md body states verbatim, so
// the word never means something different depending on which skill is
// loaded (see shared/observing-drift.md and skills/threat-model/references/
// evidence.md for how the classes that build on it — violation, review
// finding, assumption — stay distinct without re-defining "finding" itself).
const FINDING_DEFINITION =
  "A finding is a specific, actionable conclusion — what's wrong, where, why it matters, and the\n" +
  "fix — never a bare impression, and never a substitute for a tool's own verified result (a\n" +
  "violation, reported on its own).";

test("every skill's Mode B is named the same way", async () => {
  for (const name of await skillNames()) {
    const text = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
    const match = /^## Mode B — (.+)$/m.exec(text);
    assert.ok(match, `${name}/SKILL.md has no '## Mode B' heading`);
    assert.ok(
      match[1].startsWith("Refactoring:"),
      `${name}/SKILL.md's Mode B is named '${match[1]}', not the shared 'Refactoring:' convention`,
    );
  }
});

test("every skill's SKILL.md body states the same definition of 'finding'", async () => {
  for (const name of await skillNames()) {
    const text = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
    assert.ok(
      text.includes(FINDING_DEFINITION),
      `${name}/SKILL.md does not contain the shared, verbatim 'finding' definition`,
    );
  }
});
