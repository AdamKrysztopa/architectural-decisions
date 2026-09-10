# Migration and Bootstrap — design

**Date:** 2026-09-09
**Status:** proposed (design)
**Scope:** sub-project 4 of the arch-crew upgrade
**Target version:** 0.3.3
**Build order:** SP2 → **SP4** → SP5 → SP3 → SP6 (`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md`, C1).
SP2's checker registry (`runtime/checkers/`) exists when this sub-project is built; SP3's drift loop
does not.

## Why

SP1 gave `arch-crew` a memory, but only for decisions made *from here on*. Two kinds of repository get
nothing from it:

- One that already has architectural decisions, recorded as prose — Nygard, MADR, or a bespoke house
  format — with real reasoning nobody wants to lose or rewrite.
- One that has never recorded a decision at all. The rules the codebase actually follows exist only
  as regularities in the code, discoverable but not yet said out loud.

Both need a path to a first baseline that does not fabricate history, does not touch what already
exists, and does not let a human's review queue silently become the mechanism that decides what
counts as "the architecture." This sub-project is that path: **consolidation** for the first case,
**reverse discovery** for the second, sharing one runtime and one shared reference.

It is also where a real limitation from the 0.3.1 release gets fixed. See "Resolving the dual-artifact
limitation" below.

## Decisions taken

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| D1 | Migration and bootstrap are **not a fifth skill**. One new shared reference, `shared/migrating-decisions.md`, fans into all four skills' `references/` exactly as `recording-decisions.md` does (D7, SP1) | A dedicated skill (reserved for SP5's security skill by user decision); a mode bolted only onto `decide-architecture` |
| D2 | A run operates only over an **explicitly confirmed list of inputs** — paths for consolidation, code scopes for reverse discovery — echoed back before anything is written. Nothing is adopted by scanning | Whole-directory conversion; auto-adoption of anything matching a glob |
| D3 | Duplicate/overlap/contradiction detection is **split by who can decide**: structural facts are mechanical and always reported; substance judgements are the model's and are always `proposed`, never auto-applied | Auto-merge; auto-supersede; a single "conflict score" |
| D4 | Approval reuses the **existing gate** — `status: proposed`, rollup filters to `active` — with **zero new gate**. A `promote` CLI verb is added as an auditable convenience over that same gate, not a second one | A distinct migration-approval flag or file; leaving promotion entirely prose-only |
| D5 | The traceability report is **generated, not `--check`ed**, and is invalid unless it is exhaustive over its declared inputs | A `--check`ed rollup; a coverage percentage |
| D6 | Reverse discovery's evidence-gathering reuses a small **zero-dependency glob/pattern-occurrence helper**; every rule it proposes starts at `verification: narrative`; raising it is a distinct, later, human act | A model judgement standing in for a tool; auto-raising verification because a config file happens to exist |
| D7 | One reverse-discovery pass may propose **at most 20 decisions**; more forces ranking | Uncapped, relying on review discipline alone |
| D8 | The **dual-artifact limitation is resolved**: all four skills' two persistence steps (prose ADR + schema capture) collapse into one write — the schema decision file, whose prose already carries the ADR shape | Keep both artifacts and only cross-reference them (0.3.1's partial mitigation, as `test-patterns` alone did); a converter that turns the prose file into the schema file after the fact |

## Departures from `2026-09-09-upgrade-decisions-sp2-sp6.md`

Flagged per that document's own rule — these are refinements of [ASSUMED] items, not overrides of
anything [SETTLED]:

1. **Orphan detection (Q4.2) is redefined as mechanical.** The decisions doc lists "a prose ADR whose
   subject no active schema decision covers" under the *mechanical* bucket, but subject-matching is
   semantic. This spec keeps orphan detection genuinely tool-only by defining it as a **traceability
   completeness check**: every confirmed input must have exactly one disposition, and a `migrated` /
   `merged` disposition's target decision must cite the input's path in its own `## Sources` section.
   An input with no disposition, or a disposition whose target doesn't cite it, is the orphan. This is
   string matching over declared structure, not "do these mean the same thing."
