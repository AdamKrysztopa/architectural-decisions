# Compose your testing portfolio — the risk-led interview

Testing decisions **compose into a portfolio**, not a single label. Three independent dimensions
(quality practice · executable levels · stochastic evaluation) each contribute picks, and the shape
name — if any — is a *summary written afterwards*, never the strategy. The rule that governs every
step:

> **Choose the smallest reliable evidence portfolio that covers the named risks, and name the cost
> of every layer.** Start with the fastest, most local evidence that can expose the failure. Add a
> broader, slower, or more expensive layer only when a specific force fires.

**The gates are asymmetric on purpose.** Adding broad integration, E2E, an independent QA gate,
mutation testing, or an LLM judge requires *stronger* evidence than staying with the cheaper option
does. Each gate therefore states "add when" and "keep light when" separately. Never collapse the
judgment into a numeric score, and never recommend a full pyramid, trophy, or E2E suite before the
failure modes it must catch are named.

Walk the steps in order; skip branches that don't apply. Record every pick as
**Included · Force · Cost accepted · Deliberately skipped · Reopen when.**

## Step 1 — Clarify the requested scope
*Are we deciding quality practices, executable tests in the codebase, or both?*
- **Quality practices** (who checks what, acceptance, sign-off, exploratory work) → **QA branch**
  (Step 3) and stop there unless code testing also comes up.
- **Executable tests** ("what tests should I write?") → **code-testing branch** (Steps 2, 4).
- **Both** → run the QA branch briefly, then the code branch.
- **A data / ML / LLM / agentic system** → run the relevant branch *first*, then add the domain
  overlay in Step 5. The overlay is **additive**: evals do not replace ordinary code testing.

## Step 2 — Identify the system and its failure surfaces
Classify explicitly — every common system lands somewhere:

| System | Primary starting point |
|--------|------------------------|
| Pure functions / algorithms | unit |
| Rich domain model | unit-heavy, then boundaries |
| I/O-bound service or CRUD glue | narrow integration often carries more value than unit |
| Database-backed service | unit for logic + real-DB integration at the persistence seam |
| UI | component / interaction tests + a few critical journeys |
| Microservices | contract and narrow integration *before* broad E2E |
| Data transformation pipeline | transform tests + data-quality assertions + contracts |
| ML model | deterministic code tests + behavioral / model evaluation + monitoring |
| LLM call | deterministic scaffold tests + evaluation cases |
| Multi-step agent | tool / wiring tests + scenario evals + selected journey tests |
| Legacy code | characterization tests **before** any structural change |

Then ask **where complexity and risk actually live** — business invariants, serialization or
protocol boundaries, persistence, framework configuration, authn/authz, orchestration, deployment,
data quality, model quality, the user journey, human sign-off. The answers, not the system label,
drive Steps 3–5. Name the blast radius too: how reversible is a failure, and who notices first?

## Step 3 — QA-practice gates
QA is a **discipline, not a layer**. Select each practice independently; none of them implies a
separate phase, department, or release bottleneck. The default is whole-team quality ownership.

### Acceptance criteria / example-based specification
- **Add when:** product, engineering, and stakeholders disagree about expected behavior; acceptance
  depends on concrete examples; defects frequently originate in ambiguous requirements.
- **Keep light when:** behavior is local, low-risk, and already expressed by stable invariants or
  executable specifications.
- **Reopen when:** requirement disputes or acceptance escapes recur.

### Exploratory testing
- **Add when:** usability, workflow, unknown interactions, accessibility, or ambiguous behavior
  needs human investigation; the cost of undiscovered interactions is material.
- **Keep light when:** the change is isolated, mechanically verifiable, low-blast-radius, and easily
  reversible.
- **Reopen when:** defect clusters appear outside the scripted paths.
- *Automation does not replace this.* Automated checks confirm what you already thought to ask;
  exploratory work finds the questions.

### User acceptance / release evidence
- **Add when:** a contract, regulator, customer, or safety case requires formal acceptance; rollback
  is difficult and release failure has high impact.
- **Keep light when:** releases are low-risk, observable, reversible, and owned by the same team.
- **Reopen when:** release impact, external obligations, or irreversibility increases.

### Independent assurance / sign-off
- **Add when:** independence is itself the requirement (regulation, safety case, contractual
  acceptance); specialist manual assessment is needed (accessibility, security, clinical, domain);
  a conflict of interest makes self-verification insufficient; blast radius is high and irreversible.
- **Keep light when:** none of those hold — which is most of the time.
- **Do not infer** a separate QA department or a pre-release gate from the mere existence of QA work.
  Regulation justifies *evidence and independence*, not automatically a large E2E suite.

## Step 4 — Executable test-level gates

