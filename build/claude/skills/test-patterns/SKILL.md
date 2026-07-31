---
name: test-patterns
description: "Use when choosing or reviewing a software testing strategy — what belongs to QA versus executable tests, which unit / integration / end-to-end tests are justified, why a suite is slow or flaky, whether contract or property-based testing fits, or how to test data, ML, LLM, and agentic systems. Branches automatically: greenfield → a risk-led testing portfolio and ADR; existing test code → a suite review with one highest-leverage rebalancing move. Keeps QA as a process discipline, code testing as unit / integration / end-to-end, and stochastic evaluation as a separate overlay. Pushes toward the smallest reliable feedback loop that covers the risk. Reach for this whenever tests, the test pyramid or trophy, mocks, fixtures, flakiness, coverage, mutation testing, golden files, or LLM evals come up, even if no level is named."
---

# test-patterns : compose the smallest reliable evidence portfolio, or rebalance the suite you have

"Testing" is three different things, and flattening them into one hierarchy is the most common
strategy error:

1. **Quality practice (QA)** — a *process discipline*: risk analysis, acceptance criteria,
   exploratory testing, usability and accessibility assessment, release-readiness evidence, user
   acceptance, independent assurance where justified, production feedback. It is **not** a fourth
   level beside unit / integration / E2E, and its existence does not imply a separate QA phase,
   department, or release bottleneck. The default is whole-team quality ownership.
2. **Executable code tests** — exactly three primary levels: **unit**, **integration**, **E2E**.
   Static analysis, typing, linting, and security scanning are baseline verification, not a fourth
   level. Contract testing is a specialized *integration* strategy. Property-based, parameterized,
   mutation, snapshot, approval, golden-file, characterization, and test-double approaches are
   *techniques*, not levels.
3. **Stochastic quality evaluation** — the extra evidence data, ML, and LLM/agentic systems need on
   top of ordinary code tests. Keep the phrasing straight: **deterministic behavior is tested with
   assertions; stochastic quality is evaluated against cases, metrics, rubrics, and thresholds.**

Suite *shapes* (pyramid, trophy, honeycomb) and *techniques* are chosen **last** — only after the
risks and boundaries are named. The through-line: **choose the smallest reliable evidence portfolio
that covers the named risks, and name the cost of every layer.**

Knowledge lives in two references you read on demand:
- `references/decision-tree.md` — the interview and the asymmetric escalation gates.
- `references/catalog.md` — definitions, techniques, costs, anti-patterns, and review cues.

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

## Mode A — Greenfield: the risk-led portfolio interview

Read `references/decision-tree.md` and walk it from **Step 1 (scope) → Step 2 (system and failure
surfaces) → Step 3 (QA gates) → Step 4 (level gates) → Step 5 (domain overlays) → Step 6 (shape,
last)**. Ask one decision at a time; skip anything the codebase or the user has already answered.

1. **Name the failure modes before naming any level.** No layer is justified by a diagram. If you
   cannot say what failure a test catches, it is not yet earned.
2. **Escalate bottom-up and asymmetrically.** Start with the fastest, most local evidence that could
   expose the named failure. A broader, slower, or more expensive layer — broad integration, E2E, an
   independent QA gate, mutation testing, an LLM judge — needs *stronger* evidence to add than the
   cheap option needs to keep. Never use a numeric score to hide the judgment.
3. **Record every pick with its trade-off** — including what you deliberately did *not* buy.

Output — a portfolio the user can act on:

```
## Your testing portfolio

**Risks this covers:** <the named failure modes, in the user's terms.>

| Included | Force (the risk it answers) | Cost accepted | Deliberately skipped | Reopen when |
|----------|-----------------------------|---------------|----------------------|-------------|
| <practice, level, or technique> | ... | ... | <the heavier option not bought> | <the signal> |

**Baseline verification:** <typing / linting / static analysis / security scanning — complements,
does not replace, behavioral tests.>

**The smallest-portfolio check:** <one or two sentences confirming nothing here is broader than the
risk requires — or naming a layer to drop.>
```

**When the honest answer is "less", say it plainly.** "You don't need E2E yet", "no independent QA
phase", "no broad integration", "no mutation tool", "no LLM judge" are first-class outcomes — often
the most valuable ones. Give the reason and the single signal that would change the answer, and
don't pad the table to look thorough.

## Mode B — Existing suite: the test-suite review

Inspect before concluding: production code, test code, CI configuration, fixtures, external
dependencies, runtime by level, flaky-test evidence, and coverage or mutation reports if they exist.
**If code or CI evidence is unavailable, say which conclusions are provisional.** Do not fabricate
suite characteristics — a described suite is a hypothesis, not a measurement.

