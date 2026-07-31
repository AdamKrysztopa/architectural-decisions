# Testing catalog — practices, levels, shapes, techniques, overlays

Three dimensions that must not be flattened into one hierarchy: **quality practice** (a process
discipline), **executable code tests** (unit / integration / E2E), and **stochastic evaluation**
(the data/ML/LLM overlay). Deterministic behavior is *tested with assertions*; stochastic quality is
*evaluated against cases, metrics, rubrics, and thresholds*.

Each entry uses **Use when · Avoid or keep light when · Reopen when · Cost · Review cues · Common
confusion** (plus **Question answered** where a heading can't carry it) — for design *and* review.

---

## I. Taxonomy and ownership

### Quality assurance (QA) as a discipline
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
**Use when:** always — this is the product-oriented half: running tests and checks against artifacts.
**Avoid or keep light when:** n/a; the question is *which* controls, not whether.
**Cost:** build and maintenance of every check you keep.
**Review cues:** checks that nobody reads the output of; green suites nobody trusts.
**Common confusion:** treating "we have tests" as equivalent to "we do quality assurance".

### Whole-team quality ownership
**Use when:** by default. Developers own the tests for the code they write; specialists coach,
explore, and cover what automation cannot.
**Avoid or keep light when:** a named force (regulation, safety, contract, specialist assessment,
conflict of interest) genuinely requires independence for *part* of the evidence.
**Reopen when:** developers stop writing tests, or a specialist becomes the only test author.
**Cost:** requires developers to invest in test design skill; without coaching, suites drift toward
implementation-coupled tests.
**Review cues:** a hand-off queue between "dev done" and "tested"; tests written by people with no
access to the requirement.
**Common confusion:** whole-team ownership does not mean "no specialists" — it means no hand-off of
responsibility.

### Independent assurance / sign-off
**Use when:** independence is itself the requirement (regulation, safety case, contractual
acceptance), specialist manual assessment is needed, or blast radius is high and irreversible.
**Avoid or keep light when:** none of those hold — the default for most software.
**Reopen when:** a new regulation, contract, or irreversible blast radius enters scope.
**Cost:** calendar time, coordination, a second environment, and a real risk of becoming a
rubber-stamp that adds delay without adding information.
**Review cues:** an approval step nobody can describe the criteria for; sign-off with no evidence
artifact behind it.
**Common confusion:** regulation justifies *evidence and independence*; it does not automatically
justify a large E2E suite.

### Acceptance criteria / example-based specification
**Use when:** stakeholders disagree about expected behavior, or defects trace back to ambiguous
requirements. Concrete examples beat prose.
**Avoid or keep light when:** behavior is local, low-risk, and already pinned by stable invariants.
**Reopen when:** a defect traces to "that isn't what we meant" rather than to code.
**Cost:** up-front conversation time; formalized further (executable specifications) it adds a
grammar and glue layer to maintain.
**Review cues:** tests whose expected values came from running the code; stories with no observable
outcome.
**Common confusion:** acceptance criteria are a *specification* practice; automating them is a
separate, optional decision.

### Exploratory testing
**Use when:** usability, workflow, accessibility, or unknown interactions carry material risk.
**Avoid or keep light when:** the change is isolated, mechanically verifiable, and easily reversed.
**Reopen when:** users hit problems no scripted check was looking for.
**Cost:** skilled human time; findings need triage to become regression tests.
**Review cues:** defect clusters outside the scripted paths; nobody has used the feature end to end.
**Common confusion:** automation does not replace it. Automated checks confirm known expectations;
exploratory work discovers the expectations you were missing.

### User acceptance / release evidence
**Question answered:** Can we show — to a customer, a regulator, or ourselves — that this release is
fit to go out?
**Use when:** a contract, regulator, customer, or safety case requires formal acceptance; or rollback
is difficult and a failed release has high impact, so someone must be able to say *why* it shipped.
**Avoid or keep light when:** releases are small, observable, reversible, and owned by the team that
built them — the deploy pipeline plus production signals already *is* the release evidence.
**Reopen when:** release impact grows, rollback gets harder, or an external obligation (contract,
audit, certification) enters scope.
**Cost:** calendar time and coordination; an artifact to produce and store per release; the standing
risk that it hardens into a scheduled gate that delays feedback without adding information. Formal
UAT also tends to re-verify what automated checks already covered.
**Review cues:** a sign-off step whose acceptance criteria nobody can state; UAT re-running the
regression suite by hand; release notes with no link to any evidence; acceptance performed by people
who never saw the requirement.
**Common confusion:** acceptance *evidence* and an acceptance *phase* are different purchases —
the obligation is to be able to demonstrate fitness, not to hold a stage-gate. And "user acceptance"
is dimension 1 (a quality practice); it is not a fourth executable level, even when parts of it are
automated as E2E tests.

---

## II. Code-test levels

This catalog **normalizes to three levels** — **unit**, **integration**, **end-to-end**. That is a
house convention chosen because those three track *cost and feedback speed*, which is what the gates
in `decision-tree.md` actually trade off. It is not a universal taxonomy, and testing terminology
genuinely varies between organizations (a point Fowler makes repeatedly about "unit" and
"integration" alike). Translate rather than argue:

| If your organization says… | …read it here as |
|----------------------------|------------------|
| **Component testing** (ISTQB level 1) | unit |
| **Component integration testing** (ISTQB level 2) | narrow integration |
| **System integration testing** (ISTQB level 2, across systems) | broad integration, or contract tests |
| **System testing** (ISTQB level 3) | component/API test, or E2E depending on what it touches |
| **Acceptance testing** (ISTQB level 4) | E2E where it is executable; otherwise dimension 1 — user acceptance / release evidence |
| Service test, middle layer, "the trophy's middle" | integration |
| UI test, browser test, journey test | E2E |

ISTQB's four levels and this catalog's three are the same territory drawn with different borders;
neither is wrong. Everything else in this file is a *technique*, a *strategy within a level*, a
*cross-level concern*, or a *baseline check*. What matters is the question a test answers and the
resources it touches — not its folder name and not which taxonomy named it.

### Unit test
**Use when:** there is meaningful branching, calculation, state transition, or invariant that can be
exercised without a costly environment.
**Avoid or keep light when:** the code is nearly all framework wiring or I/O delegation — a narrow
integration test is then a more truthful signal for the same effort.
**Reopen when:** a defect escapes through a module whose tests were all green.
**Cost:** cheapest per test; the failure mode is *volume* — thousands of tests coupled to structure.
**Review cues:** unit tests that start a server, open a socket, or need a fixture file; assertions on
private helpers.
**Common confusion:** "unit" is about scope and cost, not about a class. A unit test may exercise
several collaborating objects.

### Solitary unit test *(a style within unit)*
**Use when:** a collaborator is slow, nondeterministic, unavailable, expensive, or has side effects.
**Avoid or keep light when:** the collaborator is a fast, deterministic, in-process value or helper —
isolating it buys nothing and couples the test to structure.
**Reopen when:** a double and the collaborator it stands for disagree in production.
**Cost:** doubles drift from the real thing; a green solitary suite can coexist with a broken system.
**Review cues:** every collaborator mocked; assertions that only check which methods were called.
**Common confusion:** solitary is a *style*, not a stricter definition of "unit" — Martin Fowler's
vocabulary, which he credits to Jay Fields.

### Sociable unit test *(a style within unit)*
**Use when:** by default, for domain logic. Verify through observable behavior at a stable seam.
**Avoid or keep light when:** a collaborator drags in I/O, time, or nondeterminism — isolate just that one.
**Reopen when:** a collaborator acquires I/O, a clock, or nondeterminism.
**Cost:** a failure may implicate several units, so diagnosis is slightly slower.
**Review cues:** a refactor that changes no behavior breaks dozens of tests — the suite was solitary
where it should have been sociable.
**Common confusion:** sociable ≠ integration. No process boundary or external resource is crossed.

### Narrow integration test *(scope within integration)*
**Use when:** a boundary's real behavior, configuration, query, or lifecycle can fail despite correct
local logic. This is the highest-value-per-test level for I/O-bound and CRUD-shaped services.
**Avoid or keep light when:** the boundary is trivial and already covered by a contract or type.
**Reopen when:** a query, migration, or serializer fails only against the real engine.
**Cost:** needs a real (ideally ephemeral) dependency; seconds not milliseconds; some setup teardown.
**Review cues:** a repository layer tested only against a mocked driver; ORM queries never executed
against a real engine.
**Common confusion:** "integration" does not imply "broad" — narrow vs broad is Fowler's distinction.
Most valuable integration tests touch exactly one boundary.

### Broad integration test *(scope within integration)*
**Use when:** the failure emerges from the *interaction* of several real components, a narrow test or
contract cannot reproduce it, and the environment can be made deterministic and owned.
**Avoid or keep light when:** one boundary at a time yields the same evidence more cheaply.
**Reopen when:** a defect reproduces only with several real components running together.
**Cost:** environment ownership, data setup, slow feedback, shared-state flakiness, hard diagnosis.
**Review cues:** a "integration" suite that is really an unowned staging-environment E2E suite; broad
tests used to catch defects a unit test would have localized instantly.
**Common confusion:** broad integration is not a cheaper E2E — it has most of E2E's costs and less of
its evidence.

### Contract test *(a strategy within integration, not a level)*
**Use when:** independently deployed services or teams share a boundary; compatibility drift is a
recurring risk; broad E2E is being used mainly to discover interface changes.
**Avoid or keep light when:** the boundary is internal to one deployable owned by one team.
**Reopen when:** a provider deploy breaks a consumer over a renamed or reshaped field.
**Cost:** a shared artifact (pact/schema) to publish, version, and verify in both pipelines; process
discipline more than code.
**Review cues:** breakages discovered in staging rather than in the provider's own pipeline; schemas
duplicated by hand on both sides.
**Common confusion:** a contract test is a **specialized integration strategy**, not a fourth level —
and it proves compatibility, not that the journey works.

### Component / API test *(scope within integration)*
**Use when:** a service's externally observable behavior (routing, validation, status codes,
serialization, authorization) is the risk, and you want it without cross-service coupling.
**Avoid or keep light when:** the same evidence comes from a narrow integration test at the seam.
**Reopen when:** routing, validation, or status-code defects reach consumers.
**Cost:** in-process test harness or container; owning the stubs for downstream collaborators.
**Review cues:** every handler tested only through a full browser journey; no test hits the real
HTTP/serialization layer at all.
**Common confusion:** it sits inside "integration", not between integration and E2E as its own level.

