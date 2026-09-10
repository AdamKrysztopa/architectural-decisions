---
description: Regenerate the architectural constitution from the decision files, or check it is current
argument-hint: "[--check]"
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" constitution $ARGUMENTS`

`constitution.md` is generated from the decision files and is never hand-edited —
it is a second authority, and its absence or staleness loses no decision.

With `--check` the command reports whether the committed file is current and
exits non-zero if it drifted; without it, the file is rewritten. If it was stale,
say which decisions moved, and remember that regenerating changes a tracked file
the user may want to review before committing.