1. **Map the suite as it is.** Count and runtime by level, what each level actually touches
   (resources matter more than folder names), fixture scope, mock density, ownership.
2. **Run the review cues** from `references/catalog.md` — the anti-pattern list is a lens, not a form
   to fill. Translate each cue to what the suite actually is; report a genuine problem even if no cue
   names it.
3. **Pick ONE highest-leverage rebalancing move.** Not a rewrite. Typical shapes: replace ten
   overlapping E2E checks with one journey plus narrow integration; replace mock-heavy service tests
   with a real database boundary test; add a consumer contract where broad E2E is only detecting
   schema drift; quarantine flaky tests *with an owner and expiry* instead of silently retrying;
   require an independent oracle before accepting generated tests; split deterministic agent wiring
   tests from semantic evals.

Output:

```
## Test-suite review

**Observed suite:** unit <n, runtime> · integration <n, runtime> · E2E <n, runtime> ·
evals <n> · CI wall-clock <…> *(measured / reported / unknown)*

**Shape:** <only if a shape name adds information — otherwise skip it.>

### What it covers · what it misses
<failure modes actually exercised, and the named risks with no evidence behind them.>

### Findings
1. **<anti-pattern>** — <where, file ref> · Impact: <runtime / trust / escaped defect> ·
   Fix: <the change> · First step: <smallest safe move>
2. ...

**Flakiness and environmental coupling:** <shared state, real network, sleeps, ordering.>
**Oracle quality:** <do assertions encode a requirement, or the current implementation?>
**Generated-test risk:** <tautologies, happy-path-only, implementation coupling.>

**Highest-leverage move:** <the single change, and what it buys.>
**Then, in order:** <2–4 follow-ups.>
**Sound as-is:** <what is already right — say so.>
```

## The generated-test guardrail (both modes)

**A test is not trusted because it passes or because coverage went up.** Require an independent
oracle from at least one of: a requirement, an acceptance example, an invariant, a specification, a
known-good reference, a reviewed golden case, a metamorphic relation, or an externally observed
contract. Review generated tests for reproducing *current* behavior instead of *intended* behavior
(the documented failure mode of generated oracles), locking in an existing defect, mock-heavy
implementation coupling, tautological assertions, happy-path-only coverage, and assertions that
would still pass after meaningful breakage. The review question:

> **What requirement would this test detect if the implementation changed?**

## Recording the outcome (write the file)

A strategy that lives only in a chat transcript is lost. Persist it.

**Greenfield → an ADR.** After presenting the portfolio, write
`docs/adr/NNNN-test-strategy-<short-title>.md` (lowercase words joined by hyphens, e.g.
`0002-test-strategy-thin-llm-service.md`) — a 4-digit number, one past the highest existing ADR in
`docs/adr/` (else `0001`). Create `docs/adr/` if absent. Follow the repository's existing ADR
template if it has one; otherwise this MADR-style shape:

```
# NNNN. <decision title, e.g. "Risk-led test portfolio for the summarization service">

- Status: Accepted
- Date: <YYYY-MM-DD>
- Deciders: <the user / team, if known>

## Context
<what the system does, the named failure modes and their blast radius, the constraints —
release cadence, reversibility, regulation, team shape, environment ownership.>

## Decision
<QA practices · executable test levels · domain overlays · the portfolio table you just presented>

## Consequences
<the cost of each layer; the heavier options rejected and why; CI and ownership implications
(runtime budget, who owns fixtures/environments/evals); and the reopening signals.>
```

**Existing suite → a review report.** Write it to `docs/test-patterns-review-<YYYY-MM-DD>.md`
(create `docs/` if absent) with the Mode B sections above. If the suite is already well balanced,
say so plainly and keep the report short — a clean bill of health is a valid outcome, not a failure
to find work. If a rebalancing move is a direction the user commits to, offer to capture it as its
own ADR.

Write the file and report its path. Ask first only if the repo layout is unclear or the user is
clearly still exploring rather than deciding.

## The guardrail that outranks the rest

> **Do not add a broader layer merely to make the diagram look balanced. Add it because a named
> failure cannot be detected reliably at a cheaper boundary.**

## Why this shape

The costliest testing mistakes are made before a single test is written: treating QA as a phase,
treating levels as interchangeable folders, buying an E2E suite to feel safe, or replacing ordinary
code tests with evals because the system has an LLM in it. Leading with the three-dimension split
and the risk-first gates keeps the focus where suites actually fail — slow, flaky, untrusted
evidence that nobody can tie to a requirement.