### End-to-end journey test
**Use when:** a *named* journey and a *named* failure mode require full-system wiring — authn +
routing + configuration + deployment failing only in combination; a revenue-, safety-, or
mission-critical path; cross-system orchestration.
**Avoid or keep light when:** no such journey or failure mode has been named. "You probably do not
need E2E yet" is a correct and common answer.
**Reopen when:** a release breaks a journey that every lower-level test passed.
**Cost:** the highest of any level — runtime, environment ownership, test data, nondeterminism,
diagnosis difficulty, and churn after UI or workflow changes.
**Review cues:** dozens of E2E tests covering variations of one journey; E2E used to detect schema
drift (buy a contract instead); retries configured as the flakiness strategy.
**Common confusion:** E2E confidence feels proportional to its cost. It isn't — a handful of
well-chosen journeys carries nearly all of the value.

### Baseline static feedback *(not a level)*
**Use when:** always, for the stack's idioms — type checking, linting, formatting, static analysis,
dependency and security scanning.
**Avoid or keep light when:** never skip entirely; do tune the rule set so failures mean something.
**Reopen when:** a defect class recurs that a type or a lint rule could have rejected.
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
**Use when:** the risk is in business rules, calculations, and invariants.
**Avoid or keep light when:** the application is thin glue over frameworks and I/O — a pyramid there
produces many tests that prove little.
**Reopen when:** unit tests stay green while boundary defects keep reaching production.
**Cost:** none inherently; the failure mode is treating the ratio as a quota.
**Review cues:** unit counts inflated with trivial tests to "look pyramidal".
**Common confusion:** "the pyramid is dead" is a slogan, not an analysis — it's still right for
logic-heavy systems, and Google's rough 80/15/5 split is orientation, not a target.

