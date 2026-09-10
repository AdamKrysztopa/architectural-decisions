import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkerCli = join(repositoryRoot, "runtime/checkers/check-rules.mjs");
const corpus = join(repositoryRoot, "test/fixtures/checkers");

// check-rules.mjs resolves every adapter's tool config (.importlinter,
// .gitleaks.toml, ...) against its own process cwd, never against --dir
// (which names only the directory holding the decision *.md files — see
// runtime/checkers/check-rules.mjs's own comment on this split). So each
// fixture's repo root is this invocation's cwd, and --dir points at that
// root's docs/architecture/decisions subdirectory.
async function runChecker(fixture, args = [], env = process.env) {
  const fixtureRoot = join(corpus, fixture);
  const decisionsDir = join(fixtureRoot, "docs/architecture/decisions");
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [checkerCli, "--dir", decisionsDir, "--json", ...args],
      { cwd: fixtureRoot, env },
    );
    return { code: 0, rows: JSON.parse(stdout).rows };
  } catch (error) {
    return { code: error.code, rows: JSON.parse(error.stdout || "{}").rows ?? [] };
  }
}

// A substring filter over PATH *segments* cannot guarantee lint-imports is
// absent: import-linter installs a binary literally named "lint-imports",
// which lives in an ordinary bin directory whose path never contains the
// string "import-linter". Substituting PATH with an empty scratch directory
// (rather than subtracting from the ambient one) guarantees the tool is
// unresolvable regardless of what is installed on the host running this
// suite.
async function withEmptyPath(fn) {
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-corpus-empty-path-"));
  try {
    return await fn({ ...process.env, PATH: dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// None of import-linter, gitleaks or semgrep are assumed installed on the
// machine running this suite (this repo ships zero dependencies, Node
// builtins only, and CI cannot assume a Python/Go toolchain). A "pass" or
// "fail" outcome can only come out of an adapter's run() by actually
// spawning the named binary, so this suite puts a small fake binary on PATH
// that speaks the exact stdout/report-file protocol each adapter's run()
// parses (see runtime/checkers/{import-linter,gitleaks,semgrep}.mjs) —
// mirroring the withFakeTools() pattern test/checkers.test.mjs already uses
// for the same reason. Every other status (unbound, unreadable-config,
// unavailable) is decided entirely inside adapter.resolve(), before any
// tool is ever spawned, so those cases need no fake tool and exercise the
// real, shipped resolution code against the fixture's real config file.
async function withFakeTools(scripts, fn) {
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-corpus-fake-bin-"));
  try {
    for (const [name, contents] of Object.entries(scripts)) {
      const filePath = join(dir, name);
      await writeFile(filePath, contents);
      await chmod(filePath, 0o755);
    }
    return await fn({ ...process.env, PATH: `${dir}:${process.env.PATH}` });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("a satisfied deterministic rule reports pass and exits 0", async () => {
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'svc-db-isolation KEPT'\nexit 0\n" }, async (env) => {
    const { code, rows } = await runChecker("import-linter/pass", ["--run"], env);
    assert.equal(code, 0);
    assert.equal(rows.find((r) => r.rule === "svc-db-isolation").status, "pass");
  });
});

test("a violated deterministic rule reports fail and exits 2", async () => {
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'svc-db-isolation BROKEN'\nexit 1\n" }, async (env) => {
    const { code, rows } = await runChecker("import-linter/fail", ["--run"], env);
    assert.equal(code, 2);
    assert.equal(rows.find((r) => r.rule === "svc-db-isolation").status, "fail");
  });
});

test("a rule naming a nonexistent contract reports unbound and exits 2, never pass", async () => {
  const { code, rows } = await runChecker("import-linter/unbound", ["--run"]);
  assert.equal(rows.find((r) => r.rule === "svc-db-isolation").status, "unbound");
  assert.equal(code, 2);
});

test("a config the reader cannot parse reports unreadable-config with a line number, not a silent pass", async () => {
  const { code, rows } = await runChecker("import-linter/unreadable-config", ["--run"]);
  const row = rows.find((r) => r.rule === "svc-db-isolation");
  assert.equal(row.status, "unreadable-config");
  // The adapter's own evidence format is "<config-file>:<line>: <message>"
  // (see import-linter.mjs's UnreadableConfig throws), not the English
  // phrase "line <N>" — assert against the real, shipped shape.
  assert.match(row.evidence, /\.importlinter:\d+/);
  assert.equal(code, 2);
});

test("a missing tool reports unavailable and does not block by default", async () => {
  await withEmptyPath(async (env) => {
    const { code, rows } = await runChecker("import-linter/unavailable", ["--run"], env);
    assert.equal(rows.find((r) => r.rule === "svc-db-isolation").status, "unavailable");
    assert.equal(code, 0);
  });
});

test("--require-tools promotes unavailable to blocking", async () => {
  await withEmptyPath(async (env) => {
    const { code } = await runChecker("import-linter/unavailable", ["--run", "--require-tools"], env);
    assert.equal(code, 2);
  });
});

test("without --run, resolution is static only and nothing is spawned", async () => {
  // Put a lint-imports on PATH that would leave unambiguous evidence of
  // having been spawned. Without --run, check-rules.mjs must never invoke
  // adapter.run() at all, so the sentinel file must never appear.
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-corpus-sentinel-bin-"));
  const sentinel = join(dir, "spawned");
  try {
    await writeFile(join(dir, "lint-imports"), `#!/bin/sh\ntouch '${sentinel}'\necho 'svc-db-isolation KEPT'\nexit 0\n`);
    await chmod(join(dir, "lint-imports"), 0o755);
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
    const { code, rows } = await runChecker("import-linter/pass", [], env);
    assert.equal(code, 0);
    const row = rows.find((r) => r.rule === "svc-db-isolation");
    assert.equal(row.status, "unavailable");
    assert.match(row.evidence, /\.importlinter:\d+ — run with --run to evaluate/);
    await assert.rejects(access(sentinel), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("gitleaks: a clean repo reports pass and exits 0", async () => {
  await withFakeTools({ gitleaks: "#!/bin/sh\nexit 0\n" }, async (env) => {
    const { code, rows } = await runChecker("gitleaks/pass", ["--run"], env);
    assert.equal(code, 0);
    assert.equal(rows.find((r) => r.rule === "no-hardcoded-secrets").status, "pass");
  });
});

test("gitleaks: a committed secret reports fail and exits 2", async () => {
  // gitleaks.mjs's run() calls gitleaks with --exit-code 1 and reads its
  // JSON --report-path file only when the exit code is nonzero.
  const script = [
    "#!/bin/sh",
    'reportPath=""',
    'prev=""',
    'for arg in "$@"; do',
    '  if [ "$prev" = "--report-path" ]; then reportPath="$arg"; fi',
    '  prev="$arg"',
    "done",
    'printf \'[{"RuleID":"test-api-key","File":"app/config.py","StartLine":1}]\' > "$reportPath"',
    "exit 1",
  ].join("\n");
  await withFakeTools({ gitleaks: script }, async (env) => {
    const { code, rows } = await runChecker("gitleaks/fail", ["--run"], env);
    assert.equal(code, 2);
    const row = rows.find((r) => r.rule === "no-hardcoded-secrets");
    assert.equal(row.status, "fail");
    assert.equal(row.scopeCoverage, "scope-matched");
  });
});

test("semgrep: a clean file reports pass and exits 0", async () => {
  await withFakeTools({ semgrep: "#!/bin/sh\necho '{\"results\":[]}'\nexit 0\n" }, async (env) => {
    const { code, rows } = await runChecker("semgrep/pass", ["--run"], env);
    assert.equal(code, 0);
    assert.equal(rows.find((r) => r.rule === "no-eval-usage").status, "pass");
  });
});

test("semgrep: a matching finding reports fail and exits 2", async () => {
  const script = [
    "#!/bin/sh",
    "echo '{\"results\":[{\"check_id\":\"no-eval\",\"path\":\"app/handler.py\",\"start\":{\"line\":2}}]}'",
    "exit 0",
  ].join("\n");
  await withFakeTools({ semgrep: script }, async (env) => {
    const { code, rows } = await runChecker("semgrep/fail", ["--run"], env);
    assert.equal(code, 2);
    const row = rows.find((r) => r.rule === "no-eval-usage");
    assert.equal(row.status, "fail");
    assert.equal(row.scopeCoverage, "scope-matched");
  });
});

// Regression for the finding: `scope` names "where this rule applies", but
// gitleaks and semgrep scan the whole repository in one pass, so a finding
// their own contract matches can sit anywhere the tool looked -- including
// outside a narrowly scoped rule's `scope`. Before check-rules.mjs filtered
// each adapter's findings against the calling rule's own `scope`, a hit
// anywhere in the repo was reported as `fail` for every rule bound to that
// contract, however narrow its `scope` -- a file the rule does not even
// govern was misattributed to it as a violation.
test("gitleaks: a finding for this contract outside the rule's own scope is not attributed to it", async () => {
  const script = [
    "#!/bin/sh",
    'reportPath=""',
    'prev=""',
    'for arg in "$@"; do',
    '  if [ "$prev" = "--report-path" ]; then reportPath="$arg"; fi',
    '  prev="$arg"',
    "done",
    'printf \'[{"RuleID":"test-api-key","File":"app/config.py","StartLine":1}]\' > "$reportPath"',
    "exit 1",
  ].join("\n");
  await withFakeTools({ gitleaks: script }, async (env) => {
    // fixture's rule scopes only "lib/**"; the finding is under "app/".
    const { code, rows } = await runChecker("gitleaks/fail-out-of-scope", ["--run"], env);
    const row = rows.find((r) => r.rule === "no-hardcoded-secrets");
    assert.equal(row.status, "pass");
    assert.equal(row.scopeCoverage, "scope-matched");
    assert.match(row.evidence, /outside this rule's scope/);
    assert.equal(code, 0);
  });
});

test("semgrep: a finding for this contract outside the rule's own scope is not attributed to it", async () => {
  const script = [
    "#!/bin/sh",
    "echo '{\"results\":[{\"check_id\":\"no-eval\",\"path\":\"app/handler.py\",\"start\":{\"line\":2}}]}'",
    "exit 0",
  ].join("\n");
  await withFakeTools({ semgrep: script }, async (env) => {
    // fixture's rule scopes only "lib/**"; the finding is under "app/".
    const { code, rows } = await runChecker("semgrep/fail-out-of-scope", ["--run"], env);
    const row = rows.find((r) => r.rule === "no-eval-usage");
    assert.equal(row.status, "pass");
    assert.equal(row.scopeCoverage, "scope-matched");
    assert.match(row.evidence, /outside this rule's scope/);
    assert.equal(code, 0);
  });
});

test("import-linter's verdict is reported repository-wide even when its rule declares a scope", async () => {
  // import-linter has no per-file finding to filter -- unlike gitleaks and
  // semgrep, its verdict can never be confined to a rule's `scope`.
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'svc-db-isolation BROKEN'\nexit 1\n" }, async (env) => {
    const { rows } = await runChecker("import-linter/fail", ["--run"], env);
    const row = rows.find((r) => r.rule === "svc-db-isolation");
    assert.equal(row.status, "fail");
    assert.equal(row.scopeCoverage, "repository-wide");
  });
});
