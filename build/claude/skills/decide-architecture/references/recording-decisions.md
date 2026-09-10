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
- **If the user states a prior decision this repository does not contain, still capture.** Reason in
  the world the user describes, say plainly that this repository holds no record of it, and write the
  decision anyway. A decision that was made in a meeting, in another repository, or before this
  repository existed is still a decision; the absence of a file is not evidence it was not taken.
  Mark what rests on the user's account rather than on something you read.

> **§3's anti-fabrication rule is not a reason to decline to capture.** It governs `verified_by`
> bindings and the `deterministic` classification — never *whether* to write the file. Capturing a
> decision whose rules are all `narrative` is a correct outcome; refusing to capture because nothing
> could be bound to a tool is not.

## 2. Write one decision file

Write into the directory the generator selects: the first existing decisions directory that already
holds at least one file matching this schema, else the first existing one holding any `NNNN-slug.md`
file at all, else `docs/architecture/decisions/` (created if absent). If an existing ADR directory
(e.g. `docs/adr/`) holds prose ADRs that are not in this schema, do **not** convert them or write into
that directory during an ordinary capture run — use `docs/architecture/decisions/` alongside it.
Converting them deliberately, on request, is `references/migrating-decisions.md`'s job, not this
one's. Name your file `NNNN-slug.md`, taking the next free number.

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

`scope` is a list of glob patterns naming the paths a rule governs — the same vocabulary the drift
drain and every checker adapter use for path matching. The supported subset is deliberately small:
literal path segments, `*` within a segment, `?` for exactly one character, and `**` as a whole
segment (leading, trailing, or in the middle). A pattern with no wildcard at all is a module name — it
matches itself and everything under it. Brace expansion (`{a,b}`), character classes (`[a-z]`),
negation (`!`), and backslashes are **not** supported and are rejected when the decision file loads,
naming the rule and the pattern — write the equivalent as two separate scope entries instead of one
brace-expanded one, and spell out a character range as separate literal patterns rather than a class.



Frontmatter is a small, fixed subset: `key: value`, inline lists (`["a", "b"]`), and one level of
list-of-maps. Anything else — block scalars, anchors, nested maps — is rejected with a line number.

Prose holds the reasoning. Never rewrite the prose of an existing decision file.

## 3. Classify every rule honestly

`verification` is a promise about what may check the rule:

- `narrative` — intent, **not** checkable. This is the default. Nothing may grade compliance against it.
- `review` — needs judgement; may be graded as a soft signal.
- `deterministic` — a tool proves it. Requires `verified_by: <tool>#<contract>` naming a contract that
  **already exists** in this repository's tool config. Known tools: `ast-grep`, `dependency-cruiser`,
  `gitleaks`, `import-linter`, `oasdiff`, `pytest-archon`, `semgrep`.

  Before raising a rule to `deterministic`, run
  `node <plugin-root>/runtime/checkers/check-rules.mjs --include-proposed` and confirm this rule's
  row is not `unbound` or `unreadable-config` — do not raise a rule on the strength of believing the
  contract exists.

  **`--include-proposed` is not optional here, and the reason matters.** Without it the command
  reports only rules from `active` decisions — and the decision you are capturing is `proposed`, so
  its rows would simply not appear and the check would look like it passed by returning nothing. The
  flag widens what is *reported*, never what is *enforced*: a proposed rule's row is marked
  `[proposed — resolution only, not enforced]` and can never change the command's exit code. If you
  see an empty result where you expected your own rule, you have run it without the flag.

  A checker's verdict is **repository-wide by default** — every adapter scans the whole repository in
  one pass, never only the paths a rule's `scope` names. `import-linter`, `dependency-cruiser`,
  `oasdiff`, and `pytest-archon` can never be confined to a `scope`: a `fail` from one of these may
  point at a finding anywhere the tool looked, no matter what the rule's `scope` says. `gitleaks` and
  `semgrep` are the exception — their findings carry a file path, so `check-rules.mjs` filters each
  rule's own verdict down to the paths its `scope` names before reporting `fail` (`ast-grep` follows
  the same discipline once its `--run` ships). Never infer which case applies from the tool's name or
  from this prose: every row `check-rules.mjs` emits, and the `checker` object the drift packet copies
  it into, carries a `scopeCoverage` field — `"scope-matched"` when the verdict was confined to this
  rule's `scope`, `"repository-wide"` when it was not (no `scope` declared, or this tool cannot be
  confined to one). A consumer reading the JSON must go by that field, not guess.

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
