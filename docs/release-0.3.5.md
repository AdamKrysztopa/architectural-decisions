# Release 0.3.5 — the drift-observation loop

## What shipped in 0.3.5

- **Three Claude Code hooks that do the cheap work.** `SessionStart` (`runtime/drift/inject-rules.mjs`)
  prints the active rule list from `constitution.md`. An `async` `PostToolUse` script
  (`runtime/drift/observe.mjs`), matched on `"Write|Edit|NotebookEdit"`, appends one line per edit to
  `.arch-crew/drift-queue.jsonl`. `Stop` (`runtime/drift/notify.mjs`) emits a `systemMessage` only when
  the queue is non-empty. All three exit 0 always and touch nothing outside `.arch-crew/`; the observer
  never imports a checker, the baseline, or a subprocess.
- **A crash-safe queue.** `runtime/drift/queue.mjs` appends under a byte cap, drains by renaming to a
  `.draining` file before parsing (so a crash mid-drain is picked up whole by the next drain), skips
  malformed lines rather than failing the append, and `discard` removes every queue and draining file.
  It knows nothing about rules.
- **The drain and its evidence packet.** `runtime/drift/drift.mjs` (`status`, `drain`, `discard`) reads
  `git` first and the queue second, matches changed paths against active rule `scope` globs
  (`runtime/drift/globs.mjs`), and copies SP2's checker verdicts verbatim — never re-deriving or
  softening them. `runtime/drift/packet.mjs` is a pure function that builds the resulting evidence
  packet: `narrative` rules are counted, never graded; `deterministic` rules get `judgement: "forbidden"`
  and either a copied checker row or `checker: {"status":"not-run"}`; only `review` rules get
  `judgement: "required"`, which is the only kind the model may classify. The CLI never exits 2 — it is
  advisory only, in-session and in CI alike.
- **`judgement` as data, not prose (D6).** The packet itself states which rules the model may form an
  opinion on. A rule with a real checker verdict is never handed to the model to re-judge.
- **The five named classes and the four-part evidence gate (D7).** `shared/observing-drift.md` is the
  canonical drain procedure — of the five classes, only four are reachable from a `review` rule's
  finding; **Violation** is reserved for `checker.status === "fail"` and is produced by the checker,
  never by classification. The evidence gate that must be satisfied before a finding is reported is
  fanned byte-for-byte into all four skills' `references/observing-drift.md` by
  `builders/sync-shared.mjs`, and cited from each `SKILL.md` body.
- **Legitimate evolution routes to a proposed decision, not a violation.** When the drain concludes a
  change reflects the codebase outgrowing a rule, it routes to the existing capture step and `promote`
  verb (SP4) rather than growing a second write path.
- **No silent modification, enforced.** The observer, the hooks, and the drain never rewrite a decision
  file, the constitution, or a rule; this is asserted by dedicated tests, not left to review.
- **Shipped identically to both targets.** `runtime/drift/` is packaged into both `build/claude` and
  `build/codex`. Only the Claude hook registration (`build/claude/hooks/hooks.json`, generated, never
  hand-edited) is adapter-specific — on Codex, which has no hooks, the same drain runs from the git lane
  alone.
- **Two new suites.** `test/drift.test.mjs` is the Layer-1 suite over `test/fixtures/drift/`, including
  a golden evidence packet reviewed line by line before being committed. `test/scenarios/drift-drain.json`
  is the Layer-2, force-driven scenario set grading the five classes and the evidence gate.

## Scope

This is **sub-project 3 of six** in the arch-crew architectural-baseline upgrade, following SP1
(0.3.1, the baseline) and SP2 (0.3.2, deterministic checkers). It ships as a **patch release, not
0.4.0**, which remains reserved for the release that satisfies the full six-sub-project checklist.

## Known limitations

- **The queue's marginal value over `git status --porcelain` is modest, by design.** The hooks exist
  to make the loop feel automatic and to survive a session where changes are made and then reverted
  within the same working tree before a checkpoint; the drain still reads git first and treats the
  queue as a secondary signal, not the source of truth. A repository that never installs the hooks (or
  runs on Codex) loses none of the drain's real value.
- **The model classifying `review` rules is the weakest link.** It is mitigated — the four-part
  evidence gate, the five named classes — of which Violation is reserved and unreachable by
  classification — `judgement` as data that forbids classification on anything a
  tool already settled, and never handing the model a rule with a real checker verdict — but not
  eliminated. A `review` rule's finding is still, ultimately, a model's read of a diff.
- **A one-unlink-wide window exists in which a drained slice could be reported twice after a crash.**
  The drain renames the queue to a `.draining` file, parses it, and only then unlinks it. A crash
  between a successful report and the unlink means the next drain picks up the same `.draining` file
  and reports its contents again. This is a bounded, known window, not an unbounded one: it can only
  double-report the single most recent drained slice, never accumulate across multiple drains.
- **Three corrections to the hooks contract, recorded here so they are not reintroduced.**
  1. There is no `$CLAUDE_TOOL_INPUT_PATH`. Hook input arrives on **stdin** as a JSON object; the
     edited path is `tool_input.file_path`. The observer is a Node script run with `"async": true`,
     not a shell `printf` reading a nonexistent environment variable.
  2. `MultiEdit` does not exist. The `PostToolUse` matcher is the exact-string list
     `"Write|Edit|NotebookEdit"` — it must stay inside the exact-string character set (letters,
     digits, `_`, `-`, spaces, `,`, `|`) so it is matched exactly, not as a regular expression that
     would also match `NotebookEdit` via `Edit.*`.
  3. `Stop` can block (exit 2 prevents Claude from stopping, capped at 8 consecutive blocks), and its
     stdout is not added to Claude's context — only `SessionStart`, `UserPromptSubmit`,
     `UserPromptExpansion`, and `PostModelSwitch` stdout is. The `Stop` notice's only legal delivery
     mechanism is exit 0 with `{"systemMessage": "..."}`, shown to the **user**, not to Claude.
- **There is no drift report artifact.** Deliberately: a generated report would be a fourth thing a
  later run could quietly rewrite. The packet plus the conversation already carry everything a human
  needs.

## Compatibility

The four skills' names, descriptions, and triggering are unchanged. Each skill body gains a citation
to `references/observing-drift.md`; no existing greenfield or refactoring workflow step is removed or
reordered. A repository that never installs the Claude hooks loses only the queue's contribution — the
git-primary drain still runs, on both targets. Existing users need no migration; installing the hooks
is opt-in via the generated `build/claude/hooks/hooks.json`.

## Verification

A reviewer can run, from the repository root:

```sh
npm run build -- --target all
npm test
npm run sync:check
node runtime/drift/drift.mjs status --root .
node runtime/drift/drift.mjs drain --root . --json
```

And confirm no lingering reference to the reserved version:

```sh
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/
```

This must return nothing.
