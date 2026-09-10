# Migrating and bootstrapping decisions

Two situations this covers. Work out which one applies before doing anything:

- **Consolidation** — this repository already has architectural decisions written down as prose
  (Nygard, MADR, or something bespoke), and some of them should become schema decision files.
- **Reverse discovery** — this repository has no recorded decisions at all, and the goal is to
  propose a first baseline from what the code actually does.

If neither describes the situation, do not force one on it — see **When neither mode applies** at the
end of this file.

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

**A stated confirmed subset *is* a confirmed list.** "Migrate these three and leave the rest" names
three inputs; that is the confirmation this section asks for, and the work starts there. Asking again
for a list you have already been handed looks like diligence and is only a stall.

**Described is not the same as absent.** If the user describes the inputs rather than pointing at
paths — "we have four ADRs: one on the event bus, one on auth, two on deployment" — that description
is the confirmed list, and it is what you work from. Say plainly that you are working from their
account rather than from files you read, mark in each decision's `## Sources` what rests on that
account, and ask for whatever you were not told. What you must not do is treat a described input as
licence to go hunting for the real file, or as a reason to produce nothing.

## Consolidation

1. List candidates: `node <plugin-root>/runtime/migration/discover-candidates.mjs`. It only names
   files shaped like `NNNN-slug.md`, or containing "adr", inside a known ADR directory — it reads no
   content.
2. Present the list. Get the user's confirmed subset.
3. For each confirmed file, read it and decide, honestly:
   - Already parses as a schema decision? Nothing to migrate — say so, **and still carry it into
     step 4** with disposition `unmapped` (or `left-as-prose`) and the reason "already a schema
     decision". The report is owed even when nothing is migrated: an input dropped from the manifest
     because it needed no work is indistinguishable, later, from one nobody ever read.
   - Prose that should become a new decision file? Draft one, following
     `references/recording-decisions.md`, with a `## Sources` section naming this exact input path
     and the commit you're working from.
   - Duplicates, or is superseded by, another confirmed file or something already `active`? Propose
     that as the new decision's own content. **Never set `status: superseded` or edit prose on the old
     file yourself** — that is what the human reviewing your proposal decides.
4. Give every confirmed input a disposition, each with its reason: `migrated`, `merged`,
   `superseded`, `omitted` (accepted alias `left-as-prose`), `conflicting` — it contradicts another
   input and a human must settle which wins — or `unresolved` (accepted alias `unmapped`). An input
   that already parses as a schema decision belongs in this vocabulary too, as `unmapped` /
   `unresolved` — or `left-as-prose` / `omitted`, whichever reads more honestly — with the reason
   "already a schema decision"; "nothing to migrate" is a disposition, not an exemption from having
   one. Then write a manifest — `{ inputs, dispositions }` — and run
   `node <plugin-root>/runtime/migration/build-migration-report.mjs --manifest <path> --dir
   <decisions-dir>`. It refuses to write the report if any confirmed input is missing a disposition,
   or a `migrated`/`merged` decision doesn't actually cite the input it claims — fix the decision file
   or the manifest, never the checker.

   **The manifest and the `build-migration-report.mjs` run are owed for whatever confirmed inputs
   exist** — however few, and however little of it was migrated. Declining to build them is not an
   available outcome: not because only one file was confirmed, not because every input turned out to
   already be a schema decision, not because the pass proposed nothing. A pass that leaves no
   traceability record cannot be told apart, later, from a pass that never ran. If the inputs were
   **described rather than present**, say so plainly and build the manifest from what was described,
   naming each input as the user named it — a manifest over described inputs is honest as long as it
   states that that is what it is.
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
   an earlier pass left unreviewed, not only what this pass adds. Subtract what is already there from
   the cap; what is left is this pass's headroom.

   **Finding more than the headroom holds is not a reason to propose nothing.** Rank the findings by
   what a human most needs to confirm, propose up to the headroom, and record the rest — and why each
   one ranked below the line — in the report, so the next pass inherits the ranking instead of
   rediscovering it. Eight regularities and room for three means three decisions written and five
   named in the report; it never means an empty pass. Step 4's "propose nothing" is for the case where
   the evidence is thin, never for the case where there is too much of it.

   Promote-or-discard applies in exactly one case: the directory is **already at the cap**, so the
   headroom is zero and nothing can be added at all. There `build-migration-report.mjs` refuses to
   write the report, and a human must promote or discard some of what is already `proposed` before
   this pass can add anything — say which findings are waiting on that, and why.
6. Same manifest and report step as consolidation.

## Promoting

Nothing here is active until a human runs, deliberately:

    node <plugin-root>/runtime/baseline/build-constitution.mjs promote NNNN [NNNN ...]

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code, and the installed plugin's directory in
Codex. This is the same gate `status: proposed` and the constitution's `active`-only filter already
enforce — the verb only makes the act auditable. Hand-editing `status: active` in the file still
works and is still a human's call to make; this tool does not prevent it.

## When neither mode applies

There is a third case, and it is the common one: nothing to convert and nothing to discover. The user
states a decision, or a run has just made one, and it simply is not written down in this repository
yet. Neither mode applies — hand off to `references/recording-decisions.md` and capture it: **one**
`status: proposed` decision file, **no `## Sources`** section (there is no input document to cite),
**no manifest**, and no migration report. Do not route an ordinary capture through this file to make
it look rigorous; a manifest over inputs that do not exist is fabricated provenance, and a `##
Sources` block citing nothing is worse than no block at all.

**`proposed` is the universal capture status, not a migration marker.** Every decision this plugin
writes starts `proposed`, whether it came from a migrated ADR, a reverse-discovery pass, or one
sentence the user said a minute ago; only a human's `promote` moves it. So `proposed` on a file is no
evidence a migration ran, and a capture owes nothing — no sources, no manifest, no cap check — to
earn the status it was always going to have.
