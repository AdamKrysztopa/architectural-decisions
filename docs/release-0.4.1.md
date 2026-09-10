# Release 0.4.1 — one front door, and four defects the first real consolidation found

## What shipped in 0.4.1

Two deliverables, both additive. Every 0.4.0 skill, command, runtime verb, hook, config and approval
gate is unchanged, and nothing was renamed or removed.

- **`/arch-crew`, the public front door.** One command that reads a user's intent in their own words,
  works out which existing capability owns that outcome, and *enters it*. It is an orientation and
  dispatch layer, not a sixth crew member: it reimplements nothing, moves no responsibility out of
  any skill, and carries no authority of its own. With no intent, or `help`, it renders a short
  capability map grouped by what a user might want to accomplish, coloured by what this repository
  already has.
- **Four defect fixes from a twelve-ADR consolidation.** The first end-to-end run of the 0.4.0
  migration path by a user who was not its author: twelve prose ADRs in `docs/adr`, twelve decisions
  carrying 127 rules, a mode switch to `living`, two promotions and four designated sources. It
  worked end to end. Four things went wrong on the way, and all four are fixed here with the test
  that would have caught them.

## The four defects

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | `arch candidates` printed "No candidates found" for a directory full of ADRs | `ADR_SHAPED` accepted only `NNNN-slug.md` or a name containing "adr"; the user's set was `000-`…`010-` | Every `*.md` in a known ADR directory, minus `constitution.md`, `migration-report.md`, `README.md`, `template.md`. Excluded by **name**, never by shape |
| 2 | 2,394 candidate-conflict lines in one migration report | Pairing is quadratic in broadly scoped rules, and identically scoped rules were paired with each other | Identical scopes are shared ground by construction and are no longer paired; past a cap of 20 the rest become a per-decision-pair tally |
| 3 | `arch constitution` wrote a generated file into a directory of authored documents | The living-mode rollup path was fixed at `dirname(documents[0])`, and `--dir` did not move it | `documentation.rollup` in `arch-crew.json`, also settable with `arch mode --rollup`. Unset, both per-mode defaults are unchanged |
| 4a | 25 em dashes in a report whose banner says never to hand-edit it | `renderTraceabilityReport` used them in its own fixed prose | Its own strings use a comma or a colon. Text that came from the human passes through unchanged |
| 4b | Designating four sources printed ten entry blocks | `sources add` returned `list(cwd, {})` | One confirmation line, plus one line and exit 3 if the write created a conflict. `sources change` had the same defect and is fixed with it |

Defect 1 is the blocking one: `/arch-migrate` opens with that listing and then asks the user to
confirm a subset of it, so an empty listing left nothing to confirm and the whole consolidation path
was unreachable without a hand-written manifest. The empty result was also indistinguishable from a
repository that genuinely records nothing, because exit 0 is the documented contract for that case.

## The front door

`commands/arch-crew.md` is the whole feature, plus one deterministic verb it stands on.

**Routing.** An ownership table keyed on the outcome the user wants, not on keywords — the door
routes on meaning, and an intent matching no row still belongs to whichever capability owns that
outcome. Once routed, deterministic behaviour stays deterministic: the door never classifies drift
itself, never decides a pattern question, never resolves a rule binding.

**Entering, not announcing.** "Review this branch for drift" begins the drift workflow in the same
turn. A second arch-crew command is required only where the capability itself demands a separate
human act: promotion, designating a source, choosing a documentation mode.

**Three things it must not lose**, each stated in the command and pinned by a test:

1. Help stays cheap. Answering "what can you do?" reviews nothing, drains nothing, reads no decision
   file, spawns no checker. Typing `/arch-crew` is not consent to a repository-wide review.
2. The drift classification survives routing. Code differing from documentation is not by itself a
   defect; the five classes (violation, suspected drift, insufficient evidence, legitimate
   evolution, stale or contradictory documentation) and the evidence gate belong to the classifier,
   and a deliberate divergence enters as a candidate for legitimate evolution.
3. Routing carries no authority. Choosing a destination never promotes a decision, supersedes an
   active one, edits the human record, changes the documentation mode, designates or removes a
   source, or regenerates a tracked file. Every gate inside the entered capability is intact.

**`arch status`** (`runtime/baseline/status.mjs`) is the one command the door pre-executes, before it
has read a word of the intent: documentation mode, where the human record lives, whether the rollup
is current, active and proposed counts, designated sources, queued observations, and at most a few
`Next:` lines. Every number comes from a file this package already owns. It imports `node:fs/promises`,
`node:path` and `node:url` and nothing else — `test/router.test.mjs` asserts that list exactly, because
a status command that shelled out to a real tool would be the expensive thing help may not do. It is
agent-neutral (its `Next:` lines name `arch` verbs, never slash commands), so the Codex package ships
it unchanged.

## The naming finding

Claude Code namespaces plugin commands as `<plugin>:<file>`, so the door resolves as
`arch-crew:arch-crew`. A bare, unnamespaced `/arch-crew` is not something a plugin can claim. The
file name is nonetheless unique across all eight commands, so `/arch-crew <intent>` is an exact name
match and is what the documentation teaches.

**No `/arch` alias.** No repository reason exists for one, and `arch` is already the name of the
shell dispatcher — a different surface, with a different job. Conceptually: `arch <verb>` is the
deterministic CLI, `/arch-crew <intent>` is the conversational front door, and the latter may decide
that one of the former's verbs is the right action.

## Validation

- `npm test`: 423 tests, 0 failures (386 at 0.4.0). 15 new tests across `test/migration.test.mjs`,
  `test/documentation-mode.test.mjs` and `test/authoritative-sources.test.mjs` for the four defects;
  18 in `test/router.test.mjs` for the door and `arch status`.
- `npm run sync:check` clean; `arch constitution --check` clean; both targets rebuilt.
- `test/scenarios/router.json` is the sixth scenario set and the first that grades a **command**.
  Eighteen scenarios, every one of the fifteen routing destinations exercised, and exactly one
  scenario permitted to write.
- The set was **run before this release was raised**: 18 of 18 routed to the capability that owns the
  outcome, with two findings, both fixed and both pinned by tests. Finding 1: a request to check
  dependency boundaries went straight to `/arch-check --run`, spawning the repository's real
  third-party tools unasked — the door now offers `--run` rather than assuming it. Finding 2: "make
  this decision active" was held at the door for an id `/arch-promote` asks for itself — the door now
  says a missing detail is not ambiguity. The run, its two re-runs, and the fidelity limits of how it
  was carried out are in [`test-runs/0.4.1-router/`](../test-runs/0.4.1-router/).

## Sub-project → version → release-doc mapping

| Sub-project | Version | Release doc |
|---|---|---|
| SP6 — release hardening | `0.4.0` | `docs/release-0.4.0.md` |
| Post-0.4.0 defect fixes + the front door | `0.4.1` | `docs/release-0.4.1.md` (this document) |
