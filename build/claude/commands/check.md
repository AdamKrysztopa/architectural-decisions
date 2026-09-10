---
description: Resolve every deterministic rule's verified_by binding against this repository's own tool config
argument-hint: "[--run] [--require-tools]"
allowed-tools: Bash(node:*)
---

Run the deterministic checker and report what it found:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" check $ARGUMENTS`

Read the output above and summarise it for the user. The status vocabulary is
exact — do not soften it:

- `pass` / `fail` — the tool actually ran and returned a verdict. Only these two
  are evidence about the code.
- `unbound` — the rule names a contract the tool's config does not define. The
  rule is unverified, not satisfied.
- `unreadable-config` — the config exists but is not statically readable.
- `unavailable` — resolved, but not evaluated (no `--run`, or the binary is
  missing). This is **not** a pass.
- `error` — the tool ran and something went wrong.

The exit code carries the gate: 0 clean, 2 a blocking rule failed, 3 a warning
rule failed, 1 the decisions could not be loaded.

Never report a rule as satisfied on the strength of its documentation. If the
user wants the rules actually evaluated rather than resolved, tell them to
re-run with `--run` (that spawns the real third-party tools).
