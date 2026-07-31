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
  a boundary; compatibility failures are a recurring risk; broad E2E is being used mainly to
  discover interface drift.
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

## Step 5 — Apply the domain overlay
Overlays are **added to** Step 4, never substituted for it. Deterministic code and wiring still get
ordinary unit / integration / E2E tests.

### Data pipelines
Keep three concerns separate — they fail differently and are owned differently:
1. **Transformation-code tests** — deterministic examples for the logic (unit level).
2. **Data-quality assertions** — run against *data*, not code: schema, nullability, uniqueness,
   referential integrity, ranges, freshness, volume, distribution. Pick only the ones tied to a real
   downstream consequence.
3. **Data contracts + production monitoring** — where ownership crosses a team boundary, and where
   yesterday's good data says nothing about today's.

Tools (dbt tests, Great Expectations, and equivalents) are *examples*, not mandatory architecture.

### ML models
Keep the ordinary code and pipeline tests, then add model-specific evidence as the risk warrants:
data validation · leakage and split checks · invariance and metamorphic checks · slice performance
(not just an aggregate metric) · behavioral test cases for known-important cases · reproducibility
controls (seeds, versions, data snapshots) · training/serving consistency · monitoring for drift and
quality degradation. The ML Test Score is a useful rubric to *cite*, not a checklist to copy
mechanically into every project.

### LLM and agentic systems
Split the system in two and use the right instrument on each half.

**Deterministic scaffold — test with ordinary assertions.** Request/response validation, tool
schemas, tool dispatch, permissions, state transitions, retry and timeout logic, persistence,
routing, guardrails. **Suppress real model calls in unit tests** — a unit test that hits a provider
is neither fast nor deterministic nor free. (In PydanticAI projects, `TestModel`, `FunctionModel`,
`Agent.override`, and `ALLOW_MODEL_REQUESTS=False` are the idiomatic tools; other stacks have
equivalents.)

**Stochastic behavior — evaluate, don't assert.** Representative cases · explicit rubrics ·
deterministic evaluators wherever the property allows one · human-reviewed reference labels ·
regression thresholds · reported uncertainty (a score from a handful of cases is noise). Temperature
zero reduces variation; it does **not** make model output deterministic, so don't build a suite that
assumes it does.

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

Then name the anti-patterns (see `catalog.md` §VI) and pick **one highest-leverage move**, e.g.:
replace ten overlapping E2E checks with one journey plus narrow integration coverage · replace
mock-heavy service tests with a real database boundary test · add a consumer contract where broad
E2E is only detecting schema drift · quarantine flaky tests **with an owner and an expiry** instead
of silently retrying · require independent expected behavior before accepting generated tests ·
split deterministic agent wiring tests from semantic evals. One move, then re-measure. No blanket
rewrite.

## The generated-test gate (applies in every branch)
Passing and raising coverage are **not** evidence that a test is worth keeping. Before accepting any
generated test, require an independent oracle: a requirement, an acceptance example, an invariant, a
specification, a known-good reference, a reviewed golden case, a metamorphic relation, or an
externally observed contract. Generated oracles are known to reproduce an implementation's *actual*
behavior rather than its *intended* behavior — which quietly promotes a current bug to a
specification. Ask of every one: **what requirement would this test detect if the implementation
changed?** Mutation thinking helps answer that; a mutation *tool* is not mandatory to ask it.

## Composing the portfolio
Stack the picks: `QA practices` → `baseline static feedback` → `unit` → `integration (+ contracts)`
→ `E2E` → `domain overlay` → `shape summary, if useful`. Each row names its force, the cost
accepted, the heavier option deliberately skipped, and the signal that would reopen it. Close with
the smallest-portfolio check — and remember that **removing** a layer is as valid an outcome as
adding one.
