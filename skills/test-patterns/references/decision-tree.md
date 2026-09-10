# Compose your testing portfolio — the risk-led interview

Testing decisions **compose into a portfolio**, not a single label. Three independent evidence
dimensions each contribute rows, and the shape name — if any — is a *summary written afterwards*,
never the strategy:

1. **Quality practices** — reviews, exploratory testing, static analysis, acceptance criteria,
   observability, production feedback, independent assurance (Step 3).
2. **Deterministic executable testing** — unit, component, integration, system, E2E, plus
   specialized boundary strategies such as contract testing (Step 4).
3. **Stochastic evaluation** — data-quality, ML, probabilistic-system, and LLM/agent evaluation
   (Step 5, detailed in `evaluation.md`).

Running across all three is one guardrail that is **not** a dimension: **oracle independence**
(`oracles.md`). The dimensions decide what evidence the portfolio contains; oracle independence
decides whether generated evidence can be trusted at all.

The rule that governs every step:

> **Choose the smallest reliable evidence portfolio that covers the named risks, and name the cost
> of every layer.** Start with the fastest, most local evidence that can expose the failure. Add a
> broader, slower, or more expensive layer only when a specific force fires.

**The gates are asymmetric on purpose.** Adding broad integration, E2E, an independent QA gate,
mutation testing, or an LLM judge requires *stronger* evidence than staying with the cheaper option
does. Each gate therefore states "add when" and "keep light when" separately. Never collapse the
judgment into a numeric score, never prescribe a ratio of unit to integration to E2E tests, and
never recommend a full pyramid, trophy, or E2E suite before the failure modes it must catch are
named.

Walk the steps in order; skip branches that don't apply. Record every pick as
**Included · Force · Cost accepted · Deliberately skipped · Reopen when.**

## Step 1 — Clarify the requested scope
*Are we deciding quality practices, executable tests in the codebase, or both?*
- **Quality practices** (who checks what, acceptance, sign-off, exploratory work) → **QA branch**
  (Step 3) and stop there unless code testing also comes up.
- **Executable tests** ("what tests should I write?") → **code-testing branch** (Steps 2, 3, 4).
  Step 3 is not optional here. Two of its gates — **Code review** and **Static analysis and
  typing** — are *Add when: always*, so they belong to every walk regardless of which branch Step 1
  routed to. What the branch changes is how much of the *rest* of Step 3 you work through, never
  whether the always-on gates are reached.
- **Both** → run the QA branch briefly, then the code branch.
- **A data / ML / LLM / agentic system** → run the relevant branch *first*, then add the stochastic
  overlay in Step 5. The overlay is **additive**: evaluations do not replace ordinary code testing,
  and code tests are not evidence of semantic quality.
- **One named gate or one named layer** ("should we add contract tests?", "is our E2E suite too
  slow?", "do we need a QA sign-off for this release?") → **walk the dimension the question named,
  and defer the rest by name.** Run Step 2 scoped to that question — the failure surface at stake
  and its blast radius — then open only that dimension's gates. Close with one line naming the
  dimensions you did not walk and why: *"dimension 1 (quality practices) and dimension 3 (stochastic
  evaluation) not walked — this question is about the executable suite's E2E layer only, and the
  system has no model or data-quality surface; ask again if a judge or an ML component lands."*
  Deferring by name is what makes a narrow answer auditable — the reader can see which dimensions
  you priced at zero and disagree with one. Walking past them silently is indistinguishable from
  having decided they were fine, and that is the shape a reader cannot check.

  Walking all three dimensions instead is the opposite failure and equally wrong: a full portfolio
  interview answering "should we add contract tests?" buys attention the question did not ask for,
  and the one answer that mattered arrives buried.

**Route on the mode before you route on the width.** A question about a suite that already exists is
a review even when it is narrow — narrowness scopes how many dimensions you walk, never which mode
you are in. Reading "narrow" first is how a review gets answered as a single-gate lookup and the
existing suite is never read at all.

**No branch here removes Step 2, and none removes the always-on gates.** The narrow branch scopes
Step 2 — one failure surface instead of the whole map — it does not skip it, and **Code review** and
**Static analysis and typing** are reached on every walk. A layer recommended with no named failure
behind it is a layer bought from a shape, which is the one thing this file exists to stop.

