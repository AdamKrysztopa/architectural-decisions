# Example — `arch-crew:test-patterns`, greenfield: when the right test suite is small

The valuable move here is *declining* layers, not stacking them. An LLM in the call path makes teams
reach for ceremony — a full pyramid, a QA gate, a browser suite, an LLM judge — none of which this
system's risks justify.

**Prompt:** "Small FastAPI service. It validates a request, makes one LLM call, and returns a
structured response. No tools, no memory, no browser, no cross-service transaction. Internal, easy
to roll back. What should I test?"

**What the skill did:** Step 2 classified this as an LLM call over thin glue — failure surfaces
*request validation*, *response mapping/schema*, and *semantic answer quality*, three risks needing
three instruments. Step 4's gates fired for unit and one narrow integration test and **did not fire**
for broad integration or E2E: no named journey depends on full-system wiring, and rollback is cheap.
Step 5's overlay split the system in two — deterministic scaffold (assert) versus stochastic output
(evaluate) — and the judge gate stayed shut on *volume*, not on coverage: deterministic evaluators
decide most properties outright, the genuinely-semantic residue still fits inside human review at
this dataset size, and calibrating a judge against those same human labels would cost more than
reading them. Output:

---

## Your testing portfolio

**Risks this covers:** malformed input reaching the model; output that fails to map to the response
schema; answers that are valid but unhelpful; a prompt or model change silently degrading quality.

| Included | Force (the risk it answers) | Cost accepted | Deliberately skipped | Reopen when |
|----------|-----------------------------|---------------|----------------------|-------------|
| Whole-team quality ownership | Small team, low blast radius, reversible releases | Devs own test design | A separate QA phase / independent assurance | Regulation, contractual acceptance, or irreversible actions appear |
| Acceptance examples (3–5, written down) | "Helpful answer" is otherwise undefined; they seed the eval set | One short conversation | Formal UAT and sign-off | An external customer or regulator must accept the output |
| Static checks: typing, linting, security scan | Cheap rejection of whole defect classes | Config upkeep | Nothing — baseline | — |
| Unit tests: request validation + response mapping | Branching and error paths live here; mapping is where structured output breaks | Milliseconds | Unit tests for framework wiring | Domain logic grows beyond mapping |
| Model calls disabled in unit tests (deterministic test model) | Provider calls make unit tests slow, nondeterministic, and billed | One injection seam | Recording/replaying real calls | Provider-specific behavior (streaming, tool schemas) becomes a risk |
| **One** narrow integration test at the HTTP/schema seam | Serialization, status codes, and validation wiring fail despite correct local logic | Seconds; an in-process client | Broad multi-component integration | A database, queue, or second service enters the path |
| Eval set of ~30 reviewed cases **built around the feared failures** — malformed output, valid-but-unhelpful answers, refusals — plus deterministic evaluators | Semantic quality is the product; prompt and model changes regress it silently | Curation + re-review; model spend per run | An LLM-as-judge | Deterministic checks stop separating good answers from bad, or volume outgrows human review |
| Production logging: input size, latency, tokens, error and refusal rates | Offline evidence says nothing about real inputs | Instrumentation + an alert owner | A full monitoring stack | Traffic or stakes grow |

**Baseline verification:** typing, linting, and dependency/security scanning on every commit — they
complement the behavioral tests, they don't replace them.

**The evaluators, concretely:** schema validity, required fields, length bounds, refusal detection,
and keyword/numeric checks where a correct answer is checkable — all exact, free, and stable. The
genuinely-semantic residue is read by a human at each prompt change.

**What ~30 cases can and cannot prove:** the set is curated to contain the failure modes above,
not sampled, so it is a **regression tripwire, not a measurement** — at n≈30 a 90% pass rate
carries roughly a ±11-point 95% interval, and small shifts are invisible to it. The threshold
matches: **no case that passed at the last review may fail, and any pass rate below 90% blocks the
prompt or model change** until a person reads the failures.

**The smallest-portfolio check:** nothing here is broader than the risk requires. The heaviest item
is an eval set one person can read in a sitting.

---

## What was deliberately *not* built, and why

- **No full pyramid ceremony.** The logic is validation plus mapping; padding unit counts to look
  pyramidal adds maintenance, not evidence.
- **No independent QA phase.** Nothing here requires independence, and rollback is a redeploy.
- **No E2E browser suite.** No journey's failure depends on full-system wiring: no UI, no auth flow,
  no cross-service orchestration. "You probably do not need E2E yet" is the honest answer, not a gap.
- **No mutation testing.** The suite is small and the code thin — assertion strength is legible by
  reading it.
- **No LLM-as-judge.** It would add model spend, score variance, and bias, and would itself need
  calibrating against human-reviewed cases before anyone could trust a threshold.
- **No exact-string assertions on model output.** Temperature zero reduces variation but does not
  make output deterministic, so a suite that assumed otherwise would be flaky by construction.

Escalation signals beyond the table's *Reopen when* column: multi-step tool use → dispatch,
permission, and step-budget tests plus scenario evals; persistent state → a persistence-boundary
test; critical authorization → E2E of authn/authz + routing + config, which no lower level proves.

The rule behind every line: **add a broader layer because a named failure cannot be detected
reliably at a cheaper boundary — not to make the diagram look balanced.**
