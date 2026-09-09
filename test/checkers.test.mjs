import assert from "node:assert/strict";
import { test } from "node:test";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chmod, mkdir, mkdtemp, readFile as read, writeFile as write } from "node:fs/promises";
import { tmpdir } from "node:os";

import { findConfigFiles, readLines } from "../runtime/checkers/text.mjs";
import { spawnTool } from "../runtime/checkers/spawn.mjs";
import {
  assertRegistryAgreesWithKnownTools,
  getAdapter,
  registerAdapter,
  registeredTools,
} from "../runtime/checkers/registry.mjs";
import importLinter, { extractContractNamesIni, extractContractNamesToml } from "../runtime/checkers/import-linter.mjs";
import dependencyCruiser, { extractRuleNames, stripJsonComments } from "../runtime/checkers/dependency-cruiser.mjs";
import semgrep, { extractIds } from "../runtime/checkers/semgrep.mjs";
import astGrep, { extractDocumentIds, parseRuleDirs } from "../runtime/checkers/ast-grep.mjs";
import gitleaks, { extractIds as extractGitleaksIds } from "../runtime/checkers/gitleaks.mjs";
import pytestArchon, { findTestFunctions } from "../runtime/checkers/pytest-archon.mjs";
import oasdiff, { VENDORED_CHECK_IDS } from "../runtime/checkers/oasdiff.mjs";
import { run as checkRules } from "../runtime/checkers/check-rules.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtures = (...parts) => join(repositoryRoot, "test/fixtures/checkers", ...parts);

// Every run() test below must behave identically whether or not the real
// tool happens to be installed on the developer's or CI's PATH — a run()
// test asserting "unavailable" only because nothing found the binary is not
// a real test, and the same test would silently start invoking a real
// third-party tool against fixture directories the moment someone installs
// it locally. These two helpers make PATH itself the seam: an isolated
// empty directory to prove "not on PATH" deterministically, or a directory
// of tiny fake executables placed ahead of the real PATH to prove exactly
// what each adapter does with a given exit code / stdout shape.
async function withPath(pathValue, fn) {
  const original = process.env.PATH;
  process.env.PATH = pathValue;
  try {
    return await fn();
  } finally {
    process.env.PATH = original;
  }
}

async function withNoToolsOnPath(fn) {
  const emptyDir = await mkdtemp(join(tmpdir(), "arch-crew-checkers-empty-path-"));
  return withPath(emptyDir, fn);
}

// scripts: { binaryName: shellScriptSourceIncludingShebang }
async function withFakeTools(scripts, fn) {
  const dir = await mkdtemp(join(tmpdir(), "arch-crew-checkers-fake-bin-"));
  for (const [name, contents] of Object.entries(scripts)) {
    const filePath = join(dir, name);
    await write(filePath, contents);
    await chmod(filePath, 0o755);
  }
  return withPath(`${dir}:${process.env.PATH}`, fn);
}

