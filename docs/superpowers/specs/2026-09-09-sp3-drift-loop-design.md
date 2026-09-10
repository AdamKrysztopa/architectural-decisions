# Drift-observation loop — design

**Date:** 2026-09-09
**Status:** approved (design)
**Scope:** sub-project 3 of the arch-crew upgrade
**Target version:** 0.3.5
**Decisions source:** `docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md` (Part 2, Q3.1–Q3.7)

## Why

The baseline can already say what this repository decided (SP1) and, since SP2, whether a
`deterministic` rule's binding actually resolves. Nothing yet notices when the *code* moves away
from a rule between one `--check` and the next. A constitution nobody consults is a constitution
nobody obeys, and the failure is quiet: the rules stay green in CI because CI only compares the
rollup to its own inputs, never to the code.

This sub-project adds the loop that notices. It is deliberately the *smallest* thing that can
notice, because it is the only sub-project that runs on a hot path.

## Position in the sequence

SP3 is fourth of five, by the build order in C1: SP2 → SP4 → SP5 → SP3 → SP6. Three consequences
this design relies on rather than rebuilds:

- **SP2 exists.** `runtime/checkers/check-rules.mjs` resolves and (with `--run`) evaluates
  `deterministic` bindings, and returns the vocabulary
  `pass | fail | unbound | unreadable-config | unavailable | error`. SP3 **calls** it and never
  re-implements any part of it. Where SP2 says `unavailable`, SP3 says `unavailable`.
- **SP4 exists.** Migration, reverse discovery, the traceability report, and the `promote` verb all
  ship before SP3. When the drain concludes that a change is a *new decision*, it hands off to the
  capture step and to `promote` — it does not grow a second write path.
- **SP5 exists, and there are five skills.** The shared reference this sub-project adds is fanned
  into five `references/` directories, and five `SKILL.md` bodies cite it.

## What was verified against the host, and three corrections

The decisions document's Q3.1/Q3.2 answers were checked against the Claude Code hooks reference
(`https://docs.claude.com/en/docs/claude-code/hooks`) and the plugins reference
(`https://docs.claude.com/en/docs/claude-code/plugins-reference`) on 2026-09-09. Three of its
assumptions do not survive contact with the documented contract, and the design departs from them.

**Correction 1 — there is no `$CLAUDE_TOOL_INPUT_PATH`.** Q3.2 proposed the hook body

```sh
printf '%s\n' "$CLAUDE_TOOL_INPUT_PATH" >> .arch-crew/drift-queue.jsonl
```

No such environment variable is documented. Hook input arrives **on stdin as a JSON object**; the
edited path is `tool_input.file_path`. The documented environment for a hook is
`$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT`, `$CLAUDE_PLUGIN_DATA`, `$CLAUDE_ENV_FILE`,
`$CLAUDE_CODE_REMOTE`, and `$CLAUDE_CODE_BRIDGE_SESSION_ID`. As written, that hook would have
appended an empty line on every edit and the whole loop would have observed nothing, silently.

So the observer must parse JSON. The three ways to do that, and why one wins, are in **Cost
discipline** below.

**Correction 2 — `MultiEdit` does not exist.** Q3.1 named the matcher set
`Edit/Write/MultiEdit/NotebookEdit`. `MultiEdit` appears nowhere in the current hooks reference. The
tool names the reference documents for file writes are `Write`, `Edit`, and `NotebookEdit`. The
matcher is therefore `"Write|Edit|NotebookEdit"`, which the matcher rules evaluate as an exact-string
list (letters, digits, `_`, `-`, spaces, `,`, `|` only), not as a regular expression. A matcher of
`Edit.*` would have been a regex and would also have matched `NotebookEdit`; the exact list is what
we want, and it must stay in the exact-string character set to stay exact.

**Correction 3 — `Stop` can block, and its stdout is not context.** Exit 2 on `Stop` *prevents
Claude from stopping* and continues the conversation, capped at 8 consecutive blocks. And plain
stdout is added to Claude's context only on `UserPromptSubmit`, `UserPromptExpansion`,
`SessionStart`, and `PostModelSwitch` — not on `Stop`, where a successful hook's stdout goes to the
debug log. The `Stop` notice therefore has exactly one legal delivery mechanism: exit 0 with
`{"systemMessage": "..."}`, which is shown to the **user**, not to Claude. `Stop`'s
`hookSpecificOutput.additionalContext` is explicitly rejected here: it keeps the conversation going
under the same loop protections as `decision: "block"`, which is the opposite of a quiet notice.

### What else was verified, and relied on

