import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { cleanup, cloneFixture, repositoryRoot } from "./e2e/support.mjs";

const execFileAsync = promisify(execFile);
const constitutionCli = join(repositoryRoot, "runtime/baseline/build-constitution.mjs");
const clones = [];
after(async () => { await Promise.all(clones.map(cleanup)); });

async function proposedRepo() {
  const dir = await cloneFixture("decisions"); // reuses test/fixtures/decisions from Task-1-era baseline tests
  clones.push(dir);
  const decisionsDir = join(dir, "docs/architecture/decisions");
  await mkdir(decisionsDir, { recursive: true });
  await writeFile(
    join(decisionsDir, "0010-proposed-only.md"),
    [
      "---",
      "id: 0010",
      "status: proposed",
      "skill: decide-architecture",
      "date: 2026-09-09",
      "commit: ddddddd",
      "rules:",
      "  - id: only-visible-once-promoted",
      "    statement: Nothing about this rule is active until a human promotes it.",
      "    severity: warning",
      "    verification: narrative",
      "---",
      "# A proposed-only decision",
      "",
      "## Context",
      "## Decision",
      "## Consequences (cost)",
      "",
    ].join("\n"),
  );
  return { dir, decisionsDir };
}

test("a proposed-only corpus renders a constitution with zero of its rules", async () => {
  const { dir, decisionsDir } = await proposedRepo();
  await execFileAsync(process.execPath, [constitutionCli, "--dir", decisionsDir]);
  const rendered = await readFile(join(decisionsDir, "../constitution.md"), "utf8");
  assert.doesNotMatch(rendered, /only-visible-once-promoted/);
});

test("promote flips exactly the named ids and regenerates", async () => {
  const { dir, decisionsDir } = await proposedRepo();
  await execFileAsync(process.execPath, [constitutionCli, "promote", "0010", "--dir", decisionsDir]);
  const rendered = await readFile(join(decisionsDir, "../constitution.md"), "utf8");
  assert.match(rendered, /only-visible-once-promoted/);
  const decisionText = await readFile(join(decisionsDir, "0010-proposed-only.md"), "utf8");
  assert.match(decisionText, /status: active/);
});

test("promoting an unknown id fails loudly and writes nothing", async () => {
  const { dir, decisionsDir } = await proposedRepo();
  const before = await readFile(join(decisionsDir, "0010-proposed-only.md"), "utf8");
  await assert.rejects(
    execFileAsync(process.execPath, [constitutionCli, "promote", "9999", "--dir", decisionsDir]),
  );
  const after = await readFile(join(decisionsDir, "0010-proposed-only.md"), "utf8");
  assert.equal(after, before);
});

// The plan's literal version of this test called promote on an already-active id
// a second time and expected it to succeed as a silent no-op. The shipped SP4
// runtime does not behave that way: `promoteStatusLine` explicitly throws
// "decision {id} is already active" (runtime/baseline/build-constitution.mjs),
// and `test/baseline.test.mjs` already has a passing, committed test asserting
// exactly that ("promoteStatusLine refuses an already-active decision", added
// with the SP4 migration work). Re-promoting therefore fails loudly (exit 1,
// nothing written) rather than no-opping silently. Changing that would mean
// re-implementing already-shipped SP4 behavior, which this sub-project's own
// constraint (D5: no new runtime/ code; reuse SP2-SP5 modules, don't
// re-implement them) forbids. The test below is adjusted to assert the actual,
// still-safe guarantee: a repeat promote cannot duplicate the rule in the
// rendered constitution, because it is refused before it writes anything.
test("promoting an already-active id fails loudly, not silently duplicating the rule", async () => {
  const { dir, decisionsDir } = await proposedRepo();
  await execFileAsync(process.execPath, [constitutionCli, "promote", "0010", "--dir", decisionsDir]);
  await assert.rejects(
    execFileAsync(process.execPath, [constitutionCli, "promote", "0010", "--dir", decisionsDir]),
  );
  const rendered = await readFile(join(decisionsDir, "../constitution.md"), "utf8");
  const occurrences = rendered.match(/only-visible-once-promoted/g) ?? [];
  assert.equal(occurrences.length, 1);
});

test("a hand-edited status: active is not mechanically blocked — documented limitation, not a bug", async () => {
  const { dir, decisionsDir } = await proposedRepo();
  const path = join(decisionsDir, "0010-proposed-only.md");
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace("status: proposed", "status: active"));
  await execFileAsync(process.execPath, [constitutionCli, "--dir", decisionsDir]);
  const rendered = await readFile(join(decisionsDir, "../constitution.md"), "utf8");
  // This assertion documents the boundary, it does not celebrate it: nothing in
  // the runtime distinguishes a promote-produced 'active' from a hand-edited one.
  assert.match(rendered, /only-visible-once-promoted/);
});
