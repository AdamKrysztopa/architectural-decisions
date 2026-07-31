# Testing catalog — practices, levels, shapes, techniques, overlays

Three dimensions that must not be flattened into one hierarchy: **quality practice** (a process
discipline), **executable code tests** (unit / integration / E2E), and **stochastic evaluation**
(the data/ML/LLM overlay). Deterministic behavior is *tested with assertions*; stochastic quality is
*evaluated against cases, metrics, rubrics, and thresholds*.

Each entry uses the same template — **Question answered · Use when · Avoid or keep light when ·
Cost · Review cues · Common confusion** — so it works during design *and* during code review.

---

## I. Taxonomy and ownership

### Quality assurance (QA) as a discipline
**Question answered:** How do we build confidence in quality across the whole process, not just in code?
**Use when:** always — as a set of practices (risk analysis, acceptance criteria, exploratory work,
usability and accessibility assessment, release evidence, production feedback, quality governance)
distributed across the team.
**Avoid or keep light when:** never skip the discipline; do skip the *ceremony* — a phase, a
department, or a release gate is a separate decision that needs its own force.
**Cost:** attention and calendar time; done badly, it becomes a bottleneck that slows feedback.
**Review cues:** quality treated as one person's job; "QA will catch it" as a design assumption; no
risk conversation before a high-blast-radius release.
**Common confusion:** QA is *not* a fourth test level, and "QA" is not a synonym for "the testing
team". Process-oriented assurance and product-oriented testing are different things (the standard
ISTQB distinction).

### Quality control / executable testing
**Question answered:** Does the product actually behave as intended, right now?
**Use when:** always — this is the product-oriented half: running tests and checks against artifacts.
**Avoid or keep light when:** n/a; the question is *which* controls, not whether.
**Cost:** build and maintenance of every check you keep.
**Review cues:** checks that nobody reads the output of; green suites nobody trusts.
**Common confusion:** treating "we have tests" as equivalent to "we do quality assurance".

### Whole-team quality ownership
**Question answered:** Who owns quality?
**Use when:** by default. Developers own the tests for the code they write; specialists coach,
explore, and cover what automation cannot.
**Avoid or keep light when:** a named force (regulation, safety, contract, specialist assessment,
conflict of interest) genuinely requires independence for *part* of the evidence.
**Cost:** requires developers to invest in test design skill; without coaching, suites drift toward
implementation-coupled tests.
**Review cues:** a hand-off queue between "dev done" and "tested"; tests written by people with no
access to the requirement.
**Common confusion:** whole-team ownership does not mean "no specialists" — it means no hand-off of
responsibility.

### Independent assurance / sign-off
**Question answered:** Does someone other than the author need to attest to this?
**Use when:** independence is itself the requirement (regulation, safety case, contractual
acceptance), specialist manual assessment is needed, or blast radius is high and irreversible.
**Avoid or keep light when:** none of those hold — the default for most software.
**Cost:** calendar time, coordination, a second environment, and a real risk of becoming a
rubber-stamp that adds delay without adding information.
**Review cues:** an approval step nobody can describe the criteria for; sign-off with no evidence
artifact behind it.
**Common confusion:** regulation justifies *evidence and independence*; it does not automatically
justify a large E2E suite.

### Acceptance criteria / example-based specification
**Question answered:** What exactly are we agreeing "done" means?
**Use when:** stakeholders disagree about expected behavior, or defects trace back to ambiguous
requirements. Concrete examples beat prose.
**Avoid or keep light when:** behavior is local, low-risk, and already pinned by stable invariants.
**Cost:** up-front conversation time; formalized further (executable specifications) it adds a
grammar and glue layer to maintain.
**Review cues:** tests whose expected values came from running the code; stories with no observable
outcome.
**Common confusion:** acceptance criteria are a *specification* practice; automating them is a
separate, optional decision.

