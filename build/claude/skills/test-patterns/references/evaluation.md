# Dimension 3 — stochastic evaluation (data · ML · LLM and agents)

Load this file **only** when the system has a data-quality, model-quality, or LLM/agent-quality
surface. Everything here is **additive**: it sits on top of dimension 2 (deterministic executable
testing), never in place of it.

The line that governs the whole file:

> **Deterministic behavior is tested with assertions. Stochastic quality is evaluated against cases,
> metrics, rubrics, and thresholds.** An evaluation is a measurement with uncertainty, not a
> pass/fail assertion — and a passing eval says nothing about whether the code around it is wired
> correctly.

Two failure modes to refuse in both directions:

- **Evals substituting for tests.** "It's an LLM app, so we need evals" — most early failures are
  ordinary bugs that ordinary assertions catch faster and cheaper.
- **Tests substituting for evals.** A green deterministic suite is not evidence of semantic quality,
  ranking quality, retrieval relevance, or calibration. Those need measurement.

Every entry keeps the same gate shape as the rest of the skill: **Add when · Keep light when ·
Reopen when · Cost**, plus **Review cues** and **Common confusion** where they earn their place.

---

## Which half is which

Before selecting any evidence, split the system explicitly. Write the split down — it is the single
most useful artifact in a data/ML/LLM portfolio, and it is what stops a team debugging a judge when
the real defect was a tool schema.

| Deterministic — **test** it (dimension 2) | Stochastic — **evaluate** it (this file) |
|---|---|
| Schemas, validation, serialization | Ranking quality, ordering usefulness |
| Transformations, joins, aggregations, windows | Model discrimination (AUC, precision/recall trade-off) |
| Feature calculations | Calibration — do scores mean what they claim? |
| Routing, dispatch, control flow | Retrieval relevance and recall of the right context |
| Tool schemas, tool permissions, argument construction | Semantic answer quality, helpfulness |
| Retries, timeouts, backoff, fallbacks | Hallucination / unsupported-claim rate |
| Persistence, idempotency, replay | Policy and instruction adherence |
| Prompt construction and templating | Task completion over multi-step scenarios |
| Output parsing and guardrails | Robustness across representative and adversarial cases |
| Deterministic fallback logic | Slice behavior across populations you are accountable to |

A property that migrates from right to left — a schema appears, a citation becomes required, an
exact field becomes checkable — should be **re-tested deterministically and dropped from the eval
set**. Deterministic evidence is faster, free, and stable; reach for it first, every time.

---

## I. Data pipelines

Keep four concerns separate — they fail differently and are owned differently.

### 1. Transformation-code tests *(dimension 2, listed here for the split)*
**Add when:** any non-trivial mapping, join, aggregation, or window exists — small deterministic
fixtures, run at unit level.
**Keep light when:** the "transformation" is a pass-through.
**Reopen when:** a mapping or aggregation defect is found by a downstream consumer.
**Cost:** fixture curation; realistic-enough sample data.
**Review cues:** pipelines whose only tests run against production data; no test for late, duplicate,
or null-heavy input.
**Common confusion:** this is a *unit test of code* — entirely separate from asserting on real data.

### 2. Data-quality assertions
**Question answered:** Is the *data* (not the code) fit for its consumers right now?
**Add when:** a specific assertion is tied to a real downstream consequence — a wrong report, a wrong
decision, a failed load — and a named person will act when it fires. Candidates: schema, nullability,
uniqueness, referential integrity, ranges, freshness, volume, distribution shift.
**Keep light when:** the consumer is exploratory, the table is not yet load-bearing, or the assertion
would trip on normal variation. An unowned, noisy assertion is worse than none.
**Reopen when:** bad data reaches a consumer, a source changes shape, or a new consumer takes a hard
dependency on the table.
**Cost:** runtime per run, alert fatigue if thresholds are guessed, ownership of every alert.
**Review cues:** hundreds of generated expectations nobody triages; alerts routed nowhere.
**Common confusion:** two different placements get conflated, and they have opposite gating rules.
*Build-time assertions over a candidate artifact you are about to publish* — a freshly built table, a
transformed batch, a candidate model's outputs — run on the **build's** cadence and may legitimately
fail the build or block the deploy; that is exactly what `dbt build` does, running each model's tests
immediately after building it and skipping its dependents on failure. *Assertions over source or
production data* run on the **data's** cadence, so they should page a named operational owner rather
than redden an unrelated build — blocking a deploy on them punishes whoever happens to be shipping.

