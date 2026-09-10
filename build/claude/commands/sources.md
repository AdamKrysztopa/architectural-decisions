---
description: Designate, list and reconcile the artifacts this project treats as authoritative
argument-hint: "[list|add|remove|change|checked] ..."
allowed-tools: Bash(node:*)
---

Show what this project currently designates as authoritative:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" sources list`

**Nothing is authoritative until a human designates it, and you never designate
anything on the user's behalf.** Not a document you found in `docs/`, not one
that looks important, not one the user mentioned in passing. If a designation
seems obviously right, say so and ask — the whole value of the registry is that
it contains only what someone chose to put in it.

If $ARGUMENTS is empty, the listing above is the answer. Read it out, including
any conflicts, and stop.

To designate an artifact the user has named:

`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" sources add --id <slug> --kind <kind> --path <path> [--covers <subject>]... [--scope <glob>]... [--by <who>] [--on <date>] [--provenance <text>]`

Kinds: `prd`, `architecture-document`, `diagram`, `engineering-standard`,
`api-contract`, `security-requirement`, `adr`, `living-document`, `other`.

Two fields do different jobs, and it is worth getting them right:

- `--covers` — the **subjects** this source is authoritative about. Two sources
  covering one subject is how a conflict becomes visible at all.
- `--scope` — the **code** it governs, in the same glob dialect a rule's scope
  uses. This is what lets `/arch-crew:drift` say an edit falls under this document.

Ask for provenance (`--by`, `--on`, `--provenance`) rather than leaving it
blank. "Who said this is binding, and when" is the question a reader of the
registry will have.

## When two sources conflict

`sources list` exits 3 and names both. **Do not pick a winner.** Precedence
orders the report; it does not settle the disagreement. Report both documents to
the user and let them decide — resolving it silently is the exact failure this
registry exists to prevent.

## What a designated source can and cannot do

It can produce a **finding**: "this change is in code governed by the API
contract you designated authoritative." It can never produce a **violation** —
that requires a tool that ran and failed, and no checker speaks for a PRD or a
security requirement. Do not report a source-derived finding as a violation, and
do not soften a real violation into one.

After reconciling a change against a source, record which version it was checked
against:

`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" sources checked --id <slug> --baseline <ref>`
