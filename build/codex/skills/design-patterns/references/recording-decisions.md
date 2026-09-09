# Recording a decision

Run this at the end of a skill run that **made a recommendation** — including an explicit refusal
("stay a monolith", "no agent", "no contract tests"). A refusal is the decision whose reasoning
evaporates fastest, so it is recorded like any other.

Do **not** record when the run only answered a question and recommended nothing. That line is the
difference between a baseline and a transcript log.

## 1. Read the constitution first

Read `docs/architecture/constitution.md` (or `constitution.md` beside whichever decisions directory
the repository uses) before writing anything. It lists the rules already in force.

- If this run's subject is already covered, **supersede** — do not add a near-duplicate.
- If a recorded rule contradicts what you are about to recommend, say so to the user before writing.

## 2. Write one decision file

Write into the directory the generator selects: the first existing decisions directory that already
holds at least one file matching this schema, else the first existing one holding any `NNNN-slug.md`
file at all, else `docs/architecture/decisions/` (created if absent). If an existing ADR directory
(e.g. `docs/adr/`) holds prose ADRs that are not in this schema, do **not** convert them or write
into that directory — use `docs/architecture/decisions/` alongside it. Name your file `NNNN-slug.md`,
taking the next free number.

    ---
    id: 0004
    status: proposed
    skill: decide-architecture
    date: 2026-09-09
    commit: aa1ca89
    rules:
      - id: no-shared-db-writes
        statement: Services must not write to another service's tables.
        scope: ["services/**"]
        severity: blocking
        verification: review
    ---
    # Events over a shared database

    ## Context
    ## Decision
    ## Consequences (cost)

`status` is always `proposed` on capture. **Never write `active`, and never promote another file's
status** — a human does that in review. `commit` is the repository's current short SHA.

Frontmatter is a small, fixed subset: `key: value`, inline lists (`["a", "b"]`), and one level of
list-of-maps. Anything else — block scalars, anchors, nested maps — is rejected with a line number.

Prose holds the reasoning. Never rewrite the prose of an existing decision file.

## 3. Classify every rule honestly

`verification` is a promise about what may check the rule:

- `narrative` — intent, **not** checkable. This is the default. Nothing may grade compliance against it.
- `review` — needs judgement; may be graded as a soft signal.
- `deterministic` — a tool proves it. Requires `verified_by: <tool>#<contract>` naming a contract that
  **already exists** in this repository's tool config. Known tools: `dependency-cruiser`, `gitleaks`,
  `import-linter`, `oasdiff`, `pytest-archon`, `semgrep`.

Start every rule at `narrative` and raise it only when the binding genuinely exists. Do not invent a
binding to make a rule look enforced — an unbacked `deterministic` claim is worse than an honest
`narrative` one, for the same reason a generated test with no oracle is worse than no test.

A decision with no rules at all is fine. Most refusals have none.

## 4. Superseding

Set `status: superseded` and `superseded_by: NNNN` on the old file. Change nothing else in it —
never delete it, never edit its prose. The rollup drops it; git keeps it.

## 5. Regenerate the constitution

Run the generator that ships with this package:

    node <plugin-root>/runtime/baseline/build-constitution.mjs

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code, and the installed plugin's directory in
Codex. Then report both paths you touched — the decision file and the constitution.

If the generator reports errors, fix the decision file; never hand-edit `constitution.md`.