### Baseline: static feedback (not a level)
Recommend the appropriate typing, linting, static analysis, formatting, and security scanning for
the stack. These are cheap, fast, whole-file feedback that **complement — never replace —
behavioral tests.** They are baseline verification mechanisms, not a fourth test level.

### Unit tests
*Is there meaningful behavior, branching, calculation, state transition, or invariant that can be
exercised without a costly environment?*
- **Add when:** yes. This is the default first stop for logic.
- **Default to sociable units** — real lightweight collaborators, verify through observable behavior.
  Isolate a collaborator only when it is slow, nondeterministic, unavailable, expensive, or produces
  side effects. **Do not mock every class boundary**; that couples tests to structure and hides
  integration defects.
- **Keep light when:** the code is nearly all framework wiring or I/O delegation — a narrow
  integration test then gives a more truthful signal for the same effort.
- **Reopen when:** domain logic, branching, or defect density grows.

### Integration tests
*Is there a boundary whose real behavior, configuration, serialization, query, protocol, or
lifecycle can fail despite correct local logic?*
- **Add a narrow integration test around one meaningful boundary when:** yes. Prefer real lightweight
  dependencies or ephemeral containers where practical; fake only the *unrelated* boundaries.
- **Add broad multi-component integration only when:** the failure emerges from the interaction of
  several real components; a narrow test or contract cannot reproduce it; and the environment can be
  made sufficiently deterministic and owned.
- **Keep broad integration out when:** one boundary at a time yields the same evidence more cheaply.
  "Integration" does not mean "broad" — that conflation is what makes suites slow.
- **Reopen when:** cross-component failures repeatedly escape narrow tests.

### Contract tests *(a specialized integration strategy, not a level)*
- **Add consumer/provider or schema contracts when:** independently deployed services or teams share
  a boundary **and** compatibility failures across it are a recurring risk. The recurrence clause is
  what earns the contract — a boundary alone does not; two boxes on a diagram are not a force. Broad
  E2E being used mainly to discover interface drift is that same recurrence showing up as cost.
- **Keep light when:** the boundary is inside one deployable owned by one team — a narrow integration
  test is cheaper and equally truthful.
- **They do not prove the journey.** Keep a few E2E checks if deployment, routing, identity, or
  orchestration remains a distinct risk.
- **Reopen when:** a second team or a second deployable starts consuming the interface.

### End-to-end tests
*Is there a critical journey whose failure depends on full-system wiring and cannot be covered
reliably by lower-level tests?*
- **Add a small number when** a named journey *and* a named failure mode justify them, e.g.
  authentication + routing + configuration + deployment failing only in combination; a revenue-,
  safety-, or mission-critical path; cross-system orchestration visible only in a production-like
  environment.
- **Costs to name every time:** runtime, environment ownership, test data management,
  nondeterminism, diagnosis difficulty, and maintenance churn after UI or workflow changes.
- **Say it plainly when it applies: "you probably do not need E2E yet."** No named journey, no
  named failure mode → no E2E. This is a correct, common answer.
- **Reopen when:** a critical cross-system defect escapes, or the system acquires a journey whose
  full wiring carries material risk.

### Mutation testing *(a technique, not a level)*
- **Add when:** the suite is already reliable and green, and you need evidence about *assertion
  strength* in a specific critical area — not repository-wide.
- **Keep light when:** the suite is small, low-risk, or still flaky. Ask the mutation *question*
  ("would this test fail if the code were subtly wrong?") without buying the tool. Fix reliability
  first.
- **Reopen when:** a defect escapes through a module whose tests were green, or assertion quality
  becomes contested in a critical area.

### Performance, load, and resilience *(integration- or E2E-scoped concerns, not levels)*
- **Add when:** a named latency, throughput, or capacity requirement exists **and** a regression
  against it would be user-visible or contractual. Then test the shape that requirement implies:
  load at expected volume, stress beyond it to find the breaking point, a soak run where leaks and
  drift surface, or a failover / chaos exercise against a named dependency whose loss the system is
  claimed to survive.
- **Keep light when:** no such number has been named — which is most systems, most of the time.
  Production observability (latency percentiles, error rates, saturation) usually answers "is it
  fast enough?" more cheaply and more truthfully than a synthetic rig, and a benchmark on
  unrepresentative data, hardware, or concurrency misleads with confidence. One cheap guard on a
  known-hot path beats a load-testing programme nobody reads.
- **Reopen when:** a number becomes real (SLO, contract, capacity plan), traffic shape shifts by an
  order of magnitude, an incident traces to saturation or to a failover that did not work, or
  latency regressions start reaching users.

## Step 5 — Apply the domain overlay
Overlays are **added to** Step 4, never substituted for it. Deterministic code and wiring still get
ordinary unit / integration / E2E tests.

