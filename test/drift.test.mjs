import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobError, compileGlob, matchesScope } from "../runtime/drift/globs.mjs";

test("a trailing ** matches everything under the prefix", () => {
  const re = compileGlob("services/**", "rule svc");
  assert.ok(re.test("services/billing/db.py"));
  assert.ok(re.test("services/billing"));
  assert.ok(!re.test("libs/billing/db.py"));
});

test("a leading ** matches at any depth, including none", () => {
  const re = compileGlob("**/*.py", "rule py");
  assert.ok(re.test("a/b/c.py"));
  assert.ok(re.test("c.py"));
  assert.ok(!re.test("c.pyi"));
});

test("* stops at a separator and ? matches one character", () => {
  assert.ok(compileGlob("services/*/db.py", "r").test("services/billing/db.py"));
  assert.ok(!compileGlob("services/*/db.py", "r").test("services/a/b/db.py"));
  assert.ok(compileGlob("v?/api.yaml", "r").test("v2/api.yaml"));
});

test("a pattern with no wildcard is a module name matching itself and its subtree", () => {
  const re = compileGlob("libs/a", "rule libs");
  assert.ok(re.test("libs/a"));
  assert.ok(re.test("libs/a/inner.ts"));
  assert.ok(!re.test("libs/ab"));
});

test("an unsupported construct fails, naming the rule and the pattern", () => {
  assert.throws(
    () => compileGlob("services/{a,b}/**", "rule no-shared-db-writes"),
    (error) =>
      error instanceof GlobError &&
      error.pattern === "services/{a,b}/**" &&
      /no-shared-db-writes/.test(error.message),
  );
  assert.throws(() => compileGlob("src/[a-z]*.ts", "r"), GlobError);
  assert.throws(() => compileGlob("!vendor/**", "r"), GlobError);
});

test("** mixed into a segment is rejected rather than guessed at", () => {
  assert.throws(() => compileGlob("services/**py", "r"), GlobError);
});

test("an empty or non-string pattern is rejected", () => {
  assert.throws(() => compileGlob("", "r"), GlobError);
  assert.throws(() => compileGlob(undefined, "r"), GlobError);
  assert.throws(() => compileGlob("services//db.py", "r"), GlobError);
});

test("matchesScope is true when any pattern matches and false for an empty scope", () => {
  assert.ok(matchesScope("services/a.py", ["libs/**", "services/**"], "r"));
  assert.ok(!matchesScope("services/a.py", ["libs/**"], "r"));
  assert.ok(!matchesScope("services/a.py", [], "r"));
});

import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_QUEUE_BYTES,
  MAX_QUEUE_LINES,
  appendObservation,
  countDrainingObservations,
  countObservations,
  discardQueue,
  drainQueue,
  queuePath,
  releaseDrained,
  resolveRoot,
  toRepositoryPath,
} from "../runtime/drift/queue.mjs";

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-crew-drift-"));
}

test("the root prefers CLAUDE_PROJECT_DIR, then the hook input cwd, then process cwd", () => {
  assert.equal(resolveRoot({ CLAUDE_PROJECT_DIR: "/a" }, { cwd: "/b" }, "/c"), "/a");
  assert.equal(resolveRoot({}, { cwd: "/b" }, "/c"), "/b");
  assert.equal(resolveRoot({}, {}, "/c"), "/c");
});

test("a path inside the root is stored repository-relative with forward slashes", () => {
  assert.equal(toRepositoryPath("/repo", "/repo/services/billing/db.py"), "services/billing/db.py");
  assert.equal(toRepositoryPath("/repo", "/elsewhere/x.py"), "/elsewhere/x.py");
});

