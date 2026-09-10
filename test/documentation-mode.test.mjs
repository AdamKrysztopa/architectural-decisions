// The HUMAN DOCUMENTATION MODE and the MACHINE ENFORCEMENT METADATA layer.
//
// The load-bearing claim of the whole design is the last group in this file:
// the machine layer does not vary by mode. Everything above it exists so that
// claim can be tested against real output rather than asserted in a comment.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ConfigError, normalizeConfig, readConfig, writeConfig } from "../runtime/baseline/config.mjs";
import { anchor, parseLivingDocument, promoteInDocument } from "../runtime/baseline/living.mjs";
import { renderConstitution } from "../runtime/baseline/constitution.mjs";
import { resolveRecord } from "../runtime/baseline/record.mjs";
import { run as constitution, runPromote as promote } from "../runtime/baseline/build-constitution.mjs";
import { run as mode } from "../runtime/baseline/mode.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-mode-"));
}

// The same two decisions, carrying the same two rules, expressed once as ADR
// files and once as sections of a living architecture document. Every
// machine-layer assertion below compares what these two produce.
const ADR_ONE = `---
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

# Data ownership

Services own their own tables.
`;

const ADR_TWO = `---
id: 0002
status: proposed
skill: threat-model
date: 2026-09-10
commit: 0000000
rules:
  - id: no-committed-secrets
    statement: No credential, token or private key is committed to this repository.
    scope: ["**"]
    severity: blocking
    verification: narrative
---

# Secrets

No credential is committed.
`;

const LIVING = `# Payments platform — living architecture

## Context

Six services behind one gateway. This section is ordinary prose and carries no
machine metadata at all.

## Data ownership

\`\`\`arch-decision
id: 1
status: active
skill: decide-architecture
date: 2026-09-10
commit: 0000000
\`\`\`

Services own their own tables.

\`\`\`arch-rule
id: services-own-their-tables
statement: A service owns its own tables; no other service reads them directly.
scope: ["src/**"]
severity: blocking
verification: narrative
\`\`\`

## Secrets

\`\`\`arch-decision
id: 2
status: proposed
skill: threat-model
date: 2026-09-10
commit: 0000000
\`\`\`

No credential is committed.

\`\`\`arch-rule
id: no-committed-secrets
statement: No credential, token or private key is committed to this repository.
scope: ["**"]
severity: blocking
verification: narrative
\`\`\`
`;

async function adrProject() {
  const root = await scratch();
  const directory = join(root, "docs/architecture/decisions");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "0001-data-ownership.md"), ADR_ONE, "utf8");
  await writeFile(join(directory, "0002-secrets.md"), ADR_TWO, "utf8");
  return root;
}

async function livingProject(text = LIVING) {
  const root = await scratch();
  await mkdir(join(root, "docs/architecture"), { recursive: true });
  await writeFile(join(root, "docs/architecture/overview.md"), text, "utf8");
  await writeFile(
    join(root, "arch-crew.json"),
    `${JSON.stringify({ version: 1, documentation: { mode: "living", documents: ["docs/architecture/overview.md"] } }, null, 2)}\n`,
    "utf8",
  );
  return root;
}

// --- the mode itself: explicit, persisted, never inferred ------------------

test("a repository with no config is in adr mode, exactly as it was before modes existed", async () => {
  const root = await adrProject();
  const config = await readConfig(root);
  assert.equal(config.present, false);
  assert.equal(config.mode, "adr");

  const record = await resolveRecord(root);
  assert.equal(record.mode, "adr");
  assert.equal(record.directory, join(root, "docs/architecture/decisions"));
  assert.equal(record.decisions.length, 2);
});

test("the selected mode is persisted, and survives a fresh read", async () => {
  const root = await livingProject();
  assert.equal((await readConfig(root)).mode, "living");

  assert.equal(await mode(["adr"], root), 0);
  assert.equal((await readConfig(root)).mode, "adr");

  // Re-selecting living needs the document again -- and persists it.
  assert.equal(await mode(["living", "--document", "docs/architecture/overview.md"], root), 0);
  const config = await readConfig(root);
  assert.equal(config.mode, "living");
  assert.deepEqual(config.documents, ["docs/architecture/overview.md"]);
});

test("selecting living without a document is refused: in that mode the document is the record", async () => {
  const root = await livingProject();
  assert.equal(await mode(["living"], root), 1);
});

