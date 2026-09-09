---
name: test-patterns
description: "Use when designing or reviewing a software testing strategy — deciding between unit, integration, contract, E2E, QA practices, data-quality checks, ML evaluation, or LLM/agent evaluation; reviewing a slow, flaky, mock-heavy, or ineffective suite; chasing escaped defects; judging whether generated tests rest on a trustworthy oracle; or asking which evidence a system actually needs. Also triggers on 'pyramid or trophy', 'do we need QA', 'why is CI slow and still missing bugs', 'how do I test this pipeline / model / agent', 'review my test suite'. Greenfield produces a risk-led evidence portfolio and an ADR; an existing suite is inspected and receives one highest-leverage rebalancing move plus a written review. Do not use this skill merely to implement one ordinary test when no testing-strategy decision is required."
---

# test-patterns : compose the smallest reliable evidence portfolio, or rebalance the suite you have

Testing strategy is **derived from risks, required evidence, and evidence cost**. A pyramid, trophy,
honeycomb, or any other shape is a *description of the resulting portfolio* — never the starting
prescription, and never a ratio to hit.

## Three evidence dimensions, one trust guardrail

Flattening these into a single hierarchy is the most common strategy error.

1. **Quality practices** — a *process discipline*: code review, exploratory testing, static analysis,
   acceptance criteria, observability, production feedback, user acceptance, independent assurance
   where justified. **Not** a level beside unit / integration / E2E, and its existence does not imply
   a separate QA phase, department, or release bottleneck. The default is whole-team quality
   ownership.
2. **Deterministic executable testing** — unit, component, integration, system, E2E, plus
   specialized boundary strategies such as **contract testing**. This skill normalizes to three
   primary levels — unit, integration, E2E — because those track cost and feedback speed, which is
   what the gates actually trade off. That is *this skill's normalization*, not a universal taxonomy:
   ISTQB CTFL names five levels, and vocabulary genuinely varies between organizations.
   `references/catalog.md` §II maps the common alternative terms onto it, so translate rather than
   argue. Static analysis, typing, linting, and security scanning are **baseline verification**, not
   a level. Performance, resilience, and security are **cross-level concerns**, each on its own gate,
   bought at whichever scope exposes their named failure most cheaply. Property-based, parameterized,
   mutation, snapshot, approval, golden-file, characterization, and test-double approaches are
   **techniques**, not levels.
3. **Stochastic evaluation** — data-quality evaluation, ML evaluation, probabilistic or
   non-deterministic systems, LLM and agent evaluation. Keep the phrasing straight: **deterministic
   behavior is tested with assertions; stochastic quality is evaluated against cases, metrics,
   rubrics, and thresholds.**

Running across all three, and belonging to none of them:

> **Generated tests require an independent source of intended behavior. The implementation under
> test must not be the sole oracle used to generate both the test inputs and the expected outcomes.**

> **The first three dimensions define the evidence portfolio. Oracle independence determines whether
> generated evidence can be trusted.**

Suite *shapes* and *techniques* are chosen **last** — only after the risks and boundaries are named.
The through-line: **choose the smallest reliable evidence portfolio that covers the named risks, and
name the cost of every layer.** The guardrail that outranks the rest: **do not add a broader layer
merely to make the diagram look balanced — add it because a named failure cannot be detected reliably
at a cheaper boundary.**

## The references — load on demand

| Read this | When |
|-----------|------|
| `references/decision-tree.md` | Always, in both modes. The interview, the asymmetric escalation gates, and the suite-health inspection list. |
| `references/catalog.md` | Whenever you need an entry's force, cost, reopening signal, or review cue for dimensions 1–2 — quality practices, levels, shapes, techniques, cross-level concerns, review anti-patterns. |
| `references/evaluation.md` | **Only** when the system has a data-quality, model-quality, or LLM/agent-quality surface (dimension 3). Skip it otherwise — most systems have none. |
| `references/oracles.md` | Whenever tests are generated, recorded, or snapshotted rather than derived from a stated requirement — and in every suite review. |

Take each pick's *force*, *cost accepted*, and *reopening signal* from these files, not from your own
priors, so every row carries a real trade-off rather than a name.

## Step 0 — Establish where the user is

Branch on **greenfield or existing suite?** Designing testing for new work (or a material redesign),
or assessing tests that already exist (code, CI config, a described suite)?