async function withEnv(vars, fn) {
  const original = {};
  for (const key of Object.keys(vars)) original[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("finds a literal config candidate that exists", async () => {
  const files = await findConfigFiles(fixtures("text"), ["literal.json", "missing.json"]);
  assert.deepEqual(files, ["literal.json"]);
});

test("returns nothing when no candidate exists", async () => {
  assert.deepEqual(await findConfigFiles(fixtures("text"), ["nope.json"]), []);
});

test("resolves a **/ glob across nested directories", async () => {
  const files = await findConfigFiles(fixtures("text"), ["nested/**/*.yml"]);
  assert.deepEqual(files, ["nested/deep/tree/rule.yml"]);
});

test("resolves the **.ext shorthand glob some config-candidate tables use", async () => {
  const files = await findConfigFiles(fixtures("text"), ["nested/**.yml"]);
  assert.deepEqual(files, ["nested/deep/tree/rule.yml"]);
});

test("skips node_modules and virtualenv directories while walking", async () => {
  const files = await findConfigFiles(fixtures("text"), ["**/*.yml"]);
  assert.deepEqual(files, ["nested/deep/tree/rule.yml"]);
});

test("candidate order does not change the result set", async () => {
  const forward = await findConfigFiles(fixtures("text"), ["literal.json", "nested/**/*.yml"]);
  const reversed = await findConfigFiles(fixtures("text"), ["nested/**/*.yml", "literal.json"]);
  assert.deepEqual([...forward].sort(), [...reversed].sort());
});

test("readLines splits a file into lines", async () => {
  const lines = await readLines(fixtures("text"), "literal.json");
  assert.equal(lines[0], "{}");
  assert.equal(lines.length, 2); // trailing newline produces a final empty element
});

test("spawnTool reports an unavailable binary without throwing", async () => {
  const result = await spawnTool("definitely-not-a-real-tool-xyz", ["--version"]);
  assert.equal(result.available, false);
  assert.equal(result.exitCode, null);
});

test("spawnTool captures a zero exit code and stdout for a real binary", async () => {
  const result = await spawnTool(process.execPath, ["--version"]);
  assert.equal(result.available, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^v\d+\.\d+\.\d+/);
});

test("spawnTool captures a nonzero exit code without throwing", async () => {
  const result = await spawnTool(process.execPath, ["-e", "process.exit(3)"]);
  assert.equal(result.available, true);
  assert.equal(result.exitCode, 3);
});

test("registers an adapter and retrieves it by tool name", () => {
  registerAdapter({ tool: "test-tool-registration", configCandidates: ["x"], resolve: async () => ({}) });
  assert.ok(getAdapter("test-tool-registration"));
  assert.equal(getAdapter("no-such-tool"), null);
});

test("rejects a second registration for the same tool", () => {
  registerAdapter({ tool: "test-tool-duplicate", configCandidates: ["x"], resolve: async () => ({}) });
  assert.throws(
    () => registerAdapter({ tool: "test-tool-duplicate", configCandidates: ["x"], resolve: async () => ({}) }),
    /already registered/,
  );
});

test("rejects an adapter missing a required field", () => {
  assert.throws(() => registerAdapter({ tool: "test-tool-incomplete" }), /missing 'configCandidates'/);
});

test("agreement guard catches a KNOWN_TOOLS entry with no adapter", () => {
  assert.throws(
    () => assertRegistryAgreesWithKnownTools(["test-tool-registration", "nobody-registered-this"]),
    /no checker adapter: nobody-registered-this/,
  );
});

test("agreement guard catches a registered adapter for an unknown tool", () => {
  assert.throws(
    () => assertRegistryAgreesWithKnownTools(["test-tool-registration"]),
    () => registeredTools().includes("test-tool-duplicate"), // sanity: still registered from an earlier test
  );
});

test("extracts contract names from an INI config, skipping the multi-line layers= value", () => {
  const names = extractContractNamesIni(
    ["[importlinter]", "root_package = myapp", "", "[importlinter:contract:one]",
      "name = domain-isolation", "layers=", "    a", "    b"].join("\n"),
    ".importlinter",
  );
  assert.deepEqual(names, [{ name: "domain-isolation", line: 5 }]);
});

test("rejects an INI continuation line before the contract's name", () => {
  assert.throws(
    () => extractContractNamesIni(
      ["[importlinter:contract:one]", "layers=", "    a", "name = domain-isolation"].join("\n"),
      ".importlinter",
    ),
    /continuation line appears before this contract's name/,
  );
});

test("extracts contract names from a pyproject.toml array of tables", () => {
  const names = extractContractNamesToml(
    ["[[tool.importlinter.contracts]]", 'name = "domain-isolation"', "", "[[tool.importlinter.contracts]]", "name = 'svc-db-isolation'"].join("\n"),
    "pyproject.toml",
  );
  assert.deepEqual(names, [{ name: "domain-isolation", line: 2 }, { name: "svc-db-isolation", line: 5 }]);
});

test("import-linter resolve() finds both real contracts in the fixture .importlinter", async () => {
  const root = fixtures("import-linter");
  const first = await importLinter.resolve(root, "domain-isolation");
  assert.equal(first.resolved, true);
  assert.equal(first.evidence, "import-linter contract 'domain-isolation' in .importlinter:5");

  const second = await importLinter.resolve(root, "svc-db-isolation");
  assert.equal(second.resolved, true);
  assert.equal(second.evidence, "import-linter contract 'svc-db-isolation' in .importlinter:12");
});

test("import-linter resolve() reports unbound for a contract that is not there", async () => {
  const result = await importLinter.resolve(fixtures("import-linter"), "does-not-exist");
  assert.deepEqual(result, {
    resolved: false,
    reason: "unbound",
    evidence: "no contract named 'does-not-exist' in .importlinter",
  });
});

test("import-linter resolve() also reads pyproject.toml contracts", async () => {
  const result = await importLinter.resolve(fixtures("import-linter-toml"), "domain-isolation");
  assert.equal(result.resolved, true);
  assert.equal(result.evidence, "import-linter contract 'domain-isolation' in pyproject.toml:5");
});

test("import-linter resolve() reports unbound when no config file exists at all", async () => {
  const result = await importLinter.resolve(fixtures("text"), "anything");
  assert.deepEqual(result, { resolved: false, reason: "unbound", evidence: "no import-linter config found" });
});

test("import-linter run() reports unavailable when lint-imports is not on PATH", async () => {
  await withNoToolsOnPath(async () => {
    const result = await importLinter.run(fixtures("import-linter"), "domain-isolation");
    assert.equal(result.status, "unavailable");
    assert.match(result.evidence, /lint-imports is not on PATH/);
  });
});

test("import-linter run() reports pass when lint-imports reports the contract KEPT", async () => {
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'domain-isolation KEPT'\nexit 0\n" }, async () => {
    const result = await importLinter.run(fixtures("import-linter"), "domain-isolation");
    assert.equal(result.status, "pass");
    assert.match(result.evidence, /KEPT/);
  });
});

