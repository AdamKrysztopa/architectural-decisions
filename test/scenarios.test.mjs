import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scenarioFile = join(repositoryRoot, "test/scenarios/test-patterns.json");
const skillRoot = join(repositoryRoot, "skills/test-patterns");

// The files a gate name may resolve to. Gates live in the decision tree and, for
// dimension 3, in the evaluation overlay — never in the catalog, which describes
// entries rather than gating them.
const gateSources = ["references/decision-tree.md", "references/evaluation.md"];

// Hardcoded on purpose, exactly like the skill inventory in build.test.mjs:
// dropping a scenario has to cost a deliberate edit here, or the suite would
// grade the scenario set against itself.
const requiredScenarioIds = [
  "crud-service-real-database",
  "etl-analytical-pipeline",
  "generated-tests-no-oracle",
  "glue-shaped-ui-product",
  "healthy-existing-suite",
  "independently-released-services",
  "internal-monolith",
  "llm-agentic-system",
  "ml-inference-service",
  "performance-sensitive-system",
  "pure-math-library",
  "safety-critical-regulated",
];

// The output properties every run is graded on, whatever the scenario.
const requiredCriteriaIds = [
  "cost-and-ownership",
  "deliberate-omissions",
  "every-row-justified",
  "justified-e2e-and-assurance",
  "no-change-permitted",
  "no-ratios",
  "no-shape-first",
  "one-primary-move",
  "oracle-independence",
  "reopening-signals",
  "risk-first",
  "tests-vs-evaluations",
];

// A gate heading carries decoration a scenario should not have to repeat: an
// ordinal prefix inside a numbered cluster, and a trailing parenthetical that
// classifies rather than names. Strip both to get the gate's name.
function gateName(heading) {
  return heading
    .replace(/^\d+\.\s+/, "")
    .split(" (")[0]
    .split(" *(")[0]
    .trim();
}

async function canonicalGates() {
  const gates = new Set();
  for (const source of gateSources) {
    const text = await readFile(join(skillRoot, source), "utf8");
    for (const [, heading] of text.matchAll(/^### (.+)$/gm)) {
      gates.add(gateName(heading));
    }
  }
  return gates;
}

async function readScenarios() {
  return JSON.parse(await readFile(scenarioFile, "utf8"));
}

test("the scenario set declares the skill it grades and how to run it", async () => {
  const set = await readScenarios();
  assert.equal(set.skill, "test-patterns");
  assert.ok(set.about?.length > 0, "the scenario set has no description");
  const howToRun = join(repositoryRoot, set.howToRun);
  await assert.doesNotReject(
    readFile(howToRun, "utf8"),
    `howToRun points at a missing file: ${set.howToRun}`,
  );
});

test("every required scenario is present exactly once", async () => {
  const { scenarios } = await readScenarios();
  const ids = scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "a scenario id is duplicated");
  assert.deepEqual([...ids].sort(), requiredScenarioIds);
});

test("every required grading criterion is present exactly once", async () => {
  const { criteria } = await readScenarios();
  const ids = criteria.map((criterion) => criterion.id);
  assert.equal(new Set(ids).size, ids.length, "a criterion id is duplicated");
  assert.deepEqual([...ids].sort(), requiredCriteriaIds);
  for (const criterion of criteria) {
    assert.ok(
      criterion.statement?.length > 20,
      `criterion ${criterion.id} has no usable statement`,
    );
  }
});

test("every scenario states a prompt, its forces, and what the run must produce", async () => {
  const { scenarios } = await readScenarios();
  for (const scenario of scenarios) {
    const label = `scenario ${scenario.id}`;
    assert.ok(["greenfield", "review"].includes(scenario.mode), `${label} has no valid mode`);
    assert.ok(scenario.title?.length > 0, `${label} has no title`);
    assert.ok(scenario.prompt?.length > 40, `${label} has no usable prompt`);
    assert.ok(scenario.expect?.length > 40, `${label} does not say what the run must produce`);
    assert.ok(
      Array.isArray(scenario.forces) && scenario.forces.length > 0,
      `${label} names no forces — gating without forces is scoring`,
    );
    assert.ok(
      Array.isArray(scenario.failsIf) && scenario.failsIf.length > 0,
      `${label} names no failure conditions`,
    );
    assert.ok(
      Array.isArray(scenario.gatesOpen) && Array.isArray(scenario.gatesClosed),
      `${label} must declare gatesOpen and gatesClosed, even if empty`,
    );
  }
});

