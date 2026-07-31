# Example — `arch-crew:test-patterns`, greenfield: when the right test suite is small

The valuable move here is *declining* layers, not stacking them. An LLM in the call path makes teams
reach for ceremony — a full pyramid, a QA gate, a browser suite, an LLM judge — none of which this
system's risks justify.

**Prompt:** "Small FastAPI service. It validates a request, makes one LLM call, and returns a
structured response. No tools, no memory, no browser, no cross-service transaction. Internal, easy
to roll back. What should I test?"

**What the skill did:** Step 2 classified this as an LLM call over thin glue, so the failure surfaces
are *request validation*, *response mapping/schema*, and *semantic answer quality* — three different
kinds of risk needing three different instruments. Step 4's gates fired for unit and one narrow
integration test and **did not fire** for broad integration or E2E: no named journey depends on
full-system wiring, and rollback is cheap. Step 5's LLM overlay split the system in two —
deterministic scaffold (assert) versus stochastic output (evaluate) — and the judge gate stayed shut
because deterministic rubric checks still cover the semantic properties that matter. Output:

---

## Your testing portfolio

**Risks this covers:** malformed input reaching the model; the model's output failing to map to the
response schema; the answer being valid-but-unhelpful; a prompt or model change silently degrading
answer quality.

| Included | Force (the risk it answers) | Cost accepted | Deliberately skipped | Reopen when |
|----------|-----------------------------|---------------|----------------------|-------------|
| Whole-team quality ownership | Small team, low blast radius, reversible releases | Devs own test design | A separate QA phase / independent assurance | Regulation, contractual acceptance, or irreversible actions appear |
| Acceptance examples (3–5, written down) | "Helpful answer" is otherwise undefined; they seed the eval set | One short conversation | Formal UAT and release sign-off | An external customer or regulator must accept the output |
| Static checks: type checking, linting, security scan | Cheap rejection of whole defect classes; Pydantic models already encode shape | Config upkeep | Nothing — baseline | — |
| Unit tests: request validation + response mapping | Branching and error paths live here; the mapping is where structured output actually breaks | Milliseconds | Unit tests for framework wiring | Domain logic grows beyond mapping |
| Model calls disabled in unit tests (deterministic test model) | Provider calls make unit tests slow, nondeterministic, and billed | One injection seam | Recording/replaying real calls | Provider-specific behavior (streaming, tool schemas) becomes a risk |
| **One** narrow integration test at the HTTP/schema seam | Serialization, status codes, and validation wiring fail despite correct local logic | Seconds; an in-process client | Broad multi-component integration | A database, queue, or second service enters the path |
| Small reviewed eval dataset (~20–30 cases) + deterministic evaluators | Semantic quality is the product; prompt/model changes regress it silently | Curation + re-review; model spend per run | An LLM-as-judge | Deterministic rubric checks stop distinguishing good from bad answers, or volume outgrows human review |
| Production logging: input size, latency, tokens, error and refusal rates | Offline evidence says nothing about real inputs | Instrumentation + an alert owner | A full monitoring stack | Traffic or stakes grow |

**Baseline verification:** type checking, linting, and dependency/security scanning run on every
commit. They complement the behavioral tests — they don't replace them.

**The evaluators, concretely:** schema validity, required fields present, length bounds, refusal
detection, and keyword/numeric checks on the cases where a correct answer is checkable. All exact,
all free, all stable. The remaining genuinely-semantic cases are reviewed by a human at each prompt
change — at this dataset size that is cheaper and more trustworthy than a judge.

**The smallest-portfolio check:** nothing here is broader than the risk requires. The heaviest item
is a ~30-case eval set that a person can read in one sitting.

---

## What was deliberately *not* built, and why

- **No full pyramid ceremony.** The application logic is validation plus mapping. Padding out unit
  counts to look pyramidal would add maintenance, not evidence.
- **No independent QA phase.** Nothing here requires independence: no regulation, no contractual
  acceptance, no irreversible action, and rollback is a redeploy.
- **No E2E browser suite.** There is no journey whose failure depends on full-system wiring — no UI,
  no auth flow, no cross-service orchestration. "You probably do not need E2E yet" is the honest
  answer, not a gap.
- **No broad integration tests.** One boundary (HTTP + schema) carries the risk; testing it alone is
  cheaper and localizes failures better.
- **No mutation testing.** The suite is small and the code is thin — assertion strength is legible by
  reading it.
- **No LLM-as-judge.** Deterministic checks decide most of what matters, and a human reviews the
  rest. A judge would add model spend, score variance, and bias — and would itself need calibrating
  against human-reviewed cases before anyone could trust a threshold.
- **No exact-string assertions on model output.** Deterministic properties are asserted; semantic
  quality is evaluated against cases. Temperature zero would reduce variation but would not make the
  output deterministic, so a suite that assumed otherwise would be flaky by construction.

## The signals that would justify escalating

- **Multi-step tool use** → tool dispatch, permission, and step-budget tests; scenario evals.
- **Memory or persistent state** → a real persistence-boundary integration test, plus tests for
  state transitions across turns.
- **Critical authorization** in the path → E2E coverage of the authn/authz + routing + configuration
  combination, which no lower level can prove together.
- **Several independently deployed services** → consumer/provider contracts before any E2E growth.
- **Irreversible actions** (payments, external writes) → acceptance evidence, release gating, and
  arguably independent assurance.
- **Eval volume beyond human review** → *then* consider a calibrated model-based judge — calibrated
  against the human-reviewed cases you already have, which is exactly why they were kept.

The rule that produced every line above: **do not add a broader layer to make the diagram look
balanced — add it because a named failure cannot be detected reliably at a cheaper boundary.**
