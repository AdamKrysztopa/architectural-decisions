import assert from "node:assert/strict";
import { test } from "node:test";

import { matchGlob, scopesOverlap } from "../runtime/migration/glob.mjs";

test("matchGlob: a trailing ** matches anything under the prefix", () => {
  assert.ok(matchGlob("services/**", "services/billing/db.py"));
  assert.ok(matchGlob("services/**", "services/billing.py"));
  assert.ok(!matchGlob("services/**", "libs/billing/db.py"));
});

test("matchGlob: * matches within one segment only", () => {
  assert.ok(matchGlob("skills/*/SKILL.md", "skills/decide-architecture/SKILL.md"));
  assert.ok(!matchGlob("skills/*/SKILL.md", "skills/a/b/SKILL.md"));
});

test("matchGlob: a literal pattern with no wildcard matches only itself", () => {
  assert.ok(matchGlob("runtime/baseline/decisions.mjs", "runtime/baseline/decisions.mjs"));
  assert.ok(!matchGlob("runtime/baseline/decisions.mjs", "runtime/baseline/decisions.mjs.bak"));
});

test("scopesOverlap: a shared prefix is a candidate conflict", () => {
  assert.ok(scopesOverlap(["services/**"], ["services/billing/**"]));
  assert.ok(scopesOverlap(["services/billing/**"], ["services/**"]));
});

test("scopesOverlap: disjoint static prefixes are not a candidate conflict", () => {
  assert.ok(!scopesOverlap(["services/billing/**"], ["services/payments/**"]));
});

test("scopesOverlap: identical scopes overlap", () => {
  assert.ok(scopesOverlap(["src/domain/**"], ["src/domain/**"]));
});

test("scopesOverlap: an empty scope on either side is never a candidate conflict", () => {
  assert.ok(!scopesOverlap([], ["services/**"]));
  assert.ok(!scopesOverlap(["services/**"], []));
  assert.ok(!scopesOverlap([], []));
});

test("scopesOverlap: a repo-wide wildcard scope overlaps every scoped rule", () => {
  // A leading wildcard has no static prefix to prove disjoint against, so it
  // must count as an overlap with everything, not nothing.
  assert.ok(scopesOverlap(["**"], ["services/**"]));
  assert.ok(scopesOverlap(["services/**"], ["**"]));
  assert.ok(scopesOverlap(["**/models.py"], ["services/**"]));
});

test("matchGlob shares its vocabulary with SP3's drift matcher instead of a second implementation", () => {
  // A wildcard-free pattern is a module name: it matches itself and its subtree.
  assert.ok(matchGlob("src/domain", "src/domain/model.py"));
  assert.ok(matchGlob("src/domain", "src/domain"));
  // '?' matches exactly one character.
  assert.ok(matchGlob("src/a?.py", "src/a1.py"));
  assert.ok(!matchGlob("src/a?.py", "src/a.py"));
  // A trailing slash is a directory prefix, not a literal segment.
  assert.ok(matchGlob("services/", "services/x.py"));
  // A construct outside the closed vocabulary is a loud error, never a silent
  // literal match.
  assert.throws(() => matchGlob("src/{a,b}/**", "src/a/x.py"));
  assert.throws(() => matchGlob("src/[ab].py", "src/a.py"));
});

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { listCandidates } from "../runtime/migration/discover-candidates.mjs";

test("listCandidates finds ADR-shaped files across every known directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-migration-"));
  await mkdir(join(root, "docs/adr"), { recursive: true });
  await mkdir(join(root, "docs/architecture/decisions"), { recursive: true });
  await writeFile(join(root, "docs/adr/0001-first.md"), "# placeholder\n");
  await writeFile(join(root, "docs/adr/README.md"), "not a decision\n");
  await writeFile(join(root, "docs/architecture/decisions/0002-second.md"), "---\n---\n# t\n");

  const found = await listCandidates(root);
  assert.deepEqual(found, [
    "docs/adr/0001-first.md",
    "docs/architecture/decisions/0002-second.md",
  ]);
});

test("listCandidates never reads file contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-migration-"));
  await mkdir(join(root, "docs/adr"), { recursive: true });
  // A file that would throw if parsed as a decision (no frontmatter). Listing
  // it must not throw — listing performs no parse.
  await writeFile(join(root, "docs/adr/0001-broken.md"), "not even frontmatter\n");
  await assert.doesNotReject(listCandidates(root));
});