2. **Packaging shape (A17's silence on it) is concretized**: one shared reference fanned into all four
   skills, not a new skill and not a single owning skill. See D1.
3. **The cap (A18) is given a number: 20.** The decisions doc left it open.
4. **`runtime/baseline/decisions.mjs`'s `parseDecision` gains one field, `body`**, on the returned
   object (previously discarded after the `# Title` heading was pulled out of it). This is additive
   and backward-compatible — no existing caller reads a `body` key today — and is what makes the
   `## Sources` check in departure 1 possible without a second parser.
5. **The dual-artifact limitation is resolved**, not merely narrowed, per the task that produced this
   spec — see below.

## Resolving the dual-artifact limitation

0.3.1 shipped a real duplication (`docs/release-0.3.1.md`, "Known limitations", last bullet): a
greenfield run writes a prose ADR to `docs/adr/NNNN-slug.md` (each skill's own "Recording the outcome"
step, pre-dating the baseline) **and** the capture step writes a schema decision file to
`docs/architecture/decisions/NNNN-slug.md` (SP1's "Record the decision" step). Independent numbering,
no cross-reference except a sentence `test-patterns` alone carries.

The user's first binding decision for this upgrade — "decision files are the ADR mode, the
Constitution is their generated view" — settles this by implication: a schema decision file's body is
already `# Title` / `## Context` / `## Decision` / `## Consequences (cost)`, which *is* the MADR shape
every skill's prose-ADR template already uses, with `status`, `date`, and a stable identity carried in
frontmatter instead of a `- Status: Accepted` bullet. **There is no longer a reason to write two
files.** SP4 collapses each skill's "Recording the outcome (write the file)" and "Record the decision"
sections into one:

- Read the constitution first (unchanged).
- Determine the decisions directory the same way the generator does (unchanged — discovery, not a new
  rule).
- Write **one** file: the schema decision, `status: proposed`, with the same Context/Decision/
  Consequences prose the skill already composes, plus `rules:` classified honestly.
- Regenerate the constitution.

No skill writes to `docs/adr/` for a *new* decision after this ships. Existing files already there are
untouched — they become exactly what consolidation exists to handle, on request, later. This is a body
edit to all four `SKILL.md` files (frontmatter untouched), and it is the one piece of this sub-project
that is not "migration" or "reverse discovery" in the literal sense — it is prevention, and the task
prompt that scoped this sub-project names it as the natural place to do it.

**What SP4 does not do:** it does not retroactively convert every repository's existing
`docs/adr/*.md` files. Those are exactly what "explicitly selected inputs" (D2) exists for — a human
chooses which ones matter enough to bring into the schema, one at a time, on their own schedule.

## Part A — Consolidation

*Turn an explicitly selected set of existing ADRs — prose, MADR, Nygard, whatever — into schema
decision files, without touching the originals.*

### What "explicitly selected inputs" means mechanically

1. A **listing helper** (`runtime/migration/discover-candidates.mjs`) walks the same four candidate
   directories `build-constitution.mjs` already knows (`docs/adr/`, `docs/architecture/decisions/`,
   `doc/adr/`, `adr/`) and returns filenames that are *shaped* like an ADR — `NNNN-slug.md`, or any
   name containing "adr". **It reads no content and classifies nothing.** This is the only thing SP4
   runs before the user has said anything — a menu, never a decision.
2. The skill presents that list to the user. **The user confirms or edits it.** Anything not on the
   confirmed list plays no further part in the run — the model does not read it "just to check," and
   if it wants to, it asks for the path to be added to the list first.
3. The confirmed list, verbatim, is what every downstream mechanical step operates over
   (`classify-inputs.mjs`, `traceability.mjs`). There is no code path that takes a directory and
   produces output — every entry point takes a list of `{ path, text }` pairs the caller already read.
4. Every generated decision's prose carries a `## Sources` section naming the exact input paths it was
   derived from and the repository commit at the time. Frontmatter is **not** extended for this — no
   `evidence` field, matching 0.3.1's deliberate omission; prose is where reasoning and provenance both
   live.

### Detecting current / superseded / duplicated / conflicting decisions

Split strictly by who can decide, and the split is enforced by which module the check lives in — a
model cannot accidentally get mechanical authority, because the mechanical functions take no model
input at all.

**Mechanical (`runtime/migration/classify-inputs.mjs`), no model, always runs:**

| Check | How | Reused from |
|---|---|---|
| Duplicate decision numbers, duplicate rule ids, dangling `superseded_by` | `validateDecisions()` over every confirmed input that parses as a schema decision | `runtime/baseline/decisions.mjs`, unchanged |
| Overlapping `scope` globs across rules in *different* decisions | `scopesOverlap()` — a conservative, zero-dependency check: two non-empty scope lists "overlap" when either's static (non-wildcard) path prefix is a prefix of the other's. False positives are acceptable — the result is a **candidate**, never an assertion; false negatives are not, so the check is deliberately loose | New, `runtime/migration/glob.mjs` |
| Traceability completeness (this spec's redefinition of "orphan") | Every confirmed input has exactly one disposition; a `migrated`/`merged` disposition's target decision cites the input's path in its own `## Sources` | New, `runtime/migration/traceability.mjs` |

**Judgement (the model, in the skill run), always produces something `status: proposed`, never
auto-applied:**

- Whether two prose ADRs say the same thing (candidate for `merged into NNNN`).
- Whether one ADR supersedes another in substance when neither file says so (candidate for
  `superseded by NNNN` — the model proposes a *new* decision that states the supersession; it does not
  set `status: superseded` on the old file itself without a human accepting that proposal in review).
- Whether two rules the mechanical scope check flagged as a candidate genuinely contradict, merely
  overlap on purpose, or aren't actually related once read.

**Never, under any circumstance:** an existing document's `status` is set to `superseded` by
migration, and no existing document's prose is edited. Both are enforced the same way capture already
enforces them (`shared/recording-decisions.md` §4) — by being the only thing the shared reference
instructs, and by `classify-inputs.mjs` never accepting a write target that already exists with content
other than what the caller passed in.

### The traceability report

One generated file, `docs/architecture/migration-report.md`, with a do-not-edit banner. **Not
`--check`ed** — SP1's own generator pattern doesn't apply here, because this is a point-in-time record
of one run, not a rollup that must track its inputs forever the way the constitution tracks decision
files.

It is **invalid, and the CLI refuses to write it**, unless every one of these holds:

1. **Every confirmed input has exactly one disposition**: `migrated → NNNN`, `merged into NNNN`,
   `left as prose (reason)`, `superseded by NNNN`, `unmapped (reason)`. This is `buildTraceability()`'s
   whole job (see Task 3) — it throws, naming the path, on the first input that lacks one or carries
   two.
2. **Every generated decision is listed**, with the input paths it came from (the inverse view of #1,
   for a reader who wants to start from the output instead of the input).
3. **Every generated rule is listed** with its `verification` class, and, for `deterministic` rules,
   the SP2 resolution result obtained by calling into `runtime/checkers/` — so the report cannot claim
   an enforcement it does not have. A rule inherited from an existing ADR that already claimed
   `deterministic` is re-resolved, not trusted.
4. **Gaps in both directions**: subjects observed in the code with no decision (from reverse
   discovery's evidence, if this run did any), and decisions with no code footprint the run could find.
5. **What was deliberately left out**, with the reason — including anything the confirmed list left
   off the menu.

**No score, no percentage, no coverage number**, anywhere in the report — the same rule
`docs/validating-skills.md` and the consolidated review table already apply everywhere else in this
project.

## Part B — Reverse discovery

*Inspect an undocumented codebase and propose a baseline from what is actually there.*

### Separating observed fact from inferred intent

The schema already draws this line; reverse discovery's only job is to use it honestly, per Q4.4 of
the decisions document, which this spec implements without change:

- **A regularity in the code is not a rule.** "Every module currently obeys X" is the codebase acting
  as its own oracle — `skills/test-patterns/references/oracles.md`'s defect, one level up. It is a
  **characterization**: valid as a scaffold, invalid as a specification, and it expires.
- **Every rule reverse discovery proposes starts at `verification: narrative`.** It may be raised to
  `deterministic` only later, by a human, after `runtime/checkers/` (SP2) actually resolves a binding
  against a contract that **already existed** in the repo before this run touched it — never because
  reverse discovery itself found a config file and inferred the rule was meant to be enforced. It may
  be raised to `review` only when a human confirms the intent. Neither raise happens automatically or
  in the same run that proposed the rule — this mirrors D6/D4's "a human promotes" shape one level
  down, at the field instead of the file.
- **Placement in the file carries the distinction, not a frontmatter flag.** `## Context` states what
  was observed and *how* — the scope inspected, the pattern checked, the counts, the exceptions.
  `## Decision` states what a human must confirm as intended. The observation is evidence in prose; the
  intent is the rule.
- **Exceptions are load-bearing.** "47 of 51 modules follow this" is the finding; "modules follow this"
  is not. `runtime/migration/inventory.mjs`'s `countPatternOccurrences()` returns both the matches and
  the exceptions, and the shared reference requires both in the `## Context` prose — a discovery pass
  that reports only the regularity has hidden its own counter-evidence.

### Mechanical evidence-gathering

`runtime/migration/inventory.mjs` provides one function, `countPatternOccurrences(root, scopeGlob,
pattern)`: walk the files under `scopeGlob` (using the same `matchGlob()` from `glob.mjs`), test each
against a literal string or `RegExp`, and return `{ total, matches, exceptions }` — file lists, not a
verdict. It never proposes a rule; it produces the count a rule's `## Context` cites. This is the only
new filesystem-walking code in this sub-project, and it is deliberately narrow: one pattern, one scope,
one pass. It is not a static-analysis engine, and it must not grow into one — a repository that needs
real static analysis has SP2's checker adapters for that.

### The cap

**One reverse-discovery pass may propose at most 20 decisions.** `build-migration-report.mjs`
enforces this mechanically: it counts the `status: proposed` decisions this run's manifest disposes as
`migrated` or `merged`, and refuses to write the report — exit `1`, nothing written — above the cap.
The pass must rank and say, in the report's "deliberately left out" section, what it dropped and why.
This is 0.3.1's own accepted risk ("proposed-file accumulation") made concrete: reverse discovery is
the feature most likely to realize it, and forty unreviewed files is a baseline nobody promotes.

## How approval is enforced before a baseline is replaced

**There is nothing to invent.** SP1 already made replacement impossible in the ordinary sense — decision
files are append-and-supersede, the constitution is generated from `active` ones only, and
`renderConstitution()`'s filter is the entire gate. A migration or discovery pass that proposes forty
files changes `constitution.md` by **exactly zero bytes** until a human promotes something, and that
was already true before this sub-project existed.

What SP4 adds is a `promote` verb on the existing CLI — `node runtime/baseline/build-constitution.mjs
promote 0007 0009 [--dir <path>]` — that flips `status: proposed` to `status: active` on the named
decisions by rewriting **exactly the `status:` line**, never any other byte of the file, then
regenerates the constitution in the same invocation. It is not a second gate: the gate is still "is
`status: active`, and did a human make that true." What changes is that a model has no reason to hand-
edit the field directly, so a diff showing `status: active` outside a `promote` invocation stays the
reviewable smell the SP1 spec already relied on. **This does not make promotion model-proof** — a model
can still write the field by hand — and this spec must not claim otherwise, exactly as the decisions
document requires (Q4.5).

## Packaging

Two additions, both mechanical given what SP1 already built:

- **`runtime/migration/`** — a new subsystem directory. Ships to both targets automatically:
  `runtime/` is already an allowlisted `canonicalRuntime` tree copied byte-identically by both
  adapters (C2 of the decisions document). No adapter change, no `agentPackaging` change.
- **`shared/migrating-decisions.md`** — a new entry in `builders/sync-shared.mjs`'s `SHARED` array,
  fanned into `skills/*/references/migrating-decisions.md` and committed, exactly as
  `recording-decisions.md` was in SP1. `requiredReferences` in `test/build.test.mjs` gains a third
  entry, and each `SKILL.md` body gains one short pointer paragraph — **not** a change to any
  `name`/`description` frontmatter.

Version → **0.3.3**. New capability plus new runtime verbs (`promote`, the migration CLIs); the four
skills' triggering is unchanged, so this is a patch, matching the reservation of `0.4.0` for SP6.

## Validation

**Layer 1 — package contract**, `test/migration.test.mjs` (new) over `test/fixtures/migration/`,
following `test/baseline.test.mjs`'s three house patterns: golden-file comparison for the traceability
renderer, shuffled-input-order-produces-identical-output for the same renderer, and a failure case that
fails loudly naming the offending path rather than being silently misread. `test/build.test.mjs` gains:
the shared-reference sync assertion for `migrating-decisions.md`; the runtime inventory now includes
`runtime/migration/*`; the frontmatter-freeze check (already asserting `name`/`description` byte-
identity) continues to pass unmodified, since this sub-project only ever edits skill bodies.

**Layer 2 — force-driven scenarios**, `test/scenarios/migration.json` (new), same discipline as
`baseline-capture.json`: forces in, gate outcomes out, no numeric scoring. Ten scenarios, including the
three outcomes easy to lose per C4 of the decisions document — a **refusal** (a user asks to convert a
whole directory at once; the skill declines and asks for per-file confirmation), an **insufficient-
evidence** case (reverse discovery over a codebase with no discernible regularity; the honest output is
"nothing to propose," not an invented narrative), and a **no-change** case (a repository whose existing
"ADRs" already are schema decisions; migration has nothing to do and says so).

## Out of scope

Everything SP2, SP3, SP5, and SP6 own. Specifically: resolving a `verified_by` binding is SP2's
`runtime/checkers/` — SP4 *calls* it for the traceability report but implements no checker of its own.
Hooks, the drift queue, and the drain classifier are SP3's. A security-specific rule or binding
vocabulary is SP5's. Automatic conflict resolution, automatic supersession, a mode-switch or a second
renderer for the constitution (explicitly withdrawn — decision files are the only ADR mode), a
persisted migration-run history or undo log, and any general-purpose static-analysis capability beyond
`countPatternOccurrences()`'s single pattern/single scope walk.

## Risks

- **Reverse discovery over-proposing.** Mitigated by the cap (D7) and by the requirement that every
  rule start `narrative` — even a wrong regularity costs nothing to have proposed, because nothing
  reads a `proposed` rule as enforced.
- **The scope-overlap check's false positives.** Deliberately loose (a candidate, never an assertion),
  so a repository with many legitimately overlapping scopes will see noise in the traceability report.
  Accepted: the report is a human-read document, not a gate, and the alternative (a tighter check) risks
  the false negative this feature exists to prevent.
- **`parseDecision`'s new `body` field is a shared-module change.** Touches `runtime/baseline/
  decisions.mjs`, which SP1, and now SP2's checker report generation and SP3's drain (when built) may
  also read. Mitigated by additivity — no existing consumer reads a key that did not previously exist —
  and by `test/baseline.test.mjs` continuing to assert the existing return shape unchanged.
- **Collapsing the dual-artifact write touches all four `SKILL.md` bodies again**, the same class of
  risk SP1's own spec named for its own capture-step edit. Mitigated the same way: frontmatter
  untouched, and the scenario layer must run before release.
- **`promote` looks more authoritative than it is.** A CLI verb reads as "the mechanism," and the spec
  must keep saying, everywhere it's mentioned, that hand-editing `status: active` still works. This is
  a documentation discipline risk, not a code risk.