## Step 2 — Identify the system and its failure surfaces
Classify explicitly — every common system lands somewhere:

| System | Primary starting point |
|--------|------------------------|
| Pure functions / algorithms | unit, plus property-based tests where a real invariant exists |
| Rich domain model | unit-heavy, then boundaries |
| I/O-bound service or CRUD glue | narrow integration often carries more value than unit |
| Database-backed service | unit for logic + real-DB integration at the persistence seam |
| UI | component / interaction tests + a few critical journeys |
| Glue-shaped product (extension, integration, automation) | journey-weighted — the wiring *is* the product |
| Microservices | contract and narrow integration *before* broad E2E |
| Data transformation pipeline | transform tests + data-quality assertions + contracts |
| ML model | deterministic code tests + model evaluation + monitoring |
| LLM call | deterministic scaffold tests + evaluation cases |
| Multi-step agent | tool / wiring tests + scenario evals + selected journey tests |
| Legacy code | characterization tests **before** any structural change |
| Safety-critical / regulated | the ordinary portfolio **plus the whole of Step 3** — independence and traceability are the two that are easiest to remember, but user acceptance and release evidence are gates in that step too, and this row is not a list of the only ones that apply |

Then ask **where complexity and risk actually live** — business invariants, serialization or
protocol boundaries, persistence, framework configuration, authn/authz, orchestration, deployment,
data quality, model quality, the user journey, human sign-off. The answers, not the system label,
drive Steps 3–5. Name the blast radius too: how reversible is a failure, and who notices first?

## Step 3 — Quality-practice gates *(dimension 1)*
Quality assurance is a **discipline, not a layer**. Select each practice independently; none of them
implies a separate phase, department, or release bottleneck. The default is whole-team quality
ownership.

### Code review
- **Add when:** always — it catches intent mismatches and missing cases no test was written for.
- **Keep light when:** the ceremony, not the practice — multi-approver gates on low-blast-radius
  changes cost latency and add little.
- **Reopen when:** defects trace to "nobody understood what this was meant to do".

### Static analysis and typing
- **Add when:** always, tuned to the stack. Cheapest rejection of whole defect classes there is.
- **Keep light when:** never skip; do prune rules whose failures nobody acts on.
- **Reopen when:** a defect class recurs that a type or lint rule could have rejected.

### Acceptance criteria / example-based specification
- **Add when:** product, engineering, and stakeholders disagree about expected behavior; acceptance
  depends on concrete examples; defects frequently originate in ambiguous requirements. Also add
  when the suite has **no independent oracle** — written acceptance examples are the cheapest one.
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

### Production feedback and observability
- **Add when:** the system is deployed and its failures are observable — error rates, latency
  percentiles, saturation, user-visible failure signals, each routed to someone who will act.
  Frequently the cheapest truthful evidence, and a legitimate substitute for a synthetic rig.
- **Keep light when:** the failure would be silent, irreversible, or expensive by the time it shows —
  then it must be caught before release.
- **Reopen when:** an incident is discovered by a customer rather than by a signal.

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
- **When it does apply it overrides the default.** Developer-owned evidence is the normal answer, not
  a principle to defend against a regulator. Say plainly that the obligation changes who may produce
  the evidence.
- **Do not infer** a separate QA department or a pre-release gate from the mere existence of QA work.
  Regulation justifies *evidence and independence*, not automatically a large E2E suite.

### Traceability to obligations *(regulated / safety-critical only)*
- **Add when:** an external party enumerates requirements they will audit — each obligation then
  needs named evidence, a named owner, and a retained artifact.
- **Keep light when:** nobody will ever ask. A traceability matrix built for its own sake is
  overhead.
- **Reopen when:** certification, audit, a customer security review, or a conformance claim enters
  scope.

## Step 4 — Executable test-level gates *(dimension 2)*

### Baseline: static feedback (not a level)
Recommend the appropriate typing, linting, static analysis, formatting, and security scanning for
the stack. These are cheap, fast, whole-file feedback that **complement — never replace —
behavioral tests.** They are baseline verification mechanisms, not a test level.

