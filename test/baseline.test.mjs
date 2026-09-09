import assert from "node:assert/strict";
import { test } from "node:test";

import { FrontmatterError, parseFrontmatter } from "../runtime/baseline/frontmatter.mjs";

const doc = (frontmatter, body = "# Title\n") => `---\n${frontmatter}\n---\n${body}`;

test("parses top-level scalars and strips quotes", () => {
  const { values, body } = parseFrontmatter(doc("id: 0004\nskill: \"decide-architecture\""));
  assert.equal(values.id, "0004");
  assert.equal(values.skill, "decide-architecture");
  assert.equal(body, "# Title\n");
});

test("parses an inline string list", () => {
  const { values } = parseFrontmatter(doc('scope: ["services/**", "libs/a"]'));
  assert.deepEqual(values.scope, ["services/**", "libs/a"]);
});

test("parses a block list of maps with continuation fields", () => {
  const { values } = parseFrontmatter(
    doc("rules:\n  - id: no-shared-db-writes\n    severity: blocking\n  - id: second\n    severity: warning"),
  );
  assert.deepEqual(values.rules, [
    { id: "no-shared-db-writes", severity: "blocking" },
    { id: "second", severity: "warning" },
  ]);
});

test("rejects an unsupported construct with a line number", () => {
  assert.throws(
    () => parseFrontmatter(doc("id: 0004\nnote: |\n  block scalar")),
    (error) => error instanceof FrontmatterError && error.line === 3,
  );
});

test("rejects a tab", () => {
  assert.throws(() => parseFrontmatter(doc("id:\t0004")), FrontmatterError);
});

test("rejects a duplicate key", () => {
  assert.throws(() => parseFrontmatter(doc("id: 1\nid: 2")), FrontmatterError);
});

test("rejects a file that does not open with a frontmatter block", () => {
  assert.throws(() => parseFrontmatter("# Title\n"), FrontmatterError);
});

import { KNOWN_TOOLS, parseDecision, validateDecisions } from "../runtime/baseline/decisions.mjs";

const decisionText = (frontmatter, title = "Events over a shared database") =>
  `---\n${frontmatter}\n---\n# ${title}\n\n## Context\nPlaceholder.\n`;

const validFrontmatter = [
  "id: 0004",
  "status: active",
  "skill: decide-architecture",
  "date: 2026-09-09",
  "commit: aa1ca89",
  "rules:",
  "  - id: no-shared-db-writes",
  "    statement: Services must not write to another service's tables.",
  '    scope: ["services/**"]',
  "    severity: blocking",
  "    verification: deterministic",
  "    verified_by: import-linter#svc-db-isolation",
].join("\n");

test("parses a decision and its rules", () => {
  const decision = parseDecision(decisionText(validFrontmatter), "0004-events-over-shared-db.md");
  assert.equal(decision.id, 4);
  assert.equal(decision.slug, "events-over-shared-db");
  assert.equal(decision.title, "Events over a shared database");
  assert.equal(decision.rules.length, 1);
  assert.deepEqual(decision.rules[0].scope, ["services/**"]);
  assert.equal(decision.rules[0].decision, 4);
});

test("rejects a filename that does not match the id", () => {
  assert.throws(() => parseDecision(decisionText(validFrontmatter), "0007-other.md"), /does not match/);
});

test("rejects an illegal status", () => {
  const text = decisionText(validFrontmatter.replace("status: active", "status: draft"));
  assert.throws(() => parseDecision(text, "0004-events-over-shared-db.md"), /status/);
});

test("rejects a deterministic rule with no verified_by", () => {
  const text = decisionText(validFrontmatter.split("\n").filter((line) => !line.includes("verified_by")).join("\n"));
  assert.throws(() => parseDecision(text, "0004-events-over-shared-db.md"), /verified_by/);
});

test("rejects a verified_by naming an unknown tool", () => {
  const text = decisionText(validFrontmatter.replace("import-linter#svc", "archunit#svc"));
  assert.throws(() => parseDecision(text, "0004-events-over-shared-db.md"), /unknown tool/);
  assert.ok(KNOWN_TOOLS.includes("import-linter"));
});

test("KNOWN_TOOLS includes ast-grep, added alongside its checker adapter", () => {
  assert.ok(KNOWN_TOOLS.includes("ast-grep"));
});

test("rejects a narrative rule that claims a binding", () => {
  const text = decisionText(validFrontmatter.replace("verification: deterministic", "verification: narrative"));
  assert.throws(() => parseDecision(text, "0004-events-over-shared-db.md"), /only a deterministic rule/);
});

