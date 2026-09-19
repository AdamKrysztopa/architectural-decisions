import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

import { locateRecord, canClassify, resolveRecord } from "../runtime/baseline/record.mjs";
import { appendObservation, countObservations, readNotifiedCount, writeNotifiedCount } from "../runtime/drift/queue.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const drainCli = join(repositoryRoot, "runtime/drift/drift.mjs");
const hook = (name) => join(repositoryRoot, "runtime/drift", name);

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-crew-no-record-"));
}

async function runHook(name, root, stdin) {
  const child = execFileAsync(process.execPath, [hook(name)], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
  child.child.stdin.end(stdin ?? JSON.stringify({ cwd: root }));
  try {
    return { code: 0, stdout: (await child).stdout };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "" };
  }
}

async function drain(root, args = []) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [drainCli, "drain", "--root", root, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

const DECISION = `---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-01
commit: fixture0
rules:
  - id: no-shared-tables
    statement: A service never writes another service's tables.
    scope: ["services/**"]
    severity: blocking
    verification: review
---

# 0001 Services own their data
`;

async function recordDecision(root) {
  await mkdir(join(root, "docs/architecture/decisions"), { recursive: true });
  await writeFile(join(root, "docs/architecture/decisions/0001-services-own-data.md"), DECISION, "utf8");
}

test("drain with no decisions directory exits 0, marks the record absent, and names the seeding step", async () => {
  const root = await scratch();
  await appendObservation(root, { t: "2026-09-19T00:00:00Z", path: "src/app.py", tool: "Edit" });
  await writeNotifiedCount(root, 1);

  const result = await drain(root, ["--json"]);
  assert.equal(result.code, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.record, "absent");
  assert.deepEqual(packet.rules, []);
  assert.deepEqual(packet.documents, []);
  assert.match(packet.nextStep, /first decision/);
  assert.match(packet.nextStep, /\/arch-crew:help/);
  assert.deepEqual(packet.paths.map((entry) => entry.path), ["src/app.py"]);

  assert.equal(await countObservations(root), 0, "the queue must be consumed");
  assert.equal(await readNotifiedCount(root), 0, "last-notified must be cleared");
  assert.deepEqual(await readdir(join(root, ".arch-crew")), []);
});

test("drain with no decisions directory, without --json, prints the next step instead of a packet", async () => {
  const root = await scratch();
  const result = await drain(root);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /no active rules/i);
  assert.match(result.stdout, /\/arch-crew:help/);
});

