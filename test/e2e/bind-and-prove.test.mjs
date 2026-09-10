import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { cleanup, cloneFixture, repositoryRoot, withPatch } from "./support.mjs";

const execFileAsync = promisify(execFile);
const checkerCli = join(repositoryRoot, "runtime/checkers/check-rules.mjs");
const clones = [];

// check-rules.mjs resolves every adapter's tool config (.importlinter,
// .gitleaks.toml, ...) against its own process cwd, never against --dir
// (which names only the directory holding the decision *.md files — see
// runtime/checkers/check-rules.mjs's own split between `directory` and
// `cwd`, and test/checker-corpus.test.mjs's runChecker for the same
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
    return { code: 0, rows: JSON.parse(stdout).rows };
  } catch (error) {
    return { code: error.code, rows: JSON.parse(error.stdout || "{}").rows ?? [] };
  }
}

// This repo ships zero dependencies (Node builtins only) and cannot assume a
// Python toolchain, so the real `lint-imports` binary is not assumed to be
// on PATH (it verifiably is not, on the machine this suite was written
// against). Rather than assert on a canned stub, this fake actually reads
// the fixture's real, possibly-just-patched svc/billing sources on every
// invocation and reports BROKEN only when they truly violate the contract's
// forbidden_modules — so a genuine file mutation (the test's own
// withPatch call) drives a genuine change in what the fake reports, and the
// full shipped pipeline (spawnTool -> stdout parsing -> pass/fail decision)
// is exercised for real against real repository state, only the third-party
// linter binary itself is a stand-in.
// import-linter.mjs's run() spawns `lint-imports` with an empty argument
// list (`spawnTool("lint-imports", [], { cwd: root })`) -- checking every
// contract in one pass is the only mode it has. The fake asserts that
// contract up front (exit 97 if it is ever invoked with arguments) so a
// future adapter change that started passing flags would fail loudly here
// instead of the fake silently accepting whatever it was given.
const FAKE_LINT_IMPORTS = [
  "#!/bin/sh",
  'if [ "$#" -ne 0 ]; then',
  '  echo "FAKE_LINT_IMPORTS: expected to be invoked with no arguments, got: $*" >&2',
  "  exit 97",
  "fi",
  'if grep -rq "from svc.catalog import db" svc/billing 2>/dev/null || grep -rq "import svc.catalog.db" svc/billing 2>/dev/null; then',
  '  echo "svc-db-isolation BROKEN"',
  "  exit 1",
  "else",
  '  echo "svc-db-isolation KEPT"',
  "  exit 0",
  "fi",
].join("\n");

async function withFakeLintImports(fn) {
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-e2e-fake-bin-"));
  try {
    const filePath = join(dir, "lint-imports");
    await writeFile(filePath, FAKE_LINT_IMPORTS);
    await chmod(filePath, 0o755);
    return await fn({ ...process.env, PATH: `${dir}:${process.env.PATH}` });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Opt-in real-tool lane: with ARCH_CREW_E2E_REAL_TOOLS=1, skip the fake
// entirely and require the real `lint-imports` binary on PATH. Without this
// variable, this suite proves the shipped pipeline up to the process
// boundary (spawn, stdout parsing, status mapping) but never that the real
// tool's own CLI contract still matches what import-linter.mjs invokes.
const useRealTools = process.env.ARCH_CREW_E2E_REAL_TOOLS === "1";

async function withLintImports(fn) {
  if (useRealTools) return fn(process.env);
  return withFakeLintImports(fn);
}

after(async () => {
  await Promise.all(clones.map(cleanup));
});

test("E2E-1: a rule is captured, resolved, violated, and repaired", async () => {
  await withLintImports(async (env) => {
    const dir = await cloneFixture("checkers/import-linter/pass");
    clones.push(dir);

    const clean = await check(dir, ["--run"], env);
    assert.equal(clean.code, 0);
    assert.equal(clean.rows.find((r) => r.rule === "svc-db-isolation").status, "pass");

    await withPatch(join(dir, "svc/billing/repo.py"), () => "from svc.catalog import db\n", async () => {
      const violated = await check(dir, ["--run"], env);
      assert.equal(violated.code, 2);
      assert.equal(violated.rows.find((r) => r.rule === "svc-db-isolation").status, "fail");
    });

    const repaired = await check(dir, ["--run"], env);
    assert.equal(repaired.code, 0);
    assert.equal(repaired.rows.find((r) => r.rule === "svc-db-isolation").status, "pass");
  });
});

test("E2E-1: a rule naming a contract that does not exist is unbound, never pass", async () => {
  const dir = await cloneFixture("e2e/bind-and-prove-unbound");
  clones.push(dir);
  const { code, rows } = await check(dir, ["--run"]);
  assert.equal(rows.find((r) => r.rule === "svc-db-isolation").status, "unbound");
  assert.equal(code, 2);
});
