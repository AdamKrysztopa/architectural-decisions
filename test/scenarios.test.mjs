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
    assert.ok(scenario.prompt?.length > 40, `${scenario.id} has no usable prompt`);
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
  "authoritative-source-governs-the-change",
  "authoritative-sources-disagree",
  "degenerate-comparison-window",
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
  "sources-are-pointers",
  "violation-is-reserved",
  "window-is-declared",
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
    assert.ok(scenario.prompt?.length > 40, `${scenario.id} has no usable prompt`);
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

// The two layers the 0.4.0 packet grew that the classifier can silently ignore:
// the designated-sources layer, and how much the git comparison window is
// worth. A scenario set that grades them is only half the guard -- the shared
// reference has to say what a correct run does with each, or the scenarios are
// grading an expectation the skill was never told about.
test("the drift reference documents the sources layer and the comparison window", async () => {
  const reference = await readFile(driftReference, "utf8");
  for (const anchor of [
    "`sources`",
    "judgement: \"review\"",
    "sourceConflicts",
    "unresolvable-by-precedence",
    "stale-baseline",
    "registry-unreadable",
    "baseStatus",
    "degenerate",
    "--base",
  ]) {
    assert.ok(
      reference.includes(anchor),
      `shared/observing-drift.md never mentions ${anchor} — a shipped packet field with no guidance`,
    );
  }
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
    assert.ok(scenario.prompt?.length > 40, `${scenario.id} has no usable prompt`);
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

const securityScenarioFile = join(repositoryRoot, "test/scenarios/security.json");
const threatModelRoot = join(repositoryRoot, "skills/threat-model");

// Gates live in the decision tree and, for the agency overlay, in agent-agency.md
// — never in the catalog, which describes controls rather than gating them.
const securityGateSources = ["references/decision-tree.md", "references/agent-agency.md"];

// Hardcoded on purpose, like every other inventory in this suite.
const requiredSecurityScenarioIds = [
  "agentic-support-bot",
  "already-hardened-service",
  "committed-secret-found-by-tool",
  "internal-crud-service",
  "legacy-monolith-trusted-network",
  "maturity-score-request",
  "multi-tenant-saas",
  "no-scanner-installed",
  "oss-library-supply-chain",
  "payments-card-data",
  "public-api-surface-change",
  "read-only-summariser-agent",
];

const requiredSecurityCriteriaIds = [
  "agent-agency-handoff",
  "asset-actor-impact-control",
  "boundary-first",
  "control-cost-named",
  "deliberate-omissions",
  "evidence-class-declared",
  "no-change-permitted",
  "no-invented-bindings",
  "no-scores",
  "no-simulated-scanning",
  "one-primary-move",
  "reopening-signals",
];

async function canonicalSecurityGates() {
  const gates = new Set();
  for (const source of securityGateSources) {
    const text = await readFile(join(threatModelRoot, source), "utf8");
    for (const [, heading] of text.matchAll(/^### (.+)$/gm)) {
      gates.add(gateName(heading));
    }
  }
  return gates;
}

async function readSecurityScenarios() {
  return JSON.parse(await readFile(securityScenarioFile, "utf8"));
}

test("the security scenario set declares the skill it grades and how to run it", async () => {
  const set = await readSecurityScenarios();
  assert.equal(set.skill, "threat-model");
  assert.ok(set.about?.length > 0, "the security scenario set has no description");
  const howToRun = join(repositoryRoot, set.howToRun);
  await assert.doesNotReject(
    readFile(howToRun, "utf8"),
    `howToRun points at a missing file: ${set.howToRun}`,
  );
});

test("every required security scenario is present exactly once", async () => {
  const { scenarios } = await readSecurityScenarios();
  const ids = scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "a security scenario id is duplicated");
  assert.deepEqual([...ids].sort(), requiredSecurityScenarioIds);
});

test("every required security criterion is present exactly once", async () => {
  const { criteria } = await readSecurityScenarios();
  const ids = criteria.map((criterion) => criterion.id);
  assert.equal(new Set(ids).size, ids.length, "a security criterion id is duplicated");
  assert.deepEqual([...ids].sort(), requiredSecurityCriteriaIds);
  for (const criterion of criteria) {
    assert.ok(
      criterion.statement?.length > 20,
      `criterion ${criterion.id} has no usable statement`,
    );
  }
});

test("every security scenario states a prompt, its forces, and what the run must produce", async () => {
  const { scenarios } = await readSecurityScenarios();
  for (const scenario of scenarios) {
    const label = `security scenario ${scenario.id}`;
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

test("every security scenario exercises at least one gate outcome", async () => {
  const { scenarios } = await readSecurityScenarios();
  for (const scenario of scenarios) {
    const exercised =
      scenario.gatesOpen.length > 0 ||
      scenario.gatesClosed.length > 0 ||
      scenario.expectNoChange === true ||
      scenario.refusesScore === true ||
      scenario.insufficientEvidence === true ||
      scenario.toolBoundGate === true;
    assert.ok(exercised, `security scenario ${scenario.id} asserts nothing`);
  }
});

test("a security scenario never opens and closes the same gate", async () => {
  const { scenarios } = await readSecurityScenarios();
  for (const scenario of scenarios) {
    const closed = new Set(scenario.gatesClosed);
    const contradictions = scenario.gatesOpen.filter((gate) => closed.has(gate));
    assert.deepEqual(contradictions, [], `security scenario ${scenario.id} contradicts itself`);
  }
});

test("every referenced security gate resolves to a canonical gate heading", async () => {
  const gates = await canonicalSecurityGates();
  const { scenarios } = await readSecurityScenarios();
  for (const scenario of scenarios) {
    for (const gate of [...scenario.gatesOpen, ...scenario.gatesClosed]) {
      assert.ok(
        gates.has(gate),
        `security scenario ${scenario.id} references '${gate}', which is not a gate in ${securityGateSources.join(" or ")}`,
      );
    }
  }
});

test("the security outcomes that are easy to lose are covered", async () => {
  const { scenarios } = await readSecurityScenarios();
  const modes = new Set(scenarios.map((scenario) => scenario.mode));
  assert.ok(modes.has("greenfield"), "no greenfield security scenario");
  assert.ok(modes.has("review"), "no review security scenario");
  assert.ok(
    scenarios.some((scenario) => scenario.expectNoChange === true),
    "no security scenario whose correct answer is 'no change'",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.refusesScore === true),
    "no security scenario exercising the score-refusal guardrail",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.insufficientEvidence === true),
    "no security scenario exercising the insufficient-evidence outcome",
  );
  assert.ok(
    scenarios.some((scenario) => scenario.toolBoundGate === true),
    "no security scenario exercising a tool-bound (deterministic) finding",
  );
  for (const gate of ["Encryption at rest", "Tenant isolation", "Human approval on irreversible actions"]) {
    assert.ok(
      scenarios.some((scenario) => scenario.gatesOpen.includes(gate)),
      `no security scenario where '${gate}' is justified open`,
    );
    assert.ok(
      scenarios.some((scenario) => scenario.gatesClosed.includes(gate)),
      `no security scenario where '${gate}' must stay closed`,
    );
  }
});

// Every `fixture` a scenario names must resolve to a real directory that has
// something in it.
//
// Without this, a fixture path can rot silently -- renamed, moved, or never
// created -- and the scenario goes on claiming to be staged against a
// representative repository while the runner has nothing to look at. That is
// precisely the fault (§6.2/B2) that voided ten scenarios in the 0.4.0 gate and
// produced four "confounded blocker" classifications nobody could resolve. A
// missing fixture must cost a red test, not a re-run.
test("every fixture a scenario names exists and is not empty", async () => {
  const { readdir, stat } = await import("node:fs/promises");
  const sets = await readdir(join(repositoryRoot, "test/scenarios"));
  let checked = 0;

  for (const name of sets.filter((entry) => entry.endsWith(".json"))) {
    const set = JSON.parse(await readFile(join(repositoryRoot, "test/scenarios", name), "utf8"));
    for (const scenario of set.scenarios) {
      if (!scenario.fixture) continue;
      checked += 1;

      assert.ok(
        !scenario.fixture.startsWith("/") && !scenario.fixture.includes(".."),
        `${name}/${scenario.id}: fixture must be a repository-relative path, got '${scenario.fixture}'`,
      );

      const path = join(repositoryRoot, scenario.fixture);
      let entries = null;
      try {
        assert.ok((await stat(path)).isDirectory());
        entries = await readdir(path);
      } catch {
        assert.fail(`${name}/${scenario.id}: fixture '${scenario.fixture}' is not a directory on disk`);
      }
      assert.ok(entries.length > 0, `${name}/${scenario.id}: fixture '${scenario.fixture}' is empty`);
    }
  }

  // A guard on the guard: if every fixture key were deleted this test would
  // pass vacuously, which is the one way it could stop protecting anything.
  assert.ok(checked >= 10, `expected at least 10 fixture-bearing scenarios, found ${checked}`);
});