test("listCandidates returns nothing when no candidate directory exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-migration-"));
  assert.deepEqual(await listCandidates(root), []);
});

import { spawnSync } from "node:child_process";
import { fileURLToPath as fileURLToPathForCli } from "node:url";

const discoverCandidatesCli = fileURLToPathForCli(
  new URL("../runtime/migration/discover-candidates.mjs", import.meta.url),
);

test("the discover-candidates CLI prints one candidate path per line and exits 0", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-migration-cli-"));
  await mkdir(join(root, "docs/adr"), { recursive: true });
  await writeFile(join(root, "docs/adr/0001-first.md"), "# placeholder\n");
  const result = spawnSync(process.execPath, [discoverCandidatesCli], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "docs/adr/0001-first.md\n");
});

test("the discover-candidates CLI reports no candidates on stderr, not silence, and still exits 0", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-migration-cli-"));
  const result = spawnSync(process.execPath, [discoverCandidatesCli], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /No candidates found/);
});

import {
  candidateScopeConflicts,
  classifyInputs,
  structuralConflicts,
} from "../runtime/migration/classify-inputs.mjs";

const schemaText = (id, ruleId, scope) =>
  `---\nid: ${id}\nstatus: active\nskill: decide-architecture\ndate: 2026-09-09\ncommit: aaaaaaa\n` +
  `rules:\n  - id: ${ruleId}\n    statement: Placeholder statement.\n    scope: ["${scope}"]\n` +
  `    severity: blocking\n    verification: narrative\n---\n# Title ${id}\n\n## Context\nx\n`;

test("classifyInputs splits confirmed inputs into schema decisions and prose, and reads nothing else", () => {
  const confirmed = [
    { path: "docs/architecture/decisions/0001-a.md", text: schemaText("0001", "rule-a", "services/**") },
    { path: "docs/adr/0002-prose.md", text: "# Just prose\n\nNo frontmatter here.\n" },
  ];
  const classified = classifyInputs(confirmed);
  assert.equal(classified[0].kind, "schema-decision");
  assert.equal(classified[0].decision.id, 1);
  assert.equal(classified[1].kind, "prose");
  assert.match(classified[1].reason, /does not open with/);
});

test("structuralConflicts reuses validateDecisions across the confirmed schema inputs", () => {
  const confirmed = [
    { path: "0001-a.md", text: schemaText("0001", "same-id", "services/**") },
    { path: "0002-b.md", text: schemaText("0002", "same-id", "libs/**") },
  ];
  const errors = structuralConflicts(classifyInputs(confirmed));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /same-id/);
});

test("candidateScopeConflicts flags overlapping scopes across different decisions as candidates", () => {
  const confirmed = [
    { path: "0001-a.md", text: schemaText("0001", "rule-a", "services/**") },
    { path: "0002-b.md", text: schemaText("0002", "rule-b", "services/billing/**") },
  ];
  const conflicts = candidateScopeConflicts(classifyInputs(confirmed));
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0], { decisionA: 1, decisionB: 2, ruleA: "rule-a", ruleB: "rule-b" });
});