test("import-linter run() reports fail when lint-imports reports the contract BROKEN", async () => {
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'domain-isolation BROKEN'\nexit 1\n" }, async () => {
    const result = await importLinter.run(fixtures("import-linter"), "domain-isolation");
    assert.equal(result.status, "fail");
    assert.match(result.evidence, /BROKEN/);
  });
});

test("import-linter run() reports error when the report never mentions the contract", async () => {
  await withFakeTools({ "lint-imports": "#!/bin/sh\necho 'some-other-contract KEPT'\nexit 0\n" }, async () => {
    const result = await importLinter.run(fixtures("import-linter"), "domain-isolation");
    assert.equal(result.status, "error");
    assert.match(result.evidence, /output format may have changed/);
  });
});

test("import-linter resolve() tolerates a tab-indented continuation line after the contract's name is found", () => {
  const names = extractContractNamesIni(
    ["[importlinter:contract:one]", "name = domain-isolation", "layers=", "\tmyapp.domain", "\tmyapp.infra"].join("\n"),
    ".importlinter",
  );
  assert.deepEqual(names, [{ name: "domain-isolation", line: 2 }]);
});

test("import-linter resolve() ignores a tab in a table this contract's search never reaches (TOML)", async () => {
  const names = extractContractNamesToml(
    ["[tool.black]", 'line-length = 100', "docstring = '''", "\ta tab inside an unrelated multi-line string", "'''",
      "", "[[tool.importlinter.contracts]]", 'name = "domain-isolation"'].join("\n"),
    "pyproject.toml",
  );
  assert.deepEqual(names, [{ name: "domain-isolation", line: 8 }]);
});

test("stripJsonComments removes // and /* */ but leaves string contents alone", () => {
  const text = '{\n  // a comment with a "quote"\n  "a": 1, /* inline */ "b": "keep // this"\n}';
  const stripped = stripJsonComments(text);
  assert.deepEqual(JSON.parse(stripped), { a: 1, b: "keep // this" });
});

test("extractRuleNames reads forbidden and allowed rule names", () => {
  const names = extractRuleNames('{"forbidden":[{"name":"a"}],"allowed":[{"name":"b"}]}');
  assert.deepEqual(names, ["a", "b"]);
});

test("extractRuleNames throws on invalid JSON", () => {
  assert.throws(() => extractRuleNames("{ not json"), /not valid JSON\/JSONC/);
});

test("dependency-cruiser resolve() finds a rule in the JSONC fixture", async () => {
  const result = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "no-orphans");
  assert.equal(result.resolved, true);
  assert.equal(result.evidence, "dependency-cruiser rule 'no-orphans' in .dependency-cruiser.json");
});

test("dependency-cruiser resolve() reports unbound for a missing rule name", async () => {
  const result = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "nope");
  assert.equal(result.reason, "unbound");
});

test("dependency-cruiser resolve() reports unreadable-config for a JS-only config", async () => {
  const result = await dependencyCruiser.resolve(fixtures("dependency-cruiser-js"), "anything");
  assert.deepEqual(result, {
    resolved: false,
    reason: "unreadable-config",
    evidence: ".dependency-cruiser.js is a JS config; dependency-cruiser JS configs are not statically readable",
  });
});

test("dependency-cruiser run() reports unavailable when depcruise is not on PATH", async () => {
  const resolution = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "no-orphans");
  await withNoToolsOnPath(async () => {
    const result = await dependencyCruiser.run(fixtures("dependency-cruiser"), "no-orphans", resolution);
    assert.equal(result.status, "unavailable");
  });
});

test("dependency-cruiser run() reports pass when depcruise's JSON report has no matching violation", async () => {
  const resolution = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "no-orphans");
  const script = `#!/bin/sh\necho '{"summary":{"violations":[]}}'\nexit 0\n`;
  await withFakeTools({ depcruise: script }, async () => {
    const result = await dependencyCruiser.run(fixtures("dependency-cruiser"), "no-orphans", resolution);
    assert.equal(result.status, "pass");
  });
});