test("selecting living with a document that does not exist is refused at selection time", async () => {
  const root = await livingProject();
  assert.equal(await mode(["living", "--document", "docs/architecture/nope.md"], root), 1);
  // ...and the refusal did not half-write the config.
  assert.equal((await readConfig(root)).documents[0], "docs/architecture/overview.md");
});

test("an unknown mode is refused rather than defaulted", () => {
  assert.throws(() => normalizeConfig({ documentation: { mode: "adrs" } }), ConfigError);
  assert.throws(() => normalizeConfig({ documentation: { mode: "living", documents: [] } }), ConfigError);
});

test("a config path may not climb out of the project", async () => {
  const root = await scratch();
  await writeConfig(root, { documentation: { mode: "adr", decisions: "../elsewhere" } });
  await assert.rejects(resolveRecord(root), ConfigError);
});

test("writeConfig preserves keys it does not know about", async () => {
  const root = await scratch();
  await writeFile(join(root, "arch-crew.json"), `${JSON.stringify({ version: 1, future: { keep: true } })}\n`, "utf8");
  await writeConfig(root, { documentation: { mode: "adr" } });
  const raw = JSON.parse(await readFile(join(root, "arch-crew.json"), "utf8"));
  assert.deepEqual(raw.future, { keep: true });
});

// --- living mode: one document, many decisions -----------------------------

test("one living document carries many decisions, and ordinary prose is left alone", () => {
  const { decisions, errors } = parseLivingDocument(LIVING, "docs/architecture/overview.md");
  assert.deepEqual(errors, []);
  // Two decisions from ONE file -- the whole point of the mode. The 'Context'
  // section has no blocks and is not a decision.
  assert.equal(decisions.length, 2);
  assert.deepEqual(decisions.map((d) => d.title), ["Data ownership", "Secrets"]);
  assert.equal(decisions[0].filename, "docs/architecture/overview.md#data-ownership");
  assert.equal(decisions[0].rules[0].scope[0], "src/**");
});

test("a rule with no decision around it is an error, not a silently ignored rule", () => {
  const { errors } = parseLivingDocument(
    "## Orphan\n\n```arch-rule\nid: x\nstatement: y\nseverity: blocking\nverification: narrative\n```\n",
    "doc.md",
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no `arch-decision` block/);
});

test("a broken rule reports its own error without hiding the next one", () => {
  const text =
    "## A\n\n```arch-decision\nid: 1\nstatus: active\nskill: s\ndate: d\ncommit: c\n```\n\n" +
    "```arch-rule\nid: a\nstatement: s\nseverity: loud\nverification: narrative\n```\n\n" +
    "## B\n\n```arch-decision\nid: 2\nstatus: active\nskill: s\ndate: d\ncommit: c\n```\n\n" +
    "```arch-rule\nid: b\nstatement: s\nseverity: blocking\nverification: sometimes\n```\n";
  const { decisions, errors } = parseLivingDocument(text, "doc.md");
  assert.equal(decisions.length, 0);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /severity 'loud'/);
  assert.match(errors[1], /verification 'sometimes'/);
});

