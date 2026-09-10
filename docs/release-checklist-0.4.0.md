# Pre-release checklist — 0.4.0

Ten sections, closed. Each states the item as it now reads, what satisfies it, and the exact test
or doc path that is the evidence — not a restatement of intent. Where an item's evidence is not yet
produced on this branch (a later task in this same plan owns it), that is said plainly rather than
marked done.

## §1 — Repository and compatibility

**Item:** the four original skills' triggering is unchanged; the package still installs and builds
the same way for both targets; nothing about plugin identity, namespace, or the Claude marketplace
façade moved.

**Satisfied by:** a byte-identical frontmatter fixture of the four original `SKILL.md` frontmatter
blocks, checked every run, plus a body-hash manifest across all five skills so a body edit is visible
even when frontmatter does not move.

**Evidence:** `test/skill-freeze.test.mjs` (`agentic-patterns`/`decide-architecture`/
`design-patterns`/`test-patterns`'s frozen frontmatter is byte-identical to its 0.3.1 shape; every
packaged skill's body hash matches the committed manifest), `test/fixtures/skill-freeze/
frontmatter-0.3.1.json`, `test/fixtures/skill-freeze/body-manifest.json`. Passing as of this commit
(`npm test`).

## §2 — Decision representation *(rewritten)*

**Item — replaces "traditional ADRs vs. living architectural documents":** there is no mode to
select and nothing to persist. Confirm:

- Decision files under the repository's decisions directory are the **sole source of record** for
  every rule and decision the crew produces.
- `constitution.md` is a **generated, read-only rollup** of the `active` decision files — never a
  second authority, never hand-edited. Its absence or staleness loses no decision: `--check` catches
  staleness, and deleting it and regenerating reproduces it exactly.
- A repository that already keeps prose ADRs (Nygard/MADR-style, in `docs/adr/`, `doc/adr/`, or
  `adr/`) keeps them untouched beside the schema decisions. Migration links them in via a
  traceability report; it never converts or edits their prose.
- A team that prefers to work from decision files alone, without a rendered rollup, may simply not
  run the generator. That is a usage choice, not a configured mode, and needs no config file to
  express it.

**Satisfied by:** nothing new in SP6 — SP1 already built the generator/rollup mechanism and SP4
already built prose-ADR coexistence at migration time. SP6's contribution here is only the checklist
wording, so the item stops asking about a mode that was never implemented.

**Evidence:** `test/baseline.test.mjs` (generator behaviour, `--check` staleness), the 0.3.1
"Coexisting with existing prose ADRs" section of `shared/migrating-decisions.md` (unchanged, still
accurate), `test/e2e/bootstrap-migration.test.mjs` (traceability over prose ADRs, E2E-3 below).
Passing as of this commit.

## §3 — Authoritative sources and baseline

**Item:** decision files remain the only thing anything treats as authoritative — no cache, no
second store, no config file quietly became a second source of truth while SP2–SP5 were built.

**Satisfied by:** an audit, not new code. The property is enforced piecemeal — the drift queue is
explicitly discardable and never a source of record, and `constitution.md`'s `status === "active"`
filter is the only path to authority. Re-reading `runtime/checkers/*`, `runtime/migration/*`, and
`runtime/drift/*` for this commit turned up no persisted state outside a decision file, the
generated constitution, or the (explicitly non-authoritative) drift queue: `check-rules.mjs`
re-reads each tool's own config file on every invocation rather than caching a prior resolution, and
`drift.mjs status`/`drain` only ever reads the queue and `git diff` against the working tree.

**Evidence:** this section itself, plus `test/e2e/drift-observed.test.mjs`'s "deleting the queue
loses nothing — `git diff` still drives the drain" case, which is a direct, executable proof that the
queue is not a second authority. Passing as of this commit.

## §4 — Migration and bootstrap

**Item:** an existing, undocumented repository can reach a first baseline without losing anything it
already had, and every input's fate is traceable.

**Satisfied by:** E2E-3, which discovers an undocumented repository's prose ADRs, proposes decisions
without touching the prose, traces every input's disposition, and shows that promotion — not
discovery, not migration — is the only path from `proposed` to `active`; and the approval-gate suite,
which proves the constitution is byte-unchanged until `promote` runs and that promotion flips exactly
the named ids.

**Evidence:** `test/e2e/bootstrap-migration.test.mjs` (3 tests: discovery reads nothing but lists the
undocumented repo's ADRs exactly; migration proposes and traces every input without editing prose;
promoting a subset changes the constitution by exactly that subset), `test/approval-gate.test.mjs`
(5 tests). Passing as of this commit.

## §5 — Compliance and architectural drift

**Item:** drift is observed and classified honestly — a violation is never asserted on weak evidence,
an unavailable tool is never given a model judgement in its place, and "nothing to report" is a
normal outcome.

**Satisfied by:** E2E-2, the only place in the whole upgrade that exercises SP3's full loop (queue →
drain → classification) against a fixture repository, rather than SP3's own unit tests over the
classifier in isolation.

**Evidence:** `test/e2e/drift-observed.test.mjs` (an edit to a scoped file is classified, never
asserted as a violation; deleting the queue loses nothing; CI's documented commands never read the
drift queue), cross-referenced against `test/scenarios/drift-drain.json` (8 scenarios; SP3) for the
judgement half — whether a given classification is genuinely correct, not only mechanically
well-formed. Passing as of this commit.

## §6 — Hooks/commands/CI

**Item:** the hook set (`SessionStart`, `PostToolUse`, `Stop`) is non-fatal by construction, CI runs
the full deterministic test suite plus `check-rules --run --require-tools` against this repository's
own decisions and never reads the drift queue, and every CLI entry point SP2–SP5 added is reachable
from both packaged targets.

**Satisfied by:** the extended target-inventory test — every `runtime/<subsystem>/` tree (`checkers`,
`migration`, `drift`, in addition to the existing `baseline`) is asserted present in both
`build/claude` and `build/codex`; the hook-manifest test asserts no `PreToolUse` registration and
that every handler resolves to a `${CLAUDE_PLUGIN_ROOT}/runtime/drift/*.mjs` script; per-CLI
executability tests run each shipped entry point from inside the built package, not the source tree;
`.github/workflows/package-contract.yml` runs `npm test` (every suite listed in `package.json`'s
`test` script — package contract, scenario-set integrity, skill-freeze, checker-corpus, drift, and
all four `test/e2e/` suites) on every push and pull request, then a real
`check-rules.mjs --dir docs/architecture/decisions --run --require-tools` invocation against this
repository's own decisions (currently all `review`, so this step cannot yet fail on a missing tool
binary — it exists so a `deterministic` rule added later is enforced in CI from day one). CI never
invokes `runtime/drift/drift.mjs` at all, so it never reads `.arch-crew/drift-queue.jsonl`.

**Evidence:** `test/build.test.mjs` — `"target inventories contain only their manifest, generated
target files, skills, and the runtime"`, `"the claude hook manifest registers the drift loop and
nothing that can block"`, `"codex ships the drift runtime and registers no hooks"`, `"the shipped
rule checker runs from each target package"`, `"the shipped migration CLI runs from each target
package"`, `"build-constitution's promote verb runs from each target package"`; the CI command list
in `docs/building-packages.md` ("Build and validate" plus `check-rules.mjs --dir ... --run` in the
runbook); `.github/workflows/package-contract.yml`'s "Deterministic test suite" and "Deterministic
rule check (repository's own decisions)" steps. Passing as of this commit.

## §7 — Security extension

**Item:** the fifth skill exists, is packaged and advertised like the other four, never enumerates
vulnerabilities itself, and its findings carry no score.

**Satisfied by:** E2E-4, plus the existing skill-count audit (§1/`test/build.test.mjs`'s
`advertisedTerms`) applied to the security skill's advertised terms and description, unchanged in
mechanism and now re-run against the five-skill state.

**Evidence:** `test/e2e/security-without-theatre.test.mjs` (the secret is found by `gitleaks`, not
asserted by the model; the decision carries one deterministic, one review, one narrative rule, and
no score), `test/build.test.mjs`'s `"documentation claims the same number of skills as are packaged"`
and `"generated metadata advertises every canonical skill"` (both parametrized over all five skills,
`threat-model` included). Passing as of this commit.

## §8 — Tests and end-to-end scenarios

**Item:** all five scenario sets (`test-patterns.json`, `baseline-capture.json`, `drift-drain.json`,
`migration.json`, `security.json`) still integrity-check under `npm test`, and have been re-run
agent-driven, fresh session per scenario, since the last change to any skill body.

**Satisfied by:** the mechanical half — every set's integrity (required scenarios/criteria present
exactly once, every gate name resolves to a real reference heading) — runs in `npm test`, with no
model, and passes on this branch. The judgement half has now been performed and **it does not pass**.

**Result (2026-09-10, full record in [`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md)):** all
five sets re-run with fresh, blind runner sessions (no access to `test/scenarios/`, the plans, or
prior run records), each run graded by a separate agent that did see the expectations. **26 of 45
graded scenarios failed. 3 of the 48 were never graded.**

| Set | In set | Graded | Pass | Fail |
|---|---|---|---|---|
| `test-patterns.json` | 12 | 11 | 5 | 6 |
| `security.json` | 12 | 11 | 0 | 11 |
| `baseline-capture.json` | 6 | 6 | 5 | 1 |
| `drift-drain.json` | 8 | 7 | 5 | 2 |
| `migration.json` | 10 | 10 | 4 | 6 |

Three findings make this row a blocker rather than a tally:

- **The security set did not test the skill it names.** Four runner sessions report
  `arch-crew:threat-model` absent from their skill registry or throwing "Unknown skill", though it is
  committed, built into both targets, and advertised in every manifest. The 0/11 is a real result and
  does not isolate the skill: in at least four cases its decision procedure was never loaded. Two
  trigger issues (`committed-secret-found-by-tool`, `agentic-support-bot`) trace to the same cause.
- **Several runs were not staged against a representative repository**, contrary to
  `docs/validating-skills.md` step 3, and reacted to the mismatch by treating the scenario's forces
  as a claim to falsify against the arch-crew checkout. That is both a harness fault and a genuine
  finding about the runs.
- **Failures include `failsIf` conditions holding, `gatesOpen` gates silently skipped,
  `gatesClosed` gates bought on fabricated forces, and one run that emitted the literal token
  `test`** — not a class of failure re-scoping a scenario could absorb.

Eight skill/shared-reference defects and two open contract-vs-criterion questions were identified and
are listed as outstanding in §8.2/§8.3 of the gate record. **Nothing has been fixed** — the record's
job was to state the finding.

### Amended result (2026-09-10, second pass — [gate record §11](release-gate-0.4.0.md#11-amendment--corrected-finding-2026-09-10-second-pass))

The first-pass numbers above are left standing. Three things happened after they were written: the
security set's 0/11 was **diagnosed**, that set was **re-run** against a reachable skill, and every
recorded failure was **calibrated**. **Model tiers, previously unrecorded: Sonnet runners, Opus
graders** — both passes.

**The 0/11 was measured against a stale installed package.** `~/.claude/plugins/installed_plugins.json:93-96`
pins `arch-crew@arch-crew` to `.../cache/arch-crew/arch-crew/0.3.0`; that tree ships four skills and
no `threat-model`, and its marketplace clone's `CLAUDE.md:22` is the actual source of the "Four shared
skills" text the gate record dismissed as a context artifact. The repo is 0.4.0 with five skills. So
the 0/11 is **void as a measurement of `threat-model`** — but it was never a **null** result: 9 of the
11 runs read the skill as files, as the runner instructions directed, and failed against its own
output contract.

| Set | In set | First pass (graded/pass/fail) | **Corrected** | What moved |
|---|---|---|---|---|
| `test-patterns.json` | 12 | 11 / 5 / 6 | 11 / 5 / 6 | unchanged |
| `security.json` | 12 | 11 / 0 / 11 | **12 / 4 / 8** | re-run against a reachable skill; `internal-crud-service` graded (PASS) |
| `baseline-capture.json` | 6 | 6 / 5 / 1 | 6 / 5 / 1 | unchanged |
| `drift-drain.json` | 8 | 7 / 5 / 2 | **6 / 5 / 1** | `rule-outlived-its-subject` struck as void (it emitted the token `test`) |
| `migration.json` | 10 | 10 / 4 / 6 | 10 / 4 / 6 | tally unchanged; one failure reclassified |
| **Total** | **48** | **45 / 19 / 26** | **45 / 23 / 22** | 3 of 48 still ungraded |

**16 of the 22 corrected failures are blocking:** 5 trace to a named line of shipped skill text,
5 are clean `threat-model` failures against a reachable skill, 2 are run-quality failures that change
the advice the user receives, and 4 are blocking but confounded by staging. The other 6 are 3 nit-only
and 3 scenario-expectation-wrong.

**The highest-yield single correction:** `skills/test-patterns/references/decision-tree.md:38` routes
*"what tests should I write?"* to "code-testing branch (**Steps 2, 4**)", contradicting `SKILL.md`
Mode A's "Step 1 → Step 2 → **Step 3** → Step 4 → Step 5 → Step 6" and making the always-on Step 3
gates **structurally unreachable**. The gate record's §4.1 blamed the runs for not walking Step 3; the
decision tree told them not to. Two failures trace to this line alone.

**Also corrected:** §8.4's claim that no scenario expectation is wrong is **withdrawn**. Three
scenario expectations and two set-level criteria are now known to be wrong — including
`baseline-capture`'s `proposed-only`, which is **mutually unsatisfiable** with the `already-decided`
scenario in its own file. They are listed in gate-record §11.5 and **have not been amended.**

**Evidence:** `test/build.test.mjs`, `test/scenarios.test.mjs` (integrity, all five sets — passing);
[`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md) (the committed finding, §1–§10 first pass and
§11 the corrected finding); `test-runs/0.4.0/<set>/<scenario-id>/` (gitignored, local — outputs and
friction logs). **This row is NOT satisfied** — and the corrected reason is genuine skill defects, not
an unloadable skill.

**Also periodic, not gating this release:** the real-tool E2E lane
(`ARCH_CREW_E2E_REAL_TOOLS=1 node --test test/e2e/bind-and-prove.test.mjs
test/e2e/security-without-theatre.test.mjs`, `lint-imports` and `gitleaks` on `PATH`) re-verifies that
E2E-1 and E2E-4 still match the real `import-linter` and `gitleaks` CLI contracts, not only the fake
stand-ins `npm test` runs by default (see `docs/validating-skills.md`'s "The real-tool E2E lane").
Run it, with both binaries installed, before cutting **this and every future** release — it is a
periodic verification step, not a one-time item this checklist closes, so it is not itself part of
the §8 gate above. **Not yet run on this branch** as part of 0.4.0.

## §9 — Documentation and release package

**Item:** README, the upgrade path, and the release notes are accurate and complete, and the package
contains nothing unintended.

**Satisfied by:** README's skill table and baseline section already name all five skills and are
current on this branch (verified: `docs/README.md:31` and the five-row skill table at `:33-40`).
Task 12 has landed: `docs/release-0.4.0.md` (release notes) is present and describes what shipped,
and the version bump is in place — `package.json`'s `version` field reads `0.4.0`, propagated into
`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `build/claude/.claude-plugin/
plugin.json`, and `build/codex/.codex-plugin/plugin.json`. The package-content audit
(`test/build.test.mjs`'s inventory-equality check, plus a manual `gitleaks detect --source build/
--no-git` run) is documented in `docs/building-packages.md` and is a by-hand, once-per-release step,
not wired into CI.

**Evidence:** `README.md` (skill table, baseline section — current); `docs/release-0.4.0.md` (present,
describes SP2–SP6 and states its own known limitations, including the outstanding §8 re-run below);
`package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
`build/claude/.claude-plugin/plugin.json`, `build/codex/.codex-plugin/plugin.json` (all read
`0.4.0`); `docs/building-packages.md`'s "Host validation before release", "Clean-install
verification", and "Package-content audit" sections (present and current). This row is closed —
§8's agent-driven re-run is the sole item still outstanding for the release as a whole.

## §10 — Final release decision

**Item:** the release gate — no silent authority change, no workflow regression, no untraceable
migration, no unverified deterministic claim — is actually satisfied, in writing, before the tag is
cut.

**Satisfied by:** the closing section below, which restates the four gate conditions against the
evidence gathered in §1–§9 and records the go decision plus every remaining documented limitation.

**Evidence:** this document, final section. §8's agent-driven re-run has now been performed and
failed; the gate is therefore closeable, and it closes **NO-GO**. See
[`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md).

## Final release decision

The release gate: do not release if architectural authority can be changed silently, existing
workflows regress, migration loses decisions without traceability, or a deterministic violation is
reported as verified without a reliable check.

| Gate condition | Evidence it does not hold |
|---|---|
| Authority changed silently | §2, §3 — decision files are the sole authority; the drift queue and any checker cache are explicitly non-authoritative; `test/approval-gate.test.mjs` |
| Existing workflows regressed | **NOT CLEARED — corrected 2026-09-10 (second pass).** §1's mechanical half holds: `test/skill-freeze.test.mjs` proves the four original skills' frontmatter is byte-identical to its 0.3.1 shape and every body hash matches the manifest. §8's behavioural half does not. **Corrected: 22 of 45 graded scenarios failed, 16 of them blocking; 3 of 48 remain ungraded.** The security set was re-run against a reachable skill and scored **4 of 12, not 0 of 11** — the 0/11 was taken against a stale *installed* package (0.3.0, four skills, no `threat-model`) and is void as a measurement, but 9 of those 11 runs did read the skill as files and failed against its own contract. Five failures trace to a named line of shipped skill text — chiefly `skills/test-patterns/references/decision-tree.md:38`, which routes "what tests should I write?" past the always-on Step 3 gates and makes a scenario's `gatesOpen` structurally unreachable. Runners were Sonnet, graders Opus. Record: [`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md) §11 (first-pass numbers preserved in §1–§10). The row additionally still cannot distinguish regression from pre-existing behaviour: no comparable prior measurement of these five sets exists, so this is a first baseline, not a delta. |
| Migration lost a decision without a trace | §4 — `test/e2e/bootstrap-migration.test.mjs`; the traceability report's exhaustiveness requirement |
| A deterministic violation reported verified without a reliable check | §6, §8 — `test/checker-corpus.test.mjs`; the `unbound`/`unavailable`/`unreadable-config` distinction |

**Decision as first written (2026-09-10, first pass — verdict unchanged, grounds superseded):**
NO-GO. One of the four gate rows above is not cleared. The "Existing workflows regressed" condition
cannot be shown not to hold: the agent-driven re-run required by §8 failed 26 of 45 graded scenarios,
three of the 48 were never graded, and the security set scored 0 of 11 in sessions where the skill
under test was not loadable.

### Decision: **NO-GO — 2026-09-10 (re-decided, second pass)**

The verdict is unchanged. **The grounds are not.** It now rests on genuine skill defects rather than
on an unloadable skill and a uniform failure rate. Full record:
[`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md) §11.

**What the NO-GO rests on — 16 blocking failures of 22:**

1. **Five trace to a named line of shipped skill text** and would reproduce on any correctly installed
   package: `skills/test-patterns/references/decision-tree.md:38`'s Step 3 routing contradiction (two
   failures), its Step 2 "Safety-critical / regulated" row enumerating two of three needed gates (one),
   `shared/migrating-decisions.md` step 5's cap remedy (one), and that file's missing "neither mode
   applies" branch (one).
2. **Five are clean `threat-model` failures with the skill reachable** — `payments-card-data`,
   `committed-secret-found-by-tool`, `agentic-support-bot`, `read-only-summariser-agent`,
   `legacy-monolith-trusted-network`.
3. **Two are run-quality failures against correct text that change the advice the user receives** — a
   closed gate bought on fabricated segments, and an E2E layer bought on a justification copied
   verbatim from the reference's own illustration.
4. **Four are blocking but confounded by staging** and cannot yet count as skill evidence.

**What it no longer rests on:** the 26-of-45 figure, the 0-of-11 figure, "the skill was not loadable"
as a general explanation, or the claim that no scenario expectation is wrong.

**No exception is accepted.** A GO-with-exceptions was reconsidered on the corrected evidence and
rejected again: 16 blocking failures across four sets, including `failsIf` conditions holding and
`gatesOpen` gates the shipped text makes structurally unreachable, is not a class of failure that
re-scoping absorbs. The closest single waiver candidate (`test-patterns/llm-agentic-system`) is
declined because the layer it bought is real advice.

The other three rows are clear on their own evidence, and the deterministic suite is green
(`npm test` — 323 tests, 323 pass, 0 fail). The blocker is the judgement half of §8, which
`docs/validating-skills.md` states the deterministic suite cannot substitute for.

**Outstanding work carried by this decision** (none of it done; gate-record §11.5/§11.6 is the list):

- **Skill and shared-reference text:** N1 (the Step 3 routing fix — highest yield), N2–N5
  (test-patterns), N6–N11 (`shared/migrating-decisions.md`, `shared/recording-decisions.md`), D1–D7,
  and D9 (`threat-model`'s output ordering must be stated load-bearing before the next security run,
  or the second gate reproduces the same `boundary-first` failures).
- **Scenario expectations to amend — identified, deliberately NOT amended:**
  `test-patterns/pure-math-library`'s `gatesClosed` "Contract tests" entry (too coarse for a published
  library; the gate must stay shut on its *second* half); `drift-drain`'s `violation-is-reserved`
  criterion (unsatisfiable as worded by any run that explains the taxonomy);
  `baseline-capture`'s `proposed-only` criterion (**mutually unsatisfiable** with the `already-decided`
  scenario in its own file — must forbid promotion to `active` while permitting the superseding edit);
  and, **provisionally and only after re-staging**, `security/already-hardened-service`,
  `security/maturity-score-request`, and `migration/reverse-discovery-narrative-with-exceptions`, all
  three of which refuse on "the described system is not this repository" and may prove to be staging
  faults rather than wrong expectations.
- **Harness:** re-install 0.4.0 on the runner machine (still pinned to 0.3.0); build the representative
  fixtures B2 needs, including the one `security/public-api-surface-change` lacks — that scenario is a
  missing fixture and must **not** be changed; grade `test-patterns/healthy-existing-suite` and the
  unidentified `drift-drain` case; re-run `drift-drain/rule-outlived-its-subject`; require the model
  tier be logged in `docs/validating-skills.md`.

**Sequence to a re-decision:** N1 → N2–N11 and D1–D7 → D9 → B2 re-staging and the re-run of the four
confounded blockers plus the three provisional scenario-wrong cases → amend the criteria and scenario
that survive that re-run → grade the three remaining ungraded/void scenarios → full re-run of all 48
with tiers logged → re-decide. Reviewed by: [name at re-decision time].

## Documented limitations carried into 0.4.0

- Nothing mechanically prevents a hand-edited `status: active` outside `promote`
  (`test/approval-gate.test.mjs`'s last case; unchanged from 0.3.1).
- Proposed-file accumulation from reverse discovery has no staleness sweep (Q4.4; unchanged from
  0.3.1's own accepted risk).
- `oasdiff` resolves against a vendored check-id list, never a file in the repository — the weakest
  of the seven checker adapters' guarantees (0.3.2).
- `pytest-archon` can only prove a same-named test function exists, never that its body asserts
  anything (0.3.2).
- `ast-grep --run` is not implemented; it always reports `unavailable` under `--run` (0.3.2).
- The model classifying `review` rules is the weakest link in the drift-observation loop. It is
  mitigated — the four-part evidence gate, `judgement` as data that forbids classification on
  anything a tool already settled — but not eliminated: a `review` rule's finding is still,
  ultimately, a model's read of a diff (0.3.5).
- The clean-install test and the `gitleaks` package audit run by hand, once per release — neither is
  wired into CI.
- The judgement half of each end-to-end scenario (drift classification quality, migration duplicate
  detection, security-control adequacy) is graded by agent-driven runs against `drift-drain.json`,
  `migration.json`, and `security.json`, never by a deterministic check — this is by design (rule 6),
  named here so it is not mistaken for a gap.