### Unit tests
*Is there meaningful behavior, branching, calculation, state transition, or invariant that can be
exercised without a costly environment?*
- **Add when:** yes. This is the default first stop for logic.
- **Default to sociable units** — real lightweight collaborators, verify through observable behavior.
  Isolate a collaborator only when it is slow, nondeterministic, unavailable, expensive, or produces
  side effects. **Do not mock every class boundary**; that couples tests to structure and hides
  integration defects.
- **Add property-based tests when:** a real invariant exists — a round-trip, idempotence, ordering,
  conservation, or a reference model to compare against. For algorithmic and mathematical code this
  is usually the strongest evidence available, and it is an independent oracle by construction.
- **Keep light when:** the code is nearly all framework wiring or I/O delegation — a narrow
  integration test then gives a more truthful signal for the same effort.
- **Reopen when:** domain logic, branching, or defect density grows.

### Integration tests
*Is there a boundary whose real behavior, configuration, serialization, query, protocol, or
lifecycle can fail despite correct local logic?*
- **Add a narrow integration test around one meaningful boundary when:** yes. Prefer real lightweight
  dependencies or ephemeral containers where practical; fake only the *unrelated* boundaries.
- **A real database is the default for a persistence seam.** Queries, migrations, constraints,
  transaction boundaries, and type coercion fail only against a real engine — a mocked driver
  verifies the mock. Substitute an in-memory engine only when it is the same engine, and say so.
- **Add broad multi-component integration only when:** the failure emerges from the interaction of
  several real components; a narrow test or contract cannot reproduce it; and the environment can be
  made sufficiently deterministic and owned.
- **Keep broad integration out when:** one boundary at a time yields the same evidence more cheaply.
  "Integration" does not mean "broad" — that conflation is what makes suites slow.
- **Reopen when:** cross-component failures repeatedly escape narrow tests.

### Contract tests *(a specialized boundary-testing strategy — its own gate, not a level)*
Contract testing verifies compatibility between **independently evolving** consumers and providers.
It deserves a separate decision gate, but it is **not** a universal level between integration and
E2E, and it is not the default answer for a service boundary. Ask first:

```
Can the producer and consumer evolve independently?
├── Yes → consider contract evidence
└── No  → ordinary integration evidence may be sufficient
```

- **Add consumer/provider or schema contracts when:** the answer above is *yes* — separate
  deployables, separate teams, or a public interface with unknown consumers — **and** compatibility
  drift across that boundary is a real risk: it has broken you before, or the producer has no way to
  discover who consumes the interface. Broad E2E being used mainly to discover interface renames is
  that same risk showing up as cost.
- **Keep light when:** producer and consumer ship together, owned by one team. A compile step, a
  shared type, or a narrow integration test is cheaper and equally truthful. **Two boxes on a
  diagram are not a force** — do not recommend contracts for every internal seam.
- **They do not prove the journey.** Keep a few E2E checks if deployment, routing, identity, or
  orchestration remains a distinct risk.
- **Reopen when:** a second team or a second deployable starts consuming the interface, or the
  interface becomes public.

### End-to-end tests
*Is there a critical journey whose failure depends on full-system wiring and cannot be covered
reliably by lower-level tests?*

**Both halves are required, and both must be named in the user's own terms:**

1. a concrete user or system **journey**; and
2. a **failure mode** that narrower evidence cannot reliably expose.

> **No named journey and no named failure mode that requires complete wiring means no E2E
> recommendation.**

> **The examples below are illustration, never justification.** Before an E2E row may be written,
> quote the journey and the failure mode **from the system under discussion**, in the user's own
> terms. A journey copied from this list — or paraphrased from it — has not been named; it has been
> borrowed, and the gate has not actually opened.

- **Add a small number when** both halves hold, e.g. authentication + routing + configuration +
  deployment failing only in combination; a revenue-, safety-, or mission-critical path;
  cross-system orchestration visible only in a production-like environment.
