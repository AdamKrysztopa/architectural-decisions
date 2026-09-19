# Release 0.7.0 — drift works before the first decision is recorded

## Defect fixed: the Stop hook invited a command that was guaranteed to fail

In a repository with no `docs/architecture/decisions/` (observed on 0.6.0):

1. SessionStart said, correctly, that there was no constitution yet.
2. PostToolUse queued every Write and Edit into `.arch-crew/drift-queue.jsonl`, by design.
3. Stop saw a non-empty queue and said "Run /arch-crew:drift to classify them against the active
   rules."
4. `/arch-crew:drift` ran `drift drain --json`, which wrote "No decisions directory at …" and exited
   1. Claude Code reported "Shell command failed", classification never ran, and the queue stayed,
   so the notice came back.

Three places treated "no decisions yet" as a normal state and one treated it as fatal. Now all four
agree:

- **`drift drain`** with no record at the default location exits 0, consumes the queue and the
  `last-notified` mark, and emits a valid packet with `record: "absent"` and a `nextStep`. Without
  `--json` it prints the next step instead of a packet. An explicit `--dir` naming a missing
  directory is still exit 1 (a named path that does not exist is a mistake; the default path being
  absent is not), and malformed decision files are still fatal.
- **The Stop hook** suggests `/arch-crew:drift` only when a drain has something to classify
  against: a decision record at its resolved location or a designated source. Otherwise it is silent.
  SessionStart already reports the missing constitution once per session, and a repeated Stop hint
  would only duplicate it. The check is one `stat`, made only on a turn that would otherwise notify.
- **The observer** is unchanged and keeps queueing. Gating it correctly would need the config read
  (living mode, a configured decisions path, designated sources), not one `stat`. Edits made before
  the first decision are the ones a first drain should see, and the drain now clears them.
- **One path resolution.** `locateRecord` in `runtime/baseline/record.mjs` resolves where the record
  lives without loading it, `resolveRecord` is built on it, and the hooks' `canClassify` uses it. The
  hooks have no second copy of the path logic.

## New: without a decision record, drift reads the documentation the repository has

A drain with no record falls back in order:

1. **Designated sources**, reported exactly as they are when a record exists.
2. **`documents`**: undesignated architecture documentation it finds (`ARCHITECTURE.md`,
   `DESIGN.md`, `docs/architecture.md`, `docs/architecture/*.md`, `docs/design/*.md`, and every
   Markdown file in a known ADR directory, which covers prose ADRs). Each entry has
   `judgement: "review"` and an `edited` flag. Nothing is designated automatically. `nextStep` offers
   `/arch-crew:sources` to designate a document or `/arch-crew:migrate` to propose decisions from it.
3. **Nothing found**: `nextStep` proposes seeding a first decision (via `/arch-crew:help`) or
   reverse-discovering proposals from the code with `/arch-crew:migrate`. Drift classifies against
   that record from the next drain on.

Every packet now carries `record`, `nextStep` (null when a record exists) and `documents` (always
empty when a record exists).

## Documentation

`commands/drift.md` and `references/observing-drift.md` describe the absent-record case and the
order the fallback reads in.