### Data pipelines
Keep three concerns separate — they fail differently and are owned differently:
1. **Transformation-code tests** — deterministic examples for the logic (unit level).
2. **Data-quality assertions** — run against *data*, not code: schema, nullability, uniqueness,
   referential integrity, ranges, freshness, volume, distribution.
   - **Add when:** a specific assertion is tied to a real downstream consequence — a wrong report, a
     wrong decision, a failed load — and a named person will act when it fires.
   - **Keep light when:** the consumer is exploratory, the table is not yet load-bearing, or the
     assertion would trip on normal variation. An unowned, noisy assertion is worse than none.
   - **Reopen when:** bad data reaches a consumer, a source changes shape, or a new consumer takes a
     hard dependency on the table.
3. **Data contracts + production monitoring**
   - **Add when:** ownership crosses a team boundary **and** upstream changes have broken you before;
     or the pipeline runs continuously, where yesterday's good data says nothing about today's.
   - **Keep light when:** producer and consumer are the same team inside one deployable — a schema
     assertion at the load step is cheaper and equally truthful.
   - **Reopen when:** an upstream schema or semantic change breaks a consumer, or a second team
     starts producing into the same table.

Name the failure surfaces that actually break pipelines — they are rarely the transform itself:
**idempotency / re-runnability** (does the second run change the result?), **backfill and replay**
over historical windows, **late-arriving and duplicate records**, and **partition or orchestration
failure** (a partial run, a retried task, a skipped upstream dependency). Each is reproducible
deterministically on small fixtures; reach for that before reaching for a bigger run.

**A full pipeline run on sample data** is the pipeline analogue of E2E and carries the same costs —
**usually not warranted**. Add one only when orchestration wiring, partitioning, or cross-step
contracts are themselves the named risk and no narrower test reproduces the failure.

Tools (dbt tests, Great Expectations, and equivalents) are *examples*, not mandatory architecture.

### ML models
Keep the ordinary code and pipeline tests, then add model-specific evidence in four gated clusters —
each bought separately, none implied by the others. The ML Test Score is a useful rubric to *cite*,
not a checklist to copy mechanically into every project.

**1. Data validation + leakage and split checks**
- **Add when:** the model is retrained on data that keeps arriving, or the split has structure —
  time, group, entity, geography — that a random split would silently violate.
- **Keep light when:** it is a one-shot model on a fixed, understood dataset with an obviously
  independent split; one documented assertion about the split is then enough.
- **Reopen when:** offline metrics outrun online results, retraining becomes automated, or a new
  feature source appears.

**2. Slice performance + behavioral cases for known-important cases**
- **Add when:** an aggregate metric hides a population you are accountable to (a paying segment,
  fairness, safety), or specific cases have been named as must-not-regress. Add invariance and
  metamorphic checks *here*, and only when a property genuinely should hold under a transformation
  you can name.
- **Keep light when:** nobody has named a slice that matters and nobody has named a case that must
  not break — aggregate metrics plus a handful of spot-checked examples are then the honest
  portfolio. **"You do not need metamorphic checks yet" is a correct, common answer.**
- **Reopen when:** a stakeholder names a segment, a complaint traces to one subpopulation, or a
  release regresses a case someone cared about.
- **Baseline comparison / champion-challenger** — before promoting any model, compare it to the
  incumbent (or to a trivial baseline) on the same held-out data and refuse a silent regression.
  Cheapest real release gate there is; earn it as soon as you ship a *second* model.

**3. Reproducibility controls (seeds, versions, data snapshots) + training/serving consistency**
- **Add when:** someone other than the author will retrain it, a result must be reconstructible later
  (audit, incident, publication), or features are computed by different code in training and serving.
- **Keep light when:** it is exploratory work by one person, or one code path computes features for
  both training and serving — the consistency risk does not exist yet.
- **Reopen when:** a result cannot be reproduced, serving metrics diverge from training metrics, or a
  second person takes over retraining.

**4. Drift and quality-degradation monitoring**
- **Add when:** the model runs continuously against live data whose distribution can move, **and** a
  degraded prediction has consequences before a human would notice unaided.
- **Keep light when:** it is a batch or one-off scoring job whose output a human already reviews, or
  labels arrive fast enough that ordinary outcome reporting already exposes decay.
- **Reopen when:** the model enters a continuous or automated decision path, upstream data ownership
  changes, or performance visibly decays between retrains.

### LLM and agentic systems
Split the system in two and use the right instrument on each half.

**Deterministic scaffold — test with ordinary assertions.** Request/response validation, tool
schemas, tool dispatch, permissions, state transitions, retry and timeout logic, persistence,
routing, guardrails. **Suppress real model calls in unit tests** — a unit test that hits a provider
is neither fast nor deterministic nor free. (In PydanticAI projects, `TestModel`, `FunctionModel`,
`Agent.override`, and the module-level `pydantic_ai.models.ALLOW_MODEL_REQUESTS = False` are the
idiomatic tools; other stacks have equivalents.)