test("reports duplicate rule ids across decisions", () => {
  const first = parseDecision(decisionText(validFrontmatter), "0004-events-over-shared-db.md");
  const second = parseDecision(
    decisionText(validFrontmatter.replace("id: 0004", "id: 0005")),
    "0005-second.md",
  );
  const errors = validateDecisions([first, second]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no-shared-db-writes/);
});

test("reports a superseded_by that resolves to nothing", () => {
  const text = decisionText(
    validFrontmatter.replace("status: active", "status: superseded\nsuperseded_by: 0099"),
  );
  const errors = validateDecisions([parseDecision(text, "0004-events-over-shared-db.md")]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /0099/);
});

test("reports a superseded decision with no superseded_by", () => {
  const text = decisionText(validFrontmatter.replace("status: active", "status: superseded"));
  const errors = validateDecisions([parseDecision(text, "0004-events-over-shared-db.md")]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /superseded_by/);
});

// --- Fix-round 1 regressions ---

test("splits an inline list on commas outside quotes, and rejects an unterminated quoted element", () => {
  const { values } = parseFrontmatter(doc('scope: ["a, b", "c"]'));
  assert.deepEqual(values.scope, ["a, b", "c"]);
  assert.throws(() => parseFrontmatter(doc('scope: ["a]')), FrontmatterError);
});

test("an apostrophe mid-element is literal, not a quote open, so elements stay distinct", () => {
  const { values } = parseFrontmatter(doc("scope: [don't, won't]"));
  assert.deepEqual(values.scope, ["don't", "won't"]);
});

test("rejects an unterminated or mismatched quoted scalar", () => {
  assert.throws(() => parseFrontmatter(doc('skill: "decide-architecture')), FrontmatterError);
  assert.throws(() => parseFrontmatter(doc("skill: \"decide-architecture'")), FrontmatterError);
});

test("keeps a block-list string item with a colon and no following space as a string", () => {
  const { values } = parseFrontmatter(doc("scope:\n  - http://example.com:8080\n  - other"));
  assert.deepEqual(values.scope, ["http://example.com:8080", "other"]);
});

test("rejects a trailing comment on an unquoted value, but allows a literal # inside quotes", () => {
  assert.throws(() => parseFrontmatter(doc("id: 0004 # note")), FrontmatterError);
  const { values } = parseFrontmatter(doc('note: "keep # this"'));
  assert.equal(values.note, "keep # this");
});

test("rejects a non-integer superseded_by", () => {
  const text = decisionText(
    validFrontmatter.replace("status: active", "status: superseded\nsuperseded_by: not-a-number"),
  );
  assert.throws(() => parseDecision(text, "0004-events-over-shared-db.md"), /superseded_by/);
});

test("a parsed decision retains its body", () => {
  const text = decisionText(validFrontmatter, "Events over a shared database") +
    "\n## Sources\n- `docs/adr/0002-events.md`\n";
  const decision = parseDecision(text, "0004-events-over-shared-db.md");
  assert.match(decision.body, /## Sources/);
  assert.match(decision.body, /docs\/adr\/0002-events\.md/);
});

// --- Task 3: constitution renderer ---

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderConstitution } from "../runtime/baseline/constitution.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureDir = join(repositoryRoot, "test/fixtures/decisions");

async function fixtureDecisions() {
  const names = (await readdir(fixtureDir)).filter((name) => name.endsWith(".md")).sort();
  const decisions = [];
  for (const name of names) {
    decisions.push(parseDecision(await readFile(join(fixtureDir, name), "utf8"), name));
  }
  return decisions;
}

test("the fixture corpus validates", async () => {
  assert.deepEqual(validateDecisions(await fixtureDecisions()), []);
});

test("renders the golden constitution byte-for-byte", async () => {
  const expected = await readFile(join(repositoryRoot, "test/fixtures/constitution.md"), "utf8");
  assert.equal(renderConstitution(await fixtureDecisions()), expected);
});

test("excludes proposed and superseded decisions", async () => {
  const rendered = renderConstitution(await fixtureDecisions());
  assert.doesNotMatch(rendered, /contract-tests-at-service-edges/);
  assert.doesNotMatch(rendered, /shared-db-is-fine/);
});

test("output does not depend on input order", async () => {
  const decisions = await fixtureDecisions();
  assert.equal(renderConstitution([...decisions].reverse()), renderConstitution(decisions));
});

test("output carries no timestamp or commit sha", async () => {
  const rendered = renderConstitution(await fixtureDecisions());
  for (const commit of ["1111111", "2222222", "3333333", "4444444"]) {
    assert.ok(!rendered.includes(commit), `rendered output leaks commit ${commit}`);
  }
  assert.doesNotMatch(rendered, /\d{4}-\d{2}-\d{2}/);
});