The request usually tells you: "what tests should I write for…" / "how do I test this pipeline" =
greenfield; "review my test suite" / "why is CI so slow" / "our tests are flaky" / a repo to read =
existing. Ask only if ambiguous.

**Also detect whether the scope is open or fixed.** "Do we need QA?" and "what should we test?" are
open — run the gates. But "we're contractually required to produce acceptance evidence — help me do
it well" is fixed: acknowledge the constraint, name its cost once, and design around it. Don't
relitigate a decision the user has already closed.

**And detect read-only requests.** See "Read-only mode" below.

If the question is really how to **build** an agent — autonomy level, reasoning loop, topology,
memory, guardrails — rather than how to get evidence about one, hand off to the `agentic-patterns`
skill, which owns that decision tree. This skill covers the evidence, not the design.

## Mode A — Greenfield: the risk-led portfolio interview

Read `references/decision-tree.md` and walk it from **Step 1 (scope) → Step 2 (system and failure
surfaces) → Step 3 (quality-practice gates) → Step 4 (level gates) → Step 5 (stochastic overlay) →
Step 6 (shape, last)**. Ask one decision at a time; skip anything the codebase or the user has
already answered. **Step 1 can end the walk early:** a pure quality-practices question ("do we need
QA?") stops at Step 3 unless executable code testing also comes up — don't hand back an unrequested
test portfolio.

1. **Inspect the available context first.** Architecture notes, ADRs, the repository layout,
   dependencies, deployment configuration, existing test directories. Ground the interview in what
   is actually there rather than asking the user to describe it back to you.
2. **Name concrete failure surfaces before naming any level.** No layer is justified by a diagram. If
   you cannot say what failure a test catches, it is not yet earned.
3. **For each failure, find the cheapest reliable evidence.** Escalate bottom-up and asymmetrically:
   start with the fastest, most local evidence that could expose it. A broader, slower, or more
   expensive layer — broad integration, E2E, an independent QA gate, mutation testing, an LLM judge —
   needs *stronger* evidence to add than the cheap option needs to keep. Never use a numeric score to
   hide the judgment.
4. **Keep the three dimensions distinct** in the output. A quality practice, an executable test, and
   a stochastic evaluation are different purchases with different owners.
5. **Record the cost of every pick** — runtime, environment ownership, maintenance, calendar time,
   model spend, alert ownership.
6. **Record what you deliberately did not buy**, and why.
7. **Define the reopening signal** for each row: the concrete event that would change the answer.
8. **Persist the accepted decision as a MADR-style ADR** (see "Recording the outcome").

Output — the evidence portfolio (the shared contract, below).

**When the honest answer is "less", say it plainly.** "You don't need E2E yet", "no independent QA
phase", "no broad integration", "no mutation tool", "no LLM judge", "no contract test — you ship
together" are first-class outcomes, often the most valuable ones. Give the reason and the single
signal that would change the answer, and don't pad the table to look thorough.

## Mode B — Existing suite: the test-suite review

**Inspect before concluding.** A described suite is a hypothesis, not a measurement — never fabricate
suite characteristics, and **if code or CI evidence is unavailable, say which conclusions are
provisional.**

1. **Read the real test code and CI configuration** — not just the tree.
2. **Infer what tests actually exercise**, rather than trusting directory names. A `unit/` test that
   starts a container is an integration test; a `browser/` test with the network stubbed is not E2E.
   Classify by resources touched.
3. **Inspect mocks, fakes, containers, external dependencies, browser drivers, and evaluation code.**
   Mock density and assertion quality say more than counts.
4. **Identify missing, duplicated, misplaced, or disproportionately expensive evidence.** Walk the
   inspection list in `references/decision-tree.md` **Step 7**, and run the review cues from
   `references/catalog.md` §VI (plus `references/evaluation.md` §IV for stochastic systems) as a
   lens, not a form. Report a genuine problem even if no cue names it.
5. **Assess oracle independence** against `references/oracles.md` — sample generated, recorded, and
   snapshotted tests. In a suite that looks healthy by every other measure, this is frequently the
   highest-leverage finding.
6. **Relate findings to escaped defects, flakiness, runtime, and ownership cost** wherever that data
   exists. Where it does not, say so rather than inventing it.
7. **Recommend exactly ONE primary highest-leverage move.** Not a rewrite. Typical shapes: relocate
   ten overlapping E2E checks into one journey plus narrow integration; replace a mocked persistence
   layer with a real database boundary test; add a consumer contract where broad E2E is only
   detecting schema drift; quarantine flaky tests *with an owner and expiry* instead of silently
   retrying; require an independent oracle before accepting generated tests; split deterministic
   agent wiring tests from semantic evals.
8. **Secondary observations are allowed** — as a short ordered list, never as a wholesale rewrite.
9. **"The suite is proportionate; no change is currently justified" is a valid and complete
   conclusion.** Say it plainly and keep the report short. Inventing findings to look thorough is
   itself a failure mode.

Output — the evidence portfolio (the shared contract, below) plus the review-only sections.

## The output contract (both modes)

Both modes report the same evidence-portfolio table, so a greenfield decision and a later review are
directly comparable:

```
## Evidence portfolio

**System context:** <what it does, who depends on it, how reversible a failure is.>
**Assumptions:** <what you inferred rather than confirmed — mark provisional conclusions.>
**Critical failure surfaces:** <the named risks, in the user's terms.>

| Risk or claim | Selected evidence | Why it belongs | Cost accepted | Evidence deliberately omitted | Reopen when |
|---------------|-------------------|----------------|---------------|-------------------------------|-------------|
| <named failure or claim> | <practice, level, technique, or evaluation> | <the force> | <runtime / ownership / calendar / spend> | <the heavier option not bought> | <the signal> |

**Deterministic tests vs stochastic evaluations:** <the split, when the system has a stochastic
surface — which half is asserted and which is evaluated. Omit if there is no such surface.>

**Generated-test oracle assessment:** <where generated, recorded, or snapshotted tests exist: the
oracle each rests on, and any that must be rejected or strengthened. Omit if none.>

**Primary recommendation:** <the single most important move, stated in one sentence.>

**Consequences and trade-offs:** <what this portfolio costs to own, and what it deliberately leaves
uncovered.>

**The smallest-portfolio check:** <one or two sentences confirming nothing here is broader than the
risk requires — or naming a layer to drop.>
```

For an existing suite, add these sections:

```
**Observed current portfolio:** unit <n, runtime> · integration <n, runtime> · E2E <n, runtime> |
evaluations <n> | CI wall-clock <…> *(measured / reported / unknown)* — classified by what the tests
actually touch, not by directory name.

### Evidence-placement problems
<missing, duplicated, misplaced, or disproportionately expensive evidence — with file refs.>

**The single highest-leverage move:** <the one change.>
**Expected benefit:** <runtime, trust, escaped-defect class, or ownership cost.>
**Migration scope:** <what has to change, and the smallest safe first step.>
**Indicators the change worked:** <what to re-measure.>
**Then, in order:** <2–4 secondary observations.>
**Sound as-is:** <what is already right — say so.>
```

**Never prescribe numerical ratios** of unit, integration, and E2E tests. Report counts you measured;
do not hand back targets.

## The E2E gate (both modes)

> **No named journey and no named failure mode that requires complete wiring means no E2E
> recommendation.**

An E2E test requires **both** (1) a concrete user or system journey and (2) a failure that narrower
evidence cannot reliably expose. Both must be stated in the user's own terms.

Equally: **do not be dogmatically anti-E2E.** When the product is genuinely glue-shaped, UI-heavy,
deployment-sensitive, or dominated by cross-component behavior — a browser extension, an integration
or automation product, a UI whose behavior *is* the interaction — a significant E2E share is
proportionate and correct. The rule is that E2E must be *earned*, and in those systems it is.

## Tests and evaluations are not substitutes (dimension 2 vs 3)

For data, ML, LLM, and agent systems, split the system and write the split down.

- **Deterministic software tests** — schemas, transformations, feature calculations, routing, tool
  permissions, retries, persistence, serialization, prompt construction, output parsing, guardrails,
  deterministic fallback logic.
- **Stochastic evaluations** — ranking quality, model discrimination, calibration, retrieval
  relevance, semantic answer quality, hallucination rate, policy adherence, task completion,
  robustness across representative cases.

Stochastic evaluations are **not** a substitute for software tests: most early failures in an LLM
system are ordinary wiring bugs that ordinary assertions catch faster. Deterministic tests are **not**
sufficient evidence of semantic quality: a green suite says nothing about relevance or calibration.

Treat an **LLM judge as a measuring instrument**, never an oracle. Buying one requires all four of: a
named claim it measures; a reason simpler deterministic evidence is insufficient; calibration against
human-labelled examples; and monitoring for judge drift or bias. Details in
`references/evaluation.md`.

## The generated-test oracle gate (both modes)

**A test is not trusted because it passes or because coverage went up.** Before accepting any
generated, recorded, or snapshotted test, ask:

1. Where does the expected behavior come from?
2. Is that source independent of the implementation?
3. Could the same defect have influenced both the implementation and the expected output?
4. Does the test assert externally meaningful behavior?
5. Would mutation or deliberate fault injection demonstrate assertion strength?

Acceptable external oracles: specifications, standards, invariants, independently implemented
reference models, production examples, historical defect cases, human-reviewed expected behavior,
metamorphic relations, domain constraints.

Reject or flag tests where implementation code was used to infer expected behavior, the assertion
merely restates the implementation, snapshots are accepted without review, or a language model
invented expected outputs with no independent basis.

> **Generated coverage without an independent oracle is coverage theatre.**

The compressed review question — **what requirement would this test detect if the implementation
changed?** The full gate, the oracle list, and the legitimate exceptions (labelled characterization
tests; reviewed snapshots) are in `references/oracles.md`.

## Read-only mode

**When the user requests a dry run, review-only mode, or no file changes, present the complete
recommendation without creating or modifying repository files.** Phrases like "review only", "don't
change anything", "dry run", "just tell me", or an explicitly read-only target all count. Say once at
the end that the artifact was not written and where it would have gone.

Otherwise persist the outcome. **Do not ask for confirmation when repository context is sufficient to
proceed.**

## Recording the outcome (write the file)

A strategy that lives only in a chat transcript is lost. Persist it.

**Greenfield → an ADR.** After presenting the portfolio, write `docs/adr/NNNN-short-title.md`
(lowercase words joined by hyphens, e.g. `0004-risk-led-evidence-portfolio-invoicing.md`) — a 4-digit
number, one past the highest existing ADR in `docs/adr/` (else `0001`). Create `docs/adr/` if absent.
Follow the repository's existing ADR template if it has one; otherwise this MADR-style shape:

```
# NNNN. <decision title, e.g. "Risk-led evidence portfolio for invoice processing">

- Status: Accepted
- Date: <YYYY-MM-DD>
- Deciders: <the user / team, if known>

## Context
<what the system does, the named failure surfaces and their blast radius, the constraints —
release cadence, reversibility, regulation, team shape, environment ownership.>

## Decision
<the evidence-portfolio table you just presented, plus the deterministic/stochastic split and the
oracle assessment where they apply.>

## Consequences
<the cost of each row; the heavier options rejected and why; CI and ownership implications
(runtime budget, who owns fixtures/environments/evals); and the reopening signals.>
```

**Existing suite → a dated review report.** Write it to `docs/test-suite-review-<YYYY-MM-DD>.md`
(create `docs/` if absent) with the output contract above. If the suite is already well balanced, say
so plainly and keep the report short — a clean bill of health is a valid outcome, not a failure to
find work. If a rebalancing move is a direction the user commits to, offer to capture it as its own
ADR.

Write the file and report its path. Ask first only if the repo layout is unclear or the user is
clearly still exploring rather than deciding.

## Why this shape

The costliest testing mistakes are made before a single test is written: treating QA as a phase,
treating levels as interchangeable folders, buying an E2E suite to feel safe, recommending contract
tests for every internal seam, or replacing ordinary code tests with evals because the system has an
LLM in it. Leading with the three-dimension split, the risk-first gates, and an explicit oracle
guardrail keeps the focus where suites actually fail — slow, flaky, untrusted evidence that nobody
can tie to a requirement.

## Record the decision

If this run made a recommendation — **including an explicit refusal** (a refused E2E suite, a
"no change needed" review) — record it. Read `references/recording-decisions.md` and follow it: read
the existing constitution, write one decision file with `status: proposed`, classify each rule's
`verification` honestly (default `narrative`), and regenerate the constitution. This is the same ADR
the output contract already asks for, in the schema the baseline can read.

Do not record when the run only answered a question without recommending anything.

## Notice drift later

At a checkpoint — before a commit, or when a session start notice says edits are queued — drain the
observations and classify them: `references/observing-drift.md`. Report a violation only where a
tool actually failed.
