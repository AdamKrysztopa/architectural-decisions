# Validating the skills

Two layers, deliberately separate.

| Layer | What it proves | How it runs |
|---|---|---|
| **Package contract** (`test/build.test.mjs`) | The package is well-formed: canonical skills reach both targets byte-for-byte, references are complete, manifests agree on identity and version, documentation names every skill. | `npm test` — deterministic, in CI. |
| **Scenario set** (`test/scenarios/*.json`) | The skill *reasons* correctly: the right gates open and stay shut for the right forces. | `npm test` checks the set's integrity; the runs themselves are agent-driven (below). |

Neither replaces the other. A perfectly packaged skill can still recommend an E2E suite nobody
needs, and a well-reasoned skill that ships without its references is useless.

`test/scenarios/baseline-capture.json` is the second scenario set: it grades the decision-capture
step shared by all four skills (`shared/recording-decisions.md`) — when a run must write a decision
file, at what status, and how a rule earns a `deterministic` classification — rather than any one
skill's domain reasoning.

Since sub-project 2, the `no-invented-bindings` criterion is also checkable mechanically: running
`runtime/checkers/check-rules.mjs` against the scenario's stated repository state confirms whether
a `verified_by` binding actually resolves, rather than resting on a reviewer's judgement alone.

`test/scenarios/drift-drain.json` is the third scenario set: it grades the drift-drain classifier
shared by all four skills (`shared/observing-drift.md`) — classifying observed changes against active
rules and deciding when to write a proposed decision — without ever asserting a violation the evidence
does not support.

## The scenario set

`test/scenarios/test-patterns.json` is the force-driven gating set for `test-patterns`. It follows
the same discipline the skills themselves use — **forces in, gate outcomes out, no numeric scoring.**

Each scenario declares:

- `prompt` — what the user says, in their own words.
- `forces` — the facts in the system that should drive the gates.
- `gatesOpen` / `gatesClosed` — the gates that must fire, and the gates that must **not**. Every name
  resolves to a `###` heading in `references/decision-tree.md` or `references/evaluation.md`, so
  renaming or deleting a gate fails `npm test`.
- `expect` — what a correct run produces, and why.
- `failsIf` — the specific wrong answers this scenario exists to catch.
- `expectNoChange` / `oracleGate` — flags for the two outcomes that are not gate picks: "the suite is
  proportionate, change nothing", and "these generated tests have no independent oracle".

The top-level `criteria` array holds the properties **every** run is graded on regardless of
scenario — risk-first framing, no shape-first prescriptions, no fixed ratios, cost and ownership
named, deliberate omissions stated, reopening signals defined, deterministic tests kept distinct from
stochastic evaluations, oracle independence assessed, exactly one primary move in review mode, and a
"no change" conclusion left available.

### What the automated suite checks

`npm test` does **not** invoke a model. It enforces the set's integrity:

- every required scenario and criterion is present exactly once;
- every scenario names a prompt, its forces, the expected output, and its failure conditions;
- no scenario opens and closes the same gate;
- **every referenced gate resolves to a real heading in the canonical references** — this is the
  check that catches reference drift;
- both modes are covered, and so are the outcomes that are easy to lose: a justified E2E scenario
  *and* a refused one, a justified contract scenario *and* a refused one, a no-change review, an
  oracle-rejection review, and a case where independent assurance overrides developer-owned evidence.

### Running the scenarios against the skill

The runs are agent-driven, as in the earlier 20-case evaluation:

1. Install the built package for the target host (see [`building-packages.md`](building-packages.md)).
2. For each scenario, start a fresh session and paste the `prompt` verbatim. Do not name the skill —
   triggering from the prompt alone is part of what is being validated.
3. Where the scenario implies a repository, point the session at a small representative project
   (real or synthetic). Reviews must run **read-only** against code you do not mind reading twice.
4. Grade the output against that scenario's `expect`, `failsIf`, and the shared `criteria`. Record a
   pass/fail with the reason, not a score.
5. Keep the outputs and a candid friction log per case under `test-runs/<iteration>/<scenario-id>/`.
   `test-runs/` is gitignored: eval artifacts are local, findings are what get committed.

A scenario fails when any `failsIf` condition holds, when a gate in `gatesClosed` was recommended
without a force the scenario supplies, or when a gate in `gatesOpen` was refused. It also fails when
the *conclusion* is right but the *reasoning* is shape-first — the skill is a decision procedure, not
an answer key.

### When a scenario and the skill disagree

Fix whichever is wrong, and say which in the commit message. A scenario encodes an intended gate
outcome; if the skill's reasoning turns out to be better than the scenario's expectation, change the
scenario. Do not weaken a gate to make a scenario pass.

## Host validation before release

The Node suites enforce the repository contract; they do not replace each host's parser and
installer. See [`building-packages.md`](building-packages.md) for the pre-release smoke test in a
disposable CLI environment.