**Do not infer the cause from the placement.** A production-data failure does not mean "the data
changed" — a transformation deployed an hour ago can corrupt production output just as easily as an
upstream source can shift. Route by **execution context** (which cadence fired it), **provenance**
(does the failing column come from a source or from code you own), **severity** (who is already
consuming the bad rows), and **ownership** (who can actually fix it) — then diagnose. Assigning blame
to the data before looking is how a fresh regression gets triaged as an upstream problem and lives in
production for a week.

### 3. Data contracts
**Add when:** ownership of the producing side sits with a different team or system, **and** either
upstream changes have broken you before **or** the dependency is new and the producer has no way to
discover who consumes their schema.
**Keep light when:** producer and consumer are the same team inside one deployable — a schema
assertion at the load step is cheaper and equally truthful. **A continuously running pipeline does
not by itself earn a contract**; it earns monitoring (below).
**Reopen when:** an upstream schema or semantic change breaks a consumer, or a second team starts
producing into or consuming from the same table.
**Cost:** schema versioning, negotiation, enforcement in both pipelines.
**Review cues:** consumers defensively coding around upstream surprises; schema changes announced in
chat.
**Common confusion:** a data contract is an agreement plus enforcement, not just a JSON schema file.
It is the data-plane sibling of a service contract test (`catalog.md` §II) and answers the same
question: *can the producer and the consumer evolve independently without breaking each other?*

### 4. Production monitoring of the pipeline
**Add when:** the pipeline runs continuously or on a schedule, where yesterday's good data says
nothing about today's: freshness, volume, run success and duration, null and distribution shift —
each routed to a named person who will act on it.
**Keep light when:** the pipeline is a one-off, a backfill, or an ad-hoc run whose output a human
inspects directly before anything downstream uses it.
**Reopen when:** a missing, late, or bad load is discovered by a consumer rather than by a signal, or
the output starts feeding an automated decision.
**Cost:** instrumentation, dashboards, alert ownership. An unowned dashboard is decoration.

### The failure surfaces that actually break pipelines
Rarely the transform itself: **idempotency / re-runnability** (does the second run change the
result?), **backfill and replay** over historical windows, **late-arriving and duplicate records**,
and **partition or orchestration failure** (a partial run, a retried task, a skipped upstream
dependency). Each is reproducible deterministically on small fixtures — reach for that before
reaching for a bigger run.

**A full pipeline run on sample data** is the pipeline analogue of E2E and carries the same costs —
**usually not warranted**. Add one only when orchestration wiring, partitioning, or cross-step
contracts are themselves the named risk and no narrower test reproduces the failure.

Tools (dbt tests, Great Expectations, and equivalents) are *examples*, not mandatory architecture.

---

## II. ML models

Keep the ordinary code and pipeline tests, then add model-specific evidence in **five independently
gated clusters**. "The model ships" does not buy all five: they fail differently, cost differently,
and are earned separately. Google's ML Test Score is a rubric to *cite and adapt*, not a checklist to
copy wholesale — applied mechanically it becomes box-ticking, which is the failure mode this split
exists to prevent. For a fixed-data, one-shot, or human-reviewed system, most of them are correctly
answered "not yet".

### 1. Data validation, leakage, and split checks
**Add when:** the model is retrained on data that keeps arriving, or the split has structure — time,
group, entity, geography — that a random split would silently violate.
**Keep light when:** a one-shot model on a fixed, understood dataset with an obviously independent
split. One documented assertion about *why* the split is valid is then enough.
**Reopen when:** offline metrics outrun online results, retraining becomes automated, a new feature
source appears, or someone proposes a random split over grouped or temporal data.
**Cost:** validation code to maintain against a moving schema; leakage checks need someone who
understands how the data was generated, which is often not the person training the model.
**Review cues:** a random split over time-series or per-entity data; features computed over the full
dataset before splitting; target-derived or post-outcome fields in the feature set; a test set reused
so often it has effectively become a training set.
**Common confusion:** leakage is a *split and feature-provenance* defect, not a metric defect — it
shows up as unusually good offline numbers, which is exactly why it survives review.

