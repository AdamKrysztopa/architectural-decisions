# Architectural Baseline — design

**Date:** 2026-09-09
**Status:** approved (design)
**Scope:** sub-project 1 of the arch-crew upgrade
**Target version:** 0.3.1

## Why

`arch-crew` currently has no memory. Every skill run reasons from scratch, and the decision it
produces — the composed stack, the chosen pattern, the evidence portfolio, and the *cost of each
pick* — is lost when the session ends. Six months later nobody can say why the system is shaped the
way it is, and nothing can tell whether the code still matches the decision.

This sub-project gives the crew a durable, machine-readable record of the decisions it makes: the
**Architectural Baseline**.

## Decomposition

The full upgrade is six subsystems. They are sequenced, not built together, because the latter five
are all consumers of the first:

1. **Baseline artifact + rule metadata** ← this spec
2. Deterministic compliance checkers (import-linter / pytest-archon, dependency-cruiser, Semgrep,
   oasdiff, gitleaks)
3. Drift-observation loop (SessionStart injection, PostToolUse queue, drain-at-checkpoint)
4. Migration skill (ADR consolidation; reverse discovery)
5. Security extension (trust boundaries, authZ, agent/tool agency)
6. Rollup of the above into docs and examples

Each gets its own spec → plan → implement cycle. Nothing in 2–6 is designed here beyond the seams
this spec must leave open.

## Decisions taken

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| D1 | The four existing skills persist their own output; the baseline is the crew's memory | A separate baseline-owning skill; human-only authoring; discovery-first |
| D2 | One directory, one file per decision | One file per skill; a single `ARCHITECTURE.md` |
| D3 | The Constitution is a **generated rollup** of the decision files | Two selectable modes (ADR vs Constitution); index-only |
| D4 | Ship a zero-dependency Node generator | Model-generated rollup; assemble-on-demand; Python |
| D5 | A rule binds to a checker the repo already owns (`verified_by`) | A tool-agnostic constraint DSL; classification only |
| D6 | Capture writes `status: proposed`; a human promotes it | Propose-in-chat-then-write; explicit-request-only |
| D7 | Capture logic lives in one canonical shared reference, fanned out by the builder | A fifth hand-off skill; inlined in all four |

## On-disk contract (consuming repo)

```
docs/architecture/decisions/0004-events-over-shared-db.md   # source of record
docs/architecture/constitution.md                           # generated, do-not-edit banner
```

**Discovery, not configuration.** The generator looks for an existing ADR directory in order:
`docs/adr/`, `docs/architecture/decisions/`, `doc/adr/`, `adr/`; failing that it creates
`docs/architecture/decisions/`. `--dir` overrides. There is no config file in v1 — one is warranted
when a second thing needs configuring, and nothing does.

Decision files are numbered `NNNN-slug.md`, matching the convention this repository already uses
(`docs/adr/0001-agent-agnostic-packaging.md`), so arch-crew dogfoods on its own ADRs.

A decision file is **frontmatter + prose**, and the split is strict: frontmatter holds only what a
machine acts on, prose holds the reasoning. No tool ever rewrites the prose.

```markdown
---
id: 0004
status: proposed          # proposed | active | superseded
skill: decide-architecture
date: 2026-09-09
commit: aa1ca89
rules:                    # see “Rule metadata schema” below
---
# Events over a shared database

## Context
## Decision
## Consequences (cost)
```

Supersession is `status: superseded` on the old file plus `superseded_by: 0011` — never deletion,
never an edit to the original's prose. The rollup drops it; git keeps it.

## Rule metadata schema

A decision carries zero or more rules. The decision is the story; a rule is its enforceable residue.

```yaml
rules:
  - id: no-shared-db-writes          # stable slug, unique repo-wide, never renumbered
    statement: Services must not write to another service's tables.
    scope: ["services/**"]           # globs, or module names
    severity: blocking               # blocking | warning
    verification: deterministic      # deterministic | review | narrative
    verified_by: import-linter#svc-db-isolation   # required iff deterministic
```

`verification` is load-bearing. Each value is a promise about what may check the rule:

- **`deterministic`** — a tool proves it. `verified_by` is **required** and names a contract in the
  repo's own tool config. A rule may not claim `deterministic` without a binding. This is what stops
  the baseline filling with rules everyone believes are enforced and none are.
- **`review`** — needs judgement; sub-project 3's drain step may grade it. A soft signal, and
  consumers know it.
- **`narrative`** — intent, not a rule. Explicitly **unverifiable**; consumers are forbidden from
  grading compliance against it. It exists so "we chose events because the team is distributed" has
  a home that never becomes a fake check.

Provenance rides on the decision (`skill`, `date`, `commit`), not on each rule. The generated
constitution records the git SHA of the decisions directory it was built from — that is the baseline
version, so "which baseline did CI check against" has an auditable answer with no hand-maintained
version field.

**Deliberately omitted:** `owner` and `evidence`. Neither has a consumer in any scoped sub-project.

## The generator

Canonical source at `runtime/baseline/`, sibling to `skills/`, shipped per target by the builder.

```
node <plugin-root>/runtime/baseline/build-constitution.mjs          # regenerate
node <plugin-root>/runtime/baseline/build-constitution.mjs --check  # CI: exit non-zero, write nothing
```

`--check` is what makes the artifact real: it fails when the committed constitution is not
byte-identical to a fresh build, so a decision file cannot be edited without the rollup following.
That demands deterministic output — rules sorted by id, decisions by number, no timestamps in the
body.

