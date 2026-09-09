# Roadmap consistency audit — SP2 → SP4 → SP5 → SP3 → SP6

**Date:** 2026-09-09
**Scope:** five specs + five plans written in parallel from
`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md`, audited for **mutual** consistency
only (interfaces, file ownership, versions, counts). No file was modified; no state-changing git
command was run.

**Method:** every claim below carries `file:line` on both sides. Line numbers are as of this audit.
Shipped-state references are `runtime/baseline/*.mjs`, `builders/*.mjs`, `test/build.test.mjs`,
`package.json` at 0.3.1.

**Severity key**
- **S1 — build-breaking.** The consuming plan's tests cannot pass against what the producing plan
  actually ships. Discovered during implementation, at the cost of a redesign mid-release.
- **S2 — silently wrong.** Code runs, tests pass, behaviour is wrong or a guarantee is hollow.
- **S3 — prose / hygiene.** Stale text, unowned cleanup, no mechanical consequence.

---

## Conflict 1 — CLI names

**Split verdict: `check-rules.mjs` REFUTED; `migrate.mjs` CONFIRMED (S1); `promote` REFUTED;
plus a fourth, unlisted name collision `drain.mjs` CONFIRMED (S1).**

### 1a. `check-rules.mjs` — REFUTED

SP2 names it exactly as the decisions doc does, and every downstream consumer agrees.

| Side | Evidence |
| --- | --- |
| Decisions doc | `specs/2026-09-09-upgrade-decisions-sp2-sp6.md:213`, `:300` — `runtime/checkers/check-rules.mjs` |
| SP2 produces | `plans/2026-09-09-sp2-deterministic-checkers.md:80`, `:1914` — creates `runtime/checkers/check-rules.mjs` |
| SP6 consumes | `plans/2026-09-09-sp6-release-hardening.md:259`; `specs/2026-09-09-sp6-release-hardening-design.md:250` |
| SP3 consumes | `plans/2026-09-09-sp3-drift-loop.md:1213` |
| SP5 consumes | `specs/2026-09-09-sp5-security-skill-design.md:160` |

Flags agree too: SP2 `plans/…sp2…:2110` documents `[--dir <path>] [--run] [--require-tools] [--json]`;
SP3 `plans/…sp3…:29` asserts exactly that set.

### 1b. `migrate.mjs` — CONFIRMED, S1

SP6 was written against the decisions doc's imagined single migration CLI. SP4 ships **two**
purpose-split modules and **neither is called `migrate.mjs`**.

| Side | Evidence |
| --- | --- |
| SP6 expects | `plans/2026-09-09-sp6-release-hardening.md:259`, `:294`, `:790`, `:815` — `runtime/migration/migrate.mjs` |
| SP4 actually creates | `plans/2026-09-09-sp4-migration-bootstrap.md:65` `runtime/migration/discover-candidates.mjs`; `:69` and `:1027` `runtime/migration/build-migration-report.mjs` |
| SP4 spec agrees with SP4 plan | `specs/2026-09-09-sp4-migration-bootstrap-design.md` names `inventory.mjs`, `traceability.mjs`, `glob.mjs`, `discover-candidates.mjs`, `classify-inputs.mjs` — no `migrate.mjs` |

This is not only a rename. The **argument shape and return contract are incompatible** (see
"Interface mismatches", I-1 below): SP6 calls
`migrate.mjs --dir <dir> --json --inputs <path> --inputs <path>` and parses
`{reportPath, proposed:[{id, status, rules:[{verification}]}]}`
(`plans/…sp6…:832-861`), whereas SP4's CLI is
`build-migration-report.mjs --manifest <path> --dir <path> [--cap <n>]`, has **no `--json`**, has
**no `--inputs`**, and resolves to an **exit code**, not a JSON payload
(`plans/…sp4…:1033-1035`, `:1130-1143`).

### 1c. `promote` — REFUTED

| Side | Evidence |
| --- | --- |
| SP4 produces | `plans/2026-09-09-sp4-migration-bootstrap.md:1251` Task 8; `:1337` `promoteStatusLine`; `:1420` dispatcher routes a leading `promote` argument |
| SP4 spec | `specs/2026-09-09-sp4-migration-bootstrap-design.md:233` — `build-constitution.mjs promote 0007 0009 [--dir <path>]` |
| SP6 consumes | `specs/2026-09-09-sp6-release-hardening-design.md:497`, `:505-508`; `plans/…sp6…:875-877` uses `promote <id> --dir <path>` |
| Decisions doc | `specs/…upgrade-decisions…:624` marks it `[ASSUMED]`; SP4 D4 settles it (`specs/…sp4…:36`) |