### Trophy-like
**Use when:** thin application logic over a UI or framework — the middle (integration/component)
carries the most value per test.
**Avoid or keep light when:** rich domain logic exists and is going untested at the unit level.
**Reopen when:** domain logic thickens and integration failures stop localizing anything.
**Cost:** integration-level tests are slower and need more setup than units.
**Review cues:** "mostly integration" used to justify skipping tests for genuinely complex logic.
**Common confusion:** the Testing Trophy is Kent C. Dodds'; the underlying phrase "Write tests. Not
too many. Mostly integration." originated with Guillermo Rauch. Dodds' Trophy counts static analysis
as its base layer; this catalog deliberately keeps static feedback out of the level taxonomy.

### Honeycomb-like
**Use when:** a service is a thin behavior layer over collaborators; owned integration tests carry
the bulk, with few units and few E2E.
**Avoid or keep light when:** the service holds significant domain logic.
**Reopen when:** the service accumulates real domain rules of its own.
**Cost:** integration environments to own and keep deterministic.
**Review cues:** a service with a rich model but only integration tests.
**Common confusion:** it's a heuristic from microservice practice (popularized by Spotify
Engineering), not a universal replacement for the pyramid.

### Contract-centered portfolio
**Use when:** several teams deploy independently and interface drift is the recurring failure.
**Avoid or keep light when:** one team, one deployable.
**Reopen when:** teams consolidate, or drift stops being the failure that costs you.
**Cost:** cross-pipeline coordination and contract versioning.
**Review cues:** a growing E2E suite whose failures are always "field renamed".
**Common confusion:** contracts replace E2E *for compatibility*, not for deployment/journey risk.

### Evaluation-heavy overlay
**Use when:** data, ML, or LLM quality carries the risk. The overlay sits **on top of** ordinary
unit/integration/E2E tests for the deterministic scaffold.
**Avoid or keep light when:** the property is deterministic — assert it instead.
**Reopen when:** eval failures keep turning out to be wiring bugs, or the model leaves the path.
**Cost:** dataset curation and review, threshold maintenance, noisy metrics, sometimes model spend.
**Review cues:** an eval suite with no deterministic tests underneath it; wiring bugs found only by
evals.
**Common confusion:** evals do not replace tests. Data/ML/LLM systems still need ordinary tests.

### Ice-cream cone *(anti-shape)*
**Use when:** never by choice — recognize it in review.
**Cost:** slow feedback, flakiness, defects localized only after long debugging sessions.
**Review cues:** most tests are UI/E2E; a bug in a pure function is caught by a browser test.
**Common confusion:** it usually forms by accretion, not by decision — nobody chose it.

### Hourglass *(anti-shape)*
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
**Use when:** always, as a default structure.
**Avoid or keep light when:** it forces contortions on a genuinely sequential protocol test.
**Reopen when:** a reviewer can't say what a test asserts without reading it twice.
**Cost:** none.
**Review cues:** interleaved act/assert blocks; several unrelated behaviors per test.
**Common confusion:** GWT is a structure; it does not require a BDD framework.

