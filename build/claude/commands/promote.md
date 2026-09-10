---
description: Promote one or more proposed decisions to active
argument-hint: "<id>... (e.g. 0007 0009)"
allowed-tools: Bash(node:*)
---

Promotion is an explicit human act. Do not run this because a report proposed a
decision, because a migration produced candidates, or because it seems like the
obvious next step — run it only when the user has named the decisions they want
promoted.

If no id was supplied in $ARGUMENTS, stop and ask which decisions to promote
rather than guessing. Show them what is currently proposed first:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" candidates`

When the user has named the ids, run:

`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" promote <ids>`

Then regenerate the constitution so it reflects the newly active decisions, and
tell the user which files changed.