Argument order, the `--dir` flag, and the "hand-editing `status: active` is a reviewable smell, not a
blocked action" caveat all match across SP4 and SP6.

### 1d. `drain.mjs` — CONFIRMED, S1 (not in the brief; found here)

The same class of error as 1b, against SP3 instead of SP4.

| Side | Evidence |
| --- | --- |
| SP6 expects | `plans/2026-09-09-sp6-release-hardening.md:658`, `:722` — `runtime/drift/drain.mjs`, invoked as `drain.mjs --dir <dir> --json` |
| SP3 actually creates | `plans/2026-09-09-sp3-drift-loop.md:56` — `runtime/drift/drift.mjs`, a CLI with subcommands `status \| drain \| discard`; `:1142` usage string `drift.mjs <status\|drain\|discard> [--root <path>] [--dir <path>] [--base <ref>] [--json]` |

SP6 itself flags the risk without resolving it: `plans/…sp6…:658` says "**assumed shape**", and
`:1405` lists `drain.mjs`, `migrate.mjs`, `build-constitution.mjs promote` as names to be checked for
consistency — the check was never performed against SP3/SP4. Three defects, not one:
1. wrong module name (`drain.mjs` vs `drift.mjs`);
2. missing subcommand — SP3 requires a leading `drain` verb;
3. wrong root flag — SP6 passes `--dir <repo>`, but SP3's repo root flag is `--root`; `--dir` in SP3
   means the *decisions directory*, so SP6's call would point the drain's decision loader at the
   repository root.

Plus a semantic mismatch on the output shape — see I-2.

---

## Conflict 2 — skill count over time

**REFUTED.** Every plan's count is correct for its own position in the build order, and nothing
iterates skills by a hard-coded four.

| Plan | Ships | Correct count | Evidence |
| --- | --- | --- | --- |
| SP2 | 0.3.2 | four | `plans/…sp2…:30`, `:2441`, `:2495`, `:2612` — "all four skills" |
| SP4 | 0.3.3 | four | `plans/…sp4…:16`, `:29-30`, `:1587`, `:1590`, `:1954` — "all four `SKILL.md`" |
| SP5 | 0.3.4 | four → five | `plans/…sp5…:71-82` replaces `expectedSkillNames`; `:913`, `:961`, `:986`, `:1020` change each count phrase |
| SP3 | 0.3.5 | five | `plans/…sp3…:31`, `:57`, `:62`, `:1665`, `:1780` — "all five" |
| SP6 | 0.4.0 | five | `plans/…sp6…:8`, `:1148`, `:1223`, `:1331`; `specs/…sp6…:27`, `:408`, `:520` |

**Dynamic iteration confirmed.** The two mechanisms that fan out over skills are already
count-independent in shipped code and neither plan freezes them:
- `builders/sync-shared.mjs:10-15` `skillNames()` enumerates `skills/` at runtime. SP3 explicitly
  notes it "needs no change to fan out to five" (`plans/…sp3…:31`).
- `test/build.test.mjs:212`, `:298-300`, `:347`, `:386`, `:392` all derive from
  `canonicalSkillNames()`; only `expectedSkillNames` (`test/build.test.mjs:24`) is a deliberate
  hard-coded inventory, and SP5 owns updating it (`plans/…sp5…:71-82`, `:112`).
- SP5's codex-prompt assertion is written as `prompts.length >= skillNames.length`
  (`plans/…sp5…:840`, matching `test/build.test.mjs:386`) — not "four".

**One residual S3, listed under "Other findings" (O-1):** SP4 hard-codes the string "all four skills"
into a *data file* it creates (`test/scenarios/migration.json`'s `about`,
`plans/…sp4…:1983`) and into `shared/migrating-decisions.md` prose (`plans/…sp4…:2213`). Both are
correct at 0.3.3 and stale at 0.3.4, and SP5's edit list does not include either
(`plans/…sp5…:50`). Neither file is in `skillCountedDocumentation` (`test/build.test.mjs:54-61`), so
nothing catches it.

---

## Conflict 3 — shared-reference fan-out

**REFUTED.** Both plans extend the hard-coded `SHARED` array *and* both halves of the test contract.

Shipped state: `builders/sync-shared.mjs:8` —
`const SHARED = [{ source: "shared/recording-decisions.md", reference: "recording-decisions.md" }];`
`test/build.test.mjs:48` `requiredReferences` and `:458-463` (the byte-identity sync assertion) are
the two assertions that must move with it.