test("drain with an explicit --dir that does not exist is still a hard error", async () => {
  const root = await scratch();
  const result = await drain(root, ["--dir", "no/such/directory", "--json"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /No decisions directory at/);
});

test("drain with a malformed decision file is still a hard error", async () => {
  const root = await scratch();
  await mkdir(join(root, "docs/architecture/decisions"), { recursive: true });
  await writeFile(join(root, "docs/architecture/decisions/0001-broken.md"), "---\nid: 1\n---\n", "utf8");
  const result = await drain(root, ["--json"]);
  assert.equal(result.code, 1);
});

test("drain with no decision record reads the architecture documents it finds instead", async () => {
  const root = await scratch();
  await writeFile(join(root, "ARCHITECTURE.md"), "# Architecture\n", "utf8");
  await mkdir(join(root, "docs/adr"), { recursive: true });
  await writeFile(join(root, "docs/adr/use-postgres.md"), "# Use Postgres\n", "utf8");
  await appendObservation(root, { t: "2026-09-19T00:00:00Z", path: "ARCHITECTURE.md", tool: "Edit" });

  const result = await drain(root, ["--json"]);
  assert.equal(result.code, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.record, "absent");
  assert.deepEqual(
    packet.documents.map(({ path, edited }) => ({ path, edited })),
    [
      { path: "ARCHITECTURE.md", edited: true },
      { path: "docs/adr/use-postgres.md", edited: false },
    ],
  );
  for (const document of packet.documents) assert.equal(document.judgement, "review");
  assert.match(packet.nextStep, /\/arch-crew:sources/);
  assert.match(packet.nextStep, /\/arch-crew:migrate/);
  assert.doesNotMatch(packet.nextStep, /first decision/);
});

test("drain with no decision record still reports designated sources, and does not list them twice", async () => {
  const root = await scratch();
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/architecture.md"), "# Architecture\n", "utf8");
  await writeFile(
    join(root, "arch-crew.json"),
    JSON.stringify({
      sources: [{ id: "arch", kind: "architecture-document", path: "docs/architecture.md", scope: ["src/**"] }],
    }),
    "utf8",
  );
  await appendObservation(root, { t: "2026-09-19T00:00:00Z", path: "src/app.py", tool: "Edit" });

  const result = await drain(root, ["--json"]);
  assert.equal(result.code, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.record, "absent");
  assert.deepEqual(packet.sources.map((source) => source.id), ["arch"]);
  assert.deepEqual(packet.sources[0].governs, ["src/app.py"]);
  assert.deepEqual(packet.documents, [], "a designated document is a source, not a discovered one");
});

test("drain with a decision record marks it present and carries no next step", async () => {
  const root = await scratch();
  await recordDecision(root);
  const result = await drain(root, ["--json"]);
  assert.equal(result.code, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.record, "present");
  assert.deepEqual(packet.documents, []);
  assert.equal(packet.nextStep, null);
});

test("locateRecord names the same place resolveRecord reads, without loading it", async () => {
  const empty = await scratch();
  assert.equal((await locateRecord(empty)).directory, (await resolveRecord(empty)).directory);
  assert.equal(await canClassify(empty), false);

  const recorded = await scratch();
  await recordDecision(recorded);
  assert.equal((await locateRecord(recorded)).directory, (await resolveRecord(recorded)).directory);
  assert.equal(await canClassify(recorded), true);

  const designated = await scratch();
  await writeFile(
    join(designated, "arch-crew.json"),
    JSON.stringify({ sources: [{ id: "arch", kind: "architecture-document", path: "ARCHITECTURE.md" }] }),
    "utf8",
  );
  assert.equal(await canClassify(designated), true, "a designated source is something to read against");
});

test("the stop hook does not suggest /arch-crew:drift when there is nothing to classify against", async () => {
  const root = await scratch();
  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });
  const result = await runHook("notify.mjs", root);
  assert.equal(result.code, 0);
  assert.doesNotMatch(result.stdout, /Run \/arch-crew:drift/);
  assert.equal(result.stdout.trim(), "");
});

test("the stop hook suggests /arch-crew:drift, deduped, once a decision is recorded", async () => {
  const root = await scratch();
  await recordDecision(root);
  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });

  const first = await runHook("notify.mjs", root);
  assert.equal(first.code, 0);
  assert.match(JSON.parse(first.stdout).systemMessage, /Run \/arch-crew:drift/);

  const second = await runHook("notify.mjs", root);
  assert.equal(second.stdout.trim(), "");
});

test("end to end: observe, notify and drain in a repository with no decisions never fail and never mislead", async () => {
  const root = await scratch();
  await mkdir(join(root, "src"), { recursive: true });

  for (const file of ["src/app.py", "src/db.py"]) {
    const observed = await runHook(
      "observe.mjs",
      root,
      JSON.stringify({ cwd: root, tool_name: "Write", tool_input: { file_path: join(root, file) } }),
    );
    assert.equal(observed.code, 0);
  }

  const stop = await runHook("notify.mjs", root);
  assert.equal(stop.code, 0);
  assert.doesNotMatch(stop.stdout, /\/arch-crew:drift/, "never invite a command with nothing to classify against");

  const drained = await drain(root, ["--json"]);
  assert.equal(drained.code, 0, drained.stderr);
  assert.equal(JSON.parse(drained.stdout).record, "absent");

  const again = await runHook("notify.mjs", root);
  assert.equal(again.code, 0);
  assert.equal(again.stdout.trim(), "", "a drained queue leaves nothing to announce");

  await recordDecision(root);
  await runHook(
    "observe.mjs",
    root,
    JSON.stringify({ cwd: root, tool_name: "Edit", tool_input: { file_path: join(root, "src/app.py") } }),
  );
  const invited = await runHook("notify.mjs", root);
  assert.match(JSON.parse(invited.stdout).systemMessage, /Run \/arch-crew:drift/);
  const followed = await drain(root, ["--json"]);
  assert.equal(followed.code, 0, "the invited command must succeed");
  assert.equal(JSON.parse(followed.stdout).record, "present");
});