test("candidateScopeConflicts reports nothing for disjoint scopes", () => {
  const confirmed = [
    { path: "0001-a.md", text: schemaText("0001", "rule-a", "services/billing/**") },
    { path: "0002-b.md", text: schemaText("0002", "rule-b", "services/payments/**") },
  ];
  assert.deepEqual(candidateScopeConflicts(classifyInputs(confirmed)), []);
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DISPOSITIONS,
  REPORTED_DISPOSITIONS,
  buildTraceability,
  canonicalDisposition,
  renderTraceabilityReport,
} from "../runtime/migration/traceability.mjs";
import { parseDecision } from "../runtime/baseline/decisions.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationFixtures = join(repositoryRoot, "test/fixtures/migration");

async function fixtureDecision() {
  const text = await readFile(join(migrationFixtures, "0011-events-over-shared-db.md"), "utf8");
  return parseDecision(text, "0011-events-over-shared-db.md");
}

test("DISPOSITIONS names the six reported outcomes, plus the two retained aliases", () => {
  // The traceability requirement names six categories: migrated, merged,
  // superseded, omitted, conflicting, unresolved. `left-as-prose` and
  // `unmapped` are the original narrower names for omitted and unresolved and
  // stay accepted, so manifests and the committed fixture keep parsing.
  assert.deepEqual([...DISPOSITIONS].sort(), [
    "conflicting",
    "left-as-prose",
    "merged",
    "migrated",
    "omitted",
    "superseded",
    "unmapped",
    "unresolved",
  ]);
  assert.deepEqual([...REPORTED_DISPOSITIONS], [
    "migrated",
    "merged",
    "superseded",
    "omitted",
    "conflicting",
    "unresolved",
  ]);
  // Each alias folds into exactly the category it always meant.
  assert.equal(canonicalDisposition("left-as-prose"), "omitted");
  assert.equal(canonicalDisposition("unmapped"), "unresolved");
  assert.equal(canonicalDisposition("migrated"), "migrated");
});

test("buildTraceability throws, naming the path, when an input has no disposition", async () => {
  const decisions = [await fixtureDecision()];
  const inputs = [
    { path: "docs/adr/0003-shared-db-writes.md" },
    { path: "docs/adr/0004-untouched.md" },
  ];
  const dispositions = [
    { path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 },
  ];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions, generatedAt: "2026-09-09" }),
    /docs\/adr\/0004-untouched\.md/,
  );
});

test("buildTraceability throws when a migrated decision does not cite its source", async () => {
  const decisions = [await fixtureDecision()];
  const inputs = [{ path: "docs/adr/9999-not-the-real-source.md" }];
  const dispositions = [
    { path: "docs/adr/9999-not-the-real-source.md", kind: "migrated", decisionId: 11 },
  ];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions, generatedAt: "2026-09-09" }),
    /does not cite it/,
  );
});

test("buildTraceability throws when the path is mentioned outside the '## Sources' section only", async () => {
  const noSourcesText =
    "---\nid: 0013\nstatus: proposed\nskill: decide-architecture\ndate: 2026-09-09\ncommit: aa1ca87\n---\n" +
    "# No sources decision\n\n## Context\n" +
    "Unlike docs/adr/0003-shared-db-writes.md, which we deliberately did NOT use as a source.\n";
  const decision = parseDecision(noSourcesText, "0013-no-sources.md");
  const inputs = [{ path: "docs/adr/0003-shared-db-writes.md" }];
  const dispositions = [{ path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 13 }];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions: [decision], generatedAt: "2026-09-09" }),
    /does not cite it/,
  );
});

test("buildTraceability does not accept a path that is merely a suffix of a cited path", async () => {
  const decisions = [await fixtureDecision()]; // Sources cites docs/adr/0003-shared-db-writes.md
  const inputs = [{ path: "adr/0003-shared-db-writes.md" }];
  const dispositions = [{ path: "adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 }];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions, generatedAt: "2026-09-09" }),
    /does not cite it/,
  );
});

test("buildTraceability throws when left-as-prose or unmapped carries no reason", async () => {
  const inputs = [{ path: "docs/adr/0005-legacy.md" }];
  const dispositions = [{ path: "docs/adr/0005-legacy.md", kind: "left-as-prose" }];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions: [], generatedAt: "2026-09-09" }),
    /must state a reason/,
  );
});

test("buildTraceability throws on a disposition for an input that was never confirmed", async () => {
  const inputs = [];
  const dispositions = [{ path: "docs/adr/0006-not-confirmed.md", kind: "unmapped", reason: "x" }];
  assert.throws(
    () => buildTraceability({ inputs, dispositions, decisions: [], generatedAt: "2026-09-09" }),
    /never confirmed/,
  );
});

test("renders the golden traceability report byte-for-byte", async () => {
  const decisions = [await fixtureDecision()];
  const inputs = [
    { path: "docs/adr/0003-shared-db-writes.md" },
    { path: "docs/adr/0004-unrelated-note.md" },
  ];
  const dispositions = [
    { path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 },
    {
      path: "docs/adr/0004-unrelated-note.md",
      kind: "left-as-prose",
      reason: "Meeting notes, not a decision; no schema equivalent proposed.",
    },
  ];
  const model = buildTraceability({ inputs, dispositions, decisions, generatedAt: "2026-09-09" });
  const rendered = renderTraceabilityReport(model);
  const expected = await readFile(join(migrationFixtures, "migration-report.expected.md"), "utf8");
  assert.equal(rendered, expected);
});