test("every scenario exercises at least one gate outcome", async () => {
  const { scenarios } = await readScenarios();
  for (const scenario of scenarios) {
    const exercised =
      scenario.gatesOpen.length > 0 ||
      scenario.gatesClosed.length > 0 ||
      scenario.oracleGate === true ||
      scenario.expectNoChange === true;
    assert.ok(exercised, `scenario ${scenario.id} asserts nothing`);
  }
});

test("a scenario never opens and closes the same gate", async () => {
  const { scenarios } = await readScenarios();
  for (const scenario of scenarios) {
    const closed = new Set(scenario.gatesClosed);
    const contradictions = scenario.gatesOpen.filter((gate) => closed.has(gate));
    assert.deepEqual(contradictions, [], `scenario ${scenario.id} contradicts itself`);
  }
});

test("every referenced gate resolves to a canonical gate heading", async () => {
  const gates = await canonicalGates();
  const { scenarios } = await readScenarios();
  for (const scenario of scenarios) {
    for (const gate of [...scenario.gatesOpen, ...scenario.gatesClosed]) {
      assert.ok(
        gates.has(gate),
        `scenario ${scenario.id} references '${gate}', which is not a gate in ${gateSources.join(" or ")}`,
      );
    }
  }
});

test("both operating modes and the no-change outcome are covered", async () => {
  const { scenarios } = await readScenarios();
  const modes = new Set(scenarios.map((scenario) => scenario.mode));
  assert.ok(modes.has("greenfield"), "no greenfield scenario");
  assert.ok(modes.has("review"), "no existing-suite scenario");
  assert.ok(
    scenarios.some((scenario) => scenario.expectNoChange === true),
    "no scenario whose correct answer is 'no change'",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.oracleGate === true),
    "no scenario exercising the oracle-independence gate",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.gatesOpen.includes("End-to-end tests")),
    "no scenario where E2E is the justified answer",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.gatesClosed.includes("End-to-end tests")),
    "no scenario where E2E must be refused",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.gatesOpen.includes("Contract tests")),
    "no scenario where contract testing is justified",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.gatesClosed.includes("Contract tests")),
    "no scenario where contract testing must be refused",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.gatesOpen.includes("Independent assurance / sign-off")),
    "no scenario where independent assurance overrides developer-owned evidence",
  );
});

const captureScenarioFile = join(repositoryRoot, "test/scenarios/baseline-capture.json");
const captureReference = join(repositoryRoot, "shared/recording-decisions.md");

const requiredCaptureScenarioIds = [
  "already-decided",
  "binding-exists",
  "explicit-refusal",
  "greenfield-recommendation",
  "no-real-binding",
  "question-only",
];

test("the capture scenario set is complete and well formed", async () => {
  const set = JSON.parse(await readFile(captureScenarioFile, "utf8"));
  assert.ok(set.about?.length > 0, "the capture scenario set has no description");
  await assert.doesNotReject(readFile(join(repositoryRoot, set.howToRun), "utf8"));

  const ids = set.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "a capture scenario id is duplicated");
  assert.deepEqual([...ids].sort(), requiredCaptureScenarioIds);

  for (const scenario of set.scenarios) {
    assert.ok(scenario.forces?.length > 0, `${scenario.id} names no forces`);
    assert.equal(typeof scenario.expect.captures, "boolean", `${scenario.id} does not state whether it captures`);
    if (scenario.expect.captures) {
      assert.equal(scenario.expect.status, "proposed", `${scenario.id} must capture as proposed`);
    }
  }
});

test("every capture criterion is anchored in the shared reference", async () => {
  const set = JSON.parse(await readFile(captureScenarioFile, "utf8"));
  const reference = await readFile(captureReference, "utf8");
  const criteriaIds = set.criteria.map((criterion) => criterion.id).sort();
  assert.deepEqual(criteriaIds, [
    "narrative-by-default",
    "no-invented-bindings",
    "no-transcript-logging",
    "proposed-only",
    "prose-preserved",
    "reads-before-writing",
  ]);
  for (const anchor of ["status: proposed", "narrative", "verified_by", "superseded_by"]) {
    assert.ok(reference.includes(anchor), `shared/recording-decisions.md never mentions ${anchor}`);
  }
});

const driftScenarioFile = join(repositoryRoot, "test/scenarios/drift-drain.json");
const driftReference = join(repositoryRoot, "shared/observing-drift.md");

const requiredDriftScenarioIds = [
  "impression-only",
  "narrative-rule-touched",
  "new-boundary",
  "nothing-to-report",
  "rule-outlived-its-subject",
  "specific-contradiction",
  "tool-failed",
  "tool-unavailable",
];

