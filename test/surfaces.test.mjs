import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { helpText, run as arch, verbs } from "../runtime/arch.mjs";
import { constitutionIsStale } from "../runtime/drift/staleness.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const archScript = join(repositoryRoot, "runtime/arch.mjs");

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-surfaces-"));
}

// A decision whose one rule is narrative, so nothing here depends on a
// third-party binary being installed.
const DECISION = `---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-10
commit: 0000000
rules:
  - id: services-own-their-tables
    statement: A service owns its own tables; no other service reads them directly.
    scope: ["src/**"]
    severity: blocking
    verification: narrative
---

# Services own their own tables

## Context
One database, several services.

## Decision
Each service owns its tables.

## Consequences (cost)
Cross-service reads become calls.
`;

async function seedDecisions(root) {
  const directory = join(root, "docs/architecture/decisions");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "0001-services-own-their-tables.md"), DECISION, "utf8");
  return directory;
}

test("every verb the dispatcher advertises resolves to a real delegate", async () => {
  assert.deepEqual(
    [...verbs].sort(),
    ["candidates", "check", "constitution", "drift", "migrate", "promote"].sort(),
  );
  for (const verb of verbs) {
    assert.match(helpText(), new RegExp(`\\n  ${verb}\\b`), `${verb} is missing from --help`);
    const { stdout, code } = await execFileAsync("node", [archScript, verb, "--help"])
      .then((r) => ({ ...r, code: 0 }))
      .catch((error) => ({ stdout: error.stdout ?? "", code: error.code }));
    assert.equal(code, 0, `arch ${verb} --help exited ${code}`);
    assert.match(stdout, /^Usage: arch /, `arch ${verb} --help printed no usage`);
  }
});

test("the dispatcher passes the underlying exit code through unchanged", async () => {
  const root = await scratch();
  await seedDecisions(root);

  // 0: the constitution does not exist yet, so generating it succeeds.
  assert.equal(await arch(["constitution"], root), 0);
  // 0: and it is now current.
  assert.equal(await arch(["constitution", "--check"], root), 0);

  // 2 is `check`'s "stale" code, and the whole reason the dispatcher must not
  // flatten exit codes: a wrapper returning 1 here would disarm a CI gate.
  await writeFile(join(root, "docs/architecture/constitution.md"), "stale\n", "utf8");
  assert.equal(await arch(["constitution", "--check"], root), 2);
});

test("an unknown verb fails without running anything, and bare arch prints help", async () => {
  const root = await scratch();
  assert.equal(await arch(["definitely-not-a-verb"], root), 1);
  assert.equal(await arch([], root), 1);
  assert.equal(await arch(["--help"], root), 0);
});

test("staleness is read-only: it reports drift and never repairs it", async () => {
  const root = await scratch();
  await seedDecisions(root);
  await arch(["constitution"], root);

  const target = join(root, "docs/architecture/constitution.md");
  const generated = await readFile(target, "utf8");
  assert.equal(await constitutionIsStale(root), false);

  await writeFile(target, `${generated}\nhand-edited\n`, "utf8");
  assert.equal(await constitutionIsStale(root), true);
  // The check must not have rewritten the file it was asked about.
  assert.match(await readFile(target, "utf8"), /hand-edited/);
});

test("staleness answers 'not stale' rather than throwing when there is nothing to compare", async () => {
  const empty = await scratch();
  assert.equal(await constitutionIsStale(empty), false);

  const noConstitution = await scratch();
  await seedDecisions(noConstitution);
  assert.equal(await constitutionIsStale(noConstitution), false);
});

// These two exercise the hook's `input.cwd` lane, which `resolveRoot` reaches
// only when CLAUDE_PROJECT_DIR is absent -- and it is *present* whenever the
// suite is run from inside a Claude Code session, which is where this
// repository is developed. Inheriting it silently pointed the hook at the real
// project root instead of the scratch one. Scrub it here rather than pinning it
// to `root`: root resolution has its own tests in `drift.test.mjs`, and what
// these two are about is what the hook says, not where it looks.
function stopHook(root) {
  const { CLAUDE_PROJECT_DIR: _ignored, ...env } = process.env;
  const child = execFileAsync("node", [join(repositoryRoot, "runtime/drift/notify.mjs")], { cwd: root, env });
  child.child.stdin.end(JSON.stringify({ cwd: root }));
  return child;
}

test("the Stop hook reports a stale constitution alongside the queue notice", async () => {
  const root = await scratch();
  await seedDecisions(root);
  await arch(["constitution"], root);
  await writeFile(join(root, "docs/architecture/constitution.md"), "stale\n", "utf8");

  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(
    join(root, ".arch-crew/drift-queue.jsonl"),
    `${JSON.stringify({ t: "2026-01-01T00:00:00.000Z", path: "src/a.py", tool: "Edit", session: "s" })}\n`,
    "utf8",
  );

  const { stdout } = await stopHook(root);

  const message = JSON.parse(stdout).systemMessage;
  assert.match(message, /1 edit observed/);
  assert.match(message, /constitution is stale/);
  assert.match(message, /\/arch-constitution/);
});

test("the Stop hook stays silent when there is nothing to say", async () => {
  const root = await scratch();
  const { stdout } = await stopHook(root);
  assert.equal(stdout.trim(), "");
});

test("every shipped command names a dispatcher verb that exists", async () => {
  const directory = join(repositoryRoot, "commands");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".md"));
  assert.ok(files.length > 0, "no commands are shipped");

  for (const file of files) {
    const text = await readFile(join(directory, file), "utf8");

    assert.match(text, /^---\n/, `${file} has no frontmatter`);
    assert.match(text, /\ndescription: .+\n/, `${file} declares no description`);

    // Every invocation must go through the dispatcher, so a command cannot
    // drift onto a module path the dispatcher does not know about.
    const invocations = [...text.matchAll(/runtime\/arch\.mjs"\s+(\w[\w-]*)/g)].map((match) => match[1]);
    assert.ok(invocations.length > 0, `${file} invokes no arch verb`);
    for (const verb of invocations) {
      assert.ok(verbs.includes(verb), `${file} invokes unknown verb '${verb}'`);
    }

    assert.doesNotMatch(
      text,
      /node "\$\{CLAUDE_PLUGIN_ROOT\}\/runtime\/(baseline|checkers|drift|migration)\//,
      `${file} bypasses the dispatcher and calls a module directly`,
    );
  }
});

test("the promote command never runs promotion for the user", async () => {
  const text = await readFile(join(repositoryRoot, "commands/arch-promote.md"), "utf8");
  // The `!` prefix executes at expansion time, before the model can decide
  // anything. Promotion is an explicit human act, so it must not be pre-run.
  assert.doesNotMatch(
    text,
    /!`[^`]*arch\.mjs" promote/,
    "arch-promote pre-executes promotion instead of asking first",
  );
  assert.match(text, /explicit human act/i);
});