**Zero-dep means writing our own frontmatter parser, and the honest way is to not implement YAML.**
The schema is fixed and small, so the parser accepts a documented subset — scalars, string lists,
and one level of list-of-maps — and hard-fails with a line number on anything outside it. A
half-YAML parser that silently misreads an anchor is worse than no parser.

Validations:

1. frontmatter parses within the subset; required fields present; enums legal
2. rule ids unique repo-wide; decision numbers unique
3. `verification: deterministic` ⇒ `verified_by` present
4. `superseded` ⇒ `superseded_by` resolves to an existing decision
5. `proposed` never appears in the rollup

**Binding resolution boundary.** v1 validates a binding's *shape* and that the named tool is on the
v1 known-tool list — `import-linter`, `pytest-archon`, `dependency-cruiser`, `semgrep`, `oasdiff`,
`gitleaks` — with its config file present. It does **not** look inside the tool config for the
contract name; that resolution belongs to sub-project 2, where the checker adapters live. Until
then a binding is well-formed, not proven — and the docs must say so, because an unproven binding
that reads as proven is the exact failure `verification` exists to prevent.

The generator writes via temp file + rename, so a crash never leaves a half-written constitution
that `--check` would subsequently bless.

Two things it never does: write a decision file, or promote a status.

## The capture step

Canonical `skills/_shared/recording-decisions.md` holds the procedure, the schema, and one worked
example. The builder fans it out into each of the four skills' `references/`. Each `SKILL.md` gains
a short closing step citing it. **The four skills' frontmatter (`name`, `description`) is not
touched**, so triggering behaviour is bit-for-bit unchanged.

**When to capture.** When the run *made a recommendation* — including an explicit refusal. "We
deliberately did not adopt microservices, and here is why" is precisely the decision whose reasoning
evaporates, and this crew refuses more than most. Do **not** capture when the run merely answered a
question without recommending anything. That line separates a baseline from a transcript log.

**What may be claimed.** A rule defaults to `narrative` and may only be raised to `deterministic`
when a real binding exists. This is the same guardrail shape as `test-patterns`' oracle rule: the
model must not manufacture a claim of verification.

**Read before write.** The capture step begins by reading `constitution.md`. This gives each skill
the repo's active rules at run time, so a skill does not re-litigate a recorded decision, and a
decision on an already-covered subject supersedes rather than duplicating. It also carries the
portability story: Codex has no SessionStart hook, so the in-skill read is the only injection path
there, and sub-project 3's hook becomes a Claude-side optimisation rather than the mechanism.

## Packaging

Two new canonical trees — `runtime/baseline/` and `skills/_shared/` — both flowing through
`builders/`. Nothing in `build/` is edited by hand.

The builder needs one new capability: **fan-out**, a single canonical source copied to several
destinations, since today's adapter contract is one source tree → one destination. The
`agentPackaging` allowlists in `package.json` gain the new directories.

**Host-specific paths vs. the no-templating rule.** The reference must tell the model where the
script is, and that root differs by host (`${CLAUDE_PLUGIN_ROOT}` in Claude, a different root in
Codex). Token substitution in Markdown is forbidden here — the project copies Markdown byte-for-byte
and deliberately has no prose templating, and that rule is load-bearing for the canonical-bytes
guarantee the existing Claude release depends on. So the reference stays one byte-identical file
naming both resolution methods in a sentence, and the model picks the one its host provides.

Version → **0.3.1**: new capability, no break to the shipped four.

## Validation

**Layer 1 — package contract.** New `test/baseline.test.mjs` over a fixture corpus at
`test/fixtures/decisions/`, plus additions to `build.test.mjs`.

Generator cases:

- golden-file compare: fixture corpus → expected `constitution.md`, byte-for-byte
- `proposed` excluded; `superseded` excluded and its `superseded_by` resolves
- duplicate rule id → fail; duplicate decision number → fail
- `deterministic` without `verified_by` → fail
- frontmatter using an unsupported construct → fail **with a line number**, never a silent misread
- `--check` against a stale rollup → non-zero exit, nothing written
- determinism: shuffled input file order produces identical output

Packaging cases: fan-out copies byte-identical to canonical; all four `SKILL.md` cite the reference;
runtime tree present in both `build/claude` and `build/codex`.

**Layer 2 — force-driven scenarios.** `test/scenarios/baseline-capture.json`, graded on gate
outcomes like the existing sets, no numeric scoring:

- greenfield recommendation → decision captured, `status: proposed`, correct skill attributed
- **explicit refusal** ("stay a monolith") → captured; the outcome easiest to lose
- question answered, nothing recommended → **nothing captured**; guards over-capture
- subject already in the constitution → supersedes, does not duplicate
- rule with no real binding → stays `narrative`, does not claim `deterministic`

Plus one dogfood run against this repository's own `docs/adr/0001`.

## Out of scope

Checker adapters and contract-name resolution (2); hooks, the drift queue, and the drain step (3);
ADR consolidation and reverse discovery (4); threat modelling (5). No config file, no `owner` or
`evidence` fields, no constraint DSL, no datastore, no dashboard.

## Risks

- **Four `SKILL.md` edits.** The capture step touches every shipped skill. Mitigated by leaving
  frontmatter untouched and by the scenario layer, but a triggering regression would be silent —
  scenarios must run before release.
- **Hand-written frontmatter parser.** Mitigated by refusing to be YAML: a documented subset with
  loud failure.
- **Unproven bindings reading as proven.** Mitigated by explicit wording in the reference and the
  generated constitution until sub-project 2 lands.
- **Proposed-file accumulation.** Unreviewed decisions pile up. Accepted for v1; a staleness sweep
  is a candidate for a later sub-project.