test("dependency-cruiser run() reports fail when depcruise's JSON report violates the named rule", async () => {
  const resolution = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "no-orphans");
  const script = `#!/bin/sh\necho '{"summary":{"violations":[{"rule":{"name":"no-orphans"},"from":"a.js","to":"a.js"}]}}'\nexit 1\n`;
  await withFakeTools({ depcruise: script }, async () => {
    const result = await dependencyCruiser.run(fixtures("dependency-cruiser"), "no-orphans", resolution);
    assert.equal(result.status, "fail");
    assert.match(result.evidence, /no-orphans/);
  });
});

test("dependency-cruiser run() reports error when depcruise's output is not parseable JSON", async () => {
  const resolution = await dependencyCruiser.resolve(fixtures("dependency-cruiser"), "no-orphans");
  const script = "#!/bin/sh\necho 'not json'\nexit 1\n";
  await withFakeTools({ depcruise: script }, async () => {
    const result = await dependencyCruiser.run(fixtures("dependency-cruiser"), "no-orphans", resolution);
    assert.equal(result.status, "error");
  });
});

test("extractIds finds an id inline with the dash and one at the field indent", () => {
  const text = ["rules:", "  - id: no-eval", "    pattern: eval(...)", "  -", "    id: no-pickle", "    pattern: pickle.loads(...)"].join("\n");
  assert.deepEqual(extractIds(text, "x.yml"), [
    { id: "no-eval", line: 2 },
    { id: "no-pickle", line: 5 },
  ]);
});

test("extractIds tolerates a multi-line pattern block placed before id", () => {
  // Real-world field order this design initially assumed would fail — it
  // does not, because YAML requires block-scalar content to be indented
  // deeper than its own key, so it can never be mistaken for a field at the
  // tracked indent.
  const text = ["rules:", "  -", "    pattern: |", "      $X.execute($SQL)", "    id: sql-injection"].join("\n");
  assert.deepEqual(extractIds(text, "x.yml"), [{ id: "sql-injection", line: 5 }]);
});

test("extractIds rejects a tab", () => {
  assert.throws(() => extractIds("rules:\n\t- id: x\n", "x.yml"), /tabs are not supported/);
});

test("extractIds rejects an anchor attached to an id value", () => {
  assert.throws(
    () => extractIds("rules:\n  - id: &shared foo\n", "x.yml"),
    /anchor\/alias on an id value is not supported/,
  );
});

test("extractIds tolerates a leading document-start marker before any rules: key", () => {
  // The idiomatic YAML "---" that opens a well-formed file must never be
  // mistaken for the multi-document construct this reader legitimately
  // rejects — it precedes rules:, so nothing is being hidden.
  const text = ["---", "rules:", "  - id: no-eval", "    pattern: eval(...)"].join("\n");
  assert.deepEqual(extractIds(text, "x.yml"), [{ id: "no-eval", line: 3 }]);
});

test("extractIds still rejects a document separator once a rules: list is being read", () => {
  const text = ["rules:", "  - id: no-eval", "---", "rules:", "  - id: hidden-in-second-doc"].join("\n");
  assert.throws(() => extractIds(text, "x.yml"), /multi-document YAML is not supported/);
});

test("semgrep resolve() finds both rules in the fixture config", async () => {
  const first = await semgrep.resolve(fixtures("semgrep"), "no-eval");
  assert.equal(first.evidence, "semgrep contract 'no-eval' in .semgrep.yml:2");
  const second = await semgrep.resolve(fixtures("semgrep"), "no-pickle-loads");
  assert.equal(second.evidence, "semgrep contract 'no-pickle-loads' in .semgrep.yml:7");
});

test("semgrep resolve() reports unreadable-config for the anchor fixture", async () => {
  const result = await semgrep.resolve(fixtures("semgrep-unreadable"), "no-pickle");
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "unreadable-config");
  assert.match(result.evidence, /anchor\/alias on an id value is not supported/);
});

test("semgrep resolve() keeps scanning past an unreadable candidate file and still finds a rule declared in another one", async () => {
  // Files are visited alphabetically; a-anchor.yml (unreadable) sorts before
  // b-good.yml (declares no-eval). Before the fix, hitting the unreadable
  // file first made resolve() give up immediately — a rule bound correctly
  // in a sibling file reported a false unreadable-config.
  const result = await semgrep.resolve(fixtures("semgrep-partial-unreadable"), "no-eval");
  assert.equal(result.resolved, true);
  assert.match(result.evidence, /\.semgrep\/b-good\.yml/);
});

