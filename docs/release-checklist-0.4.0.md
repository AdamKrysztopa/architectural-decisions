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

## §2 — Documentation mode *(restored 2026-09-10; the 0.3.x rewrite is withdrawn)*

> **This section was rewritten once before, and that rewrite was the defect.** SP6 amended it to
> "there is no mode to select and nothing to persist", which made the item agree with what had been
> built rather than with what was required. The requirement is restored here in its original terms.
> See [`docs/superpowers/specs/2026-09-10-requirements-reconciliation.md`](superpowers/specs/2026-09-10-requirements-reconciliation.md) §1.

**Item:** the user selects one of two documentation modes; the choice is explicit, persisted, and
honoured consistently by the toolchain.

- **`adr`** — traditional ADRs. Many files, one per decision; each file is its own human record.
- **`living`** — one or several **living architecture documents** are the primary human record. In
  this mode the user **must not** be forced to maintain dozens of ADR-shaped files merely because
  the runtime wants rule metadata.
- Machine-readable enforcement metadata (rules, scopes, severities, `verified_by`, the generated
  rollup) is **separate from and identical in both modes**, and no verification behaviour varies
  with the mode.
- The mode is never inferred and never changed as a side effect of another command.

**Satisfied by:** `runtime/baseline/config.mjs` (persisted in `arch-crew.json`),
`runtime/baseline/living.mjs` (a decision is a `##` section of a living document; its rules ride in
fenced `arch-decision` / `arch-rule` blocks beside the prose), and `runtime/baseline/record.mjs` —
the single seam every consumer reads through, so the rollup, `check-rules`, the drift drain, rule
injection and staleness cannot tell which mode produced their input. `arch mode` and `/arch-mode`
make the choice user-facing; `arch promote` works in both.

**Authority model:** [`docs/documentation-modes.md`](documentation-modes.md).

**Evidence:** `test/documentation-mode.test.mjs` — 24 tests, including the load-bearing one, which
expresses the same two decisions both ways and asserts the machine layer is identical across modes.
A repository with no `arch-crew.json` is in `adr` mode with a discovered directory, i.e. byte-for-byte
the prior behaviour; the 332 tests that predate the mode all still pass unchanged. Passing as of
this commit.

## §3 — Authoritative sources and baseline *(restored 2026-09-10; the 0.3.x inversion is withdrawn)*

> **This item had its meaning inverted.** A requirement to let a project **designate** its own
> authoritative inputs became a guarantee that **nothing but decision files** is authoritative — and
> was then satisfied by "an audit, not new code", an audit that would have failed had the
> requirement been built. See the reconciliation spec §2.

**Item:** a project explicitly designates artifacts as authoritative inputs — PRDs, architecture
documents and diagrams, engineering standards, API contracts, security requirements, selected ADRs,
living architecture documents, and other explicitly chosen repository artifacts — with add/remove/
change, provenance, source identity and path, precedence and conflict policy, and traceability to
the baseline version being checked. Arbitrary repository documents are **never** automatically
treated as authoritative. Conflicts are **reported**, never silently resolved. Minimal project
configuration; **no database**.

**Satisfied by:** `runtime/baseline/sources.mjs` and `arch sources`
(`list|add|remove|change|checked`), persisted as a list in the one committed `arch-crew.json`.
Provenance (`--by`, `--on`, `--provenance`); identity is the id, stable across a path change;
precedence per kind and overridable; `sources checked --baseline <ref>` pins the digest actually
read, so *never checked* / *unchanged since* / *changed since* are distinguishable — a source that
moved makes claims resting on it **unverified, not wrong**.

**Conflicts:** both sources are always listed; precedence orders the report and says so; equal
precedence reports `unresolvable-by-precedence` rather than breaking the tie. `sources list` exits
**3** on a conflict, distinct from `1`, so a CI gate can tell a real disagreement from a broken
invocation. Missing and moved-since-checked sources are reported too.

**Nothing is auto-designated.** There is no `discover`, no `--auto`, no scan, and a test asserts
there is no way in.

**The drift loop binds to it (step 3):** the packet names the designated sources this session's
edits fall under — governed by scope, or edited directly — so the drain can say *"this contradicts
the API contract and the security requirements you designated as authoritative."* **The evidence
gate is unchanged:** every entry in that layer carries `judgement: "review"` and no checker binding.
A designated source can produce a **finding**; it can never produce a **violation**, because a
violation requires a tool that ran and failed and no checker speaks for a PRD.