### Parameterized tests
**Use when:** the same logic must hold for many concrete inputs (boundaries, formats, locales).
**Avoid or keep light when:** cases diverge enough that the parameterization hides intent.
**Reopen when:** near-identical test bodies multiply for one behavior.
**Cost:** poor failure messages if case identity isn't in the test id.
**Review cues:** a loop inside one test instead of separate cases — one failure masks the rest.
**Common confusion:** parameterization is not property-based testing; the cases are still hand-picked.

### Property-based testing
**Use when:** there is a real invariant — round-trips (encode/decode), idempotence, ordering,
commutativity, conservation, or a model to compare against.
**Avoid or keep light when:** you cannot state a property without restating the implementation.
**Reopen when:** a bug arrives from an input shape nobody wrote an example for.
**Cost:** slower runs, occasional nondeterminism, a learning curve, shrinking-report triage.
**Review cues:** "properties" that duplicate the code under test; no seed/reproduction recorded for
a failing case.
**Common confusion:** it complements example-based tests; it does not replace them.

### Example-based tests
**Use when:** always — examples document intent better than generated inputs.
**Avoid or keep light when:** a table of near-identical examples should be parameterized instead.
**Reopen when:** the suite no longer shows a newcomer what the code is for.
**Cost:** examples chosen carelessly test nothing interesting.
**Review cues:** only happy-path examples; boundaries and error paths absent.
**Common confusion:** more examples ≠ more evidence; distinct behaviors do.

### Characterization tests
**Use when:** before restructuring code whose intended behavior is undocumented.
**Avoid or keep light when:** the intended behavior *is* known — then write a requirement-based test.
**Reopen when:** you must change code whose intended behavior nobody can state.
**Cost:** they pin current behavior including its bugs; they must be revisited once intent is known.
**Review cues:** characterization tests left in place for years and treated as a specification.
**Common confusion:** they are a *scaffold for change*, not a statement of what the system should do.

### Snapshot and approval tests
**Use when:** the output is large and structured, and a human genuinely reviews the diff on change.
**Avoid or keep light when:** the output is volatile, or the team's habit is to bulk-approve.
**Reopen when:** the output stabilizes enough for targeted assertions to replace it.
**Cost:** snapshots rot; they encode incidental detail; blind approval turns them into noise.
**Review cues:** snapshot updates in the same commit as the behavior change with no diff discussion;
snapshots containing timestamps, ids, or ordering that isn't guaranteed.
**Common confusion:** a snapshot asserts *sameness*, not *correctness* — it has no oracle of its own.

### Golden files
**Use when:** a reference was genuinely reviewed and is small enough to keep reviewing.
**Avoid or keep light when:** the file is so large no one reads the diff.
**Reopen when:** nobody can say who last reviewed the reference, or why.
**Cost:** maintenance and review discipline; the same rot risk as snapshots.
**Review cues:** thousand-line goldens regenerated with a flag whenever they fail.
**Common confusion:** "golden" describes the *review status* of the reference, not the file format.

### Mutation testing
**Question answered:** Would our tests actually fail if the code were subtly wrong?
**Use when:** the suite is already reliable and you need evidence about *assertion strength* in a
critical area.
**Avoid or keep light when:** the suite is small, low-risk, or still flaky — **you probably do not
need this yet.** Fix reliability first.
**Reopen when:** a green suite over a critical module misses a defect entirely.
**Cost:** long runtimes (often the whole suite per mutant), equivalent-mutant triage, tooling upkeep.
**Review cues:** mutation score adopted as a target and gamed with weak assertions.
**Common confusion:** mutation score is one signal about assertion quality — not "the one true
coverage metric", and not a gate for every repository.

### Test doubles: dummy, fake, stub, spy, mock
**Use when:** the real collaborator is slow, nondeterministic, unavailable, expensive, or has side
effects. Prefer a **fake** (a working lightweight implementation) over a mock where one exists.
**Avoid or keep light when:** the real thing is fast and deterministic.
**Reopen when:** a usable fake or ephemeral real dependency appears for something you mock.
**Cost:** every double is a second implementation that can drift from reality.
**Review cues:** mock density approaching one per collaborator; doubles for value objects; tests that
pass while the real integration is broken.
**Common confusion:** the five kinds differ. A stub supplies answers; a mock also asserts the
interaction. "Mock everything" is the failure mode.

### State vs interaction verification
**Use when:** prefer **state and output verification** — it captures the requirement and survives
refactoring. Reserve **interaction verification** for meaningful side effects and protocols (an email
was sent, a payment was charged exactly once, a retry happened).
**Avoid or keep light when:** interaction assertions on internal call order or private helpers.
**Reopen when:** a real side effect — a charge, an email, a retry — ships unverified.
**Cost:** interaction-heavy tests break on refactors that change nothing observable.
**Review cues:** `assert_called_once_with` on collaborators that produce no external effect.
**Common confusion:** asserting implementation trivia feels rigorous; it mostly raises change cost.