| Fact | Where |
|---|---|
| `SessionStart` fires on `startup`, `resume`, `clear`, `compact`, `fork`; a matcher filters on that `source` | hooks ref, *SessionStart* |
| `SessionStart` plain stdout is added to Claude's context; `hookSpecificOutput.additionalContext` does the same with other fields alongside | hooks ref, *Exit code 0*, *SessionStart decision control* |
| `SessionStart` **cannot block**: exit 2 shows stderr to the user and the session proceeds | hooks ref, *Exit code 2 behavior per event* |
| `PostToolUse` **cannot block**: exit 2 shows stderr to Claude; the tool already ran | hooks ref, *Exit code 2 behavior per event* |
| `PostToolUse` input carries `tool_name`, `tool_input.file_path` (absolute, native separators), `cwd`, `tool_use_id` | hooks ref, *PostToolUse input* |
| `async: true` on a command hook runs it in the background without blocking; `decision`/`continue` have no effect; only `additionalContext` and `systemMessage` are delivered, on the next turn | hooks ref, *Run hooks in the background* |
| A command hook with `args` runs in **exec form**: `command` is resolved on `PATH`, `${CLAUDE_PLUGIN_ROOT}` is substituted into `command` and each `args` element, no shell | hooks ref, *Exec form and shell form*, *Reference scripts by path* |
| A hook that cannot start (missing interpreter) is a **non-blocking** error notice for these events | hooks ref, *Other exit codes* |
| A timed-out `command` hook is cancelled and its output discarded; `timeout` is in **seconds**, default 600 for command hooks | hooks ref, *Timeouts*, *Common fields* |
| Hook output strings are capped at **10,000 characters** | hooks ref, *JSON output* |
| Handlers run in the current directory; `${CLAUDE_PROJECT_DIR}` stays at the session's project root while the input `cwd` follows Claude into a worktree | hooks ref, *Hook handler fields*, *Reference scripts by path* |
| A plugin declares hooks in **`hooks/hooks.json` at the plugin root** | plugins ref, *Hooks*; hooks ref, *Hook locations* |

## Decisions taken

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| D1 | Three events: `SessionStart` injects, `PostToolUse` queues, `Stop` notices. No `PreToolUse`. | Blocking an edit at `PreToolUse`; a `Stop` classifier; no `Stop` hook at all |
| D2 | The `PostToolUse` observer is a **`async: true`** Node script that appends one line and does nothing else | A synchronous shell `printf` (impossible — correction 1); `jq` (not a Node builtin, not guaranteed present) |
| D3 | The queue is `.arch-crew/drift-queue.jsonl`, repo-local, untracked, append-only, capped | An OS temp directory; a path under the decisions directory |
| D4 | **`git` is the drain's primary input; the queue is an accelerator** | Queue-primary, which would make the whole feature hook-only and break Codex |
| D5 | The drain is split: a **runtime** emits an evidence packet with no judgement; the **model** classifies only what the packet permits it to | One model step that reads the repo and reports findings |
| D6 | The packet carries a per-rule `judgement: forbidden \| required \| skipped` field, so the honesty rule is **data**, not prose | Prose instruction alone, as 0.3.1 used for `status: proposed` |
| D7 | Six classes; **`violation` is reserved** for a tool that actually failed | One ranked findings list; a numeric score |
| D8 | The drain procedure lives in a new `shared/observing-drift.md`, a second `SHARED` entry | Appending a §6 to `shared/recording-decisions.md` |
| D9 | The builder gains **generated target files** — an adapter may write allowlisted JSON *inside* its own output tree | Committing `build/claude/hooks/hooks.json` by hand; shipping the manifest as a runtime file |
| D10 | The drift loop returns **no exit code that can fail a build** | A CI drain that posts findings and gates the merge |

---

## The event set

Three handlers, all declared in one generated `hooks/hooks.json` inside `build/claude/`.

### `SessionStart` — inject the active rules

Runs `runtime/drift/inject-rules.mjs`. It reads `constitution.md` — the same file, the same bytes,
that `shared/recording-decisions.md` §1 already tells every skill to read — extracts the `## Rules`
section, and prints a compact block: rule id, statement, severity, verification class, and scope.
Not the decision prose, not the `## Active decisions` list.

**The matcher is omitted deliberately**, so the hook fires on every `source`. An explicit
`startup|resume|clear|compact|fork` list would silently stop injecting if the host ever adds a sixth
source value, and a silently-absent injection is exactly the failure this loop exists to prevent.

It emits plain text on stdout, not JSON. `SessionStart` adds plain stdout to Claude's context
directly, so there is nothing to gain from building a JSON envelope, and one less way to fail schema
validation. Output is truncated to stay under the 10,000-character cap, with an explicit
`… N more rules; read constitution.md` line rather than a silent cut.

**It never claims freshness.** The constitution may be stale against its decision files; only
`build-constitution.mjs --check` can decide that, and deciding it here would cost a full render on
every session start. The injected block ends with one sentence naming the check.

This hook is an **optimisation, not the mechanism** — the wording is SP1's and it is binding. The
in-skill read in §1 remains the path that works everywhere.

### `PostToolUse` — queue the path