**What is still true from the old wording, and kept:** no cache and no second store became a source
of truth. The drift queue remains explicitly discardable and non-authoritative.

**Model:** [`docs/authoritative-sources.md`](authoritative-sources.md).

**Evidence:** `test/authoritative-sources.test.mjs` (20 tests, including the no-auto-designation and
evidence-gate assertions) and `test/e2e/drift-observed.test.mjs`'s "deleting the queue loses
nothing" case. Passing as of this commit.

## §4 — Migration and bootstrap

**Item:** an existing, undocumented repository can reach a first baseline without losing anything it
already had, and every input's fate is traceable.

**Satisfied by:** E2E-3, which discovers an undocumented repository's prose ADRs, proposes decisions
without touching the prose, traces every input's disposition, and shows that promotion — not
discovery, not migration — is the only path from `proposed` to `active`; and the approval-gate suite,
which proves the constitution is byte-unchanged until `promote` runs and that promotion flips exactly
the named ids.

**Added 2026-09-10 — ADR → living-document migration (reviewer blocker 3).** A project with 30
traditional ADRs must be able to end with one or several coherent living architecture documents if
that is what the user selects, and the traceability report must show **migrated · merged ·
superseded · omitted · conflicting · unresolved**.

The disposition vocabulary now carries all six. `left-as-prose` and `unmapped` are retained as
accepted aliases folding into `omitted` and `unresolved`, so existing manifests keep parsing;
`conflicting` is new, because an input that could not be migrated *because it contradicted another
input* previously had to be filed as unmapped, which lost the one fact a reader most needed. The
report groups every input into all six categories and prints an empty category as empty — *"nothing
was omitted"* and *"omission was never considered"* must not look the same.

The old ADRs are never deleted, converted, or edited; they may stay in the repository or in Git
history. The living documents become the authoritative record **only after explicit human
approval** — everything migrates in as `proposed`, the rollup says `_No active rules yet._`, and
only `arch promote` moves a section to `active`.

**Evidence:** `test/e2e/bootstrap-migration.test.mjs` (3 tests: discovery reads nothing but lists the
undocumented repo's ADRs exactly; migration proposes and traces every input without editing prose;
promoting a subset changes the constitution by exactly that subset), `test/approval-gate.test.mjs`
(5 tests), and `test/e2e/adr-to-living-migration.test.mjs` — 30 ADRs become 23 sections across two
living documents, all six dispositions exercised (20/4/2/2/1/1 = 30), every ADR named in the report,
the four that produced nothing carrying their reasons, nothing enforced until three are promoted,
and the 30 originals untouched. Verified non-vacuous against four deliberate product mutations.
Passing as of this commit.

## §5 — Compliance and architectural drift

**Item:** drift is observed and classified honestly — a violation is never asserted on weak evidence,
an unavailable tool is never given a model judgement in its place, and "nothing to report" is a
normal outcome.

**Satisfied by:** E2E-2, the only place in the whole upgrade that exercises SP3's full loop (queue →
drain → classification) against a fixture repository, rather than SP3's own unit tests over the
classifier in isolation.

**Evidence:** `test/e2e/drift-observed.test.mjs` (an edit to a scoped file is classified, never
asserted as a violation; deleting the queue loses nothing; CI's documented commands never read the
drift queue), cross-referenced against `test/scenarios/drift-drain.json` (11 scenarios; SP3) for the
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

**Added 2026-09-10.** Two verbs and two commands joined the surface: `arch mode` / `/arch-mode`
(§2) and `arch sources` / `/arch-sources` (§3). Both go through the one dispatcher, both are
asserted by `test/surfaces.test.mjs`'s "every verb the dispatcher advertises resolves to a real
delegate" and "every shipped command names a dispatcher verb that exists", and both ship in the
Claude package (Codex ships the runtime, not the commands, as before).

**GitHub Actions Node runtime deprecation — cleared, not accepted.** `actions/checkout` v4→v5,
`actions/setup-node` v4→v5 and `actions/setup-python` v5→v6, all of which move from the `node20`
runtime GitHub is removing to `node24`. `node-version: 22` is unchanged — the tested Node version
was not touched. Nothing in `.github/workflows/` still warns, so there is nothing here to
consciously accept.

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

---

### Second re-run (2026-09-10, after remediation) — [gate record §12](release-gate-0.4.0.md#12-second-re-run--2026-09-10-after-the-remediation)