### Fixtures vs factories
**Use when:** factories (build objects per test, override only the relevant field) for domain data;
fixtures for genuinely shared, read-only setup.
**Avoid or keep light when:** a large shared fixture whose fields every test silently depends on.
**Reopen when:** adding one field to shared setup ripples through unrelated tests.
**Cost:** factories add a small layer; fixtures add coupling proportional to their scope.
**Review cues:** module/session-scoped mutable fixtures; tests that fail when run alone or reordered.
**Common confusion:** "DRY" applied to test data usually makes tests harder to read, not easier.

### Hermetic tests
**Use when:** always as a goal — no shared environment, no external network, no leftover state.
**Avoid or keep light when:** a deliberate, isolated contract-verification run against a real
external system, kept out of the fast pipeline.
**Reopen when:** a suite starts depending on an environment someone else can change.
**Cost:** more setup machinery (containers, in-process servers, seeded data).
**Review cues:** tests that pass locally and fail in CI, or that depend on execution order.
**Common confusion:** hermetic ≠ mocked — the term is *Software Engineering at Google*'s. A test
using a throwaway real database is hermetic.

### Deterministic time and randomness
**Use when:** any behavior touching clocks, timezones, ids, ordering, or sampling — inject them.
**Avoid or keep light when:** never; this is close to free.
**Reopen when:** new code reads the clock, an id generator, or a sampler directly.
**Cost:** an injection seam for the clock/RNG.
**Review cues:** `sleep()` used to wait for async work; `now()` called inside the code under test;
tests that fail near midnight or month end.
**Common confusion:** retrying a time-dependent test is not a fix, it's a mask.

### Ephemeral dependencies / test containers
**Use when:** narrow integration tests need a real database, broker, or cache.
**Avoid or keep light when:** startup cost dominates and a lightweight in-process fake gives the same
evidence.
**Reopen when:** container startup starts dominating the feedback loop.
**Cost:** container runtime in CI, image pulls, slower cold start, resource limits.
**Review cues:** a shared "test database" that tests mutate concurrently.
**Common confusion:** using a real dependency does not make a test broad — one boundary is still narrow.

### Flaky-test quarantine (with owner and expiry)
**Use when:** a test is flaky and blocking: quarantine it, record the suspected cause, assign an
**owner** and an **expiry date**, and track the count as a health metric.
**Avoid or keep light when:** the flake is trivially fixable now — just fix it.
**Reopen when:** a quarantined test's expiry passes with no decision taken.
**Cost:** a temporary hole in coverage that must be visible, not silent.
**Review cues:** blanket retries in the runner config; a quarantine list with no owners that only grows.
**Common confusion:** retrying is a scheduling workaround, not an ownership decision; unowned
quarantine is deletion with extra steps.

### Coverage as a navigation signal
**Use when:** exploring gaps, or as a trend to watch on critical modules.
**Avoid or keep light when:** as a target or a merge gate — it is trivially satisfiable without
assertions.
**Reopen when:** the number becomes the goal, or a critical module's trend falls.
**Cost:** small runtime overhead; large cultural cost if it becomes the goal.
**Review cues:** tests with no assertions; percentage thresholds in CI with no discussion of which
lines matter.
**Common confusion:** coverage measures execution, not verification.

---

### Cross-level concerns

Performance, resilience, and security are **qualities, not levels**. Each is bought at whichever
scope can expose its named failure most cheaply — often a unit test, sometimes an integration test,
occasionally a full-system exercise. Their gates are in `decision-tree.md` **Step 4**, and they fire
independently of one another.

### Performance testing *(a cross-level concern)*
**Question answered:** Will this be fast enough, and will we notice when it stops being?
**Use when:** either a local hot path exists whose cost is a property of the code (a deterministic
microbenchmark or complexity guard is then the cheapest correct evidence), **or** a named latency,
throughput, or capacity requirement exists whose breach would be user-visible or contractual (then
load / stress / soak at the scope the requirement implies).
**Avoid or keep light when:** no number has been named and no hot path is known. Production
percentiles answer "is it fast enough?" more cheaply and more truthfully than a synthetic rig.
**Reopen when:** an SLO, contract, or capacity plan makes a number real; traffic shape shifts by an
order of magnitude; an incident traces to saturation; latency regressions reach users.
**Cost:** load rigs need representative data, hardware, and concurrency, plus an owner to keep them
representative — an unrepresentative rig misleads with confidence. Wall-clock assertions on shared
CI hardware are a flakiness source; assert bounds or relative regressions instead.
**Review cues:** a load-test suite nobody reads the results of; `time.sleep`-calibrated thresholds;
benchmarks run once at project start and never since; performance "tested" only in production.
**Common confusion:** performance testing is not inherently an E2E activity. Load testing is; a
benchmark over a serializer or an algorithm is a unit test with a different assertion.

