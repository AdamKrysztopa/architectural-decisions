# Release 0.4.0 — the checklist closed, five skills, the baseline proven end to end

## What shipped in 0.4.0

This is the release the ten-section pre-release checklist gates, rolling up everything built since
the 0.3.1 baseline:

- **Deterministic compliance checkers (SP2, 0.3.2).** `runtime/checkers/check-rules.mjs` resolves
  every `verification: deterministic` rule's `verified_by` binding against the repository's own tool
  config across seven adapters (`import-linter`, `dependency-cruiser`, `semgrep`, `ast-grep`,
  `gitleaks`, `pytest-archon`, `oasdiff`), reporting `unbound`/`unreadable-config`/`unavailable` as
  distinct outcomes from `pass`/`fail` rather than collapsing them.
- **The drift-observation loop (SP3, 0.3.5).** Three non-fatal Claude Code hooks
  (`SessionStart`/`PostToolUse`/`Stop`) queue observed edits; `runtime/drift/drift.mjs` drains the
  queue against `git diff` and the active rule set, copying each deterministic checker's verdict
  verbatim and handing the model judgement only on the rules it is actually allowed to classify.
  Codex, which has no hooks, runs the same drain from git alone.
- **Migration and bootstrap (SP4, 0.3.6).** `shared/migrating-decisions.md` covers consolidating
  existing prose ADRs and reverse-discovering a first baseline for an undocumented repository, backed
  by `runtime/migration/build-migration-report.mjs`'s traceability report — every confirmed input gets
  exactly one disposition, and `promote` is the only path from `proposed` to `active`.
- **The security skill (SP5, 0.3.7).** `threat-model` is arch-crew's fifth skill: trust boundaries,
  authentication/authorization placement, secrets, data protection, supply chain, and agent/tool
  permissions, with every deterministic claim bound to a checker the repository already runs and no
  maturity score in its output.