### 2. Slice performance and behavioral cases
**Add when:** an aggregate metric hides a population you are accountable to (a paying segment,
fairness, safety), or specific cases have been named as must-not-regress. Add invariance and
metamorphic checks *here*, and only when a property genuinely should hold under a transformation you
can name.
**Keep light when:** nobody has named a slice that matters and nobody has named a case that must not
break — aggregate metrics plus a handful of spot-checked examples are then the honest portfolio.
**"You do not need metamorphic checks yet" is a correct, common answer.**
**Reopen when:** a stakeholder names a segment, a complaint traces to one subpopulation, or a release
regresses a case someone cared about.
**Cost:** curated cases to maintain as the model and data evolve.
**Review cues:** one aggregate accuracy number with no slices; no test for the failure the business
actually fears.
**Common confusion:** a test-set metric is not behavioral evidence; it hides subgroup failures.

### 3. Reproducibility and training/serving consistency
**Add when:** someone other than the author will retrain it, a result must be reconstructible later
(audit, incident, publication), **or** features are computed by different code in training and
serving.
**Keep light when:** exploratory work by one person, or one code path computes features for both
training and serving — the consistency risk does not exist yet. Record the seed and the data version
and move on.
**Reopen when:** a result cannot be reproduced, serving metrics diverge from training metrics, a
second person takes over retraining, or a serving path is rewritten in another language.
**Cost:** seed/version/snapshot discipline; a feature-computation path shared or verified across two
runtimes; storage for data snapshots.
**Review cues:** no way to reproduce last month's model; unpinned dependency or data versions; feature
engineering duplicated in a training notebook and a serving service.
**Common confusion:** training/serving skew is not a modeling problem — it is two implementations of
the same transformation drifting, and it is caught by an equivalence test, not by a metric.

### 4. Release evidence — baseline comparison and rollback *(two gates, earned separately)*
*Comparison* and *rollback* answer different questions and fire on different triggers. Do not bundle
them, and do not exempt the first model from either.

**Add baseline comparison when:** you are about to ship *any* consequential model — the first one
included. There is always something to compare against; "no incumbent" is not "no baseline".
- **First consequential model** → compare against a **trivial, rules-based, or non-ML alternative**:
  majority class, the existing heuristic, the manual process it replaces. Evaluate both on the same
  held-out data. If the model does not beat it, that is the finding.
- **Later model** → compare against the **incumbent** on the same held-out data and refuse a silent
  regression.

**Add a rollback / disable path when:** deployment consequence warrants it — the output reaches
users, moves money, or drives an automated decision. Gate this on **consequence, not on model
count**: a first model in a consequential path owes a versioned artifact and a rehearsed way back
(previous model, or the pre-model behavior) just as much as a fifth one does.

**Keep light when:** the model is exploratory or offline and nobody acts on its output (skip the
comparison ceremony, not the sanity check), or its output is advisory and human-reviewed before it
acts (record the artifact version; skip the rehearsed rollback). **"It's our first model" is never
the reason** — an unbeaten trivial baseline is exactly the thing a first release should surface.
**Reopen when:** a regression ships unnoticed; a bad model cannot be withdrawn quickly; someone
discovers the trivial baseline matches the model; the output starts driving an automated decision.
**Cost:** low — a held-out set, a comparison step, and a versioned artifact to roll back to. This is
the cheapest real release gate in ML.
**Review cues:** a first model promoted with no baseline of any kind; a new model promoted on its own
metric with no incumbent comparison; no record of which model version served which predictions;
"rollback" that means retraining.
**Common confusion:** an improved aggregate metric is not a promotion criterion on its own — pair it
with slice and behavioral evidence, or you ship an average win over a segment loss.

### 5. Drift and quality-degradation monitoring
**Add when:** the model runs continuously against live data whose distribution can move, **and** a
degraded prediction has consequences before a human would notice unaided.
**Keep light when:** a batch or one-off scoring job whose output a human already reviews, or labels
arrive fast enough that ordinary outcome reporting already exposes decay.
**Reopen when:** the model enters a continuous or automated decision path, upstream data ownership
changes, or performance visibly decays between retrains.
**Cost:** instrumentation, a reference distribution to compare against, threshold tuning, and an owner
for every alert — an unowned drift dashboard is decoration.
**Review cues:** drift alerts nobody triages; no signal that would reveal decay before a user
complains; monitoring on inputs only, with nothing watching outcome quality.
**Common confusion:** input drift is a *hypothesis* about degradation, not degradation itself — the
model may be fine. Where labels arrive, measure outcomes; use drift as the early proxy, not the
verdict.