**Stochastic behavior — evaluate, don't assert.** Representative cases · explicit rubrics ·
deterministic evaluators wherever the property allows one · human-reviewed reference labels ·
regression thresholds · reported uncertainty (a score from a handful of cases is noise). Temperature
zero reduces variation; it does **not** make model output deterministic, so don't build a suite that
assumes it does.

**Size the eval dataset to the risk** — a three-case smoke set and a versioned dataset with CI
regression thresholds are entirely different purchases.
- **Add a versioned dataset with CI regression thresholds when:** the output is user-facing or
  decision-bearing, the prompt / model / tool surface changes more than occasionally, and a quality
  regression would otherwise ship unnoticed. Version it with the code and record who labelled it.
- **Keep light when:** the system is a prototype, internal, or human-reviewed in the loop — three to
  ten hand-written cases run by hand before shipping is a legitimate and complete answer at that
  stage. Do not manufacture a hundred synthetic cases to look rigorous; unreviewed cases encode
  whatever the generator believed, which is the generated-oracle problem in another costume.
- **Reopen when:** someone who did not write the prompt starts changing it, a quality regression
  reaches users, the system moves into an automated decision path, or the question becomes
  "is version B better than version A?" rather than "is this good enough?".

**Add an LLM-as-judge only when:** the quality in question is genuinely semantic; deterministic
criteria are insufficient; the judge has been calibrated against human-reviewed cases; and you
accept its cost, variance, and bias. **Skip it** for schema validity, exact facts, tool-call
correctness, permissions, and every other deterministic property — assert those.

## Step 6 — Choose a suite-shape heuristic *(last, and only as a summary)*
Names describe a portfolio you already justified. They never generate one.
- **Pyramid-like** — rich domain logic dominates; most evidence is cheap and local.
- **Trophy-like** — thin application logic, most risk in component/framework interaction.
- **Honeycomb-like** — microservice heuristic: service behavior proven mostly through owned
  integrations, thin units, few E2E.
- **Contract-centered** — independently deployed boundaries are the main risk.
- **Evaluation-heavy overlay** — data/ML/LLM quality carries the risk, while deterministic code
  still uses ordinary levels underneath.

Warn about: the **ice-cream cone** (most confidence delegated to slow UI/E2E tests), the
**hourglass** (many tiny units plus broad E2E, with no boundary-level integration evidence in
between), and **shape compliance for its own sake**. Ratio heuristics such as Google's rough
80/15/5 are orientation, not a target to hit — and definitely not a quota to fill.

## Step 7 — Suite-health branch *(existing code)*
Inspect, then conclude. Where evidence is missing, say the conclusion is provisional.
- test count and runtime **by level**; CI wall-clock and stage layout
- parallelism and isolation; shared mutable fixtures; fixture scope
- external network or shared-environment dependencies
- flaky retries, quarantine, and whether anyone owns them
- mock density and assertion quality (do assertions encode a requirement?)
- production defects that escaped, and which layer *should* have caught each
- coverage trends as a navigation signal (never as a target); mutation evidence if it exists
- test ownership — orphaned suites decay

Then name the anti-patterns (see `catalog.md` §VI) and pick **one highest-leverage rebalancing move**
— the typical shapes are listed in `SKILL.md`; choose the one this inspection actually points at,
not the one that sounds most thorough. One move, then re-measure. No blanket rewrite.

## The generated-test gate (applies in every branch)
Passing and raising coverage are **not** evidence that a test is worth keeping. Before accepting any
generated test, require an independent oracle: a requirement, an acceptance example, an invariant, a
specification, a known-good reference, a reviewed golden case, a metamorphic relation, or an
externally observed contract. Generated oracles are **prone to** reproducing an implementation's
*actual* behavior rather than its *intended* behavior (Konstantinou, Degiovanni & Papadakis,
arXiv:2410.21136 — measured across 24 Java repositories) — which quietly promotes a current bug to a
specification. Ask of every one: **what requirement would this test detect if the implementation
changed?** Mutation thinking helps answer that; a mutation *tool* is not mandatory to ask it.

## Composing the portfolio
Compose the rows in this order — **this is a writing order, not an escalation ladder**: QA practices
(dimension 1, each gated on its own force) · baseline static feedback · unit → integration
(+ contracts) → E2E (dimension 2, and this arrow *is* an escalation) · domain overlay (dimension 3,
additive) · shape summary, if useful. Each row names its force, the cost accepted, the heavier option
deliberately skipped, and the signal that would reopen it. Close with the smallest-portfolio check —
and remember that **removing** a layer is as valid an outcome as adding one.