**48 of 48 graded — no ungraded cases for the first time. 40 pass, 8 fail.**
Runner tier **Sonnet**, grader tier **Opus**, logged per N13.

| Set | In set | §11 (graded/pass/fail) | **§12** | What moved |
|---|---|---|---|---|
| `baseline-capture.json` | 6 | 6 / 5 / 1 | **6 / 6 / 0** | — |
| `test-patterns.json` | 12 | 11 / 5 / 6 | **12 / 9 / 3** | N1 Step-3 routing confirmed fixed |
| `security.json` | 12 | 12 / 4 / 8 | **12 / 9 / 3** | D9 boundary-first held 12/12 |
| `drift-drain.json` | 8 | 6 / 5 / 1 | **8 / 7 / 1** | the void and the unidentified case both graded |
| `migration.json` | 10 | 10 / 4 / 6 | **10 / 9 / 1** | fixtures; cap ranks rather than refuses |
| **Total** | **48** | **45 / 23 / 22** | **48 / 40 / 8** | **3 ungraded → 0** |

**The 8 failures: 1 skill defect, 1 harness, 6 run-quality.** Both the skill defect (**N15** — the
drain regenerated `constitution.md`, changing what is enforced with no human promotion) and the
harness gap (`committed-secret-found-by-tool` had no fixture) are **fixed in this branch**. The six
run-quality failures trace to no line of shipped text — but three are the same dropped-output-contract-field
failure D2/D3 were supposed to close, which is a signal about how easy the text is to follow.

**Confirmed working by this re-run:** N1 (Step 3 routing, no run failed on it), D9 (boundary-first
12/12), N6 (cap ranks, exercised end-to-end through the real CLI), A1. **A4, A5 and A6 all pass once
correctly staged and therefore need no amendment** — per §11.5's own condition.

> **This re-run does NOT discharge the gate, and §12.1 says so at length.** The protocol requires a
> fresh session per scenario with the prompt pasted verbatim and the skill not named. These were
> fresh *subagent contexts within one session*, each told which skill to read. Triggering was
> therefore not measured at all, and one cross-run contamination was confirmed by a grader. This is
> the best measurement available short of installing the candidate and launching 48 sessions — and it
> is not the measurement the protocol asks for.

**This row remains NOT satisfied.**

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
verification", and "Package-content audit" sections (present and current).

**Added 2026-09-10 — two new documents and three verifications actually performed:**