| Plan | `SHARED` extended | `requiredReferences` extended | sync assertion extended |
| --- | --- | --- | --- |
| SP4 (`migrating-decisions.md`) | `plans/…sp4…:1559-1564` | `plans/…sp4…:1607` | `plans/…sp4…:1544-1547` |
| SP3 (`observing-drift.md`) | `plans/…sp3…:1771-1776` | `plans/…sp3…:1799` | `plans/…sp3…:1799` — generalises the assertion "to iterate both shared files" |

SP3's approach is the better of the two: it generalises the sync test to loop over `SHARED` rather
than adding a third copy-paste block. SP4 adds a parallel block instead
(`plans/…sp4…:1544-1547`); harmless, but SP3 then has to refactor it.

**However, this conflict's *consequence* on SP5 is real and unowned — see Conflict 3b.**

### Conflict 3b — SP5's new skill does not carry SP4's shared reference. CONFIRMED, S1.

SP4 (0.3.3) adds `migrating-decisions.md` to `requiredReferences`
(`plans/…sp4…:1607`). SP5 (0.3.4) then creates `skills/threat-model/` — and its plan was written as
though only `recording-decisions.md` is shared.

| Side | Evidence |
| --- | --- |
| SP4 makes it required | `plans/…sp4…:1607` — `requiredReferences = [..., "recording-decisions.md", "migrating-decisions.md"]` |
| SP5's reference inventory omits it | `plans/…sp5…:7` "a lean `SKILL.md` plus four references (`decision-tree.md`, `catalog.md`, `evidence.md`, `agent-agency.md`) and the generated `recording-decisions.md`" |
| SP5's file table omits it | `plans/…sp5…:46` lists only `references/recording-decisions.md` as generated |
| SP5's SKILL.md citation table omits it | `plans/…sp5…:652` "covering all four references plus `references/recording-decisions.md`. This table is what satisfies the two-way citation test" |
| SP5's sync expectation is arithmetically wrong | `plans/…sp5…:707` "Expected: `Synced 1 file(s)`" — after SP4, `syncShared` fans out two files into a new skill, so it prints `Synced 2 file(s)` |

Three distinct failures at 0.3.4: the `requiredReferences` assertion
(`test/build.test.mjs:234`) fails for `threat-model`; the SKILL.md→reference citation assertion
(`:247-248`) fails because nothing in `threat-model/SKILL.md` mentions
`references/migrating-decisions.md`; and SP5's own verification step at `:707` asserts the wrong
number. SP5 also never asks whether `threat-model` *should* offer the migration mode at all — a
design question, not just a wiring one.

---

## Conflict 4 — concurrent edits to `runtime/baseline/decisions.mjs`

**REFUTED — the changes compose.** Four of the five sub-projects touch the file or its exports, but
in disjoint regions and in build order.

| Plan | Touches | Where | Region |
| --- | --- | --- | --- |
| SP2 (0.3.2) | **modifies** `KNOWN_TOOLS`, adding `"ast-grep"` | `plans/…sp2…:85`, `:396`, `:517`, `:539` | the `KNOWN_TOOLS` const |
| SP4 (0.3.3) | **modifies** `parseDecision`'s return, adding `body` | `plans/…sp4…:82-131` (Task 1), esp. `:118` "add `body,` next to" | `parseDecision`'s return statement |
| SP5 (0.3.4) | **reads only** — greps for `osv-scanner` in `KNOWN_TOOLS` to decide prose | `plans/…sp5…:31`, `:508` | none |
| SP3 (0.3.5) | **imports only** `parseDecision`, `validateDecisions` | `plans/…sp3…:879`, `:1130` | none |

`KNOWN_TOOLS` (`runtime/baseline/decisions.mjs:55` area) and `parseDecision`'s return
(`:112-118` area) are separate declarations; SP2 lands first and SP4's diff does not overlap it.
SP4 additionally self-audits the composition (`plans/…sp4…:46`, `:2321`) and confirms `body` is
purely additive, so SP2's and SP3's imports of `parseDecision` are unaffected.

One benign ordering note: SP5's conditional prose depends on whether SP2 added `osv-scanner`. SP2's
plan adds only `"ast-grep"` (`plans/…sp2…:517`), so SP5's `grep` will not match and the
supply-chain row will read *"no supply-chain tool is bound in this package"*
(`plans/…sp5…:31`). That is the documented fallback and it is correct — but it means the
`osv-scanner` binding the decisions doc floats at A21 never ships in 0.3.2–0.4.0. Worth stating
explicitly in SP6's release doc rather than leaving it implied.