test("a deterministic rule's note points at the checker, and no longer claims the binding is unresolved", async () => {
  const rendered = renderConstitution(await fixtureDecisions());
  assert.match(rendered, /run the rule checker to resolve this binding and evaluate it/);
  assert.doesNotMatch(rendered, /the contract itself is not yet resolved/);
});

// --- Task 4: the CLI ---

import { mkdtemp, mkdir, writeFile as write } from "node:fs/promises";
import { tmpdir } from "node:os";

import { discoverDirectory, run } from "../runtime/baseline/build-constitution.mjs";

async function scratchRepo() {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-"));
  const decisions = join(root, "docs/architecture/decisions");
  await mkdir(decisions, { recursive: true });
  for (const name of ["0001-layered-domain.md", "0002-events-over-shared-db.md"]) {
    await write(join(decisions, name), await readFile(join(fixtureDir, name), "utf8"));
  }
  return { root, decisions };
}

test("a docs/adr holding only a legacy prose ADR is skipped in favor of a parseable docs/architecture/decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-"));
  const adr = join(root, "docs/adr");
  const decisions = join(root, "docs/architecture/decisions");
  await mkdir(adr, { recursive: true });
  await mkdir(decisions, { recursive: true });
  await write(join(adr, "0001-prose.md"), "# Not a decision file\n\nJust prose, no frontmatter.\n");
  await write(
    join(decisions, "0001-layered-domain.md"),
    await readFile(join(fixtureDir, "0001-layered-domain.md"), "utf8"),
  );
  assert.equal(await discoverDirectory(root), decisions);
});

test("a docs/adr with at least one parseable decision still wins on candidate order", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-"));
  const adr = join(root, "docs/adr");
  const decisions = join(root, "docs/architecture/decisions");
  await mkdir(adr, { recursive: true });
  await mkdir(decisions, { recursive: true });
  await write(join(adr, "0001-prose.md"), "# Not a decision file\n\nJust prose, no frontmatter.\n");
  await write(
    join(adr, "0002-events-over-shared-db.md"),
    await readFile(join(fixtureDir, "0002-events-over-shared-db.md"), "utf8"),
  );
  await write(
    join(decisions, "0001-layered-domain.md"),
    await readFile(join(fixtureDir, "0001-layered-domain.md"), "utf8"),
  );
  assert.equal(await discoverDirectory(root), adr);
});

test("a directory whose only decision file is malformed is still selected, and the parse error stays loud", async () => {
  const root = await mkdtemp(join(tmpdir(), "arch-crew-"));
  const adr = join(root, "docs/adr");
  await mkdir(adr, { recursive: true });
  await write(join(adr, "0001-broken.md"), "not frontmatter at all\n");
  assert.equal(await discoverDirectory(root), adr);
  assert.equal(await run([], root), 1);
});

test("build writes the constitution beside the decisions directory", async () => {
  const { root, decisions } = await scratchRepo();
  assert.equal(await run([], root), 0);
  const written = await readFile(join(decisions, "../constitution.md"), "utf8");
  assert.match(written, /Do not edit by hand/);
  assert.match(written, /domain-imports-nothing/);
});

test("check passes on a fresh build and fails on a stale one", async () => {
  const { root, decisions } = await scratchRepo();
  assert.equal(await run([], root), 0);
  assert.equal(await run(["--check"], root), 0);

  await write(join(decisions, "../constitution.md"), "stale\n");
  assert.equal(await run(["--check"], root), 2);
  assert.equal(await readFile(join(decisions, "../constitution.md"), "utf8"), "stale\n");
});

test("a validation error exits 1 and writes nothing", async () => {
  const { root, decisions } = await scratchRepo();
  await write(
    join(decisions, "0005-broken.md"),
    "---\nid: 0005\nstatus: active\nskill: x\ndate: 2026-09-09\ncommit: abc1234\n---\nno heading\n",
  );
  assert.equal(await run([], root), 1);
  await assert.rejects(readFile(join(decisions, "../constitution.md"), "utf8"));
});

test("--dir overrides discovery", async () => {
  const { root, decisions } = await scratchRepo();
  assert.equal(await run(["--dir", decisions], root), 0);
});

test("this repository's own committed constitution is not stale", async () => {
  assert.equal(
    await run(["--dir", "docs/architecture/decisions", "--check"], repositoryRoot),
    0,
  );
});

// --- Task 8: the promote verb ---

import { promoteStatusLine, runPromote } from "../runtime/baseline/build-constitution.mjs";