- [`docs/documentation-modes.md`](documentation-modes.md) (§2's authority model) and
  [`docs/authoritative-sources.md`](authoritative-sources.md) (§3's model) are new and current.
- **Package-content gitleaks audit — RUN, not merely documented.** `gitleaks dir build/` with the
  real binary (gitleaks 8.30.1): 1.29 MB scanned, **no leaks found**, exit 0. Previous checklists
  described this step; this is the first release record that states its actual result.
- **Real-tool E2E lane — RUN with the real binaries.** `ARCH_CREW_E2E_REAL_TOOLS=1` with a real
  `import-linter` and `gitleaks` on PATH: **5 of 5 pass**. It initially failed 4 of 5 and **found a
  genuine shipped defect** — import-linter colours its report even into a pipe, so the adapter's
  plain-text match on the contract name never fired and every deterministic import-linter rule
  reported `error` against a tool that had just printed `KEPT`. The deterministic lane, the only
  lane that can produce a violation, had silently stopped producing pass or fail for that tool, and
  the fake-tool suite was green through all of it. Fixed in
  `runtime/checkers/import-linter.mjs`. **This is the strongest argument in this document for the
  real-tool lane being mandatory before a release rather than optional.**
- **Clean-install verification — the candidate, not a cached 0.3.x.** The built Claude package was
  copied to a clean location and inspected there: `.claude-plugin/plugin.json` reads `0.4.0`, five
  skills are present (`threat-model` among them), seven commands ship, the runtime tree is complete,
  and `node runtime/arch.mjs --help` runs from inside the installed tree. **Caveat recorded
  deliberately:** the *user's own* `~/.claude/plugins` install is still pinned to `0.3.0` (four
  skills, no `threat-model`) and its marketplace clone is stale at `0.3.0`. That stale install is
  what voided the last gate's security set. It has not been changed here, because changing a
  developer's global plugin install is not this branch's business — but **any scenario re-run must
  read the skills from this repository, not from that cache**, and §8's re-run records that it did.

This row is closed — §8's agent-driven re-run is the sole item still outstanding for the release as
a whole.

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

---

## Decision: **NO-GO — 2026-09-10 (third pass, after the full remediation)**

This supersedes the second-pass NO-GO above. Every prior decision is left standing as written.

**What changed since the second pass.** Both product blockers from the
[reconciliation spec](superpowers/specs/2026-09-10-requirements-reconciliation.md) are built: the
documentation mode is restored, persisted and user-selected (§2), and the authoritative-source
registry exists with designation, provenance, precedence, conflict reporting and baseline
traceability (§3). The ADR → living-document path is proven end-to-end on 30 ADRs with six-category
traceability (§4). The recorded defect list — **N1–N15, D1–D7, D9, A1–A3, B2, B3′, B4** — is closed.
A4–A6 were correctly *not* amended and now pass with proper staging. Two real product defects were
found by running the tools rather than reading them, and fixed. The scenario tally moved from
**45 graded / 23 pass / 22 fail** to **48 / 40 / 8**, with no ungraded cases.

**Why it is still NO-GO.** Three reasons, in order of weight:

| # | Gate condition | Why it does not hold |
|---|---|---|
| 1 | Existing workflows regressed | **The gate's own protocol was not executed.** `docs/validating-skills.md` requires a fresh session per scenario, prompt verbatim, skill not named. These 48 runs were fresh *subagent contexts inside one session*, each told which skill to read. **Triggering was not measured at all**, and one cross-run contamination was confirmed by a grader (`public-api-surface-change` cited a symbol from another scenario's fixture). A GO on this evidence would rest on a method this project's own documentation rejects. |
| 2 | Existing workflows regressed | **A skill defect was found in this run and its fix is unmeasured.** N15: the drift drain followed `recording-decisions.md` "unchanged" and so regenerated `constitution.md`, retiring the superseded rule — changing what the repository *enforces*, from an observed edit, with no human promotion. The `proposed` gate was defeated from the other side. Fixed here; the fix edits a shared reference every skill cites, so it owes a re-run. |
| 3 | Authority changed silently | **The candidate has never run as an installed package.** `~/.claude/plugins` is still pinned to `0.3.0` with four skills. The clean-install check verified the *built tree*; nothing has verified the *installed plugin* behaving as 0.4.0 in a real session — and a stale install is exactly what voided the last security set. |

The other two gate rows — *migration lost a decision without a trace* and *a deterministic violation
reported verified without a reliable check* — **do hold**, and the second is stronger than it was:
the real-tool lane caught `import-linter` silently reporting `error` for every rule against a tool
that had just passed.

**Do not tag 0.4.0.** What remains, and nothing less:

1. Install the built Claude package; confirm the session sees five skills including `threat-model`.
2. Re-run all **51** from genuinely fresh sessions — prompt verbatim, skill not named — with tiers
   logged. (48 + the three drift scenarios §12.7 added for the sources layer and the comparison window.)
3. Grade all 51; no ungraded cases.
4. Confirm the six run-quality failures do not recur. If the same output-contract fields are dropped
   again by different runs, D2/D3 are not closed and the text is at fault after all.
5. Re-run `drift-drain/rule-outlived-its-subject` specifically against the N15 fix.
6. ~~Work, or consciously accept, the eleven carried-forward items in
   [gate record §12.6](release-gate-0.4.0.md#126-outstanding-carried-forward--flagged-by-graders-deliberately-not-amended).~~
   **Done, before the re-run rather than after it** — ten fixed, O6 clarified as a specification
   defect, recorded item by item in
   [gate record §12.7](release-gate-0.4.0.md#127-the-eleven-amended--what-each-became). Two of them
   were the reason the re-run could not have been valid anyway: O8 (24 of the 48 scenarios had no
   prompt and so could not be run by the documented procedure) and O10 (a degenerate git base
   silently suppressing every committed change).

**Current test counts, this commit:** `npm test` **385 passing, 0 failing** (379 before the §12.7
amendments; 332 at the second pass). `npm run sync:check` clean. Both targets rebuild byte-for-byte. Real-tool E2E lane **5/5**
with a real `import-linter` and `gitleaks 8.30.1`. Package-content gitleaks audit over `build/`:
1.29 MB scanned, **no leaks**. GitHub Actions Node-runtime deprecation **cleared**, not accepted.