test("appending creates the queue directory and writes one line per observation", async () => {
  const root = await scratch();
  assert.equal(await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" }), "appended");
  assert.equal(await appendObservation(root, { t: "T2", path: "b.py", tool: "Write" }), "appended");
  const text = await readFile(queuePath(root), "utf8");
  assert.equal(text.split("\n").filter(Boolean).length, 2);
  assert.equal(await countObservations(root), 2);
});

test("at the byte cap the observer appends nothing and says so", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(queuePath(root), "x".repeat(MAX_QUEUE_BYTES), "utf8");
  assert.equal(await appendObservation(root, { t: "T", path: "a.py", tool: "Edit" }), "at-cap");
});

test("draining renames, parses, skips malformed lines, and reports the cap", async () => {
  const root = await scratch();
  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(queuePath(root), '{"t":"T1","path":"a.py","tool":"Edit"}\nnot json\n{"nope":1}\n', "utf8");

  const drained = await drainQueue(root, 4242);
  assert.equal(drained.observations.length, 1);
  assert.equal(drained.malformed, 2);
  assert.equal(drained.atCap, false);
  const [sliceName] = await readdir(join(root, ".arch-crew"));
  assert.match(sliceName, /^drift-queue\.4242-[0-9a-f]{8}\.draining$/);
  assert.deepEqual(drained.names, [sliceName]);

  await releaseDrained(root, drained.names);
  assert.deepEqual(await readdir(join(root, ".arch-crew")), []);
});

test("a .draining file left by a crashed drain is picked up by the next drain", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(
    join(root, ".arch-crew/drift-queue.999.draining"),
    '{"t":"T0","path":"old.py","tool":"Edit"}\n',
    "utf8",
  );
  await appendObservation(root, { t: "T1", path: "new.py", tool: "Edit" });

  const drained = await drainQueue(root, 4243);
  assert.deepEqual(
    drained.observations.map((observation) => observation.path).sort(),
    ["new.py", "old.py"],
  );
});

test("draining an absent queue is empty and not an error", async () => {
  const drained = await drainQueue(await scratch(), 1);
  assert.deepEqual(drained.observations, []);
  assert.equal(drained.malformed, 0);
});

test("discard removes every queue and draining file", async () => {
  const root = await scratch();
  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });
  await discardQueue(root);
  assert.deepEqual(await readdir(join(root, ".arch-crew")), []);
});

test("a slice that vanishes between listing and reading is skipped, not crashed on", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  // A directory matching the .draining name pattern can never be read as a
  // file (EISDIR) -- it stands in for a slice a concurrent drain already
  // unlinked between this drain's readdir and its readFile.
  await mkdir(join(root, ".arch-crew/drift-queue.777.draining"), { recursive: true });
  await appendObservation(root, { t: "T1", path: "new.py", tool: "Edit" });

  const drained = await drainQueue(root, 4244);
  assert.deepEqual(drained.observations.map((observation) => observation.path), ["new.py"]);
  assert.ok(
    !drained.names.includes("drift-queue.777.draining"),
    "an unreadable slice must not be marked as consumed",
  );
});

test("hitting the line cap leaves the unconsumed slice, and everything after it, in place", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  const many = Array.from({ length: MAX_QUEUE_LINES + 1 }, (_, index) =>
    JSON.stringify({ t: `T${index}`, path: `f${index}.py`, tool: "Edit" }),
  ).join("\n");
  await writeFile(join(root, ".arch-crew/drift-queue.100.draining"), `${many}\n`, "utf8");
  await writeFile(
    join(root, ".arch-crew/drift-queue.200.draining"),
    '{"t":"T2","path":"later.py","tool":"Edit"}\n',
    "utf8",
  );

  const drained = await drainQueue(root, 4245);
  assert.equal(drained.observations.length, MAX_QUEUE_LINES);
  assert.equal(drained.truncated, true);
  assert.deepEqual(drained.names, [], "no slice was fully consumed, so none may be released");

  await releaseDrained(root, drained.names);
  assert.deepEqual(
    (await readdir(join(root, ".arch-crew"))).sort(),
    ["drift-queue.100.draining", "drift-queue.200.draining"],
  );
});