### Exploratory testing
**Question answered:** What did we not think to ask?
**Use when:** usability, workflow, accessibility, or unknown interactions carry material risk.
**Avoid or keep light when:** the change is isolated, mechanically verifiable, and easily reversed.
**Cost:** skilled human time; findings need triage to become regression tests.
**Review cues:** defect clusters outside the scripted paths; nobody has used the feature end to end.
**Common confusion:** automation does not replace it. Automated checks confirm known expectations;
exploratory work discovers the expectations you were missing.

---

## II. Code-test levels

The three primary levels are **unit**, **integration**, **end-to-end**. Everything else in this file
is a *technique*, a *strategy within a level*, or a *baseline check*. What matters is the question a
test answers and the resources it touches — not its folder name.

### Unit test
**Question answered:** Does this small piece of behavior, logic, or invariant work?
**Use when:** there is meaningful branching, calculation, state transition, or invariant that can be
exercised without a costly environment.
**Avoid or keep light when:** the code is nearly all framework wiring or I/O delegation — a narrow
integration test is then a more truthful signal for the same effort.
**Cost:** cheapest per test; the failure mode is *volume* — thousands of tests coupled to structure.
**Review cues:** unit tests that start a server, open a socket, or need a fixture file; assertions on
private helpers.
**Common confusion:** "unit" is about scope and cost, not about a class. A unit test may exercise
several collaborating objects.

### Solitary unit test
**Question answered:** Does this unit work with all its collaborators replaced by doubles?
**Use when:** a collaborator is slow, nondeterministic, unavailable, expensive, or has side effects.
**Avoid or keep light when:** the collaborator is a fast, deterministic, in-process value or helper —
isolating it buys nothing and couples the test to structure.
**Cost:** doubles drift from the real thing; a green solitary suite can coexist with a broken system.
**Review cues:** every collaborator mocked; assertions that only check which methods were called.
**Common confusion:** solitary is a *style*, not a stricter definition of "unit".

### Sociable unit test
**Question answered:** Does this behavior work with its real lightweight collaborators?
**Use when:** by default, for domain logic. Verify through observable behavior at a stable seam.
**Avoid or keep light when:** a collaborator drags in I/O, time, or nondeterminism — isolate just that one.
**Cost:** a failure may implicate several units, so diagnosis is slightly slower.
**Review cues:** a refactor that changes no behavior breaks dozens of tests — the suite was solitary
where it should have been sociable.
**Common confusion:** sociable ≠ integration. No process boundary or external resource is crossed.

### Narrow integration test
**Question answered:** Does our code interact correctly with **one** real boundary — a database,
protocol, serializer, framework, queue, or file system?
**Use when:** a boundary's real behavior, configuration, query, or lifecycle can fail despite correct
local logic. This is the highest-value-per-test level for I/O-bound and CRUD-shaped services.
**Avoid or keep light when:** the boundary is trivial and already covered by a contract or type.
**Cost:** needs a real (ideally ephemeral) dependency; seconds not milliseconds; some setup teardown.
**Review cues:** a repository layer tested only against a mocked driver; ORM queries never executed
against a real engine.
**Common confusion:** "integration" does not imply "broad". Most valuable integration tests touch
exactly one boundary.

### Broad integration test
**Question answered:** Do several real components behave correctly together, below the full journey?
**Use when:** the failure emerges from the *interaction* of several real components, a narrow test or
contract cannot reproduce it, and the environment can be made deterministic and owned.
**Avoid or keep light when:** one boundary at a time yields the same evidence more cheaply.
**Cost:** environment ownership, data setup, slow feedback, shared-state flakiness, hard diagnosis.
**Review cues:** a "integration" suite that is really an unowned staging-environment E2E suite; broad
tests used to catch defects a unit test would have localized instantly.
**Common confusion:** broad integration is not a cheaper E2E — it has most of E2E's costs and less of
its evidence.

### Contract test
**Question answered:** Do a consumer and a provider still agree on the interface?
**Use when:** independently deployed services or teams share a boundary; compatibility drift is a
recurring risk; broad E2E is being used mainly to discover interface changes.
**Avoid or keep light when:** the boundary is internal to one deployable owned by one team.
**Cost:** a shared artifact (pact/schema) to publish, version, and verify in both pipelines; process
discipline more than code.
**Review cues:** breakages discovered in staging rather than in the provider's own pipeline; schemas
duplicated by hand on both sides.
**Common confusion:** a contract test is a **specialized integration strategy**, not a fourth level —
and it proves compatibility, not that the journey works.