---

## Conflict 5 — the rule-id supersession bug

**CONFIRMED, and NO plan fixes it. S2.**

The bug, in shipped 0.3.1 code:

```
runtime/baseline/decisions.mjs:126-138
  const ruleIds = new Map();
  ...
    for (const rule of decision.rules) {
      if (ruleIds.has(rule.id)) {
        errors.push(`rule id '${rule.id}' is declared by both ${ruleIds.get(rule.id)} and ${decision.filename}`);
      }
      ruleIds.set(rule.id, decision.filename);
```

The loop that walks `decision.rules` carries **no `decision.status` guard**, even though the very
next block (`:143`) does branch on `status === "superseded"`. So a decision that supersedes another
may not restate the superseded decision's rule id — which is exactly what supersession is for.

**Exhaustive search across all ten documents found no fix.** The only mentions of rule-id or
supersession semantics are unrelated:

| Document | Line | What it actually says |
| --- | --- | --- |
| SP4 | `plans/…sp4…:1348` | `promoteStatusLine` refuses to promote a `superseded` decision — a different rule |
| SP4 | `plans/…sp4…:2008` | a scenario asserting the traceability report *names* candidate conflicts and never auto-supersedes |
| SP2 | `plans/…sp2…:1444` | `extractIds` reading TOML quoting — unrelated to `ruleIds` |

SP5 is where the bug bites, and SP5 works around it rather than fixing it:
`specs/2026-09-09-sp5-security-skill-design.md:62` (S8) records the growth to five skills as a **new
decision `0003`** rather than superseding `0002`, and `:357` justifies leaving `0002`'s
`skill-frontmatter-is-frozen` rule in place because "the existing statement is still true of the four
it names". `plans/…sp5…:1287` and `:1302` then acknowledge the consequence in plain terms:
*"Decision 0002's skill-frontmatter-is-frozen rule still names four skills"* — a stale rule left
standing in a generated constitution because the schema module would not accept a superseding
restatement.

**Right owner: SP2.** It is the only sub-project that already opens `runtime/baseline/decisions.mjs`
for a semantic change to validation-adjacent code (`KNOWN_TOOLS`, `plans/…sp2…:517`), it already
ships `test/baseline.test.mjs` changes (`:539`), and it is **first** in the build order — so fixing
it at 0.3.2 means SP5 can supersede `0002` properly at 0.3.4 instead of accreting a workaround, and
SP6 has no stale rule to audit around. SP4 is the fallback owner (it also edits the file and ships
before SP5), but by then SP5 is only one release away and SP2 is free.

---

## Conflict 6 — constitution wording

**REFUTED. No other plan, assertion, or golden fixture depends on the old wording.**

Shipped wording: `runtime/baseline/constitution.mjs:10` —
`` `Verified by \`${rule.verifiedBy}\` — binding shape checked; the contract itself is not yet resolved.` ``

SP2 changes it and correctly claims the whole blast radius:

| Item | Evidence |
| --- | --- |
| SP2 spec announces the change | `specs/2026-09-09-sp2-deterministic-checkers-design.md:225-228` |
| SP2 plan's file list includes the fixture | `plans/…sp2…:86` — `runtime/baseline/constitution.mjs` (`verificationNote()` wording), `test/fixtures/constitution.md` |
| SP2 asserts the old wording is gone | `plans/…sp2…:2362` `assert.doesNotMatch(rendered, /the contract itself is not yet resolved/)` |
| SP2 records it as a behaviour change | `plans/…sp2…:2585-2586` |

The only other place the string lives is the golden fixture `test/fixtures/constitution.md:16`, which
SP2 owns. Searches across all five specs and all five plans for
`not yet resolved` / `binding shape checked` / `verificationNote` return hits **only** in SP2's own
two documents. SP3's injection packet reads the constitution's *rule list*, not the verification note
(`plans/…sp3…:581` "the session-start hook prints the rule list from the constitution";
`:1933` asserts on rule ids and `judgement`, never on note text). SP6's assertions reference rule ids
and `check-rules` statuses, never the note. SP5 regenerates `docs/architecture/constitution.md`
(`plans/…sp5…:50`) but asserts nothing about note wording.

One S3 note: `docs/architecture/constitution.md` is generated and committed. SP2 must regenerate it
at 0.3.2 or the committed copy drifts from the generator. `plans/…sp2…:2410` observes that the
repo's own constitution "carries only `review`-severity rules today, so `verificationNote()`'s
`deterministic` branch is [not exercised]" — which is why this is cosmetic here, but the regeneration
step should still be explicit.