Matcher `"Write|Edit|NotebookEdit"`. Runs `runtime/drift/observe.mjs` with `async: true`. It reads
stdin, parses one JSON object, and appends one line to the queue. See **Cost discipline**.

### `Stop` — notice a non-empty queue

Runs `runtime/drift/notify.mjs`. No matcher (`Stop` has none). It stats the queue, counts lines, and
if the count is non-zero prints

```json
{"systemMessage": "arch-crew: 41 edits observed this session across 12 paths. Run the drift drain to classify them."}
```

then exits 0. On an empty or missing queue it prints nothing. It never emits `decision`, never emits
`hookSpecificOutput`, and **never exits non-zero** — exit 2 on `Stop` blocks the turn.

### Not used

- **`PreToolUse`.** Blocking an edit on architectural grounds is wrong: the evidence at that moment
  is at its weakest, and the whole `narrative`/`review`/`deterministic` vocabulary exists to stop
  weak evidence being asserted. Rule 7 says the same thing about cost.
- **`UserPromptSubmit`, `PostToolBatch`, `FileChanged`.** Nothing to observe, or a hot path with a
  worse cost profile. `FileChanged` is tempting — it catches a `Bash`-driven rewrite that
  `PostToolUse` misses — but it requires a session-scoped watch list and would have to be seeded
  from rule scopes at `SessionStart`, which is the precomputed-index design Q3.2 already rejected.
  The drain's `git` lane catches those edits anyway.

---

## Cost discipline

**The budget, stated as a rule the implementation is held to:** the `PostToolUse` handler must not
appear in the user's wall-clock latency, must perform a bounded, constant number of syscalls per
edit, and must never read the edited file, the constitution, the decisions directory, `git`, the
network, or a model.

Correction 1 forces a JSON parse. Three ways to do it:

| Option | Cost | Verdict |
|---|---|---|
| `jq -r '.tool_input.file_path'` | one process, but `jq` is not a Node builtin and is not guaranteed installed | **Rejected.** Zero-dependency means Node builtins only. A hook that works on the author's machine and no-ops silently elsewhere is worse than no hook |
| `sed`/`grep` over the JSON | no process beyond the shell | **Rejected.** JSON string escaping — and Windows backslash separators in `file_path` — make this a hand-rolled parser that misreads silently. `runtime/baseline/frontmatter.mjs` set the house rule: *a half-parser that silently misreads is worse than no parser* |
| `node observe.mjs` with `async: true` | one process start (~30–40 ms), **off the critical path** | **Chosen** |

`async: true` is what makes the process start acceptable: Claude Code starts the hook and continues
immediately without waiting. The 30–40 ms is real but it is not the user's latency, and the field is
documented for exactly this shape of work. Three consequences accepted openly:

- Async hooks cannot block or control Claude, which is what we want and now cannot accidentally
  change.
- Async hooks are killed at teardown in `-p` mode, finalized as `cancelled`. The queue is
  best-effort observation (D3); losing the last line of a headless run loses nothing that matters.
- Async hooks run unordered and concurrently. An append-only JSONL queue does not care.

The hook's own work, per edit, is fixed: one stdin read, one `JSON.parse`, one `stat` of the queue
(the cap check), one `appendFile` of a single short line. The line is written in one call with
`O_APPEND`; a line under `PIPE_BUF` does not interleave with a concurrent append.

**What the release gate asserts:** a trivial edit must never trigger a full-repository LLM review.
This is enforced by construction, not by intention — `observe.mjs` imports nothing from
`runtime/baseline/`, `runtime/checkers/`, or `node:child_process`, and a layer-1 test asserts that
its source contains none of those imports and that a run over a fixture stdin performs no `git`
subprocess. The classifier is not a hook at all; it cannot be reached from an edit.

---

## The queue

**Location.** `.arch-crew/drift-queue.jsonl`, resolved against `$CLAUDE_PROJECT_DIR` when set, else
the hook input's `cwd`, else `process.cwd()`. `$CLAUDE_PROJECT_DIR` first is deliberate: it stays put
when Claude enters a worktree, giving one stable queue per session, where `cwd` would scatter the
queue across worktrees mid-session. The cost is that a drain run *inside* a worktree must be pointed
at the project root; `drift status` prints the queue path it resolved, so the mismatch is visible
rather than silent, and `--root` overrides.

arch-crew **tells** the user to gitignore `.arch-crew/`; it does not edit `.gitignore`. Writing into
a user's config is the same class of act as writing into their tool config, which Q2.4 already
forbade.

**Schema.** One JSON object per line, append-only, never read-modify-written:

```json
{"t":"2026-09-09T12:04:11.412Z","path":"services/billing/db.py","tool":"Edit","session":"abc123"}
```

`path` is stored **repository-relative with `/` separators**, normalized from the absolute native
path the hook receives, so a queue written on Windows drains identically. A path outside the
resolved root is stored absolute and the drain reports it as out-of-tree rather than matching it
against a scope. Timestamps are fine here: this is state, not a `--check`ed artifact.