test("the report renders identically regardless of input or disposition order", async () => {
  const decisions = [await fixtureDecision()];
  const inputs = [
    { path: "docs/adr/0004-unrelated-note.md" },
    { path: "docs/adr/0003-shared-db-writes.md" },
  ];
  const dispositions = [
    {
      path: "docs/adr/0004-unrelated-note.md",
      kind: "left-as-prose",
      reason: "Meeting notes, not a decision; no schema equivalent proposed.",
    },
    { path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 },
  ];
  const forward = renderTraceabilityReport(
    buildTraceability({ inputs, dispositions, decisions, generatedAt: "2026-09-09" }),
  );
  const reversed = renderTraceabilityReport(
    buildTraceability({
      inputs: [...inputs].reverse(),
      dispositions: [...dispositions].reverse(),
      decisions,
      generatedAt: "2026-09-09",
    }),
  );
  assert.equal(forward, reversed);
});

import { dirname } from "node:path";

import { countPatternOccurrences } from "../runtime/migration/inventory.mjs";

async function scratchTree(files) {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-inventory-"));
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(root, dirname(path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

test("countPatternOccurrences reports matches and exceptions, not a verdict", async () => {
  const root = await scratchTree({
    "src/domain/order.py": "from domain.money import Money\n",
    "src/domain/invoice.py": "from domain.money import Money\n",
    "src/domain/legacy.py": "from infra.db import Session\n",
    "src/infra/db.py": "class Session: ...\n",
  });
  const result = await countPatternOccurrences(root, "src/domain/**", "from infra");
  assert.equal(result.total, 3);
  assert.deepEqual(result.matches.sort(), ["src/domain/legacy.py"]);
  assert.deepEqual(result.exceptions.sort(), ["src/domain/invoice.py", "src/domain/order.py"]);
});

test("countPatternOccurrences accepts a RegExp pattern", async () => {
  const root = await scratchTree({
    "src/domain/a.py": "import os\n",
    "src/domain/b.py": "import sys\n",
  });
  const result = await countPatternOccurrences(root, "src/domain/**", /^import (os|sys)$/m);
  assert.equal(result.matches.length, 2);
});

test("countPatternOccurrences does not lose matches to a /g pattern's persisted lastIndex", async () => {
  const root = await scratchTree({
    "src/domain/a.py": "from infra import x\n",
    "src/domain/b.py": "from infra import y\n",
    "src/domain/c.py": "from infra import z\n",
    "src/domain/d.py": "from infra import w\n",
  });
  const result = await countPatternOccurrences(root, "src/domain/**", /from infra/g);
  assert.equal(result.matches.length, 4);
  assert.deepEqual(result.exceptions, []);
});

test("countPatternOccurrences skips node_modules and .git", async () => {
  const root = await scratchTree({
    "src/domain/a.py": "clean\n",
    "node_modules/pkg/index.js": "from infra import x\n",
    ".git/HEAD": "ref: refs/heads/main\n",
  });
  const result = await countPatternOccurrences(root, "**", "from infra");
  assert.equal(result.total, 1);
});

test("countPatternOccurrences skips every directory runtime/checkers/text.mjs's walk also skips", async () => {
  // SKIP_DIRECTORIES (runtime/baseline/skip-directories.mjs) is shared with
  // runtime/checkers/text.mjs's config-file walk -- both must agree, or the
  // same repository yields two different "N of M modules" totals depending
  // only on which walk answered. This exercises every entry, not only
  // node_modules/.git.
  const root = await scratchTree({
    "src/domain/a.py": "clean\n",
    "node_modules/pkg/index.js": "from infra import x\n",
    ".git/HEAD": "ref: refs/heads/main\n",
    ".venv/lib/vendored.py": "from infra import x\n",
    "venv/lib/vendored.py": "from infra import x\n",
    "__pycache__/cached.py": "from infra import x\n",
    ".tox/env/lib.py": "from infra import x\n",
    ".arch-crew/drift-queue.jsonl": "from infra import x\n",
  });
  const result = await countPatternOccurrences(root, "**", "from infra");
  assert.equal(result.total, 1, "only src/domain/a.py should be walked");
});

test("inventory.mjs's walk and checkers/text.mjs's walk agree on the same file set for the same root", async () => {
  const root = await scratchTree({
    "src/domain/a.py": "clean\n",
    "src/domain/nested/b.py": "clean\n",
    "node_modules/pkg/index.py": "clean\n",
    ".git/index.py": "clean\n",
    ".venv/lib/vendored.py": "clean\n",
    "venv/lib/vendored.py": "clean\n",
    "__pycache__/cached.py": "clean\n",
    ".tox/env/lib.py": "clean\n",
    ".arch-crew/queue.py": "clean\n",
  });
  const { findConfigFiles } = await import("../runtime/checkers/text.mjs");
  const viaText = (await findConfigFiles(root, ["**/*.py"])).sort();
  const viaInventory = (await countPatternOccurrences(root, "**", "")).matches.sort();
  assert.deepEqual(viaText, ["src/domain/a.py", "src/domain/nested/b.py"]);
  assert.deepEqual(viaInventory, viaText);
});

test("SKIP_DIRECTORIES pins queue.mjs's QUEUE_DIRECTORY, as its own module comment claims", async () => {
  // runtime/baseline/skip-directories.mjs's comment says ".arch-crew" is
  // "duplicated as a literal here, not imported ... a test pins the two
  // constants equal" -- this is that test. Without it, queue.mjs's
  // QUEUE_DIRECTORY could be renamed with nothing catching that the walks in
  // text.mjs and inventory.mjs still skip the old, now-wrong literal.
  const { SKIP_DIRECTORIES } = await import("../runtime/baseline/skip-directories.mjs");
  const { QUEUE_DIRECTORY } = await import("../runtime/drift/queue.mjs");
  assert.ok(
    SKIP_DIRECTORIES.has(QUEUE_DIRECTORY),
    `SKIP_DIRECTORIES does not contain queue.mjs's QUEUE_DIRECTORY ('${QUEUE_DIRECTORY}')`,
  );
});

import { run as buildMigrationReport } from "../runtime/migration/build-migration-report.mjs";

async function scratchDecisionsDir(names) {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-report-"));
  const decisions = join(root, "docs/architecture/decisions");
  await mkdir(decisions, { recursive: true });
  for (const name of names) {
    await writeFile(join(decisions, name), await readFile(join(migrationFixtures, name), "utf8"));
  }
  return { root, decisions };
}

async function writeManifest(root, manifest) {
  const path = join(root, "manifest.json");
  await writeFile(path, JSON.stringify(manifest, null, 2));
  return path;
}

test("writes migration-report.md beside the decisions directory on a valid manifest", async () => {
  const { root, decisions } = await scratchDecisionsDir(["0011-events-over-shared-db.md"]);
  const manifest = await writeManifest(root, {
    inputs: [{ path: "docs/adr/0003-shared-db-writes.md" }],
    dispositions: [{ path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 }],
  });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions], root);
  assert.equal(code, 0);
  const written = await readFile(join(decisions, "../migration-report.md"), "utf8");
  assert.match(written, /migrated → 0011/);
});

test("exits 1 and writes nothing when the manifest is not exhaustive", async () => {
  const { root, decisions } = await scratchDecisionsDir(["0011-events-over-shared-db.md"]);
  const manifest = await writeManifest(root, {
    inputs: [
      { path: "docs/adr/0003-shared-db-writes.md" },
      { path: "docs/adr/0099-missing-disposition.md" },
    ],
    dispositions: [{ path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 }],
  });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions], root);
  assert.equal(code, 1);
  await assert.rejects(readFile(join(decisions, "../migration-report.md"), "utf8"));
});