### Component / API test
**Question answered:** Does one deployable behave correctly at its own public edge, with its
collaborators stubbed?
**Use when:** a service's externally observable behavior (routing, validation, status codes,
serialization, authorization) is the risk, and you want it without cross-service coupling.
**Avoid or keep light when:** the same evidence comes from a narrow integration test at the seam.
**Cost:** in-process test harness or container; owning the stubs for downstream collaborators.
**Review cues:** every handler tested only through a full browser journey; no test hits the real
HTTP/serialization layer at all.
**Common confusion:** it sits inside "integration", not between integration and E2E as its own level.

### End-to-end journey test
**Question answered:** Does a critical user journey work through the deployed or production-like system?
**Use when:** a *named* journey and a *named* failure mode require full-system wiring — authn +
routing + configuration + deployment failing only in combination; a revenue-, safety-, or
mission-critical path; cross-system orchestration.
**Avoid or keep light when:** no such journey or failure mode has been named. "You probably do not
need E2E yet" is a correct and common answer.
**Cost:** the highest of any level — runtime, environment ownership, test data, nondeterminism,
diagnosis difficulty, and churn after UI or workflow changes.
**Review cues:** dozens of E2E tests covering variations of one journey; E2E used to detect schema
drift (buy a contract instead); retries configured as the flakiness strategy.
**Common confusion:** E2E confidence feels proportional to its cost. It isn't — a handful of
well-chosen journeys carries nearly all of the value.

### Baseline static feedback *(not a level)*
**Question answered:** Can we reject whole classes of defect without running the system?
**Use when:** always, for the stack's idioms — type checking, linting, formatting, static analysis,
dependency and security scanning.
**Avoid or keep light when:** never skip entirely; do tune the rule set so failures mean something.
**Cost:** near-zero runtime; some configuration churn and false-positive triage.
**Review cues:** a suite of tests asserting things the type system already guarantees.
**Common confusion:** these are baseline verification mechanisms, **not** a fourth test level, and
they say nothing about behavior.

---

## III. Portfolio shapes

Shape names are **summaries of a justified portfolio, never its generator**. Names and level
boundaries vary across organizations; the question a test answers and the resources it touches
matter more than its label.

### Pyramid-like
**Question answered:** Where should most evidence sit when rich domain logic dominates?
**Use when:** the risk is in business rules, calculations, and invariants.
**Avoid or keep light when:** the application is thin glue over frameworks and I/O — a pyramid there
produces many tests that prove little.
**Cost:** none inherently; the failure mode is treating the ratio as a quota.
**Review cues:** unit counts inflated with trivial tests to "look pyramidal".
**Common confusion:** "the pyramid is dead" is a slogan, not an analysis — it's still right for
logic-heavy systems, and Google's rough 80/15/5 split is orientation, not a target.

### Trophy-like
**Question answered:** Where should evidence sit when most risk is in component/framework interaction?
**Use when:** thin application logic over a UI or framework — the middle (integration/component)
carries the most value per test.
**Avoid or keep light when:** rich domain logic exists and is going untested at the unit level.
**Cost:** integration-level tests are slower and need more setup than units.
**Review cues:** "mostly integration" used to justify skipping tests for genuinely complex logic.
**Common confusion:** the Testing Trophy is Kent C. Dodds'; the underlying phrase "Write tests. Not
too many. Mostly integration." originated with Guillermo Rauch.

### Honeycomb-like
**Question answered:** What shape fits a microservice whose behavior is mostly its integrations?
**Use when:** a service is a thin behavior layer over collaborators; owned integration tests carry
the bulk, with few units and few E2E.
**Avoid or keep light when:** the service holds significant domain logic.
**Cost:** integration environments to own and keep deterministic.
**Review cues:** a service with a rich model but only integration tests.
**Common confusion:** it's a heuristic from microservice practice (popularized by Spotify
Engineering), not a universal replacement for the pyramid.