- **Add significant E2E coverage when the product is genuinely glue-shaped** — a browser extension
  against a host page, an integration or automation product, a UI-heavy product whose behavior *is*
  the interaction, a deployment- or configuration-sensitive system, or anything dominated by
  cross-component behavior. There, a large E2E share is proportionate and correct. **Do not be
  dogmatically anti-E2E**; the rule is that E2E must be *earned*, and in these systems it is.
- **Costs to name every time:** runtime, environment ownership, test data management,
  nondeterminism, diagnosis difficulty, and maintenance churn after UI or workflow changes. When the
  portfolio is journey-weighted, buy determinism deliberately — hermetic fixtures, stable selectors,
  injected clocks — or it degrades into an ice-cream cone.
- **Say it plainly when it applies: "you probably do not need E2E yet."** That is a correct, common
  answer for logic-shaped systems.
- **Reopen when:** a critical cross-system defect escapes, or the system acquires a journey whose
  full wiring carries material risk.

### Mutation testing *(a technique, not a level)*
- **Add when:** the suite is already reliable and green, and you need evidence about *assertion
  strength* in a specific critical area — not repository-wide.
- **Keep light when:** the suite is small, low-risk, or still flaky. Ask the mutation *question*
  ("would this test fail if the code were subtly wrong?") without buying the tool. Fix reliability
  first.
- **Reopen when:** a defect escapes through a module whose tests were green, or assertion quality
  becomes contested in a critical area — including any area where tests were generated.

### Performance *(a cross-level concern, not a level)*
**Every performance row must name the claim it defends** — a latency, throughput, resource, or
scalability number, or a specific hot path whose cost is a property of the code. "It should be fast"
is not a claim, and a rig that defends no claim is cost without evidence.
- **Add a local deterministic benchmark or complexity guard when:** the cost lives in the code
  itself — an algorithm, a parser, a serializer, a query builder, a hot loop — and a regression
  would be invisible until it aggregated in production. This is unit-scoped, runs in the ordinary
  suite, and is often the cheapest *correct* performance evidence available. Assert a bound or a
  relative regression, never a wall-clock absolute on shared CI hardware.
- **Add load, stress, or soak testing when:** a named latency, throughput, resource, or scalability
  requirement exists **and** a regression against it would be user-visible or contractual. Then test
  the shape that requirement implies: load at expected volume, stress beyond it to find the breaking
  point, or a soak run where leaks and drift surface. **Scope it where the requirement lives — load
  testing is not automatically E2E.** A single binary or component driven directly is often enough;
  one service at its API against an ephemeral database is integration-scoped and answers most
  per-service numbers; go full-system only when the capacity behavior *emerges* across components
  (pools, queues, caches, shared downstreams) and no narrower rig reproduces it.
- **Keep light when:** no such number has been named — which is most systems, most of the time.
  Production observability (latency percentiles, error rates, saturation) usually answers "is it
  fast enough?" more cheaply and more truthfully than a synthetic rig, and a benchmark on
  unrepresentative data, hardware, or concurrency misleads with confidence. One cheap guard on a
  known-hot path beats a load-testing programme nobody reads.
- **Reopen when:** a number becomes real (SLO, contract, capacity plan), traffic shape shifts by an
  order of magnitude, an incident traces to saturation, or latency regressions start reaching users.

### Resilience and failure behavior *(a cross-level concern, not a level)*
This gate is **independent of the performance gate** — it fires on a named failure, recovery, or
continuity requirement, and needs no number at all.
- **Add when:** the system makes a claim about surviving something: "keep taking orders when the
  payment provider is down", "degrade to cached results", "recover without data loss after a broker
  restart", a documented fallback, an agreed RTO/RPO, or a retry / timeout / circuit-breaker someone
  is relying on. **The claim is the force.** An untested failure path is a claim nobody has checked.
- **Test at the cheapest scope that can falsify the claim:** first a unit test on the retry, timeout,
  backoff, or fallback logic itself; then a narrow integration test with the dependency refused,
  slowed, or returning garbage; and a failover or chaos exercise against real infrastructure **only**
  when the claim depends on wiring, replication, or orchestration that no smaller test reproduces.
- **Keep light when:** no continuity claim has been made, the dependency's loss simply means the
  feature is unavailable, and that is acceptable and visible. Say so plainly rather than inventing a
  resilience programme.