---

## Conflict 7 — the builder capability for writing inside a target tree

**REFUTED. SP3 specifies it in full, and no earlier plan assumes it exists.**

0.3.1's builder writes only two kinds of file into a target tree — copied trees and *root* files
(`builders/build.mjs:207-225` `runtimeTrees`; adapters' `rootFiles`, e.g.
`builders/adapters/claude.mjs:60-66`) — and the decisions doc says so at
`specs/…upgrade-decisions…:95`. A hook manifest at `build/claude/hooks/hooks.json` is neither.

SP3 adds the capability explicitly and guards it:

| Element | Evidence |
| --- | --- |
| New adapter field `targetFiles` | `plans/…sp3…:1374`, `:1467`, `:1639` — `targetFiles: [{ path: "hooks/hooks.json", render: hooks }]` |
| Contract validation `assertTargetFileBoundaries` | `plans/…sp3…:1398`, `:1415-1444` — rejects duplicates and refuses to inject into a copied tree |
| Package-level allowlist `generatedTargetFiles` | `plans/…sp3…:1439`, `:1517`, `:1543` — mirrors 0.3.1's `generatedRootFiles` in `package.json:37-47` |
| Write ordering | `plans/…sp3…:1473-1482` — after every copy and `assertCopiedExactly`, so byte-identity failures stay attributable |
| Codex opts out explicitly | `plans/…sp3…:1591-1595`, `:1642-1644` — `expectedGeneratedTargetFiles.codex = []` |
| Modified-files list is complete | `plans/…sp3…:62` — `builders/build.mjs`, both adapters, `package.json`, `test/build.test.mjs` |

SP5 (0.3.4, *before* SP3) explicitly forbids itself from assuming any of it:
`plans/…sp5…:26` — *"**SP3 does not exist.** Nothing written here may mention hooks, the drift queue,
`SessionStart`, `PostToolUse`, or the drain."* SP5's modified-file list (`:50`) contains no builder
change beyond the two adapters' catalog descriptions.

SP6 (0.4.0, *after* SP3) assumes hooks exist, which the build order permits:
`plans/…sp6…:23-25` names SP3's `runtime/drift/` and hook manifest as already shipped at 0.3.5;
`specs/…sp6…:471-473` asserts the registration is picked up. Correct ordering.

---

## Conflict 8 — versions

**REFUTED. Every plan states its own version, and 0.4.0 appears outside SP6 only as an explicit
reservation.**

| Plan | Declares | Sets it | 0.4.0 mentions |
| --- | --- | --- | --- |
| SP2 | 0.3.2 | `plans/…sp2…:42`, `:2536` | `:42-43`, `:2591`, `:2639` — all "reserved for SP6", plus a release-check grep |
| SP4 | 0.3.3 | `plans/…sp4…:2132`, `:2143`; `specs/…sp4…:256` | `specs/…sp4…:257` — "matching the reservation of `0.4.0` for SP6" |
| SP5 | 0.3.4 | `plans/…sp5…:24`, `:842`; `specs/…sp5…:329` | `:24`, `:882`, `:1394` — reservation + a grep asserting no match |
| SP3 | 0.3.5 | `plans/…sp3…:22`, `:1937` | `:22`, `:1988` — reservation + the same grep |
| SP6 | 0.4.0 | `plans/…sp6…:1343` | the only plan that claims it |

Three of the four earlier plans independently install the same guard —
`grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/` must return nothing
(`plans/…sp2…:43`, `plans/…sp3…:22`, `plans/…sp5…:1323`). SP4 states the reservation in prose
(`specs/…sp4…:257`) but does **not** install the grep — a small S3 asymmetry worth normalising.

---

## Other findings

### I-1. Migration CLI contract mismatch (S1) — the deep half of Conflict 1b

Beyond the filename, SP6 and SP4 disagree on **what the migration entry point is**:

| Dimension | SP6 expects (`plans/…sp6…:832-861`) | SP4 ships (`plans/…sp4…:1024-1035`, `:1130-1143`, `:1221`) |
| --- | --- | --- |
| Module | `runtime/migration/migrate.mjs` | `runtime/migration/build-migration-report.mjs` |
| Inputs | repeated `--inputs <path>` naming prose ADRs | `--manifest <path>` (required) — a manifest file produced by a *separate* discovery + human-classification step |
| Repo/dir flag | `--dir <repo root>` | `--dir <decisions directory>` (required) |
| Output | `--json` on stdout, parsed as `{reportPath, proposed:[{id, status, rules:[{verification}]}]}` | no `--json` at all; returns an exit code (`0` ok, `1` usage/parse/validation/cap) and writes `migration-report.md` beside the decisions directory |
| Who writes decision files | implied: the CLI produces `proposed` decisions | SP4's model-facing `shared/migrating-decisions.md` procedure writes them; the CLI only *reads* an existing decisions directory and renders traceability (`plans/…sp4…:1151`, `:1221`) |