test("countObservations includes observations parked in a .draining slice", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(
    join(root, ".arch-crew/drift-queue.stuck.draining"),
    '{"t":"T1","path":"a.py","tool":"Edit"}\n{"t":"T2","path":"b.py","tool":"Edit"}\n',
    "utf8",
  );
  await appendObservation(root, { t: "T3", path: "c.py", tool: "Edit" });

  assert.equal(await countObservations(root), 3);
  assert.deepEqual(await countDrainingObservations(root), { slices: 1, observations: 2 });
});

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const script = (name) => join(repositoryRoot, "runtime/drift", name);

async function runHook(name, stdin, env = {}) {
  const child = execFileAsync(process.execPath, [script(name)], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  child.child.stdin.end(stdin);
  try {
    const { stdout } = await child;
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code ?? 0, stdout: error.stdout ?? "" };
  }
}

test("the observer appends the edited path and exits 0", async () => {
  const root = await scratch();
  const input = JSON.stringify({
    hook_event_name: "PostToolUse",
    session_id: "abc123",
    cwd: root,
    tool_name: "Edit",
    tool_input: { file_path: join(root, "services/billing/db.py") },
  });
  const result = await runHook("observe.mjs", input, { CLAUDE_PROJECT_DIR: root });
  assert.equal(result.code, 0);
  const [line] = (await readFile(queuePath(root), "utf8")).split("\n");
  const observation = JSON.parse(line);
  assert.equal(observation.path, "services/billing/db.py");
  assert.equal(observation.tool, "Edit");
  assert.equal(observation.session, "abc123");
  assert.ok(typeof observation.t === "string" && observation.t.endsWith("Z"));
});

test("the observer exits 0 and writes nothing on malformed, empty, and pathless input", async () => {
  for (const input of ["", "not json", '{"tool_name":"Edit","tool_input":{}}']) {
    const root = await scratch();
    const result = await runHook("observe.mjs", input, { CLAUDE_PROJECT_DIR: root });
    assert.equal(result.code, 0, `exited non-zero on ${JSON.stringify(input)}`);
    assert.equal(await countObservations(root), 0);
  }
});

test("the observer touches nothing outside .arch-crew", async () => {
  const root = await scratch();
  await writeFile(join(root, "keep.txt"), "untouched", "utf8");
  await runHook(
    "observe.mjs",
    JSON.stringify({ cwd: root, tool_name: "Write", tool_input: { file_path: join(root, "keep.txt") } }),
    { CLAUDE_PROJECT_DIR: root },
  );
  assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "untouched");
  assert.deepEqual((await readdir(root)).sort(), [".arch-crew", "keep.txt"]);
});

test("the observer never reaches a checker, the baseline, or a subprocess", async () => {
  const source = await readFile(script("observe.mjs"), "utf8");
  for (const forbidden of ["child_process", "runtime/baseline", "../baseline", "../checkers", "check-rules"]) {
    assert.ok(!source.includes(forbidden), `observe.mjs must not reference ${forbidden}`);
  }
});

