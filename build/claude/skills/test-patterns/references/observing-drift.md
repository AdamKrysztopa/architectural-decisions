# Observing drift

Run this at a checkpoint — before a commit, at the end of a work session, or when the session start
notice says edits are queued. Not on every edit: a trivial edit must never trigger a review.

## 1. Get the evidence packet

    node <plugin-root>/runtime/drift/drift.mjs drain --json

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code, and the installed plugin's directory in
Codex. The drain reads `git` first and the observation queue second, so it works identically on a
host with no hooks — there, `queue.observed` is simply `0`.

If it exits 1, it could not do its job: fix the decision file it names. It never exits 2, because no
drift finding may fail a build.

## 2. Read `judgement` before reading anything else

Every rule in the packet carries a `judgement` field. It is not advice.

- `forbidden` — a `deterministic` rule. **Report `checker.status` and `checker.evidence` verbatim and
  say nothing of your own.** This holds for **every** status other than `fail` — including
  `unavailable`, `unbound`, `unreadable-config`, `error`, `not-run`, and `pass`. A model standing in
  for a tool that did not run, or that errored rather than ran to a verdict, is the single worst
  failure this loop can produce.
- `required` — a `review` rule. Classify it, under the gate in section 4.
- `skipped` — a `narrative` rule. Report the count and nothing else. Nothing may grade compliance
  against narrative intent.

Rules absent from `rules` were not scoped to any changed path. `outOfScope` counts the changed paths
no active rule covers. `scopeless` counts active rules recorded with no `scope` at all — such a rule
can never appear here no matter what changes; a nonzero `scopeless` means a decision file needs a
fix, not that nothing happened.

## 3. Classify each `required` rule into exactly one class

### Violation

A `deterministic` rule whose bound contract a tool **ran and failed** — `checker.status` is `fail`.
**This word is reserved for that case and is produced by nothing else.** Never write it about a
`review` rule, however confident you are.

### Suspected drift

A `review` rule the change appears to contradict. Requires all four of: the rule id, the file, the
**line**, and the specific text or structure that contradicts the rule's `statement`.

### Insufficient evidence

A scoped path changed and the evidence supports no finding either way. This is a normal, frequent,
correct outcome, and it is where every finding that fails the gate lands.

### Legitimate evolution

The change is a *new* architectural decision — a new boundary, a reversed dependency direction, a
subject no active rule covers. Not a defect. Section 5.

### Stale or contradictory documentation

The **rule** is wrong, not the code: it names a module that no longer exists, contradicts another
active rule, or describes a structure this repository abandoned. Also section 5.

## 4. The evidence gate

Before writing *Suspected drift*, name the source out loud: rule id, file, line, and the text or
structure that contradicts the statement. **Missing any one of the four — downgrade it to
*Insufficient evidence*.** "It looks wrong" is not an answer, and neither is a plausible-sounding
paraphrase of the rule.

Report grouped by class, and state each class's evidentiary weight in words. **No score, no
percentage, no headline count that mixes classes.** One tool failure and two impressions are not
"3 findings".

If every rule lands in *Insufficient evidence* or nothing was scoped, say so and stop. "Nothing to
report" is the correct outcome more often than not.

## 5. Route evolution into a proposed decision, never a defect report

For *Legitimate evolution* and *Stale or contradictory documentation*:

1. Say what the new decision would be about, and which rule it would supersede.
2. **Ask.** Do not write a decision file the user has not agreed to.
3. On agreement, follow `references/recording-decisions.md` unchanged: one new file, `status:
   proposed`, superseding rather than editing, the old file's prose untouched.

A `proposed` file changes `constitution.md` by exactly zero bytes until a human promotes it. That is
the gate, and it already exists — do not work around it by writing `status: active`.

## 6. What this step may never do

Modify code. Modify documentation. Edit a rule, a decision file's prose, or `constitution.md`. Write
into a tool's config. Promote a status. The only file this step may create is one new decision file
at `status: proposed`, and only after the user agrees.