- **Release hardening (SP6, this release).** A `test/skill-freeze.test.mjs` regression net over the
  four original skills' frozen frontmatter, plus a body-hash manifest across all five skills so a
  body edit is visible even when frontmatter does not move; a deterministic-checker corpus
  (`test/checker-corpus.test.mjs`) exercising three tools (`import-linter`, `gitleaks`, `semgrep`)
  across five of the seven result states in `runtime/checkers/registry.mjs`'s `CHECK_STATUSES`
  (`error` and `not-run` are not exercised there — `error` is covered in `test/checkers.test.mjs`,
  and `not-run` is the drift packet's own fallback, covered in `test/drift.test.mjs`); four
  end-to-end suites (`test/e2e/`) that drive the shipped runtime — not a mock of it —
  against small fixture repositories for binding resolution, drift observation, bootstrap migration,
  and a security finding attributed to a real scanner; `test/approval-gate.test.mjs` proving
  `promote` is the only path to `active` and naming the explicit limit of that guarantee; and
  `docs/release-checklist-0.4.0.md`, the previously-external pre-release checklist as a committed,
  per-line-audited artifact.

## Sub-project → version → release-doc mapping

This upgrade was originally planned around the build order SP2 → SP4 → SP5 → SP3 → SP6, with SP4 and
SP5 targeting `0.3.3` and `0.3.4` respectively. In practice SP3 (the drift-observation loop) shipped
ahead of SP4 and SP5, and `0.3.3`/`0.3.4` were never cut — the version that actually followed `0.3.2`
was `0.3.5`. The table below is the authoritative shipped record; `docs/superpowers/plans/` and
`docs/superpowers/specs/` reflect the original plan and carry an erratum pointing back here.

| Sub-project | Shipped as | Release doc | Shipping commit |
|---|---|---|---|
| SP2 — deterministic compliance checkers | `0.3.2` | `docs/release-0.3.2.md` | `e4fe770` |
| SP3 — drift-observation loop | `0.3.5` | `docs/release-0.3.5.md` | `012b5a4` |
| SP4 — migration and bootstrap | `0.3.6` | `docs/release-0.3.6.md` | `ac6bea1` |
| SP5 — the security skill (`threat-model`) | `0.3.7` | *(rolled up here — no standalone `release-0.3.7.md`)* | `bfb8ade` |
| SP6 — release hardening | `0.4.0` | `docs/release-0.4.0.md` (this document) | — |

**One commit subject carries a wrong version string and cannot be amended:** `ac6bea1`'s subject is
"Migration and bootstrap: propose decisions from an undocumented repo (0.3.3)" — written against the
plan's original `0.3.3` target before the build order changed. `package.json` at that commit already
reads `"version": "0.3.6"`, which is what actually shipped; the subject's `(0.3.3)` is a historical
artifact of the reordering, not a second, disagreeing release. Rewriting a shipped commit's subject
is not something this project does after the fact, so it stands uncorrected — this table is the
correction.

## New capabilities

- `node runtime/checkers/check-rules.mjs --dir <decisions-dir> [--run] [--require-tools]` — resolve
  or evaluate every deterministic rule's binding.
- `node runtime/drift/drift.mjs status|drain|discard --root .` — inspect or drain the drift queue.
- `node runtime/migration/discover-candidates.mjs` and
  `node runtime/migration/build-migration-report.mjs` — propose and trace a first baseline.
- `node runtime/baseline/build-constitution.mjs promote NNNN [NNNN ...]` — the only path from
  `status: proposed` to `active`.
- `arch-crew:threat-model` — the fifth skill, invoked like the other four.

## Breaking changes

None to any explicit action a user takes. The four original skills' `name`/`description` frontmatter
is byte-identical to their 0.3.1 values (`test/skill-freeze.test.mjs`); every checker, drain, and
migration capability above is additive and invoked only on request. The one caveat: installing the
Claude Code package registers three hooks (`SessionStart`, `PostToolUse`, `Stop`) that run
automatically from the first session after install, not on request — see Compatibility below for
exactly what they do and the one manual step upgrading users should take.

## Known limitations

Carried into 0.4.0 from earlier sub-projects, plus what this release adds:

- Nothing mechanically prevents a hand-edited `status: active` outside `promote`
  (`test/approval-gate.test.mjs`'s last case; unchanged from 0.3.1).
- Proposed-file accumulation from reverse discovery has no staleness sweep (unchanged from 0.3.1's
  own accepted risk).
- `oasdiff` resolves against a vendored check-id list, never a file in the repository — the weakest
  of the seven checker adapters' guarantees (0.3.2).
- `pytest-archon` can only prove a same-named test function exists, never that its body asserts
  anything; the evidence string says so on every row (0.3.2).
- `ast-grep --run` is not implemented; it always reports `unavailable` under `--run` (0.3.2).
- The model classifying `review` rules is the weakest link in the drift-observation loop. It is
  mitigated — the four-part evidence gate, `judgement` as data that forbids classification on
  anything a tool already settled — but not eliminated: a `review` rule's finding is still,
  ultimately, a model's read of a diff (0.3.5).
- The drift queue's marginal value over `git status --porcelain` is modest by design, and a
  one-unlink-wide window exists in which a crash mid-drain could double-report the single most
  recent drained slice (0.3.5).
- The judgement half of each end-to-end scenario (drift classification quality, migration duplicate
  detection, security-control adequacy) is graded by agent-driven runs, never by a deterministic
  check — by design, not a gap.
- The clean-install procedure and the `gitleaks` package-content audit are by-hand, once-per-release
  steps, not wired into CI (`docs/building-packages.md`).
- The agent-driven, fresh-session re-run of all five scenario sets against the 0.4.0 branch
  (`docs/validating-skills.md`'s re-run table) is a manual step outside this task's automation; its
  results live under `test-runs/0.4.0/` (gitignored) and the committed finding is
  [`docs/release-gate-0.4.0.md`](release-gate-0.4.0.md). **That re-run was performed on 2026-09-10
  and failed** — 26 of 45 graded scenarios, 3 of 48 ungraded, `security.json` 0 of 11 in sessions
  where `threat-model` was not loadable — so `docs/release-checklist-0.4.0.md`'s final decision is
  recorded **NO-GO** and this version is not tagged. These release notes describe what is built on
  the branch, not a shipped release.

## Compatibility

The four original skills' triggering, greenfield/refactoring branching, and output contracts are
unchanged. `threat-model` is new and additive. A repository already using the 0.3.1 baseline gains
every checker, drain, and migration capability above opt-in: nothing runs a checker, proposes a
migration, or invokes `threat-model` unless asked to. Plugin identity, namespace, and the Claude
marketplace façade are unmoved.

The one capability that is **not** opt-in on the Claude Code target is drift *observation* (not
drift *review*): installing the package registers a `SessionStart` hook that injects the active
constitution's rules, a `PostToolUse` hook that appends every edit to a local queue, and a `Stop`
hook that reports the queue's size. All three are non-fatal by construction and confined to a
`.arch-crew/` directory they create in the repository root — no drift finding can fail a build
(`runtime/drift/drift.mjs`'s exit codes never exceed 1), and nothing is graded or reviewed until a
human or the model explicitly runs the drain (`shared/observing-drift.md`). Codex has no hook
mechanism and is unaffected; it only ever observes drift when the drain is run against git directly.

## Upgrading from 0.3.x

No action is required to keep existing behaviour. To use the new deterministic-checker lane, bind
real `verified_by` values on your rules — the capture step (`shared/recording-decisions.md`) already
tells the model to do this. On Claude Code, reinstalling the plugin also turns on the drift-observation
hooks described above: **add `.arch-crew/` to this repository's `.gitignore`** — arch-crew creates the
directory but never edits your `.gitignore` for you, and `node runtime/drift/drift.mjs status --root .`
prints the same reminder every time it runs. Codex users get the same drain from
`runtime/drift/drift.mjs`, run against git, with no hook install step and nothing written locally
until `drain` is invoked. To bootstrap or consolidate a baseline for the first time, see
`shared/migrating-decisions.md`.

## Verification

A reviewer can run, from the repository root:

```sh
npm run build -- --target all
npm test
npm run sync:check
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check
node runtime/checkers/check-rules.mjs --dir docs/architecture/decisions
node runtime/drift/drift.mjs status --root .
```

And confirm the reserved version string now appears — this release inverts every prior release's
empty-grep check:

```sh
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/
```

This must return at least one match in each of: `package.json` (the `version` field), the two
generated manifests it propagates into (`build/claude/.claude-plugin/plugin.json` and
`build/codex/.codex-plugin/plugin.json`, under `build/`), `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json` (the root façade and its mirrored manifest), and, under `docs/`,
this release doc and `docs/release-checklist-0.4.0.md`. Every other `docs/` hit is a plan, spec, or
prior release doc's historical mention of `0.4.0` as the reserved target — expected context, not a
stray leftover; a reviewer distinguishes the two by checking that every hit resolves to one of the
files just named or to prose describing the reservation, not to a version field left unbumped.
