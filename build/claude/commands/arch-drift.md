---
description: Drain the observed-edit queue and classify it against the active architectural rules
argument-hint: "[--base <ref>]"
allowed-tools: Bash(node:*), Read, Glob, Grep
---

Drain the drift queue into an evidence packet:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" drift drain --json $ARGUMENTS`

Now classify what came back by following `references/observing-drift.md` from
any arch-crew skill — read that file before you interpret anything above.

The rules that matter most, restated so they are not lost:

1. Read the packet's `judgement` block **before** reading anything else.
2. Classify each `required` rule into exactly one class: violation, suspected
   drift, insufficient evidence, legitimate evolution, or stale documentation.
3. The evidence gate binds. Report a **violation** only where a deterministic
   tool actually failed — a `forbidden` rule with a real `fail`. Your own
   reading of the code is never sufficient to promote something to a violation.
4. Route legitimate evolution into a **proposed decision**, never a defect
   report.
5. The queue is a pointer, not authority. It tells you where to look; the git
   state and the checker verdicts decide.

If the packet is empty, say so and stop — "nothing to report" is a correct
outcome, not a failure to find something.