test("an ordinary fenced code block is the human's and passes through untouched", () => {
  const { decisions, errors } = parseLivingDocument(
    "## A\n\n```arch-decision\nid: 1\nstatus: active\nskill: s\ndate: d\ncommit: c\n```\n\n" +
      "```python\nid: not-a-rule\n```\n\nProse.\n",
    "doc.md",
  );
  assert.deepEqual(errors, []);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].rules.length, 0);
  assert.match(decisions[0].body, /```python/);
});

test("a missing living document is an error, never an empty compliant record", async () => {
  const root = await livingProject();
  await writeConfig(root, { documentation: { mode: "living", documents: ["docs/architecture/gone.md"] } });
  const record = await resolveRecord(root);
  assert.equal(record.decisions.length, 0);
  assert.equal(record.errors.length, 1);
  assert.match(record.errors[0], /no such living architecture document/);
});

test("anchors match the heading a reader would click", () => {
  assert.equal(anchor("Data ownership"), "data-ownership");
  assert.equal(anchor("Auth & authz (v2)"), "auth--authz-v2");
});

// --- promotion is the explicit human act in BOTH modes ---------------------

test("promote flips one decision in a living document and touches nothing else", async () => {
  const root = await livingProject();
  const path = join(root, "docs/architecture/overview.md");
  const before = await readFile(path, "utf8");

  assert.equal(await promote(["2"], root), 0);

  const after = await readFile(path, "utf8");
  const changed = before.split("\n").map((line, index) => [line, after.split("\n")[index]]).filter(([a, b]) => a !== b);
  assert.equal(changed.length, 1, "exactly one line may change");
  assert.deepEqual(changed[0], ["status: proposed", "status: active"]);
});

test("promoting an already-active living decision fails and writes nothing", async () => {
  const root = await livingProject();
  const path = join(root, "docs/architecture/overview.md");
  const before = await readFile(path, "utf8");
  assert.equal(await promote(["1"], root), 1);
  assert.equal(await readFile(path, "utf8"), before);
});

test("promoting an unknown living id fails and writes nothing", async () => {
  const root = await livingProject();
  const path = join(root, "docs/architecture/overview.md");
  const before = await readFile(path, "utf8");
  assert.equal(await promote(["9"], root), 1);
  assert.equal(await readFile(path, "utf8"), before);
});

test("a batch promote in living mode is all-or-nothing", async () => {
  const root = await livingProject();
  const path = join(root, "docs/architecture/overview.md");
  const before = await readFile(path, "utf8");
  // 2 is promotable; 1 is already active. Neither may land.
  assert.equal(await promote(["2", "1"], root), 1);
  assert.equal(await readFile(path, "utf8"), before);
});

test("promoteInDocument returns null for a document that does not declare the id", () => {
  assert.equal(promoteInDocument(LIVING, 99, "doc.md"), null);
});

// --- the load-bearing claim: the machine layer does not vary by mode -------

test("the same decisions produce the same rules, severities, scopes and statuses in both modes", async () => {
  const fromAdr = await resolveRecord(await adrProject());
  const fromLiving = await resolveRecord(await livingProject());

  const machineLayer = (record) =>
    record.decisions
      .map((decision) => ({
        id: decision.id,
        status: decision.status,
        skill: decision.skill,
        supersededBy: decision.supersededBy,
        rules: decision.rules.map((rule) => ({
          id: rule.id,
          statement: rule.statement,
          scope: rule.scope,
          severity: rule.severity,
          verification: rule.verification,
          verifiedBy: rule.verifiedBy,
          decision: rule.decision,
        })),
      }))
      .sort((left, right) => left.id - right.id);

  assert.deepEqual(machineLayer(fromLiving), machineLayer(fromAdr));
  assert.deepEqual(fromAdr.errors, []);
  assert.deepEqual(fromLiving.errors, []);
});

test("the generated rollup differs between modes only in its source links", async () => {
  const fromAdr = await resolveRecord(await adrProject());
  const fromLiving = await resolveRecord(await livingProject());

  const strip = (text) =>
    text
      .split("\n")
      .filter((line) => !line.startsWith("- Source: ") && !line.startsWith("- [0") && !line.startsWith("Edit ") && !line.startsWith("The active rules"))
      .join("\n");

  assert.equal(
    strip(renderConstitution(fromLiving.decisions, { mode: "living" })),
    strip(renderConstitution(fromAdr.decisions, { mode: "adr" })),
  );
});

test("cross-decision validation runs in living mode too", async () => {
  const duplicated = LIVING.replace("## Secrets", "## Secrets\n\nSee above.").replace(
    "id: no-committed-secrets",
    "id: services-own-their-tables",
  );
  const root = await livingProject(duplicated);
  const record = await resolveRecord(root);
  assert.ok(
    record.errors.some((error) => /rule id 'services-own-their-tables' is declared by both/.test(error)),
    `expected a duplicate-rule error, got: ${JSON.stringify(record.errors)}`,
  );
});

test("the rollup lands beside the human record, and --check agrees with it", async () => {
  const root = await livingProject();
  assert.equal(await constitution([], root), 0);
  const rollup = join(root, "docs/architecture/constitution.md");
  assert.match(await readFile(rollup, "utf8"), /overview\.md#data-ownership/);
  assert.equal(await constitution(["--check"], root), 0);

  await writeFile(rollup, "stale\n", "utf8");
  assert.equal(await constitution(["--check"], root), 2);
});

test("--dir overrides the mode for one invocation without changing it", async () => {
  const root = await livingProject();
  const elsewhere = await adrProject();
  const record = await resolveRecord(root, { dir: join(elsewhere, "docs/architecture/decisions") });
  assert.equal(record.decisions.length, 2);
  assert.equal(record.documents.length, 0);
  // The persisted mode is untouched: --dir said where to read, not what to be.
  assert.equal((await readConfig(root)).mode, "living");
});

test("this repository's own package ships the mode verb", async () => {
  const { verbs } = await import(join(repositoryRoot, "runtime/arch.mjs"));
  assert.ok(verbs.includes("mode"), "arch must expose a 'mode' verb");
});