SP6's E2E-3 therefore asserts against an artifact SP4 never produces (`result.proposed`) and a report
path SP4 never returns (`result.reportPath`). This is the single most expensive item in this audit:
it is not a rename, it is a different decomposition of the migration workflow.

### I-2. Drift packet output-shape mismatch (S1) — the deep half of Conflict 1d

| Dimension | SP6 expects (`plans/…sp6…:726-745`) | SP3 ships (`plans/…sp3…:1081-1114`) |
| --- | --- | --- |
| Top-level keys | `{narrativeSkipped, findings:[{ruleId, category}]}` | `{..., narrativeSkipped, rules:[{..., judgement, checker:{status, evidence}}], base, queue, outOfScope}` |
| Per-rule identity | `f.ruleId` | rules carry the decision-schema `id` |
| Per-rule verdict | `f.category` — values `"unavailable"`, `"review-finding"` | `judgement` (`JUDGEMENT[rule.verification]`, values include `"required"`, `"forbidden"`) plus a verbatim `checker.status` |

`narrativeSkipped` is the one key both sides agree on (`plans/…sp3…:932`, `:1114` vs
`plans/…sp6…:727`). Everything else diverges — and one divergence is *architectural*, not cosmetic:
SP6's `category` is a **classification**, but SP3's central design commitment is that the drain emits
"an evidence packet that **expresses no opinion**" and that classification is the model's job
(`plans/…sp3…:7`; `specs/…sp3…:389`). SP6's E2E-2 asserts
`detTool.category === "unavailable"` and `!== "review-finding"` — i.e. it expects the runtime to have
already classified. If SP6's assertions were implemented literally, SP3's core guarantee would have
to be abandoned.

### I-3. `check-rules --json` envelope key mismatch (S2) — SP2 → SP3

SP3 reads the wrong key from SP2's JSON, and the failure is **silent**.

| Side | Evidence |
| --- | --- |
| SP2 emits | `plans/…sp2…:2221` — `JSON.stringify({ rows, skippedNonDeterministic }, null, 2)`; asserted at `:2028-2030` as `parsed.rows[0].rule` / `.status` |
| SP3 reads | `plans/…sp3…:1221` — `return Array.isArray(parsed) ? parsed : (parsed.rules ?? null);` |