const requiredDriftCriteriaIds = [
  "evidence-gate",
  "insufficient-evidence-is-normal",
  "no-model-for-a-tool",
  "no-scores",
  "no-silent-writes",
  "proposed-not-defect",
  "violation-is-reserved",
];

test("the drift scenario set is complete and anchored in the shared reference", async () => {
  const set = JSON.parse(await readFile(driftScenarioFile, "utf8"));
  assert.equal(set.skill, "shared:observing-drift");
  assert.ok(set.about?.length > 0);
  await assert.doesNotReject(readFile(join(repositoryRoot, set.howToRun), "utf8"));

  const ids = set.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "a drift scenario id is duplicated");
  assert.deepEqual([...ids].sort(), requiredDriftScenarioIds);
  assert.deepEqual(set.criteria.map((criterion) => criterion.id).sort(), requiredDriftCriteriaIds);

  const reference = await readFile(driftReference, "utf8");
  const classes = new Set([...reference.matchAll(/^### (.+)$/gm)].map(([, heading]) => heading.trim()));
  assert.deepEqual([...classes].sort(), [
    "Insufficient evidence",
    "Legitimate evolution",
    "Stale or contradictory documentation",
    "Suspected drift",
    "Violation",
  ]);

  for (const scenario of set.scenarios) {
    assert.ok(scenario.forces?.length > 40, `${scenario.id} names no forces`);
    assert.equal(typeof scenario.expect.writes, "boolean", `${scenario.id} does not say whether it writes`);
    if (scenario.expect.class !== null) {
      assert.ok(classes.has(scenario.expect.class), `${scenario.id} expects a class that is not a heading`);
    }
    if (scenario.expect.writes) {
      assert.equal(scenario.expect.status, "proposed", `${scenario.id} must write only proposed`);
    }
  }

  assert.ok(
    set.scenarios.some((scenario) => scenario.expect.class === null && scenario.expect.writes === false),
    "no scenario whose correct outcome is 'nothing to report'",
  );
  assert.ok(
    set.scenarios.some((scenario) => scenario.expect.downgraded === true),
    "no scenario exercising the evidence-gate downgrade",
  );
});

const migrationScenarioFile = join(repositoryRoot, "test/scenarios/migration.json");
const migrationReference = join(repositoryRoot, "shared/migrating-decisions.md");

const requiredMigrationScenarioIds = [
  "already-schema-nothing-to-migrate",
  "conflict-reported-as-candidate",
  "consolidation-confirmed-subset",
  "dual-artifact-collapsed",
  "existing-prose-untouched",
  "promotion-is-a-separate-explicit-act",
  "refuses-whole-directory-conversion",
  "reverse-discovery-cap-exceeded",
  "reverse-discovery-insufficient-evidence",
  "reverse-discovery-narrative-with-exceptions",
];

test("the migration scenario set is complete and well formed", async () => {
  const set = JSON.parse(await readFile(migrationScenarioFile, "utf8"));
  assert.ok(set.about?.length > 0, "the migration scenario set has no description");
  await assert.doesNotReject(readFile(join(repositoryRoot, set.howToRun), "utf8"));

  const ids = set.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "a migration scenario id is duplicated");
  assert.deepEqual([...ids].sort(), requiredMigrationScenarioIds);

  for (const scenario of set.scenarios) {
    assert.ok(scenario.forces?.length > 0, `${scenario.id} names no forces`);
    assert.ok(scenario.expect?.notes?.length > 0, `${scenario.id} states no expected outcome`);
  }
});

test("every migration criterion is anchored in the shared reference or its recording-decisions companion", async () => {
  const set = JSON.parse(await readFile(migrationScenarioFile, "utf8"));
  const reference = await readFile(migrationReference, "utf8");
  const criteriaIds = set.criteria.map((criterion) => criterion.id).sort();
  assert.deepEqual(criteriaIds, [
    "cap-forces-ranking",
    "conflicts-reported-not-resolved",
    "explicit-inputs-only",
    "narrative-by-default",
    "no-score",
    "proposed-only",
    "prose-never-rewritten",
    "traceability-exhaustive",
  ]);
  for (const anchor of ["confirmed", "narrative", "Sources", "cap of 20", "20 decisions"]) {
    assert.ok(
      reference.includes(anchor) || reference.includes("at most 20"),
      `shared/migrating-decisions.md never mentions ${anchor}`,
    );
  }
});
