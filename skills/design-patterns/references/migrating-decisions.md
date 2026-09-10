# Migrating and bootstrapping decisions

Two situations this covers. Work out which one applies before doing anything:

- **Consolidation** — this repository already has architectural decisions written down as prose
  (Nygard, MADR, or something bespoke), and some of them should become schema decision files.
- **Reverse discovery** — this repository has no recorded decisions at all, and the goal is to
  propose a first baseline from what the code actually does.

Both write only `status: proposed` schema decision files, using the rules in
`references/recording-decisions.md`. This file covers what is different about writing one from an
existing document or an inspected codebase, instead of from a fresh recommendation.

## Never scan and adopt

Nothing in either mode is picked up automatically. A candidate list may be *shown* to the user —
files that look like ADRs, or code areas worth inspecting — but nothing on it is used until the user
confirms or edits it. Only paths, or code scopes for reverse discovery, on the **confirmed** list may
influence anything written. Wanting to look at something else means asking for it to be added first,
not reading it anyway.

**If asked to convert a whole directory at once, decline and ask for per-file confirmation instead.**
"Migrate everything in docs/adr/" is not itself a confirmed list.

## Consolidation

1. List candidates: `node <plugin-root>/runtime/migration/discover-candidates.mjs`. It only names
   files shaped like `NNNN-slug.md`, or containing "adr", inside a known ADR directory — it reads no
   content.
2. Present the list. Get the user's confirmed subset.
3. For each confirmed file, read it and decide, honestly:
   - Already parses as a schema decision? Nothing to migrate — say so.
   - Prose that should become a new decision file? Draft one, following
     `references/recording-decisions.md`, with a `## Sources` section naming this exact input path
     and the commit you're working from.
   - Duplicates, or is superseded by, another confirmed file or something already `active`? Propose
     that as the new decision's own content. **Never set `status: superseded` or edit prose on the old
     file yourself** — that is what the human reviewing your proposal decides.
4. Once every confirmed input has a disposition (`migrated`, `merged`, `left-as-prose`, `superseded`,
   or `unmapped`, each with its reason), write a manifest — `{ inputs, dispositions }` — and run
   `node <plugin-root>/runtime/migration/build-migration-report.mjs --manifest <path> --dir
   <decisions-dir>`. It refuses to write the report if any confirmed input is missing a disposition,
   or a `migrated`/`merged` decision doesn't actually cite the input it claims — fix the decision file
   or the manifest, never the checker.
5. Read the report's "Candidate conflicts" section before reporting back: it mechanically flags rules
   in different decisions whose `scope` cannot be proven disjoint. Each one is a candidate for a human
   to resolve, never something to merge, narrow, or supersede on your own judgement — surface it and
   let the review decide.
6. Report the path to `migration-report.md`. **The constitution does not change** until a human runs
   `promote`.

## Reverse discovery

1. Agree with the user which code scopes to inspect — a glob, a directory, a service. That is the
   confirmed list; nothing outside it is read for evidence.
2. For a candidate regularity, count it: use `runtime/migration/inventory.mjs`'s
   `countPatternOccurrences` (or the equivalent read the codebase directly, for a pattern too specific
   for a single grep) to get a match count **and the exceptions**. "47 of 51 modules" is a finding;
   "modules follow this" with the four exceptions silently dropped is not honest evidence.
3. Every rule you propose starts `verification: narrative`, regardless of whether a matching tool
   config happens to exist. Raising it to `deterministic` or `review` is a separate, later,
   human-reviewed edit — never something this pass does for itself. State in the decision's
   `## Context` what was observed and how (the scope, the pattern, the counts); state in `##
   Decision` what a human must confirm as intended.
4. **If nothing regular enough to propose was found, say so and propose nothing.** An invented
   narrative decision to have produced *something* is worse than an honest "insufficient evidence."
5. The decisions directory holds at most 20 `status: proposed` decisions at a time — a backlog cap,
   not a per-pass one: it counts every proposed file already sitting in the directory, including ones
   an earlier pass left unreviewed, not only what this pass adds. `build-migration-report.mjs`
   enforces this and refuses to write the report while the directory is above the cap. If it refuses,
   a human must promote or discard some of what is already `proposed` before this pass can add more —
   rank what matters most, and record what was left out and why.
6. Same manifest and report step as consolidation.

## Promoting

Nothing here is active until a human runs, deliberately:

    node <plugin-root>/runtime/baseline/build-constitution.mjs promote NNNN [NNNN ...]

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code, and the installed plugin's directory in
Codex. This is the same gate `status: proposed` and the constitution's `active`-only filter already
enforce — the verb only makes the act auditable. Hand-editing `status: active` in the file still
works and is still a human's call to make; this tool does not prevent it.