**Lifecycle.**

| Moment | What happens |
|---|---|
| Session start | `inject-rules.mjs` creates `.arch-crew/` if absent. Nothing else touches it |
| Each edit | one line appended |
| Stop | line count read; notice or silence |
| Drain | `rename` to `drift-queue.<pid>.draining`, process, `unlink` |
| Crash mid-drain | the `.draining` file survives; the next drain globs `drift-queue.*.draining` and processes them first, so nothing is lost and nothing is double-counted. Same temp-file-plus-rename discipline as `build-constitution.mjs` |
| `drift discard` | every queue and `.draining` file is unlinked. Losing them loses nothing: decision files are the only source of record |

**Abandoned mid-session.** Nothing special happens, and that is the design. A queue left behind is
just a queue with older timestamps; the next drain reads it and reports the span it covers
(`since` / `until`). The drain never assumes the queue describes the current session.

**Unbounded growth.** Two caps, both checked with the single `stat` the observer already does:
`MAX_QUEUE_BYTES = 1_048_576` and, at drain time, `MAX_QUEUE_LINES = 20_000`. At or above the byte
cap the observer appends nothing and exits 0 — it does not rotate, truncate, or warn, because all
three cost more than the observation is worth. The drain detects `size >= cap` and reports
*"queue at cap; edits after `<last t>` were not observed — the git lane still covers them"*. That
sentence is the point: hitting the cap degrades the queue to the Codex capability level, which is
still a working loop. **A malformed line is skipped with a counted warning, never fatal.**

---

## The drain

Not a hook. A step the model runs at a checkpoint, on a runtime that has already done every part a
tool can do.

### D5 — the split, and what each half may say

`node <plugin-root>/runtime/drift/drift.mjs drain [--root <path>] [--base <ref>] [--json]`

The **runtime** half emits an *evidence packet* and expresses no opinion. It:

1. resolves the queue, drains it, and collects its distinct paths;
2. collects `git diff --name-only <base>...HEAD`, plus `git status --porcelain` (which lists
   untracked files `git diff` misses — the hooks reference makes the same point about discovering
   changes) — `--base` defaults to `git merge-base HEAD <default-branch>`;
3. loads the decisions directory with SP1's `parseDecision` / `validateDecisions` and takes the
   `active` rules;
4. matches each path against each rule's `scope`;
5. for every `deterministic` rule, shells out to SP2's `check-rules --json` and copies its verdict
   **verbatim**;
6. stamps each rule with a `judgement` field.

```json
{
  "root": "/abs/repo",
  "base": "a1b2c3d",
  "queue": { "observed": 41, "paths": 12, "malformed": 1, "atCap": false,
             "since": "2026-09-09T12:04:11.412Z", "until": "2026-09-09T13:38:02.907Z" },
  "paths": [ { "path": "services/billing/db.py", "sources": ["queue", "git"], "tools": ["Edit"] } ],
  "rules": [
    { "id": "no-shared-db-writes", "decision": 4, "statement": "Services must not write to another service's tables.",
      "severity": "blocking", "verification": "deterministic",
      "verifiedBy": "import-linter#svc-db-isolation",
      "matched": ["services/billing/db.py"],
      "checker": { "status": "unavailable", "evidence": "import-linter not on PATH" },
      "judgement": "forbidden" }
  ],
  "narrativeSkipped": 3,
  "outOfScope": 7
}
```

The **model** half is `shared/observing-drift.md`. It may speak only where the packet says it may.

### D6 — `judgement` makes the honesty rule mechanical

| `verification` | `judgement` | What the model may do |
|---|---|---|
| `deterministic` | `forbidden` | Report `checker.status` and `checker.evidence` **verbatim**. Offer no opinion of its own — not when the status is `unavailable`, not when it is `unbound`, not when the tool passed |
| `review` | `required` | Inspect the change and classify it, under the evidence gate below |
| `narrative` | `skipped` | Nothing. Not classified, not graded, only counted |

This is rule 6 — *never use a model to approximate what a tool can verify* — expressed as a field
rather than a paragraph. Q3.5 named this "the single most likely place for this feature to go
wrong", and prose alone is what 0.3.1 already admitted is not enforcement. A layer-1 test asserts
the mapping is total and that no packet ever carries `judgement: "required"` on a `deterministic`
rule; a layer-2 scenario asserts the model does not substitute a judgement for an `unavailable`
tool.

### D7 — the six classes

Anchored as `###` headings in `shared/observing-drift.md`, so renaming one fails `npm test`.