- **Reopen when:** an incident traces to a failure path nobody had exercised, a dependency becomes
  business-critical, an RTO/RPO or availability target is agreed, or a failover does not work the
  first time it is needed.

### Security testing *(a cross-level concern, not a level)*
**Scanning is the baseline, not the strategy.** Dependency and static scanners find known-vulnerable
libraries and common code-level patterns; they cannot know who is *allowed* to do what in your
domain, so authorization rules are yours to test. Broken access control also sits at the top of the
OWASP Top 10 — hold both facts without asserting that one explains the other.
- **Add authorization and business-rule tests when:** the system has roles, ownership, tenancy, or
  any rule about who may read or change what — that is, nearly always. Assert the **negative** cases
  at the cheapest level that can express them: wrong user, wrong tenant, wrong role, missing token,
  expired token, another user's identifier. A positive-path-only suite proves the feature works, not
  that it is protected.
- **Add realistic API / integration verification when:** authn, authz, or input handling depends on
  real middleware, framework configuration, or serialization — verify it at the boundary rather than
  against a mocked guard that always says yes. A stubbed authorizer tests the stub.
- **Add negative and abuse cases when:** a named input surface is attacker-reachable — injection into
  a query, template, or command; unsafe deserialization; path traversal; mass assignment; SSRF on a
  user-supplied URL. One case per named surface, not a transcription of a checklist.
- **Add fuzzing or dynamic testing when:** the surface is a parser, protocol, or file format, or
  otherwise structured and attacker-controlled, and hand-written cases keep missing input shapes.
- **Add a specialist assessment (threat model, penetration test, code audit) when:** exposure
  warrants it — internet-facing with sensitive data, money movement, regulated data, a new trust
  boundary — or a regulation, customer, or contract requires it. Point it at the design and the trust
  boundaries; do not buy it to re-run a scanner.
- **Keep light when:** the system is internal, single-tenant, holds nothing sensitive, and crosses no
  meaningful trust boundary. Baseline scanning plus the authorization tests you already owe is then
  the honest portfolio.
- **Reopen when:** a trust boundary appears (multi-tenancy, external users, a public API), the data
  classification changes, an incident or report traces to access control or input handling, or the
  system starts moving money or handling personal data.

## Step 5 — Apply the stochastic overlay *(dimension 3)*
*Does this system have a data-quality, model-quality, or LLM/agent-quality surface?*
- **No** → skip this step entirely. Most systems do.
- **Yes** → read `evaluation.md` and walk the relevant section (data pipelines · ML models · LLM and
  agentic systems). Do not reconstruct those gates from memory.

> **"Statistical" is not the test, and neither is "machine learning".** Two different mistakes live
> here, and the fix for one must not cause the other.
>
> A **closed-form estimator** — a mean, a quantile, a regression solved analytically, a numerical
> routine with a known invariant — is **dimension 2**: its output is a deterministic function of its
> input, so it is *asserted*, not evaluated. Reaching for an evaluation harness because the word
> "statistical" appeared is the reflex this step exists to prevent.
>
> But **data quality is a dimension-3 surface whether or not a model is involved.** An ordinary ETL
> or analytics pipeline with no learned component still has freshness, completeness, distribution and
> referential expectations that no unit test asserts, and `evaluation.md`'s data-pipeline section is
> written for exactly that case. Do not read the ML and LLM sections as the whole of this step: the
> question in the heading is whether the system has a data-quality, model-quality, *or*
> LLM/agent-quality surface, and the first of the three stands on its own.

Two rules hold before you open that file:

1. **The overlay is additive.** Deterministic code and wiring still get ordinary unit / integration /
   E2E tests. Evaluations are not a substitute for them.
2. **Deterministic tests are not evidence of semantic quality.** A green suite says nothing about
   ranking, relevance, calibration, or answer quality. Split the system into its deterministic half
   (assert) and its stochastic half (evaluate), and write that split down.