test("the session-start hook prints the rule list from the constitution", async () => {
  const root = await scratch();
  await mkdir(join(root, "docs/architecture"), { recursive: true });
  await writeFile(
    join(root, "docs/architecture/constitution.md"),
    [
      "<!-- Generated by arch-crew -->",
      "",
      "# Architecture Constitution",
      "",
      "## Rules",
      "",
      "### no-shared-db-writes",
      "",
      "Services must not write to another service's tables.",
      "",
      "- Severity: blocking",
      "- Scope: `services/**`",
      "- Verified by review — needs judgement, and may be graded as a soft signal.",
      "- Source: [0004 Events](decisions/0004-events.md)",
      "",
      "## Active decisions",
      "",
      "- [0004 Events](decisions/0004-events.md) — decide-architecture",
      "",
    ].join("\n"),
    "utf8",
  );

  const result = await runHook("inject-rules.mjs", JSON.stringify({ cwd: root, source: "startup" }), {
    CLAUDE_PROJECT_DIR: root,
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /no-shared-db-writes/);
  assert.match(result.stdout, /Severity: blocking/);
  assert.ok(!result.stdout.includes("Active decisions"), "the decision list must not be injected");
  assert.match(result.stdout, /--check/, "the injection must point at the freshness check");
});

test("the session-start hook exits 0 and stays quiet when there is no constitution", async () => {
  const root = await scratch();
  const result = await runHook("inject-rules.mjs", JSON.stringify({ cwd: root }), {
    CLAUDE_PROJECT_DIR: root,
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /build-constitution\.mjs/);
});

test("the stop hook emits a systemMessage only when the queue is non-empty", async () => {
  const root = await scratch();
  const quiet = await runHook("notify.mjs", JSON.stringify({ cwd: root }), { CLAUDE_PROJECT_DIR: root });
  assert.equal(quiet.code, 0);
  assert.equal(quiet.stdout.trim(), "");

  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });
  const loud = await runHook("notify.mjs", JSON.stringify({ cwd: root }), { CLAUDE_PROJECT_DIR: root });
  assert.equal(loud.code, 0);
  const payload = JSON.parse(loud.stdout);
  assert.deepEqual(Object.keys(payload), ["systemMessage"]);
  assert.match(payload.systemMessage, /arch-crew/);
});

test("the stop hook does not repeat the same banner across turns with no new edits", async () => {
  const root = await scratch();
  await appendObservation(root, { t: "T1", path: "a.py", tool: "Edit" });

  const first = await runHook("notify.mjs", JSON.stringify({ cwd: root }), { CLAUDE_PROJECT_DIR: root });
  assert.notEqual(first.stdout.trim(), "");

  const second = await runHook("notify.mjs", JSON.stringify({ cwd: root }), { CLAUDE_PROJECT_DIR: root });
  assert.equal(second.stdout.trim(), "", "a turn with no new edits must not repeat the banner");

  await appendObservation(root, { t: "T2", path: "b.py", tool: "Edit" });
  const third = await runHook("notify.mjs", JSON.stringify({ cwd: root }), { CLAUDE_PROJECT_DIR: root });
  assert.notEqual(third.stdout.trim(), "", "a grown queue must notify again");
});

test("no hook script emits a mutating hook output field", async () => {
  const forbidden = [
    "updatedToolOutput",
    "updatedInput",
    "updatedMCPToolOutput",
    "permissionDecision",
    "\"decision\"",
    "\"continue\"",
  ];
  for (const name of ["inject-rules.mjs", "observe.mjs", "notify.mjs"]) {
    const source = await readFile(script(name), "utf8");
    for (const field of forbidden) {
      assert.ok(!source.includes(field), `${name} must not emit ${field}`);
    }
  }
});

import { copyFile } from "node:fs/promises";
import { before, describe } from "node:test";

import { JUDGEMENT, buildPacket } from "../runtime/drift/packet.mjs";

const decision = {
  id: 4,
  title: "Events over a shared database",
  filename: "0004-events.md",
  skill: "decide-architecture",
  status: "active",
  rules: [
    { id: "no-shared-db-writes", decision: 4, statement: "Services must not write to another service's tables.",
      scope: ["services/**"], severity: "blocking", verification: "deterministic",
      verifiedBy: "import-linter#svc-db-isolation" },
    { id: "domain-pure", decision: 4, statement: "The domain package must not import infrastructure.",
      scope: ["src/domain/**"], severity: "warning", verification: "review", verifiedBy: null },
    { id: "team-distributed", decision: 4, statement: "We chose events because the team is distributed.",
      scope: [], severity: "warning", verification: "narrative", verifiedBy: null },
  ],
};

test("the judgement mapping is total and forbids judgement on every deterministic rule", () => {
  assert.deepEqual(Object.keys(JUDGEMENT).sort(), ["deterministic", "narrative", "review"]);
  assert.equal(JUDGEMENT.deterministic, "forbidden");
  assert.equal(JUDGEMENT.review, "required");
  assert.equal(JUDGEMENT.narrative, "skipped");
});