### Contract-centered portfolio
**Question answered:** What shape fits when independently deployed boundaries are the main risk?
**Use when:** several teams deploy independently and interface drift is the recurring failure.
**Avoid or keep light when:** one team, one deployable.
**Cost:** cross-pipeline coordination and contract versioning.
**Review cues:** a growing E2E suite whose failures are always "field renamed".
**Common confusion:** contracts replace E2E *for compatibility*, not for deployment/journey risk.

### Evaluation-heavy overlay
**Question answered:** What shape fits when output quality is statistical rather than exact?
**Use when:** data, ML, or LLM quality carries the risk. The overlay sits **on top of** ordinary
unit/integration/E2E tests for the deterministic scaffold.
**Avoid or keep light when:** the property is deterministic — assert it instead.
**Cost:** dataset curation and review, threshold maintenance, noisy metrics, sometimes model spend.
**Review cues:** an eval suite with no deterministic tests underneath it; wiring bugs found only by
evals.
**Common confusion:** evals do not replace tests. Data/ML/LLM systems still need ordinary tests.

### Ice-cream cone *(anti-shape)*
**Question answered:** What does it look like when confidence is delegated to the slowest layer?
**Use when:** never by choice — recognize it in review.
**Cost:** slow feedback, flakiness, defects localized only after long debugging sessions.
**Review cues:** most tests are UI/E2E; a bug in a pure function is caught by a browser test.
**Common confusion:** it usually forms by accretion, not by decision — nobody chose it.

### Hourglass *(anti-shape)*
**Question answered:** What does it look like when the middle is missing?
**Use when:** never by choice.
**Cost:** boundary defects (serialization, queries, configuration, protocol) escape to E2E or to
production, where they cost the most to diagnose.
**Review cues:** many tiny unit tests plus a broad E2E suite, with almost nothing touching a real
database, queue, or HTTP layer.
**Common confusion:** high coverage plus green E2E feels complete; the missing seam evidence is
invisible until it fails.

---

## IV. Techniques and mechanics

Techniques are **orthogonal to levels** — a property-based test can be a unit or an integration test.

### Arrange–Act–Assert / Given–When–Then
**Question answered:** How do we keep a test readable and single-purpose?
**Use when:** always, as a default structure.
**Avoid or keep light when:** it forces contortions on a genuinely sequential protocol test.
**Cost:** none.
**Review cues:** interleaved act/assert blocks; several unrelated behaviors per test.
**Common confusion:** GWT is a structure; it does not require a BDD framework.

### Parameterized tests
**Question answered:** Does this behavior hold across a table of known cases?
**Use when:** the same logic must hold for many concrete inputs (boundaries, formats, locales).
**Avoid or keep light when:** cases diverge enough that the parameterization hides intent.
**Cost:** poor failure messages if case identity isn't in the test id.
**Review cues:** a loop inside one test instead of separate cases — one failure masks the rest.
**Common confusion:** parameterization is not property-based testing; the cases are still hand-picked.

### Property-based testing
**Question answered:** Does an invariant hold across generated inputs we didn't think of?
**Use when:** there is a real invariant — round-trips (encode/decode), idempotence, ordering,
commutativity, conservation, or a model to compare against.
**Avoid or keep light when:** you cannot state a property without restating the implementation.
**Cost:** slower runs, occasional nondeterminism, a learning curve, shrinking-report triage.
**Review cues:** "properties" that duplicate the code under test; no seed/reproduction recorded for
a failing case.
**Common confusion:** it complements example-based tests; it does not replace them.

### Example-based tests
**Question answered:** Does this specific, meaningful case produce this specific result?
**Use when:** always — examples document intent better than generated inputs.
**Avoid or keep light when:** a table of near-identical examples should be parameterized instead.
**Cost:** examples chosen carelessly test nothing interesting.
**Review cues:** only happy-path examples; boundaries and error paths absent.
**Common confusion:** more examples ≠ more evidence; distinct behaviors do.