## Step 6 — Choose a suite-shape heuristic *(last, and only as a summary)*
Names describe a portfolio you already justified. They never generate one, and they never come with
a ratio.
- **Pyramid-like** — rich domain logic dominates; most evidence is cheap and local.
- **Trophy-like** — thin application logic, most risk in component/framework interaction.
- **Honeycomb-like** — microservice heuristic: service behavior proven mostly through owned
  integrations, thin units, few E2E.
- **Contract-centered** — independently deployed boundaries are the main risk.
- **Journey-weighted** — glue-shaped or UI-heavy products where the wiring *is* the product.
- **Evaluation-heavy overlay** — data/ML/LLM quality carries the risk, while deterministic code
  still uses ordinary levels underneath.

Warn about: the **ice-cream cone** (most confidence delegated to slow UI/E2E tests *that are covering
logic with a cheaper home*), the **hourglass** (many tiny units plus broad E2E, with no
boundary-level integration evidence in between), and **shape compliance for its own sake**. Ratio
heuristics such as Google's rough 80/15/5 are orientation, not a target to hit — and never a quota to
fill or to hand back as a recommendation.

## Step 7 — Suite-health branch *(existing suites)*
Inspect, then conclude. **Infer what tests actually exercise rather than trusting directory names.**
Where evidence is missing, say the conclusion is provisional.

> **Step 7 routes into Step 3, not around it.** An existing suite is still owned by people, and the
> always-on Step 3 gates (Code review, Static analysis and typing) apply to it exactly as they apply
> to a new one. A review that reports only on executable tests has looked at one dimension of three.
- test count and runtime **by level**; CI wall-clock and stage layout
- what each level actually touches — open a sample from each directory and check the resources: a
  `unit/` test that starts a container is an integration test, and a `browser/` test with the network
  stubbed is not E2E
- mocks, fakes, containers, external dependencies, browser drivers, and evaluation code — what is
  real and what is a double
- parallelism and isolation; shared mutable fixtures; fixture scope
- external network or shared-environment dependencies
- flaky retries, quarantine, and whether anyone owns them
- mock density and assertion quality (do assertions encode a requirement?)
- **oracle independence** — sample generated, recorded, and snapshotted tests against `oracles.md`
- production defects that escaped, and which layer *should* have caught each
- authorization seams tested only on the allowed path; guards verified against a stub rather than
  the real middleware
- stated guarantees with no test behind them — retries, timeouts, fallbacks, degraded modes, failover
- performance rigs that defend no named claim
- coverage trends as a navigation signal (never as a target); mutation evidence if it exists
- test ownership — orphaned suites decay

Relate findings to **escaped defects, flakiness, runtime, and ownership cost** wherever that data
exists; where it does not, say so rather than inventing it.

Then name the anti-patterns (see `catalog.md` §VI, plus `evaluation.md` §IV for stochastic systems)
and pick **one highest-leverage rebalancing move** — the typical shapes are listed in `SKILL.md`;
choose the one this inspection actually points at, not the one that sounds most thorough. One move,
then re-measure. No blanket rewrite. **"The suite is proportionate; no change is currently
justified" is a valid and complete conclusion.**

## The oracle-independence gate (applies in every branch)
Passing and raising coverage are **not** evidence that a test is worth keeping. Before accepting any
generated, recorded, or snapshotted test, require an independent oracle and run the five-question
gate in `oracles.md`. The compressed form:

> **What requirement would this test detect if the implementation changed?**

The full gate, the list of acceptable external oracles, and the reject/flag list live in
`oracles.md` — read it whenever tests are generated rather than derived from a stated requirement.

## Composing the portfolio
Compose the rows in this order — **this is a writing order, not an escalation ladder**: quality
practices (dimension 1, each gated on its own force) · baseline static feedback · unit → integration
(+ contracts where the independence gate opened) → E2E (dimension 2, and this arrow *is* an
escalation) · the cross-level concerns that fired (performance, resilience, security — each placed at
the cheapest scope that answers it) · the stochastic overlay (dimension 3, additive) · the oracle
assessment where tests are generated · shape summary, if useful. Each row names its force, the cost
accepted, the heavier option deliberately skipped, and the signal that would reopen it. Close with
the smallest-portfolio check — and remember that **removing** a layer is as valid an outcome as
adding one.
