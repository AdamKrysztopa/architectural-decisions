# Validating the skills

Two layers, deliberately separate.

| Layer | What it proves | How it runs |
|---|---|---|
| **Package contract** (`test/build.test.mjs`) | The package is well-formed: canonical skills reach both targets byte-for-byte, references are complete, manifests agree on identity and version, documentation names every skill. | `npm test` — deterministic, in CI. |
| **Scenario set** (`test/scenarios/*.json`) | The skill *reasons* correctly: the right gates open and stay shut for the right forces. | `npm test` checks the set's integrity; the runs themselves are agent-driven (below). |

Neither replaces the other. A perfectly packaged skill can still recommend an E2E suite nobody
needs, and a well-reasoned skill that ships without its references is useless.

`test/scenarios/baseline-capture.json` is the second scenario set: it grades the decision-capture
step shared by all five skills (`shared/recording-decisions.md`) — when a run must write a decision
file, at what status, and how a rule earns a `deterministic` classification — rather than any one
skill's domain reasoning.

Since sub-project 2, the `no-invented-bindings` criterion is also checkable mechanically: running
`runtime/checkers/check-rules.mjs` against the scenario's stated repository state confirms whether
a `verified_by` binding actually resolves, rather than resting on a reviewer's judgement alone.

`test/scenarios/security.json` is the third set: it grades `threat-model`'s gate outcomes and, more
importantly, its refusals — that a committed secret is attributed to `gitleaks` rather than to the
model's reading, that a control with no binding stays `narrative`, and that a request for a maturity
score is declined rather than answered. Its gate names resolve to `###` headings in
`skills/threat-model/references/decision-tree.md` and `references/agent-agency.md`.

`test/scenarios/drift-drain.json` is the fourth scenario set: it grades the drift-drain classifier
shared by all five skills (`shared/observing-drift.md`) — classifying observed changes against active
rules and deciding when to write a proposed decision — without ever asserting a violation the evidence
does not support.

`test/scenarios/migration.json` is the fifth scenario set: it grades consolidation and reverse
discovery (`shared/migrating-decisions.md`) — listing candidates without adopting them, classifying
confirmed inputs, citing sources honestly, and capping how many decisions one reverse-discovery pass
may propose.

`test/scenarios/router.json` is the sixth scenario set, and the only one that grades a **command**
rather than a skill: `/arch-crew`, the public front door. Each prompt is a sentence a user would
actually type, `/arch-crew` included, and the runner is never told which capability is correct —
that judgement is the thing under test. It grades three outcomes a front door loses most easily:
orientation that stays cheap, a deliberate divergence that enters as possible evolution rather than
as a defect, and a promotion that still has to be asked for.

**Every set carries a `prompt` per scenario, and `npm test` enforces it.** The run procedure below is
built on pasting a real user prompt verbatim into a fresh session, so a set without prompts cannot be
run by its own documented method at all — which is what `baseline-capture.json`, `drift-drain.json`
and `migration.json` were, through the 0.4.0 gate's two runs. All six sets, and all sixty-nine
scenarios in them, are runnable.

One difference in the router set's procedure: paste the prompt **with** its leading `/arch-crew`,
because the command is what is being graded. Every other set is pasted without naming a skill.

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
5. **Log the model tier for both roles** — which tier ran the scenario, and which tier graded it —
   with the run record. This is required, not optional. Neither tier is recoverable from the outputs
   afterwards, and a pass rate that cannot be attributed to a tier cannot be compared against the next
   run's: a set that improves after a skill edit and a set that improves because a larger model ran it
   look identical in the artifacts.
6. Keep the outputs and a candid friction log per case under `test-runs/<iteration>/<scenario-id>/`.
   `test-runs/` is gitignored: eval artifacts are local, findings are what get committed.

A scenario fails when any `failsIf` condition holds, when a gate in `gatesClosed` was recommended
without a force the scenario supplies, or when a gate in `gatesOpen` was refused. It also fails when
the *conclusion* is right but the *reasoning* is shape-first — the skill is a decision procedure, not
an answer key.