### Resilience and failure-injection testing *(a cross-level concern)*
**Question answered:** Does the system actually do what we claim when a dependency fails?
**Use when:** a named failure, recovery, or continuity claim exists — a documented fallback, a
degraded mode, an RTO/RPO, a retry / timeout / circuit-breaker someone relies on. **No number is
required; the claim is the force.** Test it at the cheapest falsifying scope: the retry/fallback
logic as a unit test, the dependency refused or slowed as a narrow integration test, and failover or
chaos against real infrastructure only when wiring or replication is the thing in doubt.
**Avoid or keep light when:** no continuity claim exists and the dependency's loss simply means the
feature is unavailable — visibly and acceptably so.
**Reopen when:** an incident traces to a failure path nobody exercised, a dependency becomes
business-critical, an availability target is agreed, or a failover fails when first needed.
**Cost:** failure injection needs a seam (fault-injecting client, proxy, or container control);
chaos exercises need production-like infrastructure and a blast-radius plan.
**Review cues:** retry and timeout code with no test; a documented fallback path no test enters; a
circuit breaker whose open state is never exercised; "we have a replica" with no failover drill.
**Common confusion:** resilience is routinely bundled with performance because both get labelled
"non-functional". They are separate gates — a system with no latency SLO can still owe a tested
failure path, and this is the common case.

