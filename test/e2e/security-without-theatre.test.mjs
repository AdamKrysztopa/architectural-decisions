import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { cleanup, cloneFixture, repositoryRoot } from "./support.mjs";
import { parseDecision } from "../../runtime/baseline/decisions.mjs";

const execFileAsync = promisify(execFile);
const checkerCli = join(repositoryRoot, "runtime/checkers/check-rules.mjs");
const clones = [];
after(async () => {
  await Promise.all(clones.map(cleanup));
});

// check-rules.mjs resolves every adapter's tool config (.importlinter,
// .gitleaks.toml, ...) against its own process cwd, never against --dir
// (which names only the directory holding the decision *.md files — see
// runtime/checkers/check-rules.mjs's own split between `directory` and
// `cwd`, and test/e2e/bind-and-prove.test.mjs's `check` for the same
// convention). So the fixture's cloned repo root is this invocation's cwd,
// and --dir points at that root's docs/architecture/decisions subdirectory.
// The CLI's --json output is `{ rows, skippedNonDeterministic }`, not a bare
// array, so the rows array is unwrapped here.
async function check(dir, args = [], env = process.env) {
  const decisionsDir = join(dir, "docs/architecture/decisions");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [checkerCli, "--dir", decisionsDir, "--json", ...args],
      { cwd: dir, env },
    );
    const payload = JSON.parse(stdout);
    return { code: 0, rows: payload.rows, skippedNonDeterministic: payload.skippedNonDeterministic };
  } catch (error) {
    const payload = JSON.parse(error.stdout || "{}");
    return { code: error.code, rows: payload.rows ?? [], skippedNonDeterministic: payload.skippedNonDeterministic };
  }
}

// gitleaks itself is not assumed installed on the machine running this
// suite (this repo ships zero dependencies, Node builtins only, and cannot
// assume a Go toolchain — the same reasoning test/checker-corpus.test.mjs
// and test/e2e/bind-and-prove.test.mjs already document for import-linter).
// A "fail" outcome can only come out of gitleaks.mjs's run() by actually
// spawning a binary named `gitleaks`, so this puts a small fake one on
// PATH — but rather than hardcode a canned verdict, the fake reads the real
// `--config` file it was invoked with (the fixture's own .gitleaks.toml,
// parsed by nothing but this script) and greps the real, cloned repository
// tree for that pattern, exactly as gitleaks itself would. So a genuine
// mutation of the fixture's committed secret would drive a genuine change
// in what the fake reports; only the third-party gitleaks binary itself is
// a stand-in, and the full shipped pipeline (config resolution by
// gitleaks.mjs's real resolve(), spawnTool, report-file parsing, rule
// status) is exercised for real.
// gitleaks.mjs's run() invokes a fixed subcommand and flag set (see
// gitleaks.mjs's spawnTool call: "detect" "--source" "." "--config" <file>
// "--no-git" "--report-format" "json" "--report-path" <path> "--exit-code"
// "1"). The fake asserts that whole shape up front (exit 97 otherwise) so a
// changed invocation -- a renamed subcommand, a dropped flag -- turns into a
// loud failure here instead of a silent pass, since the fake would otherwise
// respond to --config/--report-path no matter what precedes them.
const FAKE_GITLEAKS = [
  "#!/bin/sh",
  'if [ "$1" != "detect" ]; then',
  "  echo \"FAKE_GITLEAKS: expected first argument 'detect', got '$1'\" >&2",
  "  exit 97",
  "fi",
  'config=""',
  'reportPath=""',
  'prev=""',
  'sawSource=0',
  'sawNoGit=0',
  'sawFormatJson=0',
  'sawExitCode1=0',
  'for arg in "$@"; do',
  '  if [ "$prev" = "--source" ] && [ "$arg" = "." ]; then sawSource=1; fi',
  '  if [ "$arg" = "--no-git" ]; then sawNoGit=1; fi',
  '  if [ "$prev" = "--report-format" ] && [ "$arg" = "json" ]; then sawFormatJson=1; fi',
  '  if [ "$prev" = "--exit-code" ] && [ "$arg" = "1" ]; then sawExitCode1=1; fi',
  '  if [ "$prev" = "--config" ]; then config="$arg"; fi',
  '  if [ "$prev" = "--report-path" ]; then reportPath="$arg"; fi',
  '  prev="$arg"',
  "done",
  'if [ "$sawSource" -ne 1 ] || [ "$sawNoGit" -ne 1 ] || [ "$sawFormatJson" -ne 1 ] || [ "$sawExitCode1" -ne 1 ]; then',
  '  echo "FAKE_GITLEAKS: missing an expected flag (--source ., --no-git, --report-format json, --exit-code 1); got: $*" >&2',
  "  exit 97",
  "fi",
  'pattern=$(sed -n "s/^regex = \'\'\'\\(.*\\)\'\'\'\\$/\\1/p" "$config")',
  'hit=$(grep -rEn "$pattern" . 2>/dev/null | head -1)',
  'if [ -n "$hit" ]; then',
  '  file=$(printf "%s" "$hit" | cut -d: -f1)',
  '  line=$(printf "%s" "$hit" | cut -d: -f2)',
  '  printf \'[{"RuleID":"generic-api-key","File":"%s","StartLine":%s}]\' "$file" "$line" > "$reportPath"',
  "  exit 1",
  "else",
  "  exit 0",
  "fi",
].join("\n");

