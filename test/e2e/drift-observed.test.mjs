import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { cleanup, cloneFixture, repositoryRoot } from "./support.mjs";

const execFileAsync = promisify(execFile);
const drainCli = join(repositoryRoot, "runtime/drift/drift.mjs");
const clones = [];
after(async () => {
  await Promise.all(clones.map(cleanup));
});

// SP3 shipped `drift.mjs <status|drain|discard> [--root <path>] [--dir <path>]
// [--base <ref>] [--json]` (a subcommand CLI), not a bare `drain.mjs --dir`.
// `--root` names the fixture's cloned repo root; `--dir` is left unset so the
// drain auto-discovers `docs/architecture/decisions` the same way check-rules
// and build-constitution do (`runtime/baseline/build-constitution.mjs`'s
// `discoverDirectory`). The JSON payload is the drift *packet*
// (`runtime/drift/packet.mjs`'s `buildPacket`): `{ root, base, queue, paths,
// rules, narrativeSkipped, scopeless, outOfScope }`, not `{ counts, findings
// }` -- a matched rule appears once in `rules[]` with a `checker: {status,
// evidence} | null` and a `judgement` ("forbidden" for deterministic,
// "required" for review, filtered out into `narrativeSkipped` for narrative),
// carrying `matched` (the scoped paths that triggered it), never a per-line
// `file`/`line` record -- there is no such granularity in the shipped packet.
async function drain(dir, args = []) {
  const { stdout } = await execFileAsync(process.execPath, [drainCli, "drain", "--root", dir, "--json", ...args]);
  return JSON.parse(stdout);
}

test("E2E-2: an edit to a scoped file is classified, never asserted as a violation", async () => {
  const dir = await cloneFixture("e2e/drift-observed");
  clones.push(dir);
  await mkdir(join(dir, ".arch-crew"), { recursive: true });
  await appendFile(
    join(dir, ".arch-crew/drift-queue.jsonl"),
    `${JSON.stringify({ t: "2026-09-09T00:00:00Z", path: "services/billing/discount.py", tool: "Edit" })}\n`,
  );

  const report = await drain(dir);

  // prefer-events is a narrative rule -- counted, never graded, never
  // present in `rules[]` as something for a human or a tool to act on.
  assert.equal(report.narrativeSkipped, 1, "prefer-events (narrative) must never be classified");
  assert.equal(
    report.rules.some((rule) => rule.id === "prefer-events"),
    false,
  );

  // The fixture ships no `.importlinter` config at all, so the deterministic
  // rule's binding cannot resolve. The drain must copy check-rules' own
  // honest verdict for that ("unbound" -- the same status Task 3's
  // bind-and-prove suite establishes for an unresolvable binding) rather than
  // inventing a pass/fail, and it must never hand a deterministic rule to a
  // human as though it were a review finding.
  const detRule = report.rules.find((rule) => rule.id === "db-isolation-checked");
  assert.ok(detRule, "the scoped deterministic rule must be reported, not silently dropped");
  assert.equal(detRule.judgement, "forbidden");
  assert.equal(detRule.checker.status, "unbound");
  assert.notEqual(detRule.checker.status, "pass");
  assert.notEqual(detRule.checker.status, "fail");

  // The review rule is surfaced for a human to judge, with enough to act on
  // (which rule, which scoped file(s)) -- and the drain never resolves it to
  // pass/fail on its own.
  const reviewRule = report.rules.find((rule) => rule.id === "no-catalog-in-billing");
  assert.ok(reviewRule);
  assert.equal(reviewRule.judgement, "required");
  assert.equal(reviewRule.checker, null);
  assert.deepEqual(reviewRule.matched, ["services/billing/discount.py"]);
});

test("E2E-2: deleting the queue loses nothing — git diff still drives the drain", async () => {
  const dir = await cloneFixture("e2e/drift-observed");
  clones.push(dir);
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  await execFileAsync("git", ["-c", "user.email=t@example.com", "-c", "user.name=test", "add", "."], { cwd: dir });
  await execFileAsync(
    "git",
    ["-c", "user.email=t@example.com", "-c", "user.name=test", "commit", "-q", "-m", "base"],
    { cwd: dir },
  );
  await appendFile(join(dir, "services/billing/discount.py"), "\n# a change worth noticing\n");

  const report = await drain(dir); // no queue file at all -- git status/diff must still surface the edit
  assert.equal(report.queue.observed, 0);
  assert.ok(
    report.paths.some((entry) => entry.path === "services/billing/discount.py" && entry.sources.includes("git")),
    "the edit must be observed through git, not lost for want of a queue entry",
  );
  assert.ok(report.rules.length >= 1, "a rule scoped to the changed file must still be reported");
});

test("E2E-2: the drift queue is non-authoritative — verdicts do not change whether or not it exists", async () => {
  // The claim under test is behavioural, not textual: the queue may only
  // change `queue.observed` (how the edit was noticed), never a single rule
  // verdict. A doc-grep for the queue's filename cannot observe this — it
  // only ever proves the string wasn't typed into an unrelated paragraph.
  const dir = await cloneFixture("e2e/drift-observed");
  clones.push(dir);
  await execFileAsync("git", ["init", "-q"], { cwd: dir });
  await execFileAsync("git", ["-c", "user.email=t@example.com", "-c", "user.name=test", "add", "."], { cwd: dir });
  await execFileAsync(
    "git",
    ["-c", "user.email=t@example.com", "-c", "user.name=test", "commit", "-q", "-m", "base"],
    { cwd: dir },
  );
  await appendFile(join(dir, "services/billing/discount.py"), "\n# a change worth noticing\n");

  await mkdir(join(dir, ".arch-crew"), { recursive: true });
  await appendFile(
    join(dir, ".arch-crew/drift-queue.jsonl"),
    `${JSON.stringify({ t: "2026-09-09T00:00:00Z", path: "services/billing/discount.py", tool: "Edit" })}\n`,
  );

  const withQueue = await drain(dir);
  assert.equal(withQueue.queue.observed, 1);

  await rm(join(dir, ".arch-crew/drift-queue.jsonl"), { force: true });
  const withoutQueue = await drain(dir);
  assert.equal(withoutQueue.queue.observed, 0);

  const shape = (report) =>
    [...report.rules]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((rule) => ({ id: rule.id, judgement: rule.judgement, status: rule.checker?.status ?? null }));
  assert.deepEqual(
    shape(withQueue),
    shape(withoutQueue),
    "the same git-observed edit must classify identically with and without a queue entry for it",
  );
});