| Class | Means | Requires |
|---|---|---|
| **Violation** | A `deterministic` rule whose bound contract a tool **ran and failed** | `checker.status === "fail"`. Nothing else in the system may produce this word |
| **Suspected drift** | A `review` rule the model believes the change contradicts | Rule id, file, **line**, and the specific text or structure that contradicts the `statement` |
| **Insufficient evidence** | A scoped path changed and the evidence supports no finding either way | Nothing. This is the honest default |
| **Legitimate evolution** | The change is a *new* architectural decision — a new boundary, a reversed dependency direction, a subject the constitution does not cover | A named subject and the rule it would supersede, if any |
| **Stale or contradictory documentation** | The *rule* is wrong, not the code: it names a module that no longer exists, contradicts another active rule, or describes a structure the repository abandoned | The rule id, and the evidence that its own referent is gone or contradicted |
| *(counted, not listed)* | Out of scope: the path matched no active rule's `scope` | — |

**Stale or contradictory documentation is new**, and it is the class this loop most needs. Without
it, a rule that has outlived its subject produces an unending stream of `unclear` findings and the
user learns to ignore the drain. Its remedy is the same as *Legitimate evolution* — a proposed
decision that supersedes — but its *evidence* is different, so it is a different class.

### D7, cont. — how a weak finding is stopped from becoming a violation

The discipline is `skills/test-patterns/references/oracles.md` transplanted, which the project has
already decided:

1. **"Violation" is a reserved word.** It is produced by `checker.status === "fail"` and by nothing
   else. A model that writes it about a `review` rule has made an error the scenario set fails it
   for.
2. **The four-part evidence gate.** A *Suspected drift* finding must name rule id, file, line, and
   the contradicting text or structure. **Missing any one of the four → it is downgraded to
   *Insufficient evidence*.** The gate question is oracles.md's: *name the source out loud; "it looks
   wrong" is not an answer.*
3. **A model may never stand in for an unavailable tool** — now enforced by `judgement: forbidden`
   (D6) rather than asked for.
4. **No score, no ratio, no headline count that mixes classes.** "3 findings" spanning one tool
   failure and two impressions is precisely the theatre the verification vocabulary exists to
   prevent. The report groups by class and states each class's evidentiary weight in words. This is
   the house rule already asserted by `no-ratios` in `test/scenarios/test-patterns.json` and by
   *"pass/fail with the reason, not a score"* in `docs/validating-skills.md`.
5. **"Nothing to report" is a normal, frequent, correct outcome**, and `drift-drain.json` contains a
   scenario where it is the only correct one.

### How legitimate evolution becomes a proposed baseline change

It is routed into the mechanism SP1 built and SP4 extended, and into no other:

1. The drain classifies it *Legitimate evolution* (or *Stale or contradictory documentation*) and
   says what the new decision would be **about** — it does not write it.
2. The user is asked. This is a checkpoint step with a human present; that is the whole reason the
   classifier is not a `Stop` hook.
3. On agreement, the run follows `shared/recording-decisions.md` unchanged: one new decision file,
   `status: proposed`, superseding rather than editing where a subject is already covered, prose of
   the old file untouched.
4. `renderConstitution()` filters on `status === "active"`, so the new file changes
   `constitution.md` by **exactly zero bytes** until a human runs SP4's `promote`. The gate is not
   added here; it already exists and is already mechanical.

A drift finding therefore has exactly two possible destinations — a conversation, or a `proposed`
decision file — and neither is a defect report filed against the developer.

---

## No LLM review may silently modify anything, and here is the enforcement

Four mechanisms, each testable. "The prompt says not to" is not on the list.

**1. No hook in the set can modify anything but the queue.** `inject-rules.mjs` opens
`constitution.md` read-only and creates one directory. `observe.mjs` appends to one file under
`.arch-crew/`. `notify.mjs` reads. None of the three imports `node:child_process`; none writes
outside `.arch-crew/`.
*Asserted by:* a layer-1 test that runs all three against a fixture repository and requires
`git status --porcelain` — excluding `.arch-crew/` — to be empty afterwards.

**2. No hook may exercise a mutating hook field.** The generated `hooks/hooks.json` and all three
scripts are asserted to contain none of `decision`, `updatedToolOutput`, `updatedInput`,
`updatedMCPToolOutput`, `permissionDecision`, `continue`, or a `PreToolUse` key. The only output
fields the loop is permitted to emit are `SessionStart` plain stdout and `Stop`'s `systemMessage`.
*Asserted by:* a layer-1 inventory test, hardcoded per C4, so adding a field costs a deliberate edit.

**3. The drain's runtime half writes nothing at all** except unlinking the queue slice it drained.
It does not write `constitution.md` (only `build-constitution.mjs` does, and per SP1 that script
never writes a decision file and never promotes a status). It does not write tool config (Q2.4). It
does not write a report file — there is no drift report artifact, deliberately, so there is no
generated file for a later run to quietly rewrite.
*Asserted by:* a golden-file test over a fixture repository — the packet is compared byte-for-byte
and the tree is compared before and after.

