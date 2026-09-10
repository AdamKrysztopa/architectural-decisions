# Upgrade decisions — sub-projects 2 to 6

**Date:** 2026-09-09
**Status:** draft — needs human review before any spec is written against it
**Scope:** the open design questions for SP2 (deterministic checkers), SP3 (drift-observation loop),
SP4 (migration and bootstrap), SP5 (security extension), SP6 (release hardening)

## How to read this

**This document was produced by an agent standing in for the user.** It exists so that five planning
agents write specs against one consistent set of answers instead of each inventing its own. It is not
a record of what the user decided.

Every answer carries a confidence tag:

- **[SETTLED]** — the project's own rules (`CLAUDE.md`, the 0.3.1 spec, the shipped code) determine
  this. A human would have no real choice. Cited to the file that forces it.
- **[ASSUMED]** — chosen on defensible grounds, but a reasonable person could choose otherwise. The
  alternative is stated. **These need human review.**
- **[ESCALATE]** — genuinely the user's call. Not answered here. Options and their costs are stated.

The consolidated table at the end lists every [ASSUMED] and [ESCALATE] item with its one-line
question. **A reviewer who reads only that table catches everything this document could have got
wrong.** The [SETTLED] items are restatements of rules that already exist; they are worth skimming,
not deliberating.

### The rules applied throughout, not re-opened

These come from `CLAUDE.md`, `docs/superpowers/plans/2026-09-09-architectural-baseline.md`
("Global Constraints"), and `docs/architecture/decisions/0002-architectural-baseline.md`. Where an
answer below simply follows one of them, it is tagged [SETTLED] and the rule is named rather than
re-argued.

1. **Zero dependencies.** No package may be added to `package.json`. Node builtins only.
2. **No prose templating.** Markdown is copied byte-for-byte; no token substitution into a `.md`.
3. **Canonical skill bytes are frozen.** The four skills' `SKILL.md` frontmatter (`name`,
   `description`) must not change — triggering is part of the shipped Claude release.
4. **Never hand-edit `build/`.**
5. **Deterministic generated output.** No timestamps, no SHAs, no host paths in generated Markdown;
   identical input in any file order produces byte-identical output.
6. **Never use a model to approximate what a tool can verify** — the `verification` vocabulary and
   `skills/test-patterns/references/oracles.md` both say this, in different words.
7. **Recommend the least architecture that meets the requirement.**

---

# Part 0 — Cross-cutting

## C1. Sequencing and dependencies between SP2–SP6

**[ASSUMED] Build order: SP2 → SP4 → SP5 → SP3 → SP6.** Alternative: build in numeric order
(SP2 → SP3 → SP4 → SP5 → SP6), which is what the 0.3.1 spec's decomposition list implies.

The dependency graph itself is [SETTLED] by what the code needs:

| Sub-project | Hard dependency | Soft dependency |
|---|---|---|
| SP2 | SP1 only (`decisions.mjs` `KNOWN_TOOLS`, the `verified_by` shape) | — |
| SP3 | SP1 only | SP2 — without resolution, the drain's `deterministic` lane can only report "unresolved", so the loop is half-built |
| SP4 | SP1 only | SP2 — the traceability report cannot honestly say which rules are enforced without it |
| SP5 | SP2 — its rules bind to `gitleaks`/`semgrep` contracts and are worthless unbound | SP4 — bootstrapping a security baseline reuses reverse discovery |
| SP6 | all four | — |

The reordering argument: SP2, SP4 and SP5 each raise the value of the baseline for a user who never
installs a hook, and each is fully validated by `npm test` plus an agent-driven scenario set. SP3 is
the only sub-project that is host-specific, that writes state into the consuming repo, and that
cannot be proven correct by the existing two validation layers alone. Doing it last means it lands on
a system whose deterministic lane already works, rather than on one where the drain has nothing
authoritative to report. The counter-argument for numeric order is simply that the user numbered them
and SP3 is what makes the baseline feel alive.

**SP2 is unambiguously first either way**, because it retires the one thing 0.3.1 shipped as a known
limitation (`docs/release-0.3.1.md`, "Known limitations": a binding is *well-formed, not proven*).

## C2. What belongs in `runtime/` versus `skills/` versus `shared/`

**[SETTLED]** by `builders/build.mjs`, `builders/sync-shared.mjs`, and the plan's recorded deviation
#1 ("anything under `skills/` is counted as a skill by `build.test.mjs`").

| Tree | Holds | Shipped to targets | Rule |
|---|---|---|---|
| `runtime/<subsystem>/` | Executable zero-dependency Node. CLIs, parsers, checker adapters, hook scripts. | Yes — `agentPackaging.canonicalRuntime` is `runtime`, so the whole tree is copied to both targets. | New subsystems land here as new directories; **no builder change is needed** for them to ship. |
| `skills/<name>/` | Model-facing prose only: `SKILL.md` + `references/*.md`. | Yes, byte-identical (`assertCopiedExactly`). | **Nothing that is not a skill may live here** — `build.test.mjs` enumerates this directory as the skill inventory. No `_shared`, no fixtures, no config. |
| `shared/` | Canonical Markdown fanned out into every skill's `references/` by `builders/sync-shared.mjs`, then committed. | Indirectly, as the committed copies. | Add an entry to that file's `SHARED` array; `npm run sync:check` guards drift. |
| `docs/` | Human-facing documentation, specs, examples. Not copied into `build/`. | No | `build.test.mjs` asserts shipped docs name every skill and claim the right count. |
| `test/` | Package-contract tests, fixtures, scenario sets. | No | New suites must be added to the `test` script in `package.json`. |
| Target-specific registration (Claude hook manifest, marketplace copy) | Generated by an adapter | Yes | Adapter-generated only; listed in `agentPackaging.generatedRootFiles` / `generatedRootDirectories`. |

Three consequences worth stating in every downstream spec:

- **A host-specific *script* still belongs in `runtime/`**, because `runtime/` is copied identically
  to both targets. Only the *registration* of that script is target-specific. A Claude-only hook
  script placed anywhere else breaks the byte-identity assertion; placed in `runtime/` it is simply
  inert on Codex.
- **`builders/build.mjs` today writes exactly two kinds of file into a target tree:** the copied
  runtime trees, and `adapter.manifestPath`. `rootFiles` are written to the *repository* root, not
  into `build/<target>/`. SP3 needs a Claude hook manifest *inside* `build/claude/`, which no
  existing mechanism produces. **[SETTLED] SP3 must add one small builder capability**: an adapter
  may declare additional generated JSON files inside its own output tree, validated by the same
  `assertRelativePath` / containment guards. It must not weaken `assertCopiedExactly`.
- **Nothing generated may be hand-edited**, including anything new SP2–SP6 generate.

## C3. How each sub-project is packaged to both targets

**[SETTLED]**, mechanically, per artifact kind:

- **New runtime code** → a new `runtime/<subsystem>/` directory. Ships to both targets automatically.
  Entry points are invoked as `node <plugin-root>/runtime/<subsystem>/<cli>.mjs`, where
  `<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude and the installed plugin directory in Codex —
  **named in a sentence in the reference, never substituted**, exactly as
  `shared/recording-decisions.md` §5 already does. This is the no-prose-templating rule, and it is
  load-bearing for the canonical-bytes guarantee.
- **New model-facing prose shared by several skills** → `shared/<file>.md`, added to the `SHARED`
  array in `builders/sync-shared.mjs`, fanned out and committed.
- **New model-facing prose for one skill** → that skill's `references/`, and it **must** be cited
  from its `SKILL.md`, because `build.test.mjs` enforces both directions (every shipped reference is
  cited; every cited reference exists).
- **A new skill** → a new `skills/<name>/` directory. Ships automatically, but requires a coordinated
  edit: the hardcoded skill inventory in `test/build.test.mjs`, both target descriptions in
  `package.json`, the marketplace description and keywords in `builders/adapters/claude.mjs`, the
  `interface` block in `builders/adapters/codex.mjs`, `README.md`, and every doc that states a count.
- **Target-specific registration** → the adapter, plus the `agentPackaging` allowlists.
- **Never** edited by hand in `build/`; `npm run build -- --target all` regenerates, and CI fails on
  any diff (`docs/building-packages.md`).

## C4. How each sub-project is validated

**[SETTLED]** — the two layers in `docs/validating-skills.md` stay, and the split is decided by one
question: *can a tool decide this?*

**Layer 1 — package contract (`npm test`, deterministic, no model).**
- `test/build.test.mjs` gains assertions for any new tree, reference, skill, or generated root file.
- Each new subsystem gets its own `test/<subsystem>.test.mjs` over fixtures in
  `test/fixtures/<subsystem>/`, added to the `test` script in `package.json` — the pattern
  `test/baseline.test.mjs` already sets.
- Three house patterns to reuse in every new suite: **golden-file byte comparison**, **shuffled input
  order produces identical output**, and **the failure case fails loudly with a line number** rather
  than being silently misread.
- **Hardcode inventories.** `scenarios.test.mjs` hardcodes its scenario and criterion ids on purpose,
  "or the suite would grade the scenario set against itself". Every new inventory (checker adapters,
  drain categories, security gates) does the same, so deleting one costs a deliberate edit.

**Layer 2 — force-driven scenarios (`test/scenarios/*.json`, agent-driven runs).**
- One new set per sub-project that changes what a model does: SP4 (`migration.json`), SP5
  (`security.json`). SP2 and SP3 mostly change what *runtimes* do and are graded in layer 1, except
  for the model's judgement steps — SP3's drain classifier needs a set (`drift-drain.json`).
- Same discipline as the existing sets: forces in, gate outcomes out, **no numeric scoring**, and
  every gate name must resolve to a real `###` heading in a shipped reference so renaming a gate
  fails `npm test`.
- Every set must include the outcomes that are easy to lose: the *refusal* case, the *no-change* case,
  and the case where the honest answer is "insufficient evidence".

**The inversion to refuse:** never grade in layer 2 something layer 1 could decide, and never let
layer 1 assert something only judgement can settle. That is rule 6 restated for the test suite.

## C5. Version number at each step

**[SETTLED]: `0.4.0` is reserved** for the release that satisfies the full pre-release checklist —
stated outright in `docs/release-0.3.1.md`, and guarded by the release check
`grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/…` which must return nothing.

**[ASSUMED]: each sub-project ships as its own patch release** rather than accumulating on a long
branch, using the same argument 0.3.1 made ("new capability, no break to the shipped four"):

| Step | Version | Note |
|---|---|---|
| SP2 | `0.3.2` | Retires the "well-formed, not proven" limitation. |
| SP4 | `0.3.3` | New runtime verbs + one new skill-side workflow; no break. |
| SP5 | `0.3.4` | A fifth skill is normally a minor bump, but `0.4.0` is reserved — see C5 note. |
| SP3 | `0.3.5` | Adds hooks; degrades cleanly, so still no break. |
| SP6 | `0.4.0` | The checklist release. |

Alternative: hold every sub-project unreleased and cut a single `0.4.0`. Cheaper in release overhead,
worse for the risk 0.3.1 named — a triggering regression in the four skills would be discovered once,
late, with five sub-projects' changes to bisect.

**Note on the fifth skill and semver.** Adding a skill is arguably a minor-version event. The
reservation of `0.4.0` overrides that here; if the user is uncomfortable shipping a new skill under a
patch number, the honest alternative is to make SP5 the last sub-project and let it be part of
`0.4.0`. That is a scheduling consequence of the reservation, not a separate decision.

---

# Part 1 — SP2: deterministic checkers

*Goal: resolve `verified_by` bindings inside real tool configs, so that a `deterministic` rule is
proven rather than merely well-formed.*

## Q2.1 — What is "resolution", exactly?

**[SETTLED] Resolution splits into two independent questions, and they must not be collapsed:**

- **(a) Binding resolution** — *does the named contract exist in this repository's own tool config?*
  A static read. No tool binary required. Runs anywhere: in-session, in CI, on a laptop with no
  Python.
- **(b) Evaluation** — *does that contract currently pass?* Requires the tool to be installed and run.

This split is forced by the semantics `verification` was given in the 0.3.1 spec: `deterministic`
means "a tool proves it", and the failure mode the field exists to prevent is "rules everyone
believes are enforced and none are". A rule bound to a contract that does not exist is *the* failure —
and detecting it must not require the user to have the toolchain installed, or the check is useless
in exactly the repositories most likely to have the defect.

## Q2.2 — How is a binding resolved per tool, without adding dependencies?

**[SETTLED] Shape: a thin adapter per tool plus a registry**, mirroring `builders/adapters/*.mjs`,
which this repository already uses twice (build targets, and the checker allowlist in
`decisions.mjs`). Canonical location `runtime/checkers/`:

```
runtime/checkers/registry.mjs        # tool name → adapter; must agree with KNOWN_TOOLS
runtime/checkers/<tool>.mjs          # { tool, configCandidates, resolve(root, contract), run(root, contract) }
runtime/checkers/check-rules.mjs     # the CLI
```

**[SETTLED] Config readers follow the frontmatter parser's discipline**, not YAML/TOML completeness:
a documented subset, and a **loud failure with a line number** on anything outside it. The 0.3.1
spec's wording applies verbatim — "a half-YAML parser that silently misreads an anchor is worse than
no parser". A reader that cannot understand a config must report `unreadable-config`, never guess.

**[SETTLED] The baseline's `runtime/baseline/frontmatter.mjs` must not be extended** to serve
checkers. It is the parser `constitution.md` and `--check` depend on; widening it to cover Semgrep
rule files puts the shipped artifact's determinism at risk for an unrelated feature. New readers live
in `runtime/checkers/`.

**[ASSUMED] Per-tool config discovery and contract locator.** Each of these is a defensible reading of
the tool's own conventions, and each could reasonably be narrowed or widened:

| Tool | Config candidates | Contract identity | Reader |
|---|---|---|---|
| `import-linter` | `.importlinter`, `setup.cfg`, `tox.ini`, `pyproject.toml` | contract `name` | INI subset; TOML subset for `[[tool.importlinter.contracts]]` |
| `dependency-cruiser` | `.dependency-cruiser.json`, `.dependency-cruiser.jsonc`, `.dependency-cruiser.{js,cjs,mjs}` | rule `name` | JSON/JSONC directly; **a JS config is not statically readable** → report `unreadable-config`, with the resolution method named in the output |
| `semgrep` / `ast-grep` | `.semgrep.yml`, `semgrep.yml`, `.semgrep/**.yml`, `rules/**.yml`, `sgconfig.yml` | rule `id` | YAML subset: list-of-maps with an `id:` key |
| `gitleaks` | `.gitleaks.toml`, `gitleaks.toml` | `[[rules]]` `id` | TOML subset |
| `pytest-archon` | no config file; rules are test functions | test function name / pytest node id | regex for `def <contract>(` across test files |
| `oasdiff` | `.oasdiff.yaml` and/or an invocation in CI config | an oasdiff *check id* | match against a vendored list of oasdiff check ids |

Alternative for any row: resolve by scanning the config file for the contract name as a literal
string. Cheaper, format-agnostic, and dishonest — it matches inside comments and disabled blocks, and
would report a commented-out contract as resolved.

**[SETTLED] The output must state *how* it resolved.** `resolved (import-linter contract in
.importlinter:14)` is evidence; `resolved` alone is an assertion. This is the oracle rule applied to
the checker itself: name the source of the claim.

**[ASSUMED] `ast-grep` is added to `KNOWN_TOOLS`, and only with an adapter.** The general rule is
[SETTLED]: **a tool enters `KNOWN_TOOLS` only when it has a working adapter**, otherwise the list
records a promise nobody can keep — the same defect `verification` exists to prevent, one level up.
Alternative: leave `ast-grep` out, since `semgrep` covers the same shape of rule.

## Q2.3 — Contract absent versus tool not installed

**[SETTLED] These are different outcomes and neither is a pass.** Collapsing them is the single most
important thing SP2 must not do.

| Situation | Result | Blocking? |
|---|---|---|
| Config present, contract found, tool ran, contract holds | `pass` | — |
| Config present, contract found, tool ran, contract violated | `fail` | Yes, if the rule is `severity: blocking` |
| Config present, contract **not** found | `unbound` | **Yes.** A `deterministic` rule naming a nonexistent contract is precisely the "reads as proven but isn't" failure. |
| No config file for the named tool | `unbound` | Yes, same reason |
| Config present in a format the reader cannot parse | `unreadable-config` | Yes — reported distinctly, so the user can fix the reader's input rather than the rule |
| Tool binary not on `PATH` | `unavailable` | **No** by default. Reported as "not evaluated", never as a pass. `--require-tools` promotes it to blocking for CI. |
| Adapter threw | `error` | Yes |

Rationale for `unavailable` not being a failure by default: arch-crew must not install anything into
a consuming repository (rule 1 is about this package, but the spirit — *bind to a checker the repo
already owns*, D5 — forbids arch-crew provisioning the toolchain). But "could not run" must never
render green, so it is a named third state, not silence.

**[ASSUMED] Result vocabulary:** `pass | fail | unbound | unreadable-config | unavailable | error`.
Alternative: fold `unreadable-config` into `unbound`. Keeping them apart is what tells a user whether
to fix their rule or their config.

## Q2.4 — Is tool config generated, or only read?

**[SETTLED] Only read. arch-crew never writes into a tool's config.** Three independent grounds:

1. **D5** (`docs/superpowers/specs/2026-09-09-architectural-baseline-design.md`) — "a rule binds to a
   checker the repo already owns", with "a tool-agnostic constraint DSL" explicitly rejected.
2. `shared/recording-decisions.md` §3 — "Requires `verified_by: <tool>#<contract>` naming a contract
   that **already exists**… Do not invent a binding to make a rule look enforced."
3. If arch-crew authored the contract it then resolves, the binding proves nothing about the
   repository — the tool config would be the baseline's own output being used as its own oracle.
   `skills/test-patterns/references/oracles.md` names exactly this shape.

**What SP2 *may* do:** emit a suggested config snippet in the report, clearly marked as something the
user adds. It must not be written, and the rule stays `narrative` or `review` until the user adds it
and the binding resolves.

## Q2.5 — How is a result reported, and with what exit codes?

**[SETTLED] The CLI shape follows `build-constitution.mjs`:** zero-dependency, an explicit `--dir`
override, a machine mode, atomic behaviour, and exit codes where **`1` is "the tool could not do its
job"** and **`2` is "the repository does not match its baseline"** (today: a stale constitution).

`runtime/checkers/check-rules.mjs`:

```
node <plugin-root>/runtime/checkers/check-rules.mjs [--dir <path>] [--run] [--require-tools] [--json]
```

Human output is one line per deterministic rule: `rule-id  status  tool#contract  (evidence)`.
`--json` emits the same rows for CI. Non-deterministic rules are counted, never graded.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Every deterministic rule resolved; no blocking `fail`. `unavailable` rows present but tolerated. |
| `1` | Usage error, missing decisions directory, unparseable decision file, adapter crash. Matches `build-constitution.mjs`. |
| `2` | At least one blocking rule is `fail`, `unbound`, `unreadable-config`, or (with `--require-tools`) `unavailable`. |
| `3` | Warning-severity failures only, nothing blocking. **[ASSUMED]** — alternative: fold into `0` with a warning line, at the cost of CI being unable to surface warnings without parsing output. |

**Note:** this is the first real consumer of the `severity: blocking | warning` field, which 0.3.1
shipped with none. The SP2 spec should say so, because until now `severity` was unexercised metadata.

**[ASSUMED] `--run` is opt-in; the default resolves statically and spawns nothing.** Spawning
arbitrary repository tooling as a side effect of a skill run is a surprise and a security surface;
CI asks for it explicitly. Alternative: run by default whenever the binary is present, which makes
the in-session experience better and the blast radius larger.

## Q2.6 — How does the "well-formed, not proven" wording change?

**[SETTLED] The generated constitution must not carry resolution status.** It is a `--check`ed,
byte-compared artifact with a hard no-timestamps, no-host-paths determinism constraint (Global
Constraints; and the recorded deviation that even a git SHA was rejected for exactly this reason).
Resolution status is a property of the working tree at a moment in time — putting it in
`constitution.md` would make `--check` fail whenever a tool config changed, for reasons that have
nothing to do with decisions.

So the wording in `runtime/baseline/constitution.mjs` → `verificationNote()` changes from

> Verified by \`import-linter#svc-db-isolation\` — binding shape checked; the contract itself is not yet resolved.

to a **pointer**, not a claim:

> Verified by \`import-linter#svc-db-isolation\` — run the rule checker to resolve this binding and evaluate it.

**[SETTLED] Three other places carry the same retraction**, and all three must be updated in the same
release or the package contradicts itself:

1. `docs/release-0.3.1.md` "Known limitations", first bullet — retired, replaced by a pointer to the
   checker and its limits.
2. `shared/recording-decisions.md` §3 — gains one sentence: raise a rule to `deterministic` only when
   the checker actually resolves the binding. This converts a prose-only guardrail into a
   **verifiable** one, which is a genuine upgrade over the state 0.3.1 documented.
3. `test/scenarios/baseline-capture.json`, scenarios `binding-exists` and `no-real-binding` — their
   `expect` clauses currently rest on the model's honesty; after SP2 they can rest on the checker's
   output, and the criterion `no-invented-bindings` becomes layer-1 checkable for the first time.

**[SETTLED] The golden constitution fixture changes**, so `test/fixtures/constitution.md` and the
committed `docs/architecture/constitution.md` are both regenerated in this release. That is expected,
not drift.

---

# Part 2 — SP3: drift-observation loop

*Goal: notice when code diverges from an active rule as it happens, rather than only when someone
runs `--check`.*

## Q3.1 — Which lifecycle events, and what does each do?

**[SETTLED] `SessionStart` injection is an optimisation, not the mechanism.** The 0.3.1 spec says so
explicitly: "Codex has no SessionStart hook, so the in-skill read is the only injection path there,
and sub-project 3's hook becomes a Claude-side optimisation rather than the mechanism." The
"read the constitution first" step already shipped in all four skills is the mechanism. SP3 must not
build anything that only works when the hook fires.

**[ASSUMED] The event set:**

| Event | What it does | Cost |
|---|---|---|
| `SessionStart` | Injects the **rule list only** from `constitution.md` — id, statement, severity, verification class — not the whole file, not the decision prose. | One file read |
| `PostToolUse` (Edit/Write/MultiEdit/NotebookEdit) | **Appends one line to a queue. Nothing else.** No analysis, no matching, no model, no subprocess. | See Q3.2 |
| `Stop` | Emits a one-line notice when the queue is non-empty: "N observations queued; run the drain." | One `wc -l` equivalent |
| *(not used)* `PreToolUse` | — | Blocking an edit on architectural grounds is wrong here: the evidence at that moment is at its weakest, and rule 7 ("least architecture") plus the whole `narrative`/`review`/`deterministic` honesty vocabulary both argue against it. |
| *(not used)* `UserPromptSubmit` | — | Noise; nothing to observe. |

The drain classifier is **not** a hook. It is a skill step the model runs at a checkpoint. Running a
classifier at `Stop` makes stopping slow and gives it nobody to ask when the evidence is ambiguous —
and ambiguity is its most common output.

Alternative to the `Stop` notice: no `Stop` hook at all, and the drain is invoked only when the user
or a skill asks. Quieter, easier to forget.

## Q3.2 — What may the `PostToolUse` check cost?

**[ASSUMED] It must do no matching at all: append the path, unconditionally, in shell.**

```sh
printf '%s\n' "$CLAUDE_TOOL_INPUT_PATH" >> .arch-crew/drift-queue.jsonl
```

Budget: no Node process start (~30–40 ms, which would otherwise dominate), no file read of the edited
content, no subprocess beyond the hook itself, no network, no model. A single short `printf` append
to an `O_APPEND` file is atomic under `PIPE_BUF`, so concurrent edits do not interleave.

The rejected alternative was a Node hook that reads a precomputed rule-scope index and appends only
paths that match an active rule's `scope`. It is more "correct" and costs a process start on every
edit, plus an index that can go stale against `constitution.md`. Filtering at drain time is free —
the drain reads the constitution anyway. This is rule 7 applied to a hot path.

**[SETTLED] Whatever the implementation, the hook must never fail the tool call.** A hook that can
break editing because a directory is missing is worse than no hook; it must be non-fatal by
construction (append to a path that is created on `SessionStart`, and swallow failure).

## Q3.3 — Where does the queue live, and what is its schema?

**[ASSUMED] `.arch-crew/drift-queue.jsonl` in the consuming repository, untracked.**

Alternatives: an OS temp directory (survives nothing, invisible to the developer) or a path under the
decisions directory (pollutes the source of record). Repo-local wins because the drain runs in the
repo, the queue must survive a session restart, and a developer can read it. arch-crew **tells** the
user to gitignore `.arch-crew/`; it does not edit `.gitignore` — writing into a user's config is the
same class of act as writing into their tool config (Q2.4).

This does not re-open the "no config file" decision: `.arch-crew/` holds **state**, and the 0.3.1
spec's bar was "a config file is warranted when a second thing needs *configuring*". A fixed path
needs no configuring.

**[ASSUMED] Schema — JSONL, append-only, one object per line, no read-modify-write:**

```json
{"t":"2026-09-09T12:04:11Z","path":"services/billing/db.py","tool":"Edit"}
```

- Timestamps are fine here: this is state, not a `--check`ed generated artifact.
- A malformed line is **skipped with a warning, never fatal**. The queue is best-effort observation.
- **[SETTLED] The queue is discardable and is never a source of record.** Decision files are the only
  source of record (D1/D2). Deleting the queue must lose nothing that matters.
- Drain empties it by `rename` to `drift-queue.jsonl.draining`, then processes, then unlinks — the
  same temp-file-plus-rename discipline `build-constitution.mjs` already uses, so a crash mid-drain
  never loses observations and never double-counts.
- A size cap: past N lines the drain reports "queue truncated, older observations dropped" rather
  than choking. Losing observations is acceptable; a drain that cannot finish is not.

## Q3.4 — What does the drain classifier output?

**[ASSUMED] Five categories, per rule touched:**

1. **`checked`** — the rule is `deterministic`; SP2 resolved and (with `--run`) evaluated it. Evidence
   is the tool's own output. No judgement involved.
2. **`review-finding`** — the rule is `review`; the model inspected the change and has a *specific*
   named observation. Must cite rule id, file, and line, and say what contradicts the statement.
3. **`unclear`** — a scoped path changed, but the evidence supports no finding either way. This
   category exists so that category 2 does not absorb everything ambiguous.
4. **`decision-needed`** — the change looks like a *new* architectural decision (a new boundary, a
   reversed dependency direction), so the right output is "run the skill and capture a decision", not
   a violation.
5. **`out-of-scope`** — the path matched no rule's `scope`. Counted, not listed.

**[SETTLED] `narrative` rules are never classified at all.** The 0.3.1 spec: consumers are
"forbidden from grading compliance against it". The drain must skip them, and the report must say how
many it skipped, so their existence stays visible without becoming a fake check.

**[ASSUMED] Git is the drain's primary input; the queue is an accelerator.** The drain works from
`git diff --name-only <base>` and *adds* the queue's paths for uncommitted, in-session edits. This
inverts the obvious design deliberately, and it is what makes Q3.7 work.

## Q3.5 — How does a finding avoid being asserted as a violation on weak evidence?

**[SETTLED]** — this is `oracles.md` transplanted into a new context, and the project has already
decided it.

- **The word "violation" is reserved** for a `deterministic` rule that a tool actually failed.
  Everything else is a "finding" or an "observation". The report never mixes them in one count.
- **Every `review-finding` must name its evidence**: rule id, file, line, and the specific text or
  structure that contradicts the rule's `statement`. Missing any one of those → it is downgraded to
  `unclear`. This is oracles.md's gate question — *name the source out loud; "it looks wrong" is not
  an answer* — applied to drift.
- **A model may never stand in for an unavailable tool.** If a rule is `deterministic` and SP2
  reports `unavailable`, the drain reports `unavailable`. It does not offer a judgement instead. This
  is rule 6, and it is the single most likely place for this feature to go wrong.
- **No scoring, no counts as a headline.** "3 findings" mixing a tool failure with two impressions is
  exactly the theatre the whole verification vocabulary exists to prevent. The report groups by class
  and states each class's evidentiary weight in words.
- **"Nothing to report" must be a normal, frequent outcome**, and the scenario set must contain a
  case where it is the correct one.

## Q3.6 — What runs in CI versus in-session?

**[ASSUMED]**

| Runs in CI | Runs in-session |
|---|---|
| `build-constitution.mjs --check` (already shipped) | `SessionStart` injection |
| `check-rules --run --require-tools` (SP2) | `PostToolUse` append |
| Nothing model-driven | The drain and its classifier |

**CI never reads the drift queue.** It is untracked, session-local, and host-specific; a build gate
must rest only on committed artifacts. Findings from the drain never fail a build — they produce a
conversation and, when warranted, a decision file.

Alternative: let CI run the drain over `git diff` against the merge base and post findings as review
comments. That is a real product, and it needs a model in CI — a different kind of project, and out of
scope for this one.

## Q3.7 — How does Codex, which has no hooks, degrade?

**[SETTLED] It barely does — provided Q3.4's inversion holds.**

| Capability | Claude | Codex |
|---|---|---|
| Constitution reaches the model | `SessionStart` hook (fast path) **or** the in-skill read | The in-skill read — already shipped in all four skills |
| Observation of changes | `git diff` **plus** the queue's uncommitted in-session edits | `git diff` only |
| Drain and classifier | Identical | Identical |
| Deterministic checking (SP2) | Identical | Identical |

Codex loses exactly one lane: edits made and not yet committed within a session. Everything else is
the same code. **[SETTLED] The hook scripts ship to both targets** in `runtime/drift/` because
`runtime/` is copied byte-identically (C2); only the Claude hook registration is adapter-generated,
and that needs the small builder capability identified in C2.

The design rule to write into the SP3 spec: **if a capability only works with hooks, it is in the
wrong place.** Hooks may only make an existing path cheaper.

---

# Part 3 — SP4: migration and bootstrap

*Goal: get an existing codebase — with prose ADRs, or with nothing — to a first baseline.*

## Q4.1 — What does "explicitly selected inputs" mean mechanically?

**[ASSUMED] A migration never converts a directory. It consumes an echoed list of paths.**

Mechanically:
1. The skill proposes a candidate list (files it found), and **the user confirms or edits it** before
   anything is written.
2. The confirmed list is echoed back verbatim.
3. Every generated decision file records, in its **prose** (a `## Sources` section), the exact input
   paths it was derived from and the repository commit at the time. Frontmatter is not extended —
   the 0.3.1 spec deliberately omitted an `evidence` field, and prose is where reasoning lives.
4. **Nothing outside the echoed list may influence the output.** If the model wants to use something
   else, it asks for it to be added to the list first.

Grounds: `docs/release-0.3.1.md` already commits to "the capture step never writes into, converts, or
reformats a prose ADR directory", which makes wholesale conversion impossible by policy; per-file
opt-in is the only consistent reading. Alternative: allow "convert this whole directory" as a single
confirmation, which is faster and loses the per-file audit trail.

## Q4.2 — How are current / superseded / duplicated / conflicting decisions detected?

**[ASSUMED] Split strictly by who can decide, and never let one impersonate the other.**

**Mechanical — the runtime reports structural facts, no model:**
- `status` and `superseded_by` chains, duplicate decision numbers, duplicate rule ids — already in
  `runtime/baseline/decisions.mjs` `validateDecisions()`.
- New: **overlapping `scope` globs across rules in different decisions**. Reported as a *candidate*
  conflict, never asserted as one — two rules can legitimately scope the same tree.
- New: **orphans** — a prose ADR whose subject no active schema decision covers.

**Judgement — the model proposes, and every proposal is `proposed`:**
- Whether two prose ADRs say the same thing.
- Whether ADR-0007 supersedes ADR-0003 in substance when neither file says so.
- Whether two rules genuinely contradict, or merely overlap.

**[SETTLED] Never auto-mark an existing document superseded, and never edit its prose.** Both are
already rules: `shared/recording-decisions.md` §4 ("Change nothing else in it — never delete it,
never edit its prose") and D6 (a human promotes). A migration proposes a *new* decision that states
the supersession; the human applies it.

## Q4.3 — What is in the traceability report?

**[ASSUMED] One generated Markdown file with a do-not-edit banner**, e.g.
`docs/architecture/migration-report.md`. It is **not** `--check`ed — it is a point-in-time record of a
migration, not a rollup that must track its inputs forever.

Contents, and the report is invalid if any of these is missing:

1. **Every input path, and what happened to it** — one of `migrated → NNNN`, `merged into NNNN`,
   `left as prose (reason)`, `superseded by NNNN`, `unmapped (reason)`. **Exhaustive over its inputs
   or it is not traceability.**
2. **Every generated decision**, with the input paths it came from.
3. **Every generated rule**, with its `verification` class and, for `deterministic`, the SP2
   resolution result — so the report cannot claim enforcement it does not have.
4. **Gaps, in both directions** — subjects observed in the code with no decision, and decisions with
   no code footprint. The second list is usually the more interesting one.
5. **What was deliberately not migrated**, with the reason.

**[SETTLED] No score, no percentage-complete, no "coverage" number.** The scenario discipline
("pass/fail with the reason, not a score", `docs/validating-skills.md`) and test-patterns' no-ratios
criterion both forbid it, and a "78% documented" figure is the exact artefact that stops anyone
reading the gaps list.

## Q4.4 — How does reverse discovery separate observed fact from inferred intent?

**[SETTLED] The schema already carries the distinction; reverse discovery just has to use it
honestly.**

- **A regularity in the code is not a rule.** "Every module currently obeys X" is the codebase acting
  as its own oracle — the precise defect `skills/test-patterns/references/oracles.md` names, and its
  own verdict applies: such an observation is a **characterization**, valid as a scaffold, invalid as
  a specification, and it has an expiry.
- Therefore: **every rule produced by reverse discovery starts at `narrative`**, exactly as
  `shared/recording-decisions.md` §3 requires of every rule. It may be raised to `deterministic` only
  when a contract *already exists* in the repo's tool config and SP2 resolves it — that is observed
  fact. It may be raised to `review` only when a human confirms the intent.
- **Placement in the file encodes the distinction:** `## Context` states what was observed and *how*
  (the command run, the counts, the exceptions found); `## Decision` states what a human must confirm
  as intended. The observation is evidence in prose; the intent is the rule.
- **Exceptions are load-bearing.** "47 of 51 modules follow this" is a far more useful sentence than
  "modules follow this", and the four exceptions are the finding. A discovery pass that reports only
  the regularity has hidden its own counter-evidence.

**[ASSUMED] Cap the number of decisions one reverse-discovery pass may propose.** 0.3.1 accepted
"proposed-file accumulation" as a known risk; reverse discovery is the feature most likely to realise
it — forty unreviewed proposed files is a baseline nobody promotes. The cap forces the pass to rank.
Alternative: no cap, plus the staleness sweep 0.3.1 deferred.

## Q4.5 — How is approval enforced before a baseline is replaced?

**[SETTLED] There is no "replacement" to gate.** Decision files are append-and-supersede, never
overwritten (D2, and §4 of the capture reference); the constitution is generated from the `active`
ones only. A migration that produces forty `proposed` files changes `constitution.md` by **exactly
zero bytes** until a human promotes something. That is the gate, and it already exists and is already
mechanically enforced by `renderConstitution()`'s `status === "active"` filter.

What is *not* enforced today: nothing stops a model writing `status: active` directly. 0.3.1 lists
this as a known limitation — "enforced by prose instruction to the model… not mechanically".

**[ASSUMED] SP4 adds a `promote` verb to the runtime** — `node …/build-constitution.mjs promote 0007
0009`, or a sibling CLI — that flips `status` and regenerates. Two benefits: the model has no reason
to hand-edit `status`, so a diff showing `status: active` outside a promote invocation is a
reviewable smell; and promotion becomes a single auditable act. It does **not** make promotion
model-proof, and the spec must not claim it does — a model can still write the field. Alternative:
leave promotion prose-only and rely on human review of the decision-file diff, which is what 0.3.1
chose.

**[SETTLED] Three existing guarantees carry over unchanged and must be asserted in SP4's tests:** the
prose ADR directory is never written into, converted, or reformatted; no existing file's prose is
edited; the traceability report is written *before* any promotion, so review has something to read.

---

# Part 4 — SP5: security extension

## Q5.1 — New skill, extension of the four, or a reference?

**[ASSUMED] A fifth skill.** Alternative: a topic reference on `decide-architecture` only, which is
cheaper and loses independent triggering.

The three options and their costs:

| Option | For | Against |
|---|---|---|
| **(a) Fifth skill, e.g. `threat-model`** | Security-architecture review is a distinct decision procedure with its own interview (trust boundaries → data classification → authN/authZ → secrets → supply chain → agent agency) and its own review mode. It gets its own `decision-tree.md`, `catalog.md`, and scenario set — the shape every skill here has. It triggers on security language, which no existing description covers. Agent/tool permissions span `agentic-patterns` *and* `decide-architecture`, so there is no single existing skill it belongs to. | The coordinated packaging edit in C3. Every doc that says "four" changes, and `build.test.mjs` asserts the docs' count matches. |
| **(b) A shared `references/security.md` fanned into all four** | Cheapest; zero triggering change; reuses `sync-shared.mjs`. | Makes every skill carry material most runs never need — exactly what `CLAUDE.md`'s topic-reference rule warns against ("size that actually harms selective retrieval is the bar"). And it has no decision tree, so it is a catalog with no procedure. |
| **(c) A topic reference on `decide-architecture` only** | Middle cost; trust boundaries and authZ *are* architecture-level. | Secrets, supply chain, and agent/tool permissions are not, and the four skills' frontmatter is frozen — so `decide-architecture` cannot advertise the new capability, and it would go untriggered. |

Cross-linking, not duplication: `agentic-patterns`' catalog gains a pointer to the new skill for
agent/tool permission questions. It cannot gain a *description* change (frozen frontmatter), so the
pointer lives in the body.

**[ESCALATE] Does "four skills" belong to the shipped Claude release's identity?** `CLAUDE.md` requires
that "user-facing marketplace and install commands, plugin identity, skill namespace, and canonical
skill bytes must remain compatible with the existing Claude release". Adding a fifth skill breaks
none of those literally — identity, namespace, and existing bytes are untouched — but it does change
the marketplace copy in both adapters and every "four architectural-decision skills" sentence in the
docs. Whether that counts as a compatibility event is a product call.
*Cost of treating it as permitted:* a coordinated but mechanical edit across ~8 files, and marketplace
copy that changes between releases. *Cost of treating it as forbidden:* SP5 falls back to option (c),
security questions never trigger it, and the feature is only reachable by someone who already invoked
`decide-architecture`.

## Q5.2 — How does architecture-level threat review stay distinct from vulnerability scanning?

**[SETTLED] By the `verification` vocabulary the project already has.** One sentence carries the whole
distinction:

> **If a tool can decide it, the skill's job is to make sure a binding exists. If no tool can decide
> it, the skill's job is to make the decision explicit and honest about being unverifiable.**

Concretely:
- **Vulnerability scanning is a `deterministic` concern.** It belongs to SP2 bindings —
  `gitleaks#<rule>`, `semgrep#<rule-id>`, `osv-scanner#<check>`. The skill **never** enumerates CVEs,
  grades dependency versions, or simulates a scanner's output. That is rule 6, and it is not
  negotiable: a model listing plausible vulnerabilities is the security equivalent of a generated test
  with no oracle.
- **Threat review is a design activity.** Its output is decision files: where the trust boundaries
  are, what crosses each, who is authorized at each, what data classification applies, and what an
  agent may do without a human. Its rules are mostly `review` and `narrative`, with `deterministic`
  ones only where a real contract backs them.
- **The handoff is explicit in both directions.** A threat review that concludes "secrets must not be
  committed" does not stop there — it checks whether a `gitleaks` rule exists, and if not, says so and
  leaves the rule `narrative` rather than pretending.

## Q5.3 — Which scanners are reused rather than reimplemented?

**[SETTLED] All of them; SP5 reimplements nothing.** D5 already decided this ("a rule binds to a
checker the repo already owns"), and the existing `KNOWN_TOOLS` list covers most of the surface:

| Security concern | Tool, via a `verified_by` binding |
|---|---|
| Secrets in the repo or history | `gitleaks` |
| Dangerous sinks, taint, missing authZ patterns | `semgrep` (and `ast-grep`, if SP2 adds it) |
| Trust-boundary API surface change | `oasdiff` |
| Boundary and dependency-direction integrity | `import-linter`, `pytest-archon`, `dependency-cruiser` |
| Supply chain / known-vulnerable dependencies | **gap** — see below |

**[ASSUMED] Add one supply-chain tool: `osv-scanner`.** It is language-agnostic, a single binary, and
emits stable machine-readable output, which suits the adapter shape. It enters `KNOWN_TOOLS` only
with an SP2 adapter (Q2.2's rule). Alternative: leave supply chain `review`-only in SP5 and let the
user bind whatever their ecosystem already runs (`pip-audit`, `npm audit`, Dependabot) — at the cost
of no deterministic supply-chain rule being expressible at all.

**Never reimplemented, under any circumstances:** secret entropy detection, advisory matching, taint
analysis, SAST rule evaluation.

## Q5.4 — How do findings avoid checklist-score theatre?

**[SETTLED]** — the anti-scoring discipline is already this project's house style
(`docs/validating-skills.md`: "Record a pass/fail with the reason, not a score";
`test/scenarios/test-patterns.json` criteria `no-ratios`, `no-shape-first`).

- **No maturity score, no percentage, no "8/10 controls present", no OWASP-Top-10 tick sheet as the
  output shape.** A checklist may be used as a *coverage prompt for the interview*; it may never be
  the output.
- **Every finding names four things**: the asset or boundary at risk, the actor, the impact, and the
  cheapest control that closes it — **with that control's cost**. Cost-per-pick is the crew's
  signature move in all four existing skills, and a security control without a stated cost is how
  security theatre gets bought.
- **Asymmetric gates, as in `test-patterns`.** A control is added because a named threat cannot be
  mitigated more cheaply elsewhere — never to complete a list.
- **"No change needed" stays an available conclusion**, and the scenario set must contain a case
  where it is the correct one, mirroring `expectNoChange`.
- **The severity of a finding tracks its evidence class**, not its scariness: a `gitleaks` hit is a
  violation; "this boundary looks under-authorized" is a review finding; "we assume the internal
  network is trusted" is narrative. Never merged into one ranked list.

---

# Part 5 — SP6: release hardening

## Q6.1 — What do the four end-to-end scenarios actually assert?

**[ASSUMED] One scenario per sub-project SP2–SP5**, each a full lifecycle against a small fixture
repository, and each asserting **its own characteristic failure mode**, not only the happy path — the
pattern `build.test.mjs` already sets with "unsupported targets fail without creating an artifact".

**E2E-1 — Bind and prove (SP2).** Fixture repo with a real `import-linter` contract.
Skill run captures a decision with a `deterministic` rule → `check-rules` resolves it → the contract
is deliberately violated in code → `check-rules --run` exits `2` → fixed → exits `0`.
*Failure modes asserted:* a rule naming a nonexistent contract reports `unbound` and exits `2`, never
`pass`; with the tool uninstalled the same rule reports `unavailable` and exits `0`, and `2` under
`--require-tools`.

**E2E-2 — Drift observed, not asserted (SP3).** Edit a scoped file → a queue line appears → the drain
produces exactly one `review-finding` carrying rule id, file and line; one `unclear`; and **zero**
classifications of any `narrative` rule.
*Failure modes asserted:* deleting the queue loses nothing (`git diff` path still works); CI does not
read the queue; a `deterministic` rule whose tool is unavailable is reported `unavailable` and is
**not** given a model judgement instead.

**E2E-3 — Bootstrap an undocumented repo (SP4).** Repo with three prose ADRs and no schema decisions.
Migration produces N `proposed` files plus a traceability report listing every input, including the
unmapped ones → `constitution.md` is **byte-unchanged** → two decisions are promoted → the rollup now
contains exactly their rules and no others.
*Failure modes asserted:* `git diff` on the prose ADR directory is empty; no existing file's prose
changed; every rule produced by reverse discovery is `narrative`; the report has no score.

**E2E-4 — Security decision without theatre (SP5).** A service with a trust boundary and a committed
secret. The run produces a decision with one `deterministic` rule bound to a `gitleaks` rule that
actually exists, one `review` rule, one `narrative` rule, and no score.
*Failure modes asserted:* **the secret is found by `gitleaks`, not by the model**; a plausible but
unbound control stays `narrative`; the output contains no percentage, ranking, or maturity level.

## Q6.2 — How does regression coverage prove the original four still behave?

**[SETTLED] mechanism, three layers**, because 0.3.1 named a triggering regression as the top risk and
noted it "would be silent":

1. **Frontmatter freeze, mechanically.** A layer-1 test asserts the four skills' `name` and
   `description` are byte-identical to a checked-in fixture of their 0.3.1 values. Today
   `skill-frontmatter-is-frozen` is a `review` rule in `docs/architecture/constitution.md` with no
   checker at all — SP6 is where it becomes an actual assertion. It cannot become a `verified_by`
   binding (no listed tool checks Markdown frontmatter), so it lives in `test/build.test.mjs`, which
   is the right home: it is arch-crew's own package contract.
2. **[ASSUMED] Body-change visibility.** A manifest of content hashes for the four `SKILL.md` bodies,
   asserted by a test, so any body edit costs a deliberate manifest update and lands in the release
   notes. Same trick as the hardcoded scenario inventory in `scenarios.test.mjs`, and for the same
   stated reason. Alternative: rely on code review of the diff.
3. **Behavioural re-run.** The existing sets — `test/scenarios/test-patterns.json` (12 scenarios) and
   `test/scenarios/baseline-capture.json` (6) — re-run agent-driven per
   `docs/validating-skills.md`, fresh session per scenario, **prompt pasted verbatim without naming
   the skill**, graded pass/fail with reasons into `test-runs/<iteration>/`. This is the only layer
   that catches a triggering regression, and it is the one that must not be skipped for schedule.

Plus one check the topic-reference rule in `CLAUDE.md` implies: **the added references must not have
pushed any `SKILL.md` past the point where selective retrieval degrades.** If a skill now loads
material most runs never need, that is a finding, not a nit.

## Q6.3 — What does a clean-install test do for each target?

**[ASSUMED]** — grounded in `docs/building-packages.md` and the Verification section
`docs/release-0.3.1.md` already models.

**Both targets, from a clean clone at the release tag:**
```sh
npm ci                              # no dependencies; must be a no-op
npm run build -- --target all
git status --short                  # empty: committed artifacts match a clean rebuild
npm test
npm run sync:check
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/   # empty until SP6 itself
```

**Claude**, in a scratch project outside this repository:
`/plugin marketplace add …` then `/plugin install arch-crew`. Assert: every skill appears under the
`arch-crew:` namespace; each skill's references resolve from `$CLAUDE_PLUGIN_ROOT`;
`node $CLAUDE_PLUGIN_ROOT/runtime/baseline/build-constitution.mjs --check` runs; the SP2 and SP3
entry points run from the installed tree; the hook registration is picked up and a `PostToolUse`
append actually lands.

**Codex**: `codex plugin marketplace add …`, `codex plugin add arch-crew@arch-crew`, new session.
Assert the same skill inventory; the runtime scripts run from the installed plugin directory; and —
the point of the test — **the absence of hooks changes no correctness outcome**: the git-based drain
path produces the same classification as E2E-2 did on Claude, minus the uncommitted-edit lane.

The in-repo proxy already exists (`build.test.mjs`: "the shipped generator runs from each target
package"). The clean-install test is the out-of-repo counterpart, run by hand per release and recorded
in the release doc.

---

# Part 6 — The escalated question

## E1 — The "Traditional ADRs vs living architectural documents" mode

**[ESCALATE] — not answered here.**

The user's pre-release checklist assumes a user-selectable mode, persisted in project config.
Sub-project 1 deliberately collapsed it: **D3** chose "the Constitution is a *generated rollup* of the
decision files" and explicitly rejected "two selectable modes (ADR vs Constitution)". There is no mode
to persist, and the 0.3.1 spec also refused a config file to persist it in ("There is no config file
in v1 — one is warranted when a second thing needs configuring, and nothing does").

### Path A — Rewrite the checklist item to match the shipped design

The checklist item becomes a statement of coexistence rather than of modes: decision files are the
source of record, the constitution is generated, and a repository that keeps Nygard/MADR prose ADRs
keeps them untouched beside the schema decisions (already shipped — discovery skips a prose-only
directory, and the capture step never writes into one).

*Cost:* effectively zero engineering. The cost is a promise withdrawn: a team whose culture is "the
ADR *is* the artifact, and there is no rollup" gets a generated `constitution.md` they may not want.
A cheap mitigation exists — decision files stand alone, so simply not running the generator yields
ADR-only behaviour, and a `--no-constitution` posture could be documented rather than built.
*What is lost:* nothing technical; only the framing the checklist promised.

### Path B — Reintroduce a genuine mode switch in SP4

A persisted project setting selects "traditional ADRs" or "living constitution", and the toolchain
honours it.

*Cost:*
1. **It re-opens the config-file refusal.** A persisted mode is, by definition, the second thing that
   needs configuring, so SP1's stated bar is met and a config file must be designed, discovered,
   validated, and versioned.
2. **Two output modes means two renderers and two `--check` semantics**, and every downstream
   consumer — SP2's report, SP3's drain, SP4's traceability report, SP5's findings — must handle both
   or declare that it only works in one.
3. **The scenario sets roughly double** for capture, since correct behaviour now depends on mode.
4. **The substantive one:** in ADR-only mode there is no `constitution.md`. The "read the constitution
   first" step is the mechanism SP1 relies on for Codex portability *and* the thing SP3's injection
   and SP5's cross-checks build on. Mode B removes the artifact those depend on and would need an
   index to replace it — which is, in most of its properties, a constitution under another name.

*What is gained:* the product promise is kept, and teams with an established ADR culture adopt without
acquiring a generated file.

**This is a product decision, not an engineering preference.** Path B is materially more expensive
than it first appears — chiefly because of cost 4 — but that is a fact about the cost, not a
recommendation. **A third framing the user may actually want**, and which is a variant of Path A
rather than a third option: keep the generated rollup as the mechanism, and offer a *presentational*
choice of how it renders. That keeps one artifact and one code path while satisfying an ADR-shaped
reading preference. It is noted here because it may dissolve the question, not as a pick.

---

# Consolidated review table

Everything below needs human review. The [SETTLED] items are not listed; they restate rules that
already exist in `CLAUDE.md`, the 0.3.1 spec, or the shipped code.

## [ESCALATE] — 2 items

| # | Question |
|---|---|
| **E1** | Traditional-ADR vs living-document mode: rewrite the checklist to match the shipped generated-rollup design, or reintroduce a genuine mode switch in SP4? (Part 6) |
| **E2** | Does "four skills" belong to the shipped Claude release's identity — i.e. may the package grow to five for SP5's security skill? (Q5.1) |

## [ASSUMED] — 23 items

| # | Where | Question, in one line |
|---|---|---|
| A1 | C1 | Build order SP2 → SP4 → SP5 → SP3 → SP6, rather than numeric order? |
| A2 | C5 | Ship each sub-project as its own `0.3.x` patch release, rather than accumulating to one `0.4.0`? |
| A3 | Q2.2 | Are the per-tool config candidates and contract locators (the table) the right ones for each of the six-to-eight tools? |
| A4 | Q2.2 | Add `ast-grep` to `KNOWN_TOOLS`, or leave it out because `semgrep` covers the same shape? |
| A5 | Q2.3 | Result vocabulary `pass / fail / unbound / unreadable-config / unavailable / error` — is `unreadable-config` worth separating from `unbound`? |
| A6 | Q2.5 | Exit code `3` for warning-only failures, or fold warnings into `0`? |
| A7 | Q2.5 | Default to static resolution with `--run` opting into spawning the user's tools, or run whenever the binary is present? |
| A8 | Q3.1 | Hook set = `SessionStart` + `PostToolUse` + a `Stop` notice; no `PreToolUse`. Is the `Stop` notice wanted at all? |
| A9 | Q3.2 | The `PostToolUse` hook appends the path in shell with no matching, rather than a Node hook that filters by rule scope? |
| A10 | Q3.3 | Queue at `.arch-crew/drift-queue.jsonl` in the consuming repo (untracked, arch-crew does not edit `.gitignore`), rather than a temp directory? |
| A11 | Q3.3 | The JSONL line schema, the malformed-line-is-skipped rule, and the size cap. |
| A12 | Q3.4 | The five drain categories — `checked` / `review-finding` / `unclear` / `decision-needed` / `out-of-scope`. |
| A13 | Q3.4 | `git diff` is the drain's primary input and the queue is only an accelerator for uncommitted edits? |
| A14 | Q3.6 | CI never reads the drift queue and drain findings never fail a build? |
| A15 | Q4.1 | "Explicitly selected inputs" = a user-confirmed, echoed path list recorded in each decision's prose `## Sources` section, per file rather than per directory? |
| A16 | Q4.2 | The mechanical-vs-judgement split for detecting duplicates and conflicts (overlapping scope globs flagged as *candidate* conflicts only). |
| A17 | Q4.3 | The traceability report's contents, its location, and that it is **not** `--check`ed. |
| A18 | Q4.4 | Cap the number of decisions one reverse-discovery pass may propose? |
| A19 | Q4.5 | Add a `promote` CLI verb, or leave promotion prose-only as 0.3.1 chose? |
| A20 | Q5.1 | Security ships as a **fifth skill**, rather than a topic reference on `decide-architecture`? (see also E2) |
| A21 | Q5.3 | Add `osv-scanner` as the one supply-chain tool, or leave supply chain `review`-only? |
| A22 | Q6.1 | The four end-to-end scenarios map one-to-one onto SP2–SP5, with the failure modes listed? |
| A23 | Q6.2 / Q6.3 | A content-hash manifest for the four `SKILL.md` bodies, and the clean-install procedure per target. |