### Security testing *(a cross-level concern)*
**Question answered:** Can someone do something here they are not allowed to do?
**Use when:** the system has roles, ownership, tenancy, or any rule about who may read or change
what — write the **negative** authorization cases (wrong user, wrong tenant, wrong role, missing or
expired token, another user's id) at the cheapest level that can express them. Add abuse cases per
named attacker-reachable input surface, fuzzing for parsers and protocols, and a specialist
assessment (threat model, penetration test, audit) when exposure or an external requirement warrants
it.
**Avoid or keep light when:** internal, single-tenant, no sensitive data, no meaningful trust
boundary — baseline scanning plus the authorization tests you already owe.
**Reopen when:** a trust boundary appears (multi-tenancy, external users, a public API), data
classification changes, an incident traces to access control or input handling, or the system starts
moving money or personal data.
**Cost:** negative-path tests roughly double the case count at an authorization seam; fuzzing needs
corpus and triage time; specialist assessment is calendar time and money, and its findings arrive as
a remediation backlog.
**Review cues:** every authorization test asserts the *allowed* case only; authorization verified
against a mocked guard rather than the real middleware; scanner output treated as the security
story; a pen-test report with no test written for anything it found.
**Common confusion:** scanning is the **baseline, not the strategy**. Scanners find known-vulnerable
dependencies and generic code patterns; they cannot know your domain's rules, which is why broken
access control sits at the top of the OWASP Top 10 and why it is your tests' job, not a tool's.

---

## V. Domain overlays

Overlays are **additive**. Deterministic code and wiring still get ordinary unit/integration/E2E tests.

### Data transformation tests
**Use when:** any non-trivial mapping, join, aggregation, or window — small deterministic fixtures.
**Avoid or keep light when:** the "transformation" is a pass-through.
**Reopen when:** a mapping or aggregation defect is found by a downstream consumer.
**Cost:** fixture curation; realistic-enough sample data.
**Review cues:** pipelines whose only tests run against production data; no test for late/duplicate
/ null-heavy input.
**Common confusion:** this is a *unit-level* test of code — separate from asserting on real data.

### Data-quality assertions
**Question answered:** Is the *data* (not the code) fit for its consumers right now?
**Use when:** downstream consequences exist for schema drift, nullability, uniqueness, referential
integrity, ranges, freshness, volume, or distribution shifts.
**Avoid or keep light when:** the check has no named consumer or no action on failure.
**Reopen when:** a consumer breaks on data that passed every code test.
**Cost:** runtime per run, alert fatigue if thresholds are guessed, ownership of every alert.
**Review cues:** hundreds of generated expectations nobody triages; alerts routed nowhere.
**Common confusion:** two different placements get conflated, and they have opposite gating rules.
*Build-time assertions over a candidate artifact you are about to publish* — a freshly built table, a
transformed batch, a candidate model's outputs — run on the **build's** cadence and may legitimately
fail the build or block the deploy; that is exactly what `dbt build` does, running each model's tests
immediately after building it and skipping its dependents on failure. *Assertions over source or
production data* run on the **data's** cadence; a failure there means "the data changed", not "the
code broke", so route it to a named operational owner rather than to a red build — blocking a deploy
on it punishes whoever happens to be shipping.

### Data contracts
**Use when:** ownership crosses a team boundary and breakages are recurring.
**Avoid or keep light when:** producer and consumer are the same team and codebase.
**Reopen when:** an upstream schema change surprises a consumer again.
**Cost:** schema versioning, negotiation, enforcement in both pipelines.
**Review cues:** consumers defensively coding around upstream surprises; schema changes announced in chat.
**Common confusion:** a data contract is an agreement plus enforcement, not just a JSON schema file.

### ML behavioral evaluation
**Use when:** a model is in the risk path: invariance and metamorphic checks, directional
expectations, slice performance, known-important behavioral cases (CheckList-style).
**Avoid or keep light when:** the model is off the critical path or a simple aggregate metric with
monitoring genuinely suffices.
**Reopen when:** an aggregate metric holds while a slice or a known case regresses.
**Cost:** curated cases to maintain as the model and data evolve.
**Review cues:** one aggregate accuracy number with no slices; no test for the failure the business
actually fears.
**Common confusion:** a test-set metric is not behavioral evidence; it hides subgroup failures.

### ML production-readiness — four *independently gated* concerns

**"The model ships" does not buy all of these.** They fail differently, cost differently, and are
earned separately — mirroring the four clusters in `decision-tree.md` **Step 5 → ML models**. Google's
ML Test Score is a rubric to *cite and adapt*, not a checklist to copy wholesale; applied
mechanically it becomes box-ticking, which is the failure mode this split exists to prevent. Each
entry below has its own keep-light outcome, and for a fixed-data, one-shot, or human-reviewed system
most of them are correctly answered "not yet".

### ML data validation, leakage and split checks
**Use when:** the model is retrained on data that keeps arriving, or the split has structure — time,
group, entity, geography — that a random split would silently violate.
**Avoid or keep light when:** a one-shot model on a fixed, understood dataset with an obviously
independent split. One documented assertion about *why* the split is valid is then enough.
**Reopen when:** offline metrics outrun online results, retraining becomes automated, a new feature
source appears, or someone proposes a random split over grouped or temporal data.
**Cost:** validation code to maintain against a moving schema; leakage checks need someone who
understands how the data was generated, which is often not the person training the model.
**Review cues:** a random split over time-series or per-entity data; features computed over the full
dataset before splitting; target-derived or post-outcome fields in the feature set; a test set reused
so often it has effectively become a training set.
**Common confusion:** leakage is a *split and feature-provenance* defect, not a metric defect — it
shows up as unusually good offline numbers, which is exactly why it survives review.

### ML reproducibility and training/serving consistency
**Use when:** someone other than the author will retrain it, a result must be reconstructible later
(audit, incident, publication), **or** features are computed by different code in training and
serving.
**Avoid or keep light when:** exploratory work by one person, or one code path computes features for
both training and serving — the consistency risk does not exist yet. Record the seed and the data
version and move on.
**Reopen when:** a result cannot be reproduced, serving metrics diverge from training metrics, a
second person takes over retraining, or a serving path is rewritten in another language.
**Cost:** seed/version/snapshot discipline; a feature-computation path shared or verified across two
runtimes; storage for data snapshots.
**Review cues:** no way to reproduce last month's model; unpinned dependency or data versions;
feature engineering duplicated in a training notebook and a serving service.
**Common confusion:** training/serving skew is not a modeling problem — it is two implementations of
the same transformation drifting, and it is caught by an equivalence test, not by a metric.

### ML release gating — baseline comparison and rollback
**Use when:** you are about to ship a *second* model. Compare the candidate to the incumbent (or to a
trivial baseline) on the same held-out data and refuse a silent regression; know how to put the
previous model back.
**Avoid or keep light when:** the very first model, where "better than nothing" is the bar and the
comparison has no incumbent to make.
**Reopen when:** a regression ships unnoticed, or a bad model cannot be withdrawn quickly.
**Cost:** low — a held-out set, a comparison step, and a versioned artifact to roll back to. This is
the cheapest real release gate in ML.
**Review cues:** a new model promoted on its own metric with no incumbent comparison; no record of
which model version served which predictions; rollback that means retraining.
**Common confusion:** an improved aggregate metric is not a promotion criterion on its own — pair it
with the slice and behavioral evidence above, or you ship an average win over a segment loss.

### ML drift and quality-degradation monitoring
**Use when:** the model runs continuously against live data whose distribution can move, **and** a
degraded prediction has consequences before a human would notice unaided.
**Avoid or keep light when:** a batch or one-off scoring job whose output a human already reviews, or
labels arrive fast enough that ordinary outcome reporting already exposes decay.
**Reopen when:** the model enters a continuous or automated decision path, upstream data ownership
changes, or performance visibly decays between retrains.
**Cost:** instrumentation, a reference distribution to compare against, threshold tuning, and an
owner for every alert — an unowned drift dashboard is decoration.
**Review cues:** drift alerts nobody triages; no signal that would reveal decay before a user
complains; monitoring on inputs only, with nothing watching outcome quality.
**Common confusion:** input drift is a *hypothesis* about degradation, not degradation itself — the
model may be fine. Where labels arrive, measure outcomes; use drift as the early proxy, not the verdict.

### Deterministic LLM / agent scaffold tests
**Use when:** always, for LLM and agentic systems: request/response validation, tool schemas, tool
dispatch, permissions, state transitions, retry and timeout logic, persistence, routing, guardrails.
Suppress real model calls in unit tests and substitute a deterministic test model.
**Avoid or keep light when:** never — this is the cheapest, highest-yield evidence in an LLM system.
**Reopen when:** a new tool, permission, or state transition enters the agent loop.
**Cost:** a seam to inject the model; test doubles for the provider.
**Review cues:** unit tests that hit a provider (slow, nondeterministic, billed); no test for tool
dispatch or permission checks; every failure investigated as "the model was bad" when it was wiring.
**Common confusion:** "it's an LLM app so we need evals" — most early failures are ordinary bugs that
ordinary assertions catch.

### Golden evaluation datasets
**Use when:** output quality is genuinely semantic. Cases should be representative (including the
failure modes you fear), human-reviewed, versioned, and small enough to keep reviewing.
**Avoid or keep light when:** the property is deterministic — assert it instead.
**Reopen when:** a shipped regression was invisible to the current case set.
**Cost:** curation and re-review as the product changes; model spend per run; metric noise.
**Review cues:** an eval set assembled from whatever was handy; no failure cases in it; results
reported as a single number with no variance or case count.
**Common confusion:** an eval is a measurement with uncertainty, not a pass/fail assertion.

### Deterministic evaluators
**Use when:** the property is checkable — schema validity, required fields, exact/keyword match,
citation presence, numeric tolerance, tool called with the right arguments, latency, cost.
**Avoid or keep light when:** the property is irreducibly semantic.
**Reopen when:** a semantic property becomes checkable — a schema, a citation, an exact field.
**Cost:** near-zero; they are fast, free, and stable — reach for them first.
**Review cues:** a model-based judge scoring things a regex or schema check would decide exactly.
**Common confusion:** teams reach for a judge before exhausting deterministic checks, then debug the
judge instead of the product.

### Calibrated model-based judges (LLM-as-judge)
**Use when:** quality is semantic, deterministic criteria are insufficient, **and** the judge has
been calibrated against human-reviewed cases — with cost, variance, and bias accepted.
**Avoid or keep light when:** for schema validity, exact facts, tool-call correctness, permissions,
or anything deterministic. Skip it until deterministic rubric checks demonstrably fall short.
**Reopen when:** the judge model changes, or its scores drift from human review.
**Cost:** model spend per eval run, score variance, position/verbosity/self-preference bias, drift
when the judge model changes, and a rubric to maintain.
**Review cues:** judge scores with no human-calibration set; the judge and the system under test
sharing a model and prompt style; thresholds set to whatever the first run produced.
**Common confusion:** an LLM judge is **not objective** — it is a noisy instrument that must itself be
validated, and temperature zero reduces variation without making it deterministic.

### Production monitoring as evidence
**Use when:** always for data/ML/LLM systems — drift, freshness, error rates, refusal/fallback rates,
latency, cost, user-visible failure signals, sampled human review.
**Avoid or keep light when:** never skip; scope it to signals someone will act on.
**Reopen when:** a production failure mode appears that no existing signal covers.
**Cost:** instrumentation, dashboards, alert ownership.
**Review cues:** offline evals only; nobody would notice a quality regression until a user complains.
**Common confusion:** monitoring does not replace pre-release evidence, and pre-release evidence does
not replace monitoring — stochastic systems need both.

---

## VI. Review anti-patterns

Use as a lens in Mode B, not a form to fill. Each: what it looks like · why it costs · what to do.

- **Coverage theater** — high coverage, few meaningful assertions. Execution is being measured, not
  verification. → Look at assertion quality on critical modules; treat coverage as navigation.
- **Oracle copied from the implementation, hand-written or generated** — expected values came from
  running the code, so the test detects *change*, never *wrongness*; generated oracles are prone to
  reproducing actual rather than intended behavior (Konstantinou, Degiovanni & Papadakis,
  arXiv:2410.21136 — measured across 24 Java repositories). → Ask what requirement each test would
  detect; derive expectations from a requirement, example, invariant, or reviewed reference.
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
- **Authorization tested only on the allowed path** — every test logs in as the user who *may* do the
  thing, so the suite proves the feature works and says nothing about who is kept out; scanners
  cannot fill this gap because they do not know your rules. → Add the negative cases (wrong user,
  wrong tenant, wrong role, missing/expired token) at the seam that enforces them, against the real
  middleware rather than a stubbed guard.
- **Untested failure paths behind a stated guarantee** — retries, timeouts, fallbacks, degraded
  modes, and failover are documented and relied on, but no test ever enters them. → Exercise the
  claim at the cheapest falsifying scope: the retry/fallback logic as a unit test, the dependency
  refused or slowed as a narrow integration test.

---

## Appendix — tooling examples *(non-normative)*

Illustrative only; not a package-shopping guide — verify current names, maintenance status, and fit.

**Python:** `pytest` (+ `pytest-cov` for coverage, `pytest-xdist` for parallelism) · `Hypothesis`
(property-based) · `Testcontainers` (ephemeral dependencies) · `respx` (httpx) / `responses`
(requests) / VCR-style recording (HTTP) · `factory_boy` (data factories) · `Playwright` (browser
journeys) · `mutmut` / `Cosmic Ray` (mutation) · `tox` / `nox` (matrix runs) · `pydantic-evals`
(dataset-based evaluation, usable standalone) · PydanticAI test utilities (`TestModel`,
`FunctionModel`, `Agent.override`, `pydantic_ai.models.ALLOW_MODEL_REQUESTS = False`).

**Cross-ecosystem:** Vitest / Jest, Testing Library, Playwright (JS/TS) · JUnit and Testcontainers
(JVM) · Pact (polyglot consumer/provider contracts — JS/TS, Java/Kotlin, .NET, Go, Python, Ruby,
Rust, PHP, Swift; **many** of the language bindings wrap a shared Rust core, while others — Pact-JVM
among them — are separate implementations, so check feature parity for your language rather than
assuming it) · dbt **data** tests (dbt also has unit tests since
1.8 — those are ordinary code tests) and Great Expectations / GX Core (data-quality assertions).