**4. The drain's model half has exactly one write verb**, and it is the already-gated capture step:
a new decision file at `status: proposed`. It cannot reach `constitution.md`, because
`renderConstitution()` filters on `active`. It cannot edit an existing decision's prose, because
§4 of the capture reference forbids it and `prose-preserved` grades it. After SP4, a diff showing
`status: active` outside a `promote` invocation is a reviewable smell.
*Asserted by:* `drift-drain.json` scenarios, including one whose correct outcome is that **no file
is written at all**.

## CI versus in-session, and exit codes

| Runs in CI | Runs in-session |
|---|---|
| `build-constitution.mjs --check` | `SessionStart` injection |
| `check-rules --run --require-tools` (SP2) | `PostToolUse` append |
| Nothing model-driven | `Stop` notice; the drain and its classifier |

**CI never reads the drift queue.** It is untracked, session-local, and host-specific; a build gate
must rest only on committed artifacts. `drift.mjs` is not part of any CI recipe this project ships.

| Command | `0` | `1` | `2` |
|---|---|---|---|
| `drift.mjs status` | always, queue empty or not | usage error; unreadable root | never |
| `drift.mjs drain` | a packet was produced — findings or not | tool could not do its job: no decisions directory, unparseable decision file, SP2 adapter crash | **never** |
| `drift.mjs discard` | queue removed, or absent | unwritable root | never |
| `inject-rules.mjs` / `observe.mjs` / `notify.mjs` | **always** | never emitted | never emitted |
| `build-constitution.mjs --check` (SP1, unchanged) | fresh | tool error | rollup stale |
| `check-rules` (SP2, unchanged) | resolved, nothing blocking | tool error | baseline violated |

**Every drift finding is advisory.** The drift loop contributes **no exit code that can fail a
build** — deliberately, and stated so that a later release cannot add one without contradicting this
document. Blocking outcomes are SP1's stale rollup and SP2's failed contract, both of which rest on
committed artifacts and a real tool's verdict. The alternative — a model in CI posting review
comments — is a real product and a different project.

## Codex, which has no hooks

**It degrades to the git lane, and the git lane is the primary one.** That is D4 doing its job.

| Capability | Claude | Codex |
|---|---|---|
| Constitution reaches the model | `SessionStart` hook (fast path) **or** the in-skill read | The in-skill read — shipped in every skill since 0.3.1 |
| Change observation | `git` **plus** the queue | `git` only |
| Drain runtime and evidence packet | identical | identical |
| Classifier and its six classes | identical | identical |
| Deterministic checking (SP2) | identical | identical |

`runtime/drift/` is copied byte-identically to both targets by the existing `canonicalRuntime`
mechanism (C2), so the scripts *ship* to Codex and are simply never invoked. Only the *registration*
is Claude-specific.

**What Codex actually loses,** stated honestly rather than minimised: `git status --porcelain`
already sees uncommitted edits, so the queue's marginal value is narrower than it first appears. It
is (a) attribution — which paths *this agent* edited, versus what was already dirty when the session
began; (b) paths edited and then committed mid-session, which `--base` may or may not span; and
(c) the tool and timing of each touch. On Codex the drain reports "no queue" in the `queue` block
rather than pretending, and every one of the six classes remains reachable.

That narrowness is not a defect in the design; it is the argument for the budget. **The design rule
to hold: if a capability only works with hooks, it is in the wrong place. Hooks may only make an
existing path cheaper.**

## Failure, timeout, and missing dependencies

Every row is non-blocking, and every row is a *named* state rather than silence.

| Failure | Behaviour |
|---|---|
| `node` not on `PATH` | The hook cannot start. Claude Code shows a non-blocking `Failed with non-blocking status code:` notice and the action proceeds. Editing is unaffected; nothing is queued. Visible afterwards: `drift status` reports an empty queue while `git` reports changes |
| `.arch-crew/` missing or unwritable | `observe.mjs` catches, writes nothing, exits 0. `inject-rules.mjs` creates it; if creation fails it still injects the rules |
| Queue at the byte cap | `observe.mjs` appends nothing, exits 0. The drain reports the cap and names the last observed timestamp |
| Malformed queue line | Skipped, counted, reported in `queue.malformed`. Never fatal |
| `constitution.md` missing | `inject-rules.mjs` prints one line naming the file and the generator that makes it, exits 0. The in-skill read handles the same case already |
| `constitution.md` unparseable or unexpected | The injector prints the raw `## Rules` section if it can find the heading, else the one-line pointer. It never throws and never guesses at structure |
| Hook exceeds `timeout` | Claude Code cancels it and discards its output. `SessionStart` → no injection this session; the in-skill read is the fallback. `PostToolUse` → `timeout` is not enforced once an async hook is running. `Stop` → no notice |
| SP2's `check-rules` absent or crashed | The packet marks `checker: {"status":"not-run","evidence":"check-rules did not run: <reason>"}` and the rule keeps `judgement: "forbidden"`. The drain still runs; the model still may not offer an opinion about it |
| `git` absent, or the root is not a repository | The drain runs on the queue alone, sets `base: null`, and says so. On Codex with no queue and no git, it reports that it observed nothing — never that nothing drifted |