### Characterization tests
**Question answered:** What does this legacy code *currently* do, so I can change it safely?
**Use when:** before restructuring code whose intended behavior is undocumented.
**Avoid or keep light when:** the intended behavior *is* known — then write a requirement-based test.
**Cost:** they pin current behavior including its bugs; they must be revisited once intent is known.
**Review cues:** characterization tests left in place for years and treated as a specification.
**Common confusion:** they are a *scaffold for change*, not a statement of what the system should do.

### Snapshot and approval tests
**Question answered:** Did this complex output change unexpectedly?
**Use when:** the output is large and structured, and a human genuinely reviews the diff on change.
**Avoid or keep light when:** the output is volatile, or the team's habit is to bulk-approve.
**Cost:** snapshots rot; they encode incidental detail; blind approval turns them into noise.
**Review cues:** snapshot updates in the same commit as the behavior change with no diff discussion;
snapshots containing timestamps, ids, or ordering that isn't guaranteed.
**Common confusion:** a snapshot asserts *sameness*, not *correctness* — it has no oracle of its own.

### Golden files
**Question answered:** Does output still match a reviewed known-good reference?
**Use when:** a reference was genuinely reviewed and is small enough to keep reviewing.
**Avoid or keep light when:** the file is so large no one reads the diff.
**Cost:** maintenance and review discipline; the same rot risk as snapshots.
**Review cues:** thousand-line goldens regenerated with a flag whenever they fail.
**Common confusion:** "golden" describes the *review status* of the reference, not the file format.

### Mutation testing
**Question answered:** Would our tests actually fail if the code were subtly wrong?
**Use when:** the suite is already reliable and you need evidence about *assertion strength* in a
critical area.
**Avoid or keep light when:** the suite is small, low-risk, or still flaky — **you probably do not
need this yet.** Fix reliability first.
**Cost:** long runtimes (often the whole suite per mutant), equivalent-mutant triage, tooling upkeep.
**Review cues:** mutation score adopted as a target and gamed with weak assertions.
**Common confusion:** mutation score is one signal about assertion quality — not "the one true
coverage metric", and not a gate for every repository.

### Test doubles: dummy, fake, stub, spy, mock
**Question answered:** How do we stand in for a collaborator we can't or shouldn't use directly?
**Use when:** the real collaborator is slow, nondeterministic, unavailable, expensive, or has side
effects. Prefer a **fake** (a working lightweight implementation) over a mock where one exists.
**Avoid or keep light when:** the real thing is fast and deterministic.
**Cost:** every double is a second implementation that can drift from reality.
**Review cues:** mock density approaching one per collaborator; doubles for value objects; tests that
pass while the real integration is broken.
**Common confusion:** the five kinds differ. A stub supplies answers; a mock also asserts the
interaction. "Mock everything" is the failure mode.

### State vs interaction verification
**Question answered:** Do we assert the resulting state/output, or which calls were made?
**Use when:** prefer **state and output verification** — it captures the requirement and survives
refactoring. Reserve **interaction verification** for meaningful side effects and protocols (an email
was sent, a payment was charged exactly once, a retry happened).
**Avoid or keep light when:** interaction assertions on internal call order or private helpers.
**Cost:** interaction-heavy tests break on refactors that change nothing observable.
**Review cues:** `assert_called_once_with` on collaborators that produce no external effect.
**Common confusion:** asserting implementation trivia feels rigorous; it mostly raises change cost.

### Fixtures vs factories
**Question answered:** How do we build test data without hiding what matters?
**Use when:** factories (build objects per test, override only the relevant field) for domain data;
fixtures for genuinely shared, read-only setup.
**Avoid or keep light when:** a large shared fixture whose fields every test silently depends on.
**Cost:** factories add a small layer; fixtures add coupling proportional to their scope.
**Review cues:** module/session-scoped mutable fixtures; tests that fail when run alone or reordered.
**Common confusion:** "DRY" applied to test data usually makes tests harder to read, not easier.