test("refuses above the cap and writes nothing", async () => {
  const { root, decisions } = await scratchDecisionsDir(["0011-events-over-shared-db.md"]);
  const manifest = await writeManifest(root, {
    inputs: [{ path: "docs/adr/0003-shared-db-writes.md" }],
    dispositions: [{ path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 }],
  });
  const code = await buildMigrationReport(
    ["--manifest", manifest, "--dir", decisions, "--cap", "0"],
    root,
  );
  assert.equal(code, 1);
  await assert.rejects(readFile(join(decisions, "../migration-report.md"), "utf8"));
});

test("--manifest and --dir are both required", async () => {
  const { root } = await scratchDecisionsDir([]);
  await assert.rejects(buildMigrationReport([], root), /--manifest/);
});

test("the report names overlapping rule scopes across decisions as a candidate conflict", async () => {
  const { root, decisions } = await scratchDecisionsDir([
    "0011-events-over-shared-db.md",
    "0012-billing-scope-note.md",
  ]);
  const manifest = await writeManifest(root, {
    inputs: [
      { path: "docs/adr/0003-shared-db-writes.md" },
      { path: "docs/adr/0004-billing-notes.md" },
    ],
    dispositions: [
      { path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 },
      { path: "docs/adr/0004-billing-notes.md", kind: "migrated", decisionId: 12 },
    ],
  });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions], root);
  assert.equal(code, 0);
  const written = await readFile(join(decisions, "../migration-report.md"), "utf8");
  assert.match(written, /## Candidate conflicts/);
  assert.match(written, /0011/);
  assert.match(written, /0012/);
  assert.match(written, /no-shared-db-writes/);
  assert.match(written, /billing-owns-its-writes/);
});