test("semgrep resolve() reports unreadable-config, naming the skipped files, only when no candidate yields a match", async () => {
  const result = await semgrep.resolve(fixtures("semgrep-partial-unreadable"), "no-such-rule");
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "unreadable-config");
  assert.match(result.evidence, /a-anchor\.yml/);
});

test("semgrep run() reports unavailable when semgrep is not on PATH", async () => {
  const resolution = await semgrep.resolve(fixtures("semgrep"), "no-eval");
  await withNoToolsOnPath(async () => {
    const result = await semgrep.run(fixtures("semgrep"), "no-eval", resolution);
    assert.equal(result.status, "unavailable");
  });
});

test("semgrep run() reports pass when semgrep's JSON report has no matching finding", async () => {
  const resolution = await semgrep.resolve(fixtures("semgrep"), "no-eval");
  await withFakeTools({ semgrep: "#!/bin/sh\necho '{\"results\":[]}'\nexit 0\n" }, async () => {
    const result = await semgrep.run(fixtures("semgrep"), "no-eval", resolution);
    assert.equal(result.status, "pass");
  });
});

test("semgrep run() reports fail when semgrep's JSON report matches the contract's check_id", async () => {
  const resolution = await semgrep.resolve(fixtures("semgrep"), "no-eval");
  const script = `#!/bin/sh\necho '{"results":[{"check_id":"no-eval","path":"app.py","start":{"line":3}}]}'\nexit 1\n`;
  await withFakeTools({ semgrep: script }, async () => {
    const result = await semgrep.run(fixtures("semgrep"), "no-eval", resolution);
    assert.equal(result.status, "fail");
    assert.match(result.evidence, /no-eval/);
  });
});

test("ast-grep's rule-file reader is independent of semgrep's: it reads a top-level id per YAML document", () => {
  const text = ["id: rule-one", "language: TypeScript", "rule:", "  pattern: foo()",
    "---", "id: rule-two", "rule:", "  pattern: bar()"].join("\n");
  assert.deepEqual(extractDocumentIds(text, "x.yml"), [
    { id: "rule-one", line: 1 },
    { id: "rule-two", line: 6 },
  ]);
});

test("extractDocumentIds rejects an anchor attached to an id value", () => {
  assert.throws(
    () => extractDocumentIds("id: &shared foo\n", "x.yml"),
    /anchor\/alias on an id value is not supported/,
  );
});

test("extractDocumentIds rejects a tab", () => {
  assert.throws(() => extractDocumentIds("id: foo\n\tlanguage: TypeScript\n", "x.yml"), /tabs are not supported/);
});

test("parseRuleDirs reads a block-style ruleDirs list", () => {
  assert.deepEqual(parseRuleDirs("ruleDirs:\n  - rules\n  - more-rules\n"), ["rules", "more-rules"]);
});

test("parseRuleDirs reads an inline ruleDirs list", () => {
  assert.deepEqual(parseRuleDirs('ruleDirs: [rules, "more-rules"]\n'), ["rules", "more-rules"]);
});

test("ast-grep resolve() finds a rule via sgconfig.yml's ruleDirs, not by reusing semgrep's rules: reader", async () => {
  const result = await astGrep.resolve(fixtures("ast-grep"), "no-console-log");
  assert.equal(result.resolved, true);
  assert.equal(result.evidence, "ast-grep contract 'no-console-log' in rules/no-console.yml:1");
});

test("ast-grep resolve() reads multiple rules from one file separated by ---", async () => {
  const first = await astGrep.resolve(fixtures("ast-grep"), "rule-one");
  assert.equal(first.resolved, true);
  const second = await astGrep.resolve(fixtures("ast-grep"), "rule-two");
  assert.equal(second.resolved, true);
});

test("ast-grep resolve() falls back to conventional rule-file locations when no sgconfig.yml exists", async () => {
  const result = await astGrep.resolve(fixtures("ast-grep-fallback"), "fallback-rule");
  assert.equal(result.resolved, true);
  assert.match(result.evidence, /rules\/foo\.yml/);
});

test("ast-grep resolve() does not match a semgrep rules: config — the two tools look in different places", async () => {
  const result = await astGrep.resolve(fixtures("semgrep"), "no-eval");
  // fixtures("semgrep") has only a .semgrep.yml, which is not one of
  // ast-grep's own candidate locations (sgconfig.yml / .ast-grep/**.yml /
  // rules/**.yml), so this correctly reports unbound.
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "unbound");
});

test("ast-grep run() always reports unavailable in this release", async () => {
  const result = await astGrep.run();
  assert.equal(result.status, "unavailable");
  assert.match(result.evidence, /not implemented in this release/);
});