### Hermetic tests
**Question answered:** Does this test depend only on what it explicitly sets up?
**Use when:** always as a goal — no shared environment, no external network, no leftover state.
**Avoid or keep light when:** a deliberate, isolated contract-verification run against a real
external system, kept out of the fast pipeline.
**Cost:** more setup machinery (containers, in-process servers, seeded data).
**Review cues:** tests that pass locally and fail in CI, or that depend on execution order.
**Common confusion:** hermetic ≠ mocked. A test using a throwaway real database is hermetic.

### Deterministic time and randomness
**Question answered:** Will this test still pass tomorrow, in another timezone, on a fast machine?
**Use when:** any behavior touching clocks, timezones, ids, ordering, or sampling — inject them.
**Avoid or keep light when:** never; this is close to free.
**Cost:** an injection seam for the clock/RNG.
**Review cues:** `sleep()` used to wait for async work; `now()` called inside the code under test;
tests that fail near midnight or month end.
**Common confusion:** retrying a time-dependent test is not a fix, it's a mask.

### Ephemeral dependencies / test containers
**Question answered:** How do we test a real boundary without owning a shared environment?
**Use when:** narrow integration tests need a real database, broker, or cache.
**Avoid or keep light when:** startup cost dominates and a lightweight in-process fake gives the same
evidence.
**Cost:** container runtime in CI, image pulls, slower cold start, resource limits.
**Review cues:** a shared "test database" that tests mutate concurrently.
**Common confusion:** using a real dependency does not make a test broad — one boundary is still narrow.

### Flaky-test quarantine (with owner and expiry)
**Question answered:** What do we do with a test that fails intermittently?
**Use when:** a test is flaky and blocking: quarantine it, record the suspected cause, assign an
**owner** and an **expiry date**, and track the count as a health metric.
**Avoid or keep light when:** the flake is trivially fixable now — just fix it.
**Cost:** a temporary hole in coverage that must be visible, not silent.
**Review cues:** blanket retries in the runner config; a quarantine list with no owners that only grows.
**Common confusion:** retrying is a scheduling workaround, not an ownership decision; unowned
quarantine is deletion with extra steps.

### Coverage as a navigation signal
**Question answered:** Which parts of the system have no tests pointing at them?
**Use when:** exploring gaps, or as a trend to watch on critical modules.
**Avoid or keep light when:** as a target or a merge gate — it is trivially satisfiable without
assertions.
**Cost:** small runtime overhead; large cultural cost if it becomes the goal.
**Review cues:** tests with no assertions; percentage thresholds in CI with no discussion of which
lines matter.
**Common confusion:** coverage measures execution, not verification.

---

## V. Domain overlays

Overlays are **additive**. Deterministic code and wiring still get ordinary unit/integration/E2E tests.

### Data transformation tests
**Question answered:** Does the transformation logic produce the right output for known inputs?
**Use when:** any non-trivial mapping, join, aggregation, or window — small deterministic fixtures.
**Avoid or keep light when:** the "transformation" is a pass-through.
**Cost:** fixture curation; realistic-enough sample data.
**Review cues:** pipelines whose only tests run against production data; no test for late/duplicate
/ null-heavy input.
**Common confusion:** this is a *unit-level* test of code — separate from asserting on real data.

### Data-quality assertions
**Question answered:** Is the *data* (not the code) fit for its consumers right now?
**Use when:** downstream consequences exist for schema drift, nullability, uniqueness, referential
integrity, ranges, freshness, volume, or distribution shifts.
**Avoid or keep light when:** the check has no named consumer or no action on failure.
**Cost:** runtime per run, alert fatigue if thresholds are guessed, ownership of every alert.
**Review cues:** hundreds of generated expectations nobody triages; alerts routed nowhere.
**Common confusion:** these run against data on a schedule — they are not unit tests and do not
belong in the same pipeline stage or dashboard.

### Data contracts
**Question answered:** Do producer and consumer agree on schema and semantics across an ownership boundary?
**Use when:** ownership crosses a team boundary and breakages are recurring.
**Avoid or keep light when:** producer and consumer are the same team and codebase.
**Cost:** schema versioning, negotiation, enforcement in both pipelines.
**Review cues:** consumers defensively coding around upstream surprises; schema changes announced in chat.
**Common confusion:** a data contract is an agreement plus enforcement, not just a JSON schema file.

