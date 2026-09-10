---
description: Show or set the human documentation mode (ADRs, or living architecture documents)
argument-hint: "[adr|living] [--document <path>]..."
allowed-tools: Bash(node:*)
---

The documentation mode is the user's choice about **where their architecture
record lives for a human reader**. It is not a performance setting and it is not
yours to pick. Never change it as a side effect of another task.

Show what is selected now:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" mode`

If $ARGUMENTS is empty, that output is the answer — stop there.

The two modes, and what each one means for the person reading the repository:

- **`adr`** — many ADR files, one per decision, in a decisions directory. Each
  file is its own human record: context, decision, consequences. This is the
  default, and the right choice for a team that wants an append-only trail of
  individual decisions.
- **`living`** — one or several **living architecture documents** are the human
  record, maintained as documents. Decisions are sections of those documents,
  each carrying its rule metadata in fenced `arch-decision` / `arch-rule`
  blocks beside the prose that explains it. Choose this when the team wants a
  document they read top to bottom, not a directory they page through.

**What does not change with the mode:** rules, scopes, severities, `verified_by`
bindings, the generated `constitution.md` rollup, `arch check`, the drift loop,
and rule injection. That is machine enforcement metadata, and it is identical in
both modes. Switching modes changes what a person maintains — never what is
enforced or how.

To set it:

`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" mode adr`
`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" mode living --document docs/architecture/overview.md`

`living` needs at least one document that already exists. If the user wants
living mode and has no document yet, write the document with them first — an
empty living mode is a record with nothing in it.

If the user is switching from `adr` with existing ADRs, do not silently strand
them: point at `arch migrate`, which produces the traceability report
(migrated · merged · superseded · omitted · conflicting · unresolved) that says
what became of each one.