**Every hook script wraps its whole body in one `try`/`catch` and exits 0 from the catch.** A
layer-1 test feeds each script malformed stdin, empty stdin, and stdin with a missing `file_path`,
and asserts exit 0 and an unchanged tree in every case. A hook that can break editing because a
directory is missing is worse than no hook, and this is where that is proven rather than promised.

## Packaging: the new builder capability

C2 established the gap: `builders/build.mjs` writes exactly two kinds of file into a target tree —
the copied runtime trees, and `adapter.manifestPath`. `rootFiles` go to the *repository* root. A
Claude hook manifest must live at `build/claude/hooks/hooks.json`, which no existing mechanism
produces.

**The capability: generated target files.** An adapter may declare additional generated JSON files
inside its own output tree, allowlisted in `package.json` exactly as `generatedRootFiles` already
is:

```json
"generatedTargetFiles": { "claude": ["hooks/hooks.json"], "codex": [] }
```

The adapter declares `targetFiles: [{ path, render }]`, and `build.mjs` gains three guards mirroring
the root-file ones: `assertTargetFileContract` (relative, unique, and the declared set equals the
allowlist), `assertTargetFileBoundaries`, and `assertGeneratedTargetInventory`.

**How byte-identity survives.** `assertCopiedExactly` is untouched, and three properties keep it
meaningful:

1. **Generated target files may not land inside a runtime tree destination.**
   `assertTargetFileBoundaries` rejects any path that resolves inside `skills/` or `runtime/` in the
   output tree — including a path *equal* to a destination. This is the guard that matters: without
   it, an adapter could inject a file into the copied `skills/` tree and the byte-identity assertion
   would start comparing a tree it does not own.
2. **Ordering.** Target files are written *after* every `cp` and its `assertCopiedExactly`, and
   after the manifest. A byte-identity failure therefore always names a canonical-vs-copied
   mismatch, never a generated file.
3. **JSON only, via the existing `writeJson`.** A hook manifest is a manifest. Markdown is still
   copied byte-for-byte and nothing is templated into a `.md`.

**How the inventory guarantee survives.** `build.mjs` gains `assertGeneratedTargetInventory`, which
asserts the output tree contains exactly `manifestPath` + `generatedTargetFiles` + the runtime trees'
files. `test/build.test.mjs`'s existing *"target inventories contain only their manifest, canonical
skills, and the runtime"* test is extended in the house style — the allowlist is **hardcoded** in
the test, not read from `package.json`, per C4, so deleting `hooks/hooks.json` from the package costs
a deliberate edit in two places:

```js
assert.deepEqual(generatedTargetFiles.claude, ["hooks/hooks.json"]);
assert.deepEqual(generatedTargetFiles.codex, []);
```

`generatedTargetFiles.codex` being empty is not an omission; it exercises the empty-allowlist path
and is the mechanical statement that the loop's Codex behaviour needs no registration.

**`${CLAUDE_PLUGIN_ROOT}` in the manifest is not prose templating.** It is a literal string in
generated JSON that Claude Code substitutes at hook-run time. The no-templating rule governs
Markdown, and the prose reference continues to name both resolution methods in a sentence exactly as
`shared/recording-decisions.md` §5 does.

## The shared reference

**`shared/observing-drift.md`**, a second entry in `sync-shared.mjs`'s `SHARED` array, fanned into
all five skills' `references/` and committed. Each of the five `SKILL.md` **bodies** gains a citation
— required in both directions by `build.test.mjs`, and frontmatter is untouched.

It is **not** a §6 appended to `shared/recording-decisions.md`. That file is 84 lines and is loaded
on every capture; the drain is a checkpoint activity that most captures never perform, and doubling
the file's size for material most runs never need is precisely what `CLAUDE.md`'s topic-reference
rule warns against. The cost of the split is five body edits, which SP6's body-hash manifest will
record.

Contents: the drain invocation, how to read the packet, the `judgement` contract, the six `###`
class headings, the four-part evidence gate and its downgrade rule, and the handoff to
`recording-decisions.md` for *Legitimate evolution* and *Stale or contradictory documentation*. It
does not restate the capture procedure; it points at it.

## Validation

**Layer 1 — package contract.** New `test/drift.test.mjs` over fixtures in `test/fixtures/drift/`,
added to the `test` script. The three house patterns apply: golden-file byte comparison of the
evidence packet; shuffled queue-line order producing an identical packet; and loud failure with a
line number on an unsupported `scope` glob.

- glob subset: `**`, `*`, `?`, literal segments; anything else (`{a,b}`, `[a-z]`, `!`) fails naming
  the rule id and the pattern
- queue: append is atomic under concurrency; malformed line skipped and counted; byte cap honoured;
  `rename`-then-unlink loses nothing on a simulated mid-drain crash; a stray `.draining` file is
  picked up by the next drain