### ML behavioral evaluation
**Question answered:** Does the model behave correctly on cases we care about — not just on average?
**Use when:** a model is in the risk path: invariance and metamorphic checks, directional
expectations, slice performance, known-important behavioral cases (CheckList-style).
**Avoid or keep light when:** the model is off the critical path or a simple aggregate metric with
monitoring genuinely suffices.
**Cost:** curated cases to maintain as the model and data evolve.
**Review cues:** one aggregate accuracy number with no slices; no test for the failure the business
actually fears.
**Common confusion:** a test-set metric is not behavioral evidence; it hides subgroup failures.

### ML production-readiness checks
**Question answered:** Is this system operable, reproducible, and monitored — not just accurate?
**Use when:** the model ships: data validation, leakage and split checks, reproducibility (seeds,
versions, data snapshots), training/serving consistency, rollback, drift monitoring.
**Avoid or keep light when:** an experiment that will never be deployed.
**Cost:** infrastructure and discipline; a large rubric applied mechanically becomes box-ticking.
**Review cues:** no way to reproduce last month's model; features computed differently in training
and serving.
**Common confusion:** Google's ML Test Score is a rubric to *cite and adapt*, not a checklist to copy
wholesale into every project.

### Deterministic LLM / agent scaffold tests
**Question answered:** Does everything around the model work — the parts that are ordinary software?
**Use when:** always, for LLM and agentic systems: request/response validation, tool schemas, tool
dispatch, permissions, state transitions, retry and timeout logic, persistence, routing, guardrails.
Suppress real model calls in unit tests and substitute a deterministic test model.
**Avoid or keep light when:** never — this is the cheapest, highest-yield evidence in an LLM system.
**Cost:** a seam to inject the model; test doubles for the provider.
**Review cues:** unit tests that hit a provider (slow, nondeterministic, billed); no test for tool
dispatch or permission checks; every failure investigated as "the model was bad" when it was wiring.
**Common confusion:** "it's an LLM app so we need evals" — most early failures are ordinary bugs that
ordinary assertions catch.

### Golden evaluation datasets
**Question answered:** Does semantic quality hold across representative, reviewed cases?
**Use when:** output quality is genuinely semantic. Cases should be representative (including the
failure modes you fear), human-reviewed, versioned, and small enough to keep reviewing.
**Avoid or keep light when:** the property is deterministic — assert it instead.
**Cost:** curation and re-review as the product changes; model spend per run; metric noise.
**Review cues:** an eval set assembled from whatever was handy; no failure cases in it; results
reported as a single number with no variance or case count.
**Common confusion:** an eval is a measurement with uncertainty, not a pass/fail assertion.

### Deterministic evaluators
**Question answered:** Can this quality property be scored without another model?
**Use when:** the property is checkable — schema validity, required fields, exact/keyword match,
citation presence, numeric tolerance, tool called with the right arguments, latency, cost.
**Avoid or keep light when:** the property is irreducibly semantic.
**Cost:** near-zero; they are fast, free, and stable — reach for them first.
**Review cues:** a model-based judge scoring things a regex or schema check would decide exactly.
**Common confusion:** teams reach for a judge before exhausting deterministic checks, then debug the
judge instead of the product.

### Calibrated model-based judges (LLM-as-judge)
**Question answered:** How do we score genuinely semantic quality at a volume humans can't review?
**Use when:** quality is semantic, deterministic criteria are insufficient, **and** the judge has
been calibrated against human-reviewed cases — with cost, variance, and bias accepted.
**Avoid or keep light when:** for schema validity, exact facts, tool-call correctness, permissions,
or anything deterministic. Skip it until deterministic rubric checks demonstrably fall short.
**Cost:** model spend per eval run, score variance, position/verbosity/self-preference bias, drift
when the judge model changes, and a rubric to maintain.
**Review cues:** judge scores with no human-calibration set; the judge and the system under test
sharing a model and prompt style; thresholds set to whatever the first run produced.
**Common confusion:** an LLM judge is **not objective** — it is a noisy instrument that must itself be
validated, and temperature zero reduces variation without making it deterministic.