---

## III. LLM and agentic systems

Split the system in two and use the right instrument on each half.

### Deterministic scaffold — test with ordinary assertions *(dimension 2)*
**Add when:** always, for LLM and agentic systems. Request/response validation, tool schemas, tool
dispatch, permissions, state transitions, retry and timeout logic, persistence, routing, prompt
construction, output parsing, guardrails, deterministic fallbacks.
**Keep light when:** never — this is the cheapest, highest-yield evidence in an LLM system.
**Reopen when:** a new tool, permission, or state transition enters the agent loop.
**Cost:** a seam to inject the model; test doubles for the provider.
**Review cues:** unit tests that hit a provider (slow, nondeterministic, billed); no test for tool
dispatch or permission checks; every failure investigated as "the model was bad" when it was wiring.
**Common confusion:** "it's an LLM app so we need evals" — most early failures are ordinary bugs that
ordinary assertions catch.

**Suppress real model calls in unit tests.** A unit test that hits a provider is neither fast nor
deterministic nor free. (In PydanticAI projects, `TestModel`, `FunctionModel`, `Agent.override`, and
the module-level `pydantic_ai.models.ALLOW_MODEL_REQUESTS = False` are the idiomatic tools; other
stacks have equivalents.)

### Retrieval evaluation *(RAG)*
**Add when:** answer quality depends on which context was retrieved — then measure retrieval
separately from generation, because they fail separately and the fixes are unrelated. Recall of the
known-relevant document, rank of the first relevant hit, and the rate of answers generated with no
supporting context are the usual signals.
**Keep light when:** the corpus is tiny, fixed, and hand-curated, or retrieval is an exact lookup by
key — that is a deterministic test, not an evaluation.
**Reopen when:** the corpus grows or changes ownership, the chunking or embedding model changes, or
answer failures keep turning out to be "the right passage was never retrieved".
**Cost:** a labelled query→relevant-document set that must be re-reviewed as the corpus moves.
**Review cues:** end-to-end answer scores with no retrieval metric underneath, so nobody can say
whether a bad answer was a retrieval miss or a generation failure.
**Common confusion:** a good answer over a bad retrieval is luck, and it will not survive a corpus
change.

### Golden evaluation datasets
**Add when:** output quality is genuinely semantic. Cases should be representative (including the
failure modes you fear), human-reviewed, versioned, and small enough to keep reviewing.
**Size the dataset to the risk** — a three-case smoke set and a versioned dataset with CI regression
thresholds are entirely different purchases:
- **Add a versioned dataset with CI regression thresholds when:** the output is user-facing or
  decision-bearing, the prompt / model / tool surface changes more than occasionally, and a quality
  regression would otherwise ship unnoticed. Version it with the code and record who labelled it.
- **Keep light when:** the system is a prototype, internal, or human-reviewed in the loop — three to
  ten hand-written cases run by hand before shipping is a legitimate and complete answer at that
  stage. Do not manufacture a hundred synthetic cases to look rigorous; unreviewed cases encode
  whatever the generator believed, which is the generated-oracle problem in another costume
  (`oracles.md`).
**Reopen when:** someone who did not write the prompt starts changing it, a quality regression reaches
users, the system moves into an automated decision path, or the question becomes "is version B better
than version A?" rather than "is this good enough?".
**Cost:** curation and re-review as the product changes; model spend per run; metric noise.
**Review cues:** an eval set assembled from whatever was handy; no failure cases in it; results
reported as a single number with no variance or case count.
**Common confusion:** an eval is a measurement with uncertainty, not a pass/fail assertion. Report the
case count; a score from a handful of cases is noise. Temperature zero reduces variation; it does
**not** make model output deterministic, so do not build a suite that assumes it does.

### Deterministic evaluators
**Add when:** the property is checkable — schema validity, required fields, exact or keyword match,
citation presence, numeric tolerance, tool called with the right arguments, latency, cost. Exhaust
these before reaching for a judge.
**Keep light when:** the property is irreducibly semantic.
**Reopen when:** a semantic property becomes checkable — a schema, a citation, an exact field.
**Cost:** near-zero; they are fast, free, and stable.
**Review cues:** a model-based judge scoring things a regex or schema check would decide exactly.
**Common confusion:** teams reach for a judge before exhausting deterministic checks, then debug the
judge instead of the product.