- packet: `judgement` mapping is total; `deterministic` never yields `judgement: "required"`;
  `narrative` rules appear only in `narrativeSkipped`; SP2's verdict is copied verbatim
- hooks: each script exits 0 on malformed, empty, and `file_path`-less stdin; the tree is unchanged
  outside `.arch-crew/`; `observe.mjs` imports no checker, no baseline module, and no
  `node:child_process`
- packaging: `hooks/hooks.json` present in `build/claude` and **absent** from `build/codex`;
  `runtime/drift/` byte-identical in both; a target file declared inside a runtime destination
  throws; the hardcoded inventory above
- degradation: the drain produces a packet with `base` set and `queue.observed: 0` when no queue
  exists — the Codex lane, exercised in layer 1

**Layer 2 — `test/scenarios/drift-drain.json`.** Follows the shape of `baseline-capture.json`
(criteria plus forces-and-expect scenarios), with `expect.class` resolved against the `###` headings
in `shared/observing-drift.md` so renaming a class fails `npm test`. It must contain the outcomes
that are easy to lose:

- a `deterministic` rule whose tool reports `unavailable` → the run reports `unavailable` and offers
  **no** judgement
- a `review` rule with a specific contradiction at a named line → *Suspected drift*
- the same rule with only an impression → **downgraded** to *Insufficient evidence*
- a new boundary in a subject the constitution does not cover → *Legitimate evolution*, and a
  `proposed` decision file, and `constitution.md` byte-unchanged
- a rule naming a module that no longer exists → *Stale or contradictory documentation*
- **a drained queue whose correct outcome is "nothing to report" and no file written**
- a `narrative` rule whose scope was touched → not classified, only counted

## Out of scope

CI-side drain and review comments; a drift report artifact; a `PreToolUse` gate; a precomputed
rule-scope index; `FileChanged` watches; auto-promotion; editing `.gitignore`; any drift state in
`constitution.md` (Q2.6 already forbids it — resolution status is a property of the working tree and
would make `--check` fail for reasons unrelated to decisions); Codex hook emulation; a config file.

## Risks

- **The hooks contract is a moving target.** Three of the decisions document's assumptions were
  already wrong (corrections 1–3). Mitigated by exec-form path placeholders, an omitted
  `SessionStart` matcher, exit-0-always scripts, and by the fact that every capability degrades to
  the git lane. The residual risk is a *silently* absent hook; `drift status` printing its resolved
  queue path is the cheapest available detector.
- **`async: true` is load-bearing for the budget.** If it is ever unavailable or ignored, the
  observer becomes a synchronous 30–40 ms tax on every edit. Named here so the fallback is a
  decision, not a discovery.
- **The queue's marginal value over `git status --porcelain` is modest.** Accepted, and it is the
  reason the budget is severe rather than the reason to skip the queue.
- **Five `SKILL.md` body edits.** A triggering regression would be silent. Frontmatter is untouched
  and the layer-2 sets re-run before release, per SP6.
- **The model classifying `review` rules is the weakest link by construction.** Mitigated by
  `judgement`, the four-part gate with a mandatory downgrade, the reserved word, and a scenario set
  that grades the downgrade explicitly. It is not eliminated, and this document does not claim it is.

## Refinements to the decisions document

Flagged per its own protocol: SETTLED is binding, ASSUMED is refinable with a flag.

| Item | Refinement |
|---|---|
| **A9** (Q3.2) | The shell-`printf` observer is **not implementable** — `$CLAUDE_TOOL_INPUT_PATH` does not exist. Replaced by an `async: true` Node observer with the budget stated above. The decision's *intent* — no matching, no index, no analysis on the hot path — is preserved exactly |
| **A8** (Q3.1) | `MultiEdit` removed from the matcher; the set is `Write\|Edit\|NotebookEdit`. The `Stop` notice is kept, delivered as `systemMessage`, and must exit 0 because exit 2 on `Stop` blocks the turn |
| **A12** (Q3.4) | Five classes become six. `checked` splits into **Violation** (`fail`) and the verbatim non-`fail` statuses; `review-finding` → **Suspected drift**; `unclear` → **Insufficient evidence**; `decision-needed` → **Legitimate evolution**; **Stale or contradictory documentation** is added, because a rule that has outlived its subject otherwise generates permanent `unclear` noise; `out-of-scope` stays counted, not listed |
| **A11** (Q3.3) | Schema gains `session`, and `path` is normalized to repository-relative `/`-separated form at write time so a Windows-written queue drains identically |
| **A13** (Q3.4) | Unchanged and reinforced: git-primary is what makes Codex work, and the queue's genuine marginal value is stated rather than overclaimed |
| **A14** (Q3.6) | Unchanged, and strengthened: the drift loop returns no exit code that can fail a build, stated as a contract rather than a default |