test("the packet reports scoped rules, counts narrative ones, and never grades them", () => {
  const packet = buildPacket({
    root: "/repo",
    base: "a1b2c3d",
    decisions: [decision],
    paths: [
      { path: "services/billing/db.py", sources: ["queue", "git"], tools: ["Edit"] },
      { path: "README.md", sources: ["git"], tools: [] },
    ],
    queue: { observed: 3, malformed: 0, atCap: false, truncated: false, since: "T1", until: "T3" },
    checkerRows: [{ rule: "no-shared-db-writes", status: "unavailable", evidence: "import-linter not on PATH" }],
  });

  assert.equal(packet.rules.length, 1);
  const [rule] = packet.rules;
  assert.equal(rule.id, "no-shared-db-writes");
  assert.equal(rule.judgement, "forbidden");
  assert.deepEqual(rule.checker, { status: "unavailable", evidence: "import-linter not on PATH" });
  assert.deepEqual(rule.matched, ["services/billing/db.py"]);
  assert.equal(packet.narrativeSkipped, 1);
  assert.equal(packet.scopeless, 0);
  assert.equal(packet.outOfScope, 1);
  assert.ok(!JSON.stringify(packet).includes("violation"), "the packet must express no classification");
});

test("a deterministic or review rule recorded with no scope is counted as scopeless, never silently dropped", () => {
  const scopeless = {
    ...decision,
    rules: [
      { ...decision.rules[0], scope: [] },
      { ...decision.rules[1], scope: [] },
    ],
  };
  const packet = buildPacket({
    root: "/repo", base: null, decisions: [scopeless],
    paths: [{ path: "services/billing/db.py", sources: ["git"], tools: [] }],
    queue: { observed: 0, malformed: 0, atCap: false, truncated: false, since: null, until: null },
    checkerRows: [],
  });
  assert.deepEqual(packet.rules, []);
  assert.equal(packet.scopeless, 2);
  assert.equal(packet.outOfScope, 1);
});

test("a deterministic rule with no checker row is not-run, and judgement is still forbidden", () => {
  const packet = buildPacket({
    root: "/repo", base: null, decisions: [decision],
    paths: [{ path: "services/a.py", sources: ["git"], tools: [] }],
    queue: { observed: 0, malformed: 0, atCap: false, truncated: false, since: null, until: null },
    checkerRows: null,
  });
  assert.equal(packet.rules[0].checker.status, "not-run");
  assert.equal(packet.rules[0].judgement, "forbidden");
});

test("a review rule is the only kind the model may classify", () => {
  const packet = buildPacket({
    root: "/repo", base: null, decisions: [decision],
    paths: [{ path: "src/domain/order.py", sources: ["git"], tools: [] }],
    queue: { observed: 0, malformed: 0, atCap: false, truncated: false, since: null, until: null },
    checkerRows: [],
  });
  assert.deepEqual(packet.rules.map((rule) => [rule.id, rule.judgement]), [["domain-pure", "required"]]);
});

test("only active decisions contribute rules", () => {
  const proposed = { ...decision, id: 5, filename: "0005-x.md", status: "proposed" };
  const packet = buildPacket({
    root: "/repo", base: null, decisions: [proposed],
    paths: [{ path: "services/a.py", sources: ["git"], tools: [] }],
    queue: { observed: 0, malformed: 0, atCap: false, truncated: false, since: null, until: null },
    checkerRows: [],
  });
  assert.deepEqual(packet.rules, []);
});

test("shuffling the queue and path order produces an identical packet", () => {
  const forward = buildPacket({
    root: "/repo", base: "b", decisions: [decision],
    paths: [
      { path: "services/b.py", sources: ["git"], tools: [] },
      { path: "services/a.py", sources: ["queue"], tools: ["Edit"] },
    ],
    queue: { observed: 2, malformed: 0, atCap: false, truncated: false, since: "T1", until: "T2" },
    checkerRows: [],
  });
  const reversed = buildPacket({
    root: "/repo", base: "b", decisions: [decision],
    paths: [
      { path: "services/a.py", sources: ["queue"], tools: ["Edit"] },
      { path: "services/b.py", sources: ["git"], tools: [] },
    ],
    queue: { observed: 2, malformed: 0, atCap: false, truncated: false, since: "T1", until: "T2" },
    checkerRows: [],
  });
  assert.equal(JSON.stringify(forward), JSON.stringify(reversed));
});