### Production monitoring as evidence
**Question answered:** Is quality holding *after* release, where the real inputs are?
**Use when:** always for data/ML/LLM systems — drift, freshness, error rates, refusal/fallback rates,
latency, cost, user-visible failure signals, sampled human review.
**Avoid or keep light when:** never skip; scope it to signals someone will act on.
**Cost:** instrumentation, dashboards, alert ownership.
**Review cues:** offline evals only; nobody would notice a quality regression until a user complains.
**Common confusion:** monitoring does not replace pre-release evidence, and pre-release evidence does
not replace monitoring — stochastic systems need both.

---

## VI. Review anti-patterns

Use as a lens in Mode B, not a form to fill. Each: what it looks like · why it costs · what to do.

- **Coverage theater** — high coverage, few meaningful assertions. Execution is being measured, not
  verification. → Look at assertion quality on critical modules; treat coverage as navigation.
- **Oracle copied from the current implementation** — expected values were produced by running the
  code. The test can only detect *change*, never *wrongness*. → Derive expectations from a
  requirement, example, invariant, or reviewed reference.
- **Generated tests with no independent requirement** — accepted because they pass and raise
  coverage. → Require an independent oracle; ask what requirement each test would detect.
- **Mocking every collaborator** — the suite verifies structure, not behavior; refactors break
  everything and real integrations break silently. → Prefer sociable units and fakes; keep mocks for
  meaningful effects and protocols.
- **Testing framework internals** — asserting that the ORM saved, the router routed, the validator
  validated. → Test *your* behavior at the boundary; trust the framework's own tests.
- **Shared mutable fixtures** — order-dependent, intermittently failing, impossible to run alone.
  → Narrow fixture scope; build data per test with factories.
- **Sleep-based timing tests** — slow when passing, flaky when failing. → Inject the clock; await a
  condition, not a duration.
- **Retrying flaky tests without ownership** — the signal is suppressed and the underlying defect
  ships. → Quarantine with an owner and an expiry; track the count.
- **Giant golden files nobody reviews** — regenerated on failure; the diff is never read. → Shrink
  to a reviewable reference or replace with targeted assertions.
- **Exact-string assertions on stochastic model output** — permanently flaky, or pinned so hard the
  test breaks on every prompt change. → Assert the deterministic properties; evaluate the semantic
  ones against cases.
- **Evals with no representative dataset** — scores computed over a handful of convenient cases.
  → Curate representative cases including known failure modes; report case count and variance.
- **Judge scores with no human calibration** — an unvalidated instrument used as ground truth.
  → Calibrate against human-reviewed cases before trusting a threshold, or use a deterministic check.
- **Broad E2E used to detect simple contract drift** — the slowest layer diagnosing a schema rename.
  → Buy a consumer/provider or schema contract and delete most of those E2E tests.

---

## Appendix — tooling examples *(non-normative)*

Illustrative only. This skill is not a package-shopping guide; verify current names, maintenance
status, and fit before adopting anything here.

**Python:** `pytest` (+ `pytest-cov` for coverage, `pytest-xdist` for parallelism) · `Hypothesis`
(property-based) · `Testcontainers` (ephemeral real dependencies) · `respx` / `responses` / VCR-style
recording (HTTP boundaries) · `factory_boy` (test data factories) · `Playwright` (browser journeys) ·
`mutmut` / `Cosmic Ray` (mutation) · `tox` / `nox` (matrix runs) · PydanticAI's test utilities
(`TestModel`, `FunctionModel`, `Agent.override`, `ALLOW_MODEL_REQUESTS=False`) and its evals package
for dataset-based evaluation.

**Cross-ecosystem:** Vitest / Jest, Testing Library, Playwright (JS/TS) · JUnit, Testcontainers, Pact
(JVM and polyglot contract testing) · dbt tests and Great Expectations (data-quality assertions).