`parsed.rules` is always `undefined`, so `checkerRows()` returns `null`, so every deterministic rule
in every packet is stamped `{status: "not-run", evidence: "check-rules did not run"}`
(`plans/…sp3…:1065`). That path is *tested* (`plans/…sp3…:33` calls it "a tested path, not a
degradation"), so **SP3's own suite would pass while the checker integration is entirely dead**. The
row *fields* match perfectly (`rule`, `tool`, `contract`, `status`, `evidence` at
`plans/…sp2…:2142-2168` vs SP3's `.rule` / `.status` / `.evidence` at `:1067-1069`) — only the
envelope key is wrong. This is the cheapest fix in the audit and the easiest to miss.

### I-4. SP3 invokes `check-rules` without `--run` (S2)

`plans/…sp3…:1214` spawns `[script, "--dir", directory, "--json"]` — no `--run`. Without it, SP2
reports resolution status only; the `unavailable` branch at `plans/…sp2…:2158-2163` sets
`evidence: "… — run with --run to evaluate"`. So a `pass`/`fail` verdict can never appear in a drift
packet. Meanwhile `specs/…sp3…:269` says the drain "shells out to SP2's `check-rules --json` and
**copies its verdict**", and `specs/…sp3…:408` shows `check-rules --run --require-tools` in the lane
table. The omission may well be deliberate (keeping the drain off the edit critical path — the same
motivation as the `async` PostToolUse hook at `plans/…sp3…:1570`), but no document says so, and
SP6's E2E-2 expects `category: "unavailable"` for a deterministic rule (`plans/…sp6…:744`), which is
consistent with *not* running. **Decide it explicitly and write it down**; right now two documents
imply opposite things.

### O-1. "Four skills" frozen into files SP5 does not update (S3)

SP4 creates two artifacts containing the literal count, and SP5's edit list omits both:

| File | Created by | Line | SP5 covers it? |
| --- | --- | --- | --- |
| `test/scenarios/migration.json` (`about`) | SP4 | `plans/…sp4…:1983` — "the two modes shared by all four skills" | No — `plans/…sp5…:50` lists only `test/scenarios/baseline-capture.json` |
| `shared/migrating-decisions.md` | SP4 | `plans/…sp4…:2213` — "(shared by all four skills)" | No |

Neither file is in `skillCountedDocumentation` (`test/build.test.mjs:54-61`), so the count test
cannot catch it. Note SP5 *did* handle the analogous case for the pre-existing scenario file
(`plans/…sp5…:1020`, changing `baseline-capture.json`'s `about` from four to five) — it simply could
not see SP4's not-yet-written file. SP3 has the same exposure for `test/scenarios/drift-drain.json`,
but it ships at five so it writes "five" from the start (`plans/…sp3…:1916`).

### O-2. `docs/validating-skills.md` is edited by three plans, uncoordinated (S3)

`plans/…sp5…:50` (adds the security set), `plans/…sp4…:2269` (adds `test/scenarios/migration.json`
"alongside the existing two sets"), `plans/…sp3…:1916` (adds `test/scenarios/drift-drain.json`
"beside the two existing sets"). Both SP4 and SP3 say **"the existing two sets"**, but in build order
SP4 makes it three and SP5 makes it four, so by the time SP3 runs there are four existing sets, not
two. Prose-only, but each plan's instruction is written against a stale baseline. SP5 also changes
"shared by all four skills" → five in the same file (`specs/…sp5…:349`).

### O-3. No two plans create the same file — no hard collisions

Every `Create:` path across the five plans is disjoint. `runtime/checkers/*` (SP2),
`runtime/migration/*` (SP4), `skills/threat-model/*` + `test/scenarios/security.json` (SP5),
`runtime/drift/*` + `test/scenarios/drift-drain.json` (SP3), `test/e2e/*` + `test/fixtures/e2e/*`
(SP6). Shared *modified* files (`test/build.test.mjs`, `package.json`, `builders/sync-shared.mjs`,
`runtime/baseline/decisions.mjs`, `docs/validating-skills.md`) are all touched in distinct regions
and in build order — see Conflicts 3, 4, 8 and O-2.

### O-4. Stated dependencies match the build order

`plans/…sp2…:2591` ("Sub-project 2 of six, build order SP2 → SP4 → SP5 → SP3 → SP6"),
`plans/…sp4…:2235` (same order restated), `plans/…sp5…:845` ("otherwise, stop — the build order in
the decisions doc C1 was not followed"), `plans/…sp3…:27` ("assumes SP2, SP4 and SP5 have shipped"),
`plans/…sp6…:23-25` (names SP2/SP4/SP5/SP3 artifacts with their shipping versions). All consistent.
SP6 even anticipates SP2 running first (`plans/…sp6…:492`). The dependency *graph* is right; the
defects above are all about the *content* of the interfaces, not their order.

---

## Prioritised fix list

Ordered by cost-if-it-reaches-implementation. Each names exactly one owning plan.

| # | Sev | Owner | Exact edit |
| --- | --- | --- | --- |
| 1 | S1 | **SP6 plan** (`plans/2026-09-09-sp6-release-hardening.md`) | Rewrite E2E-3 (`:786-877`) against SP4's actual decomposition. Replace `migrate.mjs` with the real two-step flow: `runtime/migration/discover-candidates.mjs` to list, then `runtime/migration/build-migration-report.mjs --manifest <path> --dir docs/architecture/decisions`. Drop `--inputs` and `--json`; assert on the **exit code** and on the contents of `docs/architecture/migration-report.md`, not on a parsed `{reportPath, proposed}`. Since SP4's CLI does not author decision files, the fixture must ship pre-written `status: proposed` decisions, or the test must exercise the model-facing `shared/migrating-decisions.md` procedure instead of a CLI. Update `:259`, `:294`, `:790`, `:815`, `:1405`. |
| 2 | S1 | **SP6 plan** (`plans/2026-09-09-sp6-release-hardening.md`) | Rewrite E2E-2 (`:658`, `:715-745`) against SP3's actual drain. Name it `runtime/drift/drift.mjs`; invoke `drift.mjs drain --root <dir> --json` (subcommand present, `--root` not `--dir`). Replace the `{findings:[{ruleId, category}]}` assertions with SP3's packet shape — `rules[]` carrying `judgement` and a verbatim `checker.{status,evidence}` — and **assert the absence of a classification**, which is SP3's actual guarantee (`plans/…sp3…:7`; `specs/…sp3…:389`). Keep `narrativeSkipped`; it is the one key both sides already agree on. |
| 3 | S2 | **SP3 plan** (`plans/2026-09-09-sp3-drift-loop.md`) | `:1221` — change `parsed.rules ?? null` to `parsed.rows ?? null`, matching SP2's `JSON.stringify({ rows, skippedNonDeterministic })` at `plans/…sp2…:2221`. Add a test that asserts a non-`not-run` checker status reaches a packet, so the dead-integration path cannot pass silently again. |
| 4 | S2 | **SP2 plan** (`plans/2026-09-09-sp2-deterministic-checkers.md`) | Fix the rule-id supersession bug. In `runtime/baseline/decisions.mjs:126-138`, skip decisions whose `status === "superseded"` when populating `ruleIds` (mirroring the existing `:143` status branch), so a superseding decision may restate a superseded rule id. Add the regression test to `test/baseline.test.mjs`, which SP2 already modifies at `:539`. Owned by SP2 because it ships first and already opens this file; fixing it at 0.3.2 lets SP5 supersede `0002` properly instead of leaving the stale "four skills" `skill-frontmatter-is-frozen` rule (`plans/…sp5…:1287`, `:1302`). |
| 5 | S1 | **SP5 plan** (`plans/2026-09-09-sp5-security-skill.md`) | Account for `migrating-decisions.md`, which SP4 makes mandatory one release earlier (`plans/…sp4…:1607`). Add it to the reference inventory (`:7`), to the generated-files table (`:46`), and to `threat-model/SKILL.md`'s references table (`:652`) so the two-way citation test at `test/build.test.mjs:234`/`:247` passes. Correct `:707` from `Synced 1 file(s)` to `Synced 2 file(s)`. Decide and record whether `threat-model` offers the migration mode. |
| 6 | S2 | **SP3 plan** (`plans/2026-09-09-sp3-drift-loop.md`) | Resolve the `--run` question at `:1214`. Either add `--run` (and reconcile with the async/off-critical-path design), or keep it off and **state the reason** — then fix `specs/…sp3…:269` ("copies its verdict") and `:408` (which shows `--run --require-tools`) so the spec stops implying `pass`/`fail` verdicts the drain can never observe. |
| 7 | S3 | **SP5 plan** (`plans/2026-09-09-sp5-security-skill.md`) | Extend the four→five sweep (`:50`, Task at `:900-1054`) to the two files SP4 creates one release earlier: `test/scenarios/migration.json`'s `about` (`plans/…sp4…:1983`) and `shared/migrating-decisions.md` (`plans/…sp4…:2213`). Optionally add both to `skillCountedDocumentation` (`test/build.test.mjs:54-61`) so the next count change is caught mechanically. |
| 8 | S3 | **SP3 plan** (`plans/2026-09-09-sp3-drift-loop.md`) | `:1916` — "beside the two existing sets" is stale; by 0.3.5 there are four (`test-patterns`, `baseline-capture`, `migration`, `security`). Same correction belongs in SP4 at `plans/…sp4…:2269` ("alongside the existing two sets" → three). Small, but `docs/validating-skills.md` is edited by three plans in a row with no coordinating owner. |
| 9 | S3 | **SP4 plan** (`plans/2026-09-09-sp4-migration-bootstrap.md`) | Add the `0.4.0`-reservation grep that SP2 (`:43`), SP5 (`:1323`) and SP3 (`:22`) all install, so all four pre-SP6 releases guard the reserved version identically. SP4 currently states the reservation in prose only (`specs/…sp4…:257`). |
| 10 | S3 | **SP2 plan** (`plans/2026-09-09-sp2-deterministic-checkers.md`) | Make the regeneration of the committed `docs/architecture/constitution.md` an explicit step alongside the `verificationNote()` change (`:2374-2378`), so the committed copy cannot drift from the generator. Cosmetic today (`:2410`: no deterministic rules in this repo's own baseline yet), consequential once SP5 adds security rules. |
| 11 | S3 | **SP6 plan** (`plans/2026-09-09-sp6-release-hardening.md`) | State in the 0.4.0 release doc that `osv-scanner` is **not** in `KNOWN_TOOLS` (SP2 adds only `ast-grep`, `plans/…sp2…:517`), so `threat-model`'s supply-chain row ships as the `review`/`narrative` fallback (`plans/…sp5…:31`). Decisions-doc A21 stays open; say so rather than leaving it implied. |