test("extractIds reads both single- and double-quoted TOML rule ids", () => {
  const text = ['[[rules]]', 'id = "double"', '', '[[rules]]', "id = 'single'"].join("\n");
  assert.deepEqual(extractGitleaksIds(text, "gitleaks.toml"), [
    { id: "double", line: 2 },
    { id: "single", line: 5 },
  ]);
});

test("extractIds rejects a multi-line string before a rule's id", () => {
  assert.throws(
    () => extractGitleaksIds(['[[rules]]', 'regex = """', 'multi', '"""', 'id = "late"'].join("\n"), "gitleaks.toml"),
    /multi-line string appears before this rule's id/,
  );
});

test("gitleaks resolve() finds both real rules in the fixture", async () => {
  const first = await gitleaks.resolve(fixtures("gitleaks"), "aws-secret-key");
  assert.equal(first.evidence, "gitleaks contract 'aws-secret-key' in .gitleaks.toml:4");
  const second = await gitleaks.resolve(fixtures("gitleaks"), "slack-token");
  assert.equal(second.evidence, "gitleaks contract 'slack-token' in .gitleaks.toml:9");
});

test("gitleaks resolve() reports unbound when no config exists", async () => {
  const result = await gitleaks.resolve(fixtures("text"), "anything");
  assert.deepEqual(result, { resolved: false, reason: "unbound", evidence: "no gitleaks config found" });
});

test("gitleaks resolve() keeps scanning past an unreadable candidate and still finds a rule in the other one", async () => {
  // .gitleaks.toml (unreadable: a multi-line string before its id) and
  // gitleaks.toml (declares real-rule) are both literal CONFIG_CANDIDATES
  // and both exist in this fixture; resolve() must not give up on the first.
  const result = await gitleaks.resolve(fixtures("gitleaks-partial-unreadable"), "real-rule");
  assert.equal(result.resolved, true);
  assert.equal(result.location.file, "gitleaks.toml");
});

test("gitleaks resolve() reports unreadable-config, naming the skipped file, only when no candidate yields a match", async () => {
  const result = await gitleaks.resolve(fixtures("gitleaks-partial-unreadable"), "no-such-rule");
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "unreadable-config");
  assert.match(result.evidence, /\.gitleaks\.toml/);
});

test("gitleaks run() reports unavailable when gitleaks is not on PATH", async () => {
  const resolution = await gitleaks.resolve(fixtures("gitleaks"), "aws-secret-key");
  await withNoToolsOnPath(async () => {
    const result = await gitleaks.run(fixtures("gitleaks"), "aws-secret-key", resolution);
    assert.equal(result.status, "unavailable");
  });
});

test("gitleaks run() passes --config pointing at the exact file resolve() read", async () => {
  // A config resolved out of the non-dotted "gitleaks.toml" candidate is not
  // one gitleaks auto-discovers on its own; without an explicit --config,
  // the tool would silently fall back to its built-in ruleset and this
  // adapter would misreport whatever that scan finds as authoritative.
  const resolution = await gitleaks.resolve(fixtures("gitleaks-partial-unreadable"), "real-rule");
  assert.equal(resolution.location.file, "gitleaks.toml");
  const captureFile = join(await mkdtemp(join(tmpdir(), "arch-crew-checkers-capture-")), "args");
  const script = `#!/bin/sh\nprintf '%s\\n' "$@" > "$ARGS_CAPTURE_FILE"\nexit 0\n`;
  await withFakeTools({ gitleaks: script }, () =>
    withEnv({ ARGS_CAPTURE_FILE: captureFile }, async () => {
      await gitleaks.run(fixtures("gitleaks-partial-unreadable"), "real-rule", resolution);
    }));
  const capturedArgs = (await read(captureFile, "utf8")).split("\n");
  const configIndex = capturedArgs.indexOf("--config");
  assert.ok(configIndex >= 0, "gitleaks was not invoked with --config");
  assert.equal(capturedArgs[configIndex + 1], "gitleaks.toml");
});

test("gitleaks run() reports fail when the report contains a finding for the contract's RuleID", async () => {
  const resolution = await gitleaks.resolve(fixtures("gitleaks"), "aws-secret-key");
  const script = `#!/bin/sh\nreportpath=""\nprev=""\nfor arg in "$@"; do\n  if [ "$prev" = "--report-path" ]; then reportpath="$arg"; fi\n  prev="$arg"\ndone\nprintf '[{"RuleID":"aws-secret-key","File":"a.py","StartLine":3}]' > "$reportpath"\nexit 1\n`;
  await withFakeTools({ gitleaks: script }, async () => {
    const result = await gitleaks.run(fixtures("gitleaks"), "aws-secret-key", resolution);
    assert.equal(result.status, "fail");
    assert.match(result.evidence, /aws-secret-key/);
  });
});