### Calibrated model-based judges (LLM-as-judge)
**Treat a judge as a measuring instrument, not an oracle.** Buying one commits you to four things —
if you cannot supply all four, do not buy it:

1. **A named claim** it measures ("is the answer supported by the retrieved passages?"), not a vague
   "quality" score.
2. **A reason simpler deterministic evidence is insufficient** for that claim.
3. **Calibration against human-labelled examples**, with the agreement rate recorded.
4. **Monitoring for judge drift and bias** — position, verbosity, and self-preference bias are
   documented failure modes, and a judge-model upgrade silently re-baselines every score.

**Add when:** all four hold and you accept the cost, variance, and bias.
**Keep light when:** for schema validity, exact facts, tool-call correctness, permissions, or anything
deterministic — assert those instead. Skip the judge until deterministic rubric checks demonstrably
fall short.
**Reopen when:** the judge model changes, its scores drift from human review, or the human-labelled
calibration set goes stale.
**Cost:** model spend per eval run, score variance, position/verbosity/self-preference bias, drift when
the judge model changes, and a rubric to maintain.
**Review cues:** judge scores with no human-calibration set; the judge and the system under test
sharing a model and prompt style; thresholds set to whatever the first run produced.
**Common confusion:** an LLM judge is **not objective** — it is a noisy instrument that must itself be
validated.

### Agent scenario and task-completion evaluation
**Add when:** the system takes multiple steps and the risk is whether it *finishes the task*, not
whether any single response is good — tool-selection quality, recovery after a failed step, step
budget adherence, policy adherence over a trajectory.
**Keep light when:** the agent is a single call with a tool or two; deterministic dispatch and
permission tests plus a small golden set already cover it.
**Reopen when:** the tool surface grows, the agent gains autonomy over irreversible actions, or
failures start being "it did the wrong thing in step four" rather than "the answer was weak".
**Cost:** scenario fixtures with deterministic tool stubs; long runs; trajectory review time.
**Review cues:** scenario evals whose tools hit real systems; no deterministic test for the tool
permissions the scenario assumes.
**Common confusion:** a trajectory eval is not a substitute for testing the dispatch and permission
code — it is slower, noisier, and diagnoses nothing.

### Production monitoring as evidence
**Add when:** the system is **deployed or scheduled** and its degradation could precede human
detection — a continuously serving model, a scheduled pipeline, an agent answering users. Pick from
drift, freshness, error rates, refusal/fallback rates, latency, cost, user-visible failure signals,
and sampled human review — only the signals someone is named to act on.
**Keep light when:** the run is a one-off, a backfill, or an ad-hoc job, or a human already reviews the
output before anything downstream consumes it. There is nothing running to monitor, and the review
*is* the detection.
**Reopen when:** the system moves from one-off to scheduled or continuous, its output starts feeding an
automated decision, human review of every output stops, or a production failure mode appears that no
existing signal covers.
**Cost:** instrumentation, dashboards, alert ownership. An unowned dashboard is decoration, and a
monitor on a system nobody runs twice is pure cost.
**Review cues:** a deployed system with offline evals only, where nobody would notice a quality
regression until a user complains; conversely, a monitoring stack built around a one-shot job.
**Common confusion:** monitoring does not replace pre-release evidence, and pre-release evidence does
not replace monitoring — stochastic systems need both.

---

## IV. Evaluation-specific review cues

Add these to the anti-pattern lens in `catalog.md` §VI when the system has a stochastic surface.

- **Exact-string assertions on stochastic model output** — permanently flaky, or pinned so hard the
  test breaks on every prompt change. → Assert the deterministic properties; evaluate the semantic
  ones against cases.
- **Evals with no representative dataset** — scores computed over a handful of convenient cases.
  → Curate representative cases including known failure modes; report case count and variance.
- **Judge scores with no human calibration** — an unvalidated instrument used as ground truth.
  → Calibrate against human-reviewed cases before trusting a threshold, or use a deterministic check.
- **An eval suite with no deterministic tests underneath it** — wiring bugs found only by evals, at
  the slowest and noisiest layer available. → Test the scaffold.
- **End-to-end answer scores with no retrieval metric** — nobody can tell a retrieval miss from a
  generation failure. → Measure retrieval separately.
- **Synthetic eval cases nobody reviewed** — the generated-oracle defect wearing an eval costume.
  → `oracles.md`.