async function withFakeGitleaks(fn) {
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-e2e-fake-bin-"));
  try {
    const filePath = join(dir, "gitleaks");
    await writeFile(filePath, FAKE_GITLEAKS);
    await chmod(filePath, 0o755);
    return await fn({ ...process.env, PATH: `${dir}:${process.env.PATH}` });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Opt-in real-tool lane: with ARCH_CREW_E2E_REAL_TOOLS=1, skip the fake
// entirely and require the real `gitleaks` binary on PATH. Without this
// variable, this suite proves the shipped pipeline up to the process
// boundary (spawn, report-file parsing, status mapping) but never that the
// real tool's own CLI contract still matches what gitleaks.mjs invokes.
const useRealTools = process.env.ARCH_CREW_E2E_REAL_TOOLS === "1";

async function withGitleaks(fn) {
  if (useRealTools) return fn(process.env);
  return withFakeGitleaks(fn);
}

test("E2E-4: the secret is found by gitleaks, not asserted by the model", async () => {
  await withGitleaks(async (env) => {
    const dir = await cloneFixture("e2e/security-without-theatre");
    clones.push(dir);
    const { rows } = await check(dir, ["--run"], env);
    const secretRule = rows.find((r) => r.rule === "no-committed-secrets");
    assert.equal(secretRule.status, "fail");
    assert.match(secretRule.evidence, /gitleaks/i);
  });
});

test("E2E-4: the review and narrative rules are counted but never graded", async () => {
  // The claim under test is a product behaviour, not a fact about the
  // fixture bytes: running the fixture through the shipped checker must
  // count the two non-deterministic rules without ever producing a row for
  // either of them, and must produce exactly one row — the deterministic
  // secrets rule — regardless of how many rules the decision declares.
  await withGitleaks(async (env) => {
    const dir = await cloneFixture("e2e/security-without-theatre");
    clones.push(dir);
    const { rows, skippedNonDeterministic } = await check(dir, ["--run"], env);
    assert.equal(skippedNonDeterministic, 2);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rule, "no-committed-secrets");
    assert.ok(!rows.some((row) => row.rule === "payments-authz-reviewed"));
    assert.ok(!rows.some((row) => row.rule === "internal-network-assumed-trusted"));
  });
});

test("E2E-4 fixture integrity: the decision declares one deterministic, one review, one narrative rule, and no score", async () => {
  // A fixture-integrity guard, not an end-to-end result: it pins the shape
  // the test above depends on (via parseDecision, so a frontmatter-schema
  // regression is caught too), and separately confirms the decision text
  // itself never smuggles in a maturity score.
  const dir = await cloneFixture("e2e/security-without-theatre");
  clones.push(dir);
  const filename = "0001-service-boundary-security.md";
  const text = await readFile(join(dir, "docs/architecture/decisions", filename), "utf8");
  const decision = parseDecision(text, filename);
  assert.deepEqual(
    decision.rules.map((rule) => rule.verification).sort(),
    ["deterministic", "narrative", "review"],
  );
  assert.doesNotMatch(text, /%|\bscore\b|\bmaturity\b|\/10\b/i);
});