test("gitleaks run() reports pass when the report has findings but none for the contract's RuleID", async () => {
  const resolution = await gitleaks.resolve(fixtures("gitleaks"), "aws-secret-key");
  const script = `#!/bin/sh\nreportpath=""\nprev=""\nfor arg in "$@"; do\n  if [ "$prev" = "--report-path" ]; then reportpath="$arg"; fi\n  prev="$arg"\ndone\nprintf '[{"RuleID":"other-rule","File":"a.py","StartLine":3}]' > "$reportpath"\nexit 1\n`;
  await withFakeTools({ gitleaks: script }, async () => {
    const result = await gitleaks.run(fixtures("gitleaks"), "aws-secret-key", resolution);
    assert.equal(result.status, "pass");
  });
});

test("findTestFunctions locates def lines regardless of surrounding indentation", () => {
  const text = "class Foo:\n    def test_a():\n        pass\ndef test_b():\n    pass\n";
  assert.deepEqual(findTestFunctions(text), [
    { name: "test_a", line: 2 },
    { name: "test_b", line: 4 },
  ]);
});

test("pytest-archon resolve() finds the real test function by name, and says it only matched the name", async () => {
  const result = await pytestArchon.resolve(fixtures("pytest-archon"), "test_domain_does_not_import_infra");
  assert.equal(result.resolved, true);
  assert.equal(result.location.file, "tests/test_layers.py");
  assert.match(result.evidence, /name match only; the body is not inspected/);
});

test("pytest-archon resolve() reports unbound for a function that does not exist", async () => {
  const result = await pytestArchon.resolve(fixtures("pytest-archon"), "test_missing");
  assert.deepEqual(result, {
    resolved: false,
    reason: "unbound",
    evidence: "no test function named 'test_missing' in any collected test file",
  });
});

test("pytest-archon run() reports unavailable when pytest is not on PATH", async () => {
  const resolution = await pytestArchon.resolve(fixtures("pytest-archon"), "test_domain_does_not_import_infra");
  await withNoToolsOnPath(async () => {
    const result = await pytestArchon.run(fixtures("pytest-archon"), "test_domain_does_not_import_infra", resolution);
    assert.equal(result.status, "unavailable");
  });
});

test("pytest-archon run() reports pass on exit 0", async () => {
  const resolution = await pytestArchon.resolve(fixtures("pytest-archon"), "test_domain_does_not_import_infra");
  await withFakeTools({ pytest: "#!/bin/sh\necho '1 passed'\nexit 0\n" }, async () => {
    const result = await pytestArchon.run(fixtures("pytest-archon"), "test_domain_does_not_import_infra", resolution);
    assert.equal(result.status, "pass");
  });
});

test("pytest-archon run() reports fail only on exit 1 (a proven test failure)", async () => {
  const resolution = await pytestArchon.resolve(fixtures("pytest-archon"), "test_domain_does_not_import_infra");
  await withFakeTools({ pytest: "#!/bin/sh\necho '1 failed'\nexit 1\n" }, async () => {
    const result = await pytestArchon.run(fixtures("pytest-archon"), "test_domain_does_not_import_infra", resolution);
    assert.equal(result.status, "fail");
  });
});

test("pytest-archon run() reports error, not fail, for a collection/usage/internal exit code", async () => {
  // Exit 2 (interrupted / collection error), 3 (internal error), 4 (usage
  // error) and 5 (no tests collected) all mean the contract was never
  // actually evaluated — e.g. pytest_archon is not importable in the active
  // interpreter — and must never be reported as a proven contract failure.
  const resolution = await pytestArchon.resolve(fixtures("pytest-archon"), "test_domain_does_not_import_infra");
  for (const exitCode of [2, 3, 4, 5]) {
    await withFakeTools({ pytest: `#!/bin/sh\necho 'collection error'\nexit ${exitCode}\n` }, async () => {
      const result = await pytestArchon.run(fixtures("pytest-archon"), "test_domain_does_not_import_infra", resolution);
      assert.equal(result.status, "error", `exit ${exitCode} must not be reported as fail`);
    });
  }
});

test("oasdiff resolve() accepts a real vendored check id even with no .oasdiff.yaml present", async () => {
  const result = await oasdiff.resolve(fixtures("text"), VENDORED_CHECK_IDS[0]);
  assert.equal(result.resolved, true);
  assert.match(result.evidence, /no \.oasdiff\.yaml found/);
  assert.equal(result.location, undefined);
});