test("an unsupported scope glob fails the drain loudly, naming the rule", () => {
  const bad = { ...decision, rules: [{ ...decision.rules[1], scope: ["src/{a,b}/**"] }] };
  assert.throws(
    () => buildPacket({
      root: "/repo", base: null, decisions: [bad],
      paths: [{ path: "src/a/x.py", sources: ["git"], tools: [] }],
      queue: { observed: 0, malformed: 0, atCap: false, truncated: false, since: null, until: null },
      checkerRows: [],
    }),
    /domain-pure/,
  );
});

// Deviation from the plan's literal test: the drain CLI's packet honestly
// echoes back the absolute `--root` it was given, so a byte-exact fixture
// checked in with this machine's path would fail on every other checkout
// (violating this repo's own "no host paths in generated artifacts" rule).
// `expected-packet.json` pins a `__FIXTURES_ROOT__` placeholder instead, and
// the comparison substitutes the real, per-run fixtures path back in.
describe("the drain CLI drains the fixture repository", () => {
  const fixtures = join(repositoryRoot, "test/fixtures/drift");
  const liveQueue = join(fixtures, ".arch-crew/drift-queue.jsonl");
  const fixtureQueue = join(fixtures, ".arch-crew/drift-queue.fixture.jsonl");

  before(async () => {
    await copyFile(fixtureQueue, liveQueue);
  });

  test("produces the golden packet for the fixture repository", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(repositoryRoot, "runtime/drift/drift.mjs"), "drain", "--root", fixtures, "--json"],
      { cwd: repositoryRoot },
    );
    const golden = await readFile(join(fixtures, "expected-packet.json"), "utf8");
    assert.equal(stdout, golden.replace("__FIXTURES_ROOT__", fixtures));

    // The two runtimes must not silently disagree: a real check-rules run
    // reaches the packet as a real verdict, never as the synthesised
    // "check-rules did not run" placeholder that fires only when the
    // subprocess itself is absent or unparseable.
    const packet = JSON.parse(stdout);
    const deterministic = packet.rules.find((rule) => rule.id === "no-shared-db-writes");
    assert.equal(deterministic.checker.status, "unbound");
    assert.notEqual(deterministic.checker.evidence, "check-rules did not run");
  });
});

test("the drain exits 1 when it cannot do its job and never exits 2", async () => {
  const empty = await scratch();
  await assert.rejects(
    execFileAsync(process.execPath, [join(repositoryRoot, "runtime/drift/drift.mjs"), "drain", "--root", empty]),
    (error) => error.code === 1,
  );
});

test("status reports the queue path it resolved", async () => {
  const root = await scratch();
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(repositoryRoot, "runtime/drift/drift.mjs"), "status", "--root", root],
  );
  assert.ok(stdout.includes(queuePath(root)), "status must print the queue path it resolved");
  assert.match(stdout, /\.gitignore/, "status must tell the user to gitignore .arch-crew/");
});

test("status counts a stuck .draining slice into observed and names it separately", async () => {
  const root = await scratch();
  await mkdir(join(root, ".arch-crew"), { recursive: true });
  await writeFile(
    join(root, ".arch-crew/drift-queue.stuck.draining"),
    '{"t":"T1","path":"a.py","tool":"Edit"}\n',
    "utf8",
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [join(repositoryRoot, "runtime/drift/drift.mjs"), "status", "--root", root],
  );
  assert.match(stdout, /observed: 1/, "a crashed drain's slice must not be reported as observed: 0");
  assert.match(stdout, /\.draining slice/, "status must name the stuck slice as a distinct number");
});