### When a scenario and the skill disagree

Fix whichever is wrong, and say which in the commit message. A scenario encodes an intended gate
outcome; if the skill's reasoning turns out to be better than the scenario's expectation, change the
scenario. Do not weaken a gate to make a scenario pass.

## Re-running every set before a release

Before any release, and always before `0.4.0`, re-run every scenario set that exists — not only the
one that changed:

| Set | Scenarios | Owning sub-project |
|---|---|---|
| `test/scenarios/test-patterns.json` | 12 | SP1 |
| `test/scenarios/baseline-capture.json` | 6 | SP1 |
| `test/scenarios/drift-drain.json` | 11 | SP3 |
| `test/scenarios/migration.json` | 10 | SP4 |
| `test/scenarios/security.json` | 12 | SP5 |

Fresh session per scenario, prompt pasted verbatim without naming the skill, record pass/fail with the
reason under `test-runs/<version>/<set>/<scenario-id>/`, **and log the runner and grader tiers for the
release record** — a release-gate result with no tier against it is not comparable to the one before
it or the one after. A body edit to *any* skill (see
`test/fixtures/skill-freeze/body-manifest.json`) requires this full re-run, not only the set that
skill owns — a shared reference change (`shared/recording-decisions.md`, an SP2 checker binding
guidance change) can shift behaviour across every skill that cites it.

## The real-tool E2E lane

By default, `test/e2e/bind-and-prove.test.mjs` (E2E-1) and `test/e2e/security-without-theatre.test.mjs`
(E2E-4) exercise `runtime/checkers/import-linter.mjs` and `runtime/checkers/gitleaks.mjs` against a
**fake** stand-in binary (`test/e2e/support.mjs`'s `withFakeLintImports`/`withFakeGitleaks`). That
proves the shipped pipeline up to the process boundary — spawn, stdout/report-file parsing, status
mapping — but never that the real tool's own current CLI contract (its flags, its exit codes, its
report shape) still matches what the adapter invokes. `test/checker-corpus.test.mjs` and
`test/checkers.test.mjs` exercise every adapter (`import-linter`, `gitleaks`, `semgrep`,
`dependency-cruiser`, and the rest) the same way, always against a fake script — none of them has a
real-tool opt-in of its own. `ARCH_CREW_E2E_REAL_TOOLS` is currently wired into exactly two suites
(E2E-1 and E2E-4, below); a real-tool lane for the other adapters would be a separate addition.

Setting `ARCH_CREW_E2E_REAL_TOOLS=1` switches E2E-1 and E2E-4 to the real binaries instead of the
fakes:

```sh
ARCH_CREW_E2E_REAL_TOOLS=1 node --test test/e2e/bind-and-prove.test.mjs test/e2e/security-without-theatre.test.mjs
```

This requires two third-party binaries on `PATH` that nothing else in this repository needs:

| Binary | Provides | Install |
|---|---|---|
| `lint-imports` | the `import-linter` CLI E2E-1 binds to | `pip install import-linter` |
| `gitleaks` | the secret scanner E2E-4 binds to | see [gitleaks releases](https://github.com/gitleaks/gitleaks/releases) |

Without `ARCH_CREW_E2E_REAL_TOOLS=1`, `npm test` (and CI) never notice a real tool's contract drifting
out from under the shipped adapter — this is the one regression class the deterministic suite cannot
catch on its own. Run this lane locally, with both binaries installed, as a periodic check — not on
every commit, since the binaries are not part of this project's zero-dependency footprint — and
always as part of pre-release verification (see `docs/release-checklist-0.4.0.md`'s §6/§8 rows and
the "Documented limitations" list, which name this as a manual, non-CI step).

## Host validation before release

The Node suites enforce the repository contract; they do not replace each host's parser and
installer. See [`building-packages.md`](building-packages.md) for the pre-release smoke test in a
disposable CLI environment.