test("oasdiff resolve() reports unbound for a made-up check id", async () => {
  const result = await oasdiff.resolve(fixtures("text"), "not-a-real-oasdiff-check");
  assert.deepEqual(result, {
    resolved: false,
    reason: "unbound",
    evidence: "'not-a-real-oasdiff-check' is not a recognised oasdiff check id (checked against a vendored list, not any file in this repo)",
  });
});

test("oasdiff run() reports unavailable with no base/revision spec pair to diff", async () => {
  const resolution = await oasdiff.resolve(fixtures("text"), VENDORED_CHECK_IDS[0]);
  const result = await oasdiff.run(fixtures("text"), VENDORED_CHECK_IDS[0], resolution);
  assert.equal(result.status, "unavailable");
  assert.match(result.evidence, /no base\/revision spec pair/);
});

async function scratchRepo() {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-checkers-"));
  const decisions = join(root, "docs/architecture/decisions");
  await mkdir(decisions, { recursive: true });
  return { root, decisions };
}

async function writeImportLinterConfig(root) {
  await write(
    join(root, ".importlinter"),
    "[importlinter]\nroot_package = myapp\n\n[importlinter:contract:one]\nname = domain-isolation\ntype = layers\n",
  );
}

async function writeDecision(decisions, rules) {
  await write(
    join(decisions, "0001-layered-domain.md"),
    `---\nid: 0001\nstatus: active\nskill: decide-architecture\ndate: 2026-09-09\ncommit: aa1ca89\nrules:\n${rules}\n---\n# Layered domain\n\n## Context\n## Decision\n## Consequences (cost)\n`,
  );
}

test("a rule with a real, resolvable binding reports unavailable and exits 0 by default", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: domain-imports-nothing\n    statement: no infra imports\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#domain-isolation\n",
  );
  assert.equal(await checkRules([], root), 0);
});

test("a blocking rule with no matching contract is unbound and exits 2", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: nonexistent\n    statement: x\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#does-not-exist\n",
  );
  assert.equal(await checkRules([], root), 2);
});

test("a warning-severity unbound rule exits 3, not 2", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: nonexistent\n    statement: x\n    severity: warning\n    verification: deterministic\n    verified_by: import-linter#does-not-exist\n",
  );
  assert.equal(await checkRules([], root), 3);
});

test("--require-tools alone (no --run) is a no-op", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: domain-imports-nothing\n    statement: x\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#domain-isolation\n",
  );
  assert.equal(await checkRules(["--require-tools"], root), 0);
});

test("--run --require-tools promotes a missing tool binary to blocking", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: domain-imports-nothing\n    statement: x\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#domain-isolation\n",
  );
  // Deterministic regardless of whether lint-imports happens to be
  // installed on this machine's real PATH — an isolated empty PATH is the
  // only reliable way to prove "the tool binary is missing" here.
  await withNoToolsOnPath(async () => {
    assert.equal(await checkRules(["--run", "--require-tools"], root), 2);
    assert.equal(await checkRules(["--run"], root), 0); // without --require-tools, still tolerated
  });
});

test("a decision-file parse error exits 1 and reports no rows", async () => {
  const { root, decisions } = await scratchRepo();
  await write(join(decisions, "0002-broken.md"), "---\nid: 0002\nstatus: active\n---\nno heading\n");
  assert.equal(await checkRules([], root), 1);
});

test("--json emits the same information as machine-readable rows", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: domain-imports-nothing\n    statement: x\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#domain-isolation\n",
  );
  let captured = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try {
    await checkRules(["--json"], root);
  } finally {
    process.stdout.write = originalWrite;
  }
  const parsed = JSON.parse(captured);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].rule, "domain-imports-nothing");
  assert.equal(parsed.rows[0].status, "unavailable");
});

test("narrative and review rules are counted, never resolved", async () => {
  const { root, decisions } = await scratchRepo();
  await writeDecision(
    decisions,
    "  - id: some-intent\n    statement: x\n    severity: warning\n    verification: narrative\n",
  );
  let captured = "";
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try {
    assert.equal(await checkRules([], root), 0);
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.match(captured, /1 non-deterministic rule\(s\) counted, not graded/);
});

test("--dir overrides discovery, matching build-constitution.mjs", async () => {
  const { root, decisions } = await scratchRepo();
  await writeImportLinterConfig(root);
  await writeDecision(
    decisions,
    "  - id: domain-imports-nothing\n    statement: x\n    severity: blocking\n    verification: deterministic\n    verified_by: import-linter#domain-isolation\n",
  );
  assert.equal(await checkRules(["--dir", decisions], root), 0);
});
