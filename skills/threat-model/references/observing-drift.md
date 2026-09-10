# Observing drift

Run this at a checkpoint — before a commit, at the end of a work session, or when the session start
notice says edits are queued. Not on every edit: a trivial edit must never trigger a review.

## 1. Get the evidence packet

    node <plugin-root>/runtime/drift/drift.mjs drain --json

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code, and the installed plugin's directory in
Codex. The drain reads the observation queue first and `git` second, so it works identically on a
host with no hooks — there, `queue.observed` is simply `0`.

If it exits 1, it could not do its job: fix the decision file it names. It never exits 2, because no
drift finding may fail a build.

## 2. Read `judgement` before reading anything else

Every entry in `rules` carries a `judgement` field. It is not advice.

- `forbidden` — a `deterministic` rule. **Report `checker.status` and `checker.evidence` verbatim and
  say nothing of your own.** This holds for **every** status other than `fail` — including
  `unavailable`, `unbound`, `unreadable-config`, `error`, `not-run`, and `pass`. A model standing in
  for a tool that did not run, or that errored rather than ran to a verdict, is the single worst
  failure this loop can produce.
- `required` — a `review` rule. Classify it, under the gate in section 4.

Narrative rules never reach `rules` at all — they are **counted**, not carried: each one only adds
to the top-level `narrativeSkipped` field. Report that count and nothing else. Nothing may grade
compliance against narrative intent.

A rule can be absent from `rules` for three distinct reasons, and they mean different things: it is
`narrative` (always excluded this way, counted in `narrativeSkipped`, as above); it is `scopeless` —
active but recorded with no `scope` at all, so it can never appear here no matter what changes (a
nonzero `scopeless` means a decision file needs a fix, not that nothing happened); or its declared
`scope` simply did not match any path changed this run. `outOfScope` counts the changed paths no
active rule's scope covers.

## 3. Classify each finding into exactly one class

### Violation

**Scoped to `forbidden` rules only.** A `forbidden`-judgement, `deterministic` rule whose bound contract a tool **ran and failed** —
`checker.status` is `fail`. **This word is reserved for that case and is produced by nothing else.**
Never write it about a `required` (`review`) rule, however confident you are — those are classified
into one of the four classes below instead. The checker ran against the whole repository, not only
this rule's `scope` — `checker.evidence` may name a file the scoped edit never touched. Report it
verbatim as a violation of the rule's bound contract; do not describe it as confined to `scope`,
which only decided that this rule belongs in the packet at all.

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
3. On agreement, write **one new decision file** at `status: proposed`, following
   `references/recording-decisions.md` for its shape and content — **with one exception, which is
   not optional.**

> **At drain time you write the new file and nothing else.** `recording-decisions.md`'s supersession
> procedure — set `status: superseded` and `superseded_by` on the old file, then regenerate
> `constitution.md` — is **deferred to promotion**. Do not perform it here. Name in the new file's
> body which rule it would supersede and why, and say to the user that the supersession takes effect
> when they promote it.
>
> This is not bookkeeping. Regenerating `constitution.md` at drain time changes what the repository
> *enforces* — the superseded rule stops being active — and it does so on the strength of an observed
> edit, with no human promotion anywhere in the chain. That is precisely the gate below, defeated
> from the other side: it does not matter that the new decision is `proposed` if the old one was
> retired to make room for it. A drain that regenerates the rollup has already changed the answer.

A `proposed` file changes `constitution.md` by exactly zero bytes until a human promotes it. That is
the gate, and it already exists — do not work around it by writing `status: active`, and do not work
around it by retiring the rule it would replace.

## 6. What this step may never do

Modify code. Modify documentation. Edit a rule, a decision file's prose, or `constitution.md`. Write
into a tool's config. Promote a status. **Set `status: superseded` or `superseded_by` on an existing
decision, or regenerate `constitution.md` — even by running the generator, which is still this step
changing what is enforced.** The only file this step may create is one new decision file at
`status: proposed`, and only after the user agrees.

If you believe a rule must be retired, that is a proposal like any other: say so, write the proposed
replacement, and leave the retirement to the human who promotes it.