test("promoteStatusLine changes exactly the status line", () => {
  const before = decisionText(validFrontmatter); // status: active in this fixture; use a proposed one:
  const proposedText = decisionText(validFrontmatter.replace("status: active", "status: proposed"));
  const after = promoteStatusLine(proposedText, 4, "0004-events-over-shared-db.md");
  const beforeLines = proposedText.split("\n");
  const afterLines = after.split("\n");
  const changed = beforeLines
    .map((line, index) => (line === afterLines[index] ? null : index))
    .filter((index) => index !== null);
  assert.deepEqual(changed, [beforeLines.indexOf("status: proposed")]);
  assert.ok(afterLines.includes("status: active"));
});

test("promoteStatusLine refuses an already-active decision", () => {
  const text = decisionText(validFrontmatter); // status: active
  assert.throws(() => promoteStatusLine(text, 4, "0004-x.md"), /already active/);
});

test("promoteStatusLine refuses a superseded decision", () => {
  const text = decisionText(validFrontmatter.replace("status: active", "status: superseded\nsuperseded_by: 0009"));
  assert.throws(() => promoteStatusLine(text, 4, "0004-x.md"), /superseded/);
});

test("runPromote flips status, regenerates the constitution, and touches only the named files", async () => {
  const { root, decisions } = await scratchRepo(); // from Task 4 of the SP1 plan: 0001 and 0002, both active
  const proposedName = "0005-proposed-extra.md";
  await write(
    join(decisions, proposedName),
    decisionText(
      validFrontmatter
        .replace("id: 0004", "id: 0005")
        .replace("status: active", "status: proposed")
        .replace("no-shared-db-writes", "extra-rule"),
    ),
  );
  const code = await runPromote(["0005"], root);
  assert.equal(code, 0);
  const promoted = await readFile(join(decisions, proposedName), "utf8");
  assert.match(promoted, /status: active/);
  const constitution = await readFile(join(decisions, "../constitution.md"), "utf8");
  assert.match(constitution, /extra-rule/);
});

test("runPromote exits 1 for an id that does not exist, and writes nothing", async () => {
  const { root, decisions } = await scratchRepo();
  const before = await readFile(join(decisions, "../constitution.md"), "utf8").catch(() => null);
  const code = await runPromote(["0099"], root);
  assert.equal(code, 1);
  const after = await readFile(join(decisions, "../constitution.md"), "utf8").catch(() => null);
  assert.equal(before, after);
});

test("runPromote validates every requested id before writing any of them", async () => {
  const { root, decisions } = await scratchRepo();
  const alphaText = decisionText(
    validFrontmatter
      .replace("id: 0004", "id: 0007")
      .replace("status: active", "status: proposed")
      .replace("no-shared-db-writes", "alpha-rule"),
    "Alpha decision",
  );
  const betaText = decisionText(
    validFrontmatter.replace("id: 0004", "id: 0009").replace("no-shared-db-writes", "beta-rule"),
    "Beta decision (already active)",
  );
  await write(join(decisions, "0007-alpha.md"), alphaText);
  await write(join(decisions, "0009-beta.md"), betaText);

  const constitutionBefore = await readFile(join(decisions, "../constitution.md"), "utf8").catch(() => null);
  const code = await runPromote(["0007", "0009"], root);
  assert.equal(code, 1);

  // 0007 validated fine in isolation; 0009 (already active) failed after it.
  // Nothing may be written until every requested id is known-promotable.
  assert.equal(await readFile(join(decisions, "0007-alpha.md"), "utf8"), alphaText);
  assert.equal(await readFile(join(decisions, "0009-beta.md"), "utf8"), betaText);
  const constitutionAfter = await readFile(join(decisions, "../constitution.md"), "utf8").catch(() => null);
  assert.equal(constitutionBefore, constitutionAfter);
});

test("runPromote refuses a directory with two files sharing an NNNN prefix, mutating neither", async () => {
  const { root, decisions } = await scratchRepo();
  const zetaText = decisionText(
    validFrontmatter
      .replace("id: 0004", "id: 0007")
      .replace("status: active", "status: proposed")
      .replace("no-shared-db-writes", "zeta-rule"),
    "Zeta decision",
  );
  const alphaText = decisionText(
    validFrontmatter
      .replace("id: 0004", "id: 0007")
      .replace("status: active", "status: proposed")
      .replace("no-shared-db-writes", "alpha-rule"),
    "Alpha decision",
  );
  await write(join(decisions, "0007-zeta.md"), zetaText);
  await write(join(decisions, "0007-alpha.md"), alphaText);

  const code = await runPromote(["0007"], root);
  assert.equal(code, 1);
  assert.equal(await readFile(join(decisions, "0007-zeta.md"), "utf8"), zetaText);
  assert.equal(await readFile(join(decisions, "0007-alpha.md"), "utf8"), alphaText);
});