test("the report says so when no candidate conflict was found", async () => {
  const { root, decisions } = await scratchDecisionsDir(["0011-events-over-shared-db.md"]);
  const manifest = await writeManifest(root, {
    inputs: [{ path: "docs/adr/0003-shared-db-writes.md" }],
    dispositions: [{ path: "docs/adr/0003-shared-db-writes.md", kind: "migrated", decisionId: 11 }],
  });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions], root);
  assert.equal(code, 0);
  const written = await readFile(join(decisions, "../migration-report.md"), "utf8");
  assert.match(written, /## Candidate conflicts\n\n_None detected/);
});

test("the cap counts every status: proposed decision file, even with an empty manifest", async () => {
  // Reverse discovery proposes decisions straight from code observation: it has
  // no prose inputs and so no dispositions to count. The cap must still fire.
  const { root, decisions } = await scratchDecisionsDir([
    "0011-events-over-shared-db.md",
    "0012-billing-scope-note.md",
  ]);
  const manifest = await writeManifest(root, { inputs: [], dispositions: [] });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions, "--cap", "1"], root);
  assert.equal(code, 1);
  await assert.rejects(readFile(join(decisions, "../migration-report.md"), "utf8"));
});

test("the cap-refusal message names the directory's whole backlog, not just what this pass proposed", async () => {
  // This pass's own manifest proposes nothing (empty inputs/dispositions) --
  // it is the two pre-existing proposed decisions already in the directory
  // that exceed the cap. The old message ("This run proposes N decisions")
  // was unfollowable here: there was nothing in this run to rank.
  const { root, decisions } = await scratchDecisionsDir([
    "0011-events-over-shared-db.md",
    "0012-billing-scope-note.md",
  ]);
  const manifest = await writeManifest(root, { inputs: [], dispositions: [] });
  const original = process.stderr.write;
  let captured = "";
  process.stderr.write = (chunk) => {
    captured += chunk;
    return true;
  };
  let code;
  try {
    code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions, "--cap", "1"], root);
  } finally {
    process.stderr.write = original;
  }
  assert.equal(code, 1);
  assert.match(captured, /This directory holds 2 unreviewed proposed decisions \(cap 1\)/);
  assert.doesNotMatch(captured, /This run proposes/);
});

test("the cap is not bypassed by routing new proposed decisions through a 'superseded' disposition", async () => {
  const { root, decisions } = await scratchDecisionsDir([
    "0011-events-over-shared-db.md",
    "0012-billing-scope-note.md",
  ]);
  const manifest = await writeManifest(root, {
    inputs: [
      { path: "docs/adr/0003-shared-db-writes.md" },
      { path: "docs/adr/0004-billing-notes.md" },
    ],
    dispositions: [
      { path: "docs/adr/0003-shared-db-writes.md", kind: "superseded", decisionId: 11 },
      { path: "docs/adr/0004-billing-notes.md", kind: "superseded", decisionId: 12 },
    ],
  });
  const code = await buildMigrationReport(["--manifest", manifest, "--dir", decisions, "--cap", "1"], root);
  assert.equal(code, 1);
  await assert.rejects(readFile(join(decisions, "../migration-report.md"), "utf8"));
});
