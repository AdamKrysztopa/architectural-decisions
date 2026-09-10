# Deterministic Compliance Checkers — design

**Date:** 2026-09-09
**Status:** approved (design)
**Scope:** sub-project 2 of the arch-crew upgrade (build order SP2 → SP4 → SP5 → SP3 → SP6)
**Target version:** 0.3.2
**Depends on:** sub-project 1 only (`runtime/baseline/decisions.mjs` — `KNOWN_TOOLS`, the `verified_by`
shape; `runtime/baseline/constitution.mjs` — `verificationNote()`)

## Why

0.3.1 shipped `verification: deterministic` and `verified_by: <tool>#<contract>` as a promise: a
rule marked this way is proven by a tool, not by a human's belief. But 0.3.1 validates only the
binding's *shape* and that the tool is on `KNOWN_TOOLS` — it never opens `.importlinter` or
`.semgrep.yml` to check the named contract is actually there. `docs/release-0.3.1.md` names this
outright: "a binding is well-formed, not proven." A repository can carry a dozen `deterministic`
rules bound to contracts that were renamed, deleted, or never existed, and nothing in the package
would notice. That is precisely the failure `verification` exists to prevent, one layer down.

This sub-project closes the gap: **resolve** a binding against the repository's own tool
configuration (no tool required, works on a laptop with no Python), and optionally **evaluate** it
by actually running the tool (`--run`, opt-in). Both are proven end-to-end in this design against a
real `.importlinter` fixture — see "Worked proof" below — not merely asserted.

## Decisions taken

Provenance tags: **[SETTLED]** / **[ASSUMED]** are carried over verbatim from
`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md` ("the decisions doc"), cited by
question number. **[DESIGN]** is a choice this document makes to fill a gap the decisions doc left
open, and is flagged for review the same way an [ASSUMED] item is.

| # | Decision | Rejected alternative | Source |
|---|---|---|---|
| D1 | Resolution (does the contract exist? static, no tool needed) and evaluation (does it currently pass? needs the tool) are two independent questions, never collapsed | One `--check`-style pass that requires the toolchain to say anything at all | [SETTLED] Q2.1 |
| D2 | A thin adapter per tool (`{ tool, configCandidates, resolve, run }`) plus a registry, mirroring `builders/adapters/*.mjs` | A tool-agnostic constraint DSL; one generic parser for all formats | [SETTLED] Q2.2 |
| D3 | Config readers accept a documented subset and fail loudly with a line number **only for constructs that could hide or misplace the contract identifier itself** — a `pattern: \|` block scalar, an unparsed field, is skipped opaquely, not rejected | A full YAML/TOML/JSON parser (a dependency); scanning for the contract name as a literal string anywhere in the file (matches inside comments and disabled blocks — Q2.2 names this "dishonest") | [DESIGN], refining [SETTLED] Q2.2's "frontmatter parser's discipline" for configs arch-crew does not author |
| D4 | Six result states, never collapsed: `pass \| fail \| unbound \| unreadable-config \| unavailable \| error` | Fewer states (e.g. treating `unbound` and `unreadable-config` alike, which hides whether the user should fix their rule or their config) | [SETTLED]/[ASSUMED] Q2.3/Q2.5 |
| D5 | arch-crew only **reads** tool config. It may print a suggested snippet in a report, clearly marked as something the user adds by hand; it never writes into a tool's config file | A "fix it for me" mode that patches `.importlinter` etc. | [SETTLED] Q2.4 |
| D6 | `--run` is opt-in; the default resolves statically and spawns nothing | Running whenever a binary happens to be on `PATH` (a surprise, and a security surface) | [ASSUMED] Q2.5 |
| D7 | `unavailable` covers two distinct causes — "resolved but `--run` was not requested" and "resolved, `--run` requested, tool binary missing" — distinguished only in the evidence string, not the status field | A seventh status splitting the two | [DESIGN] — keeps to the six-state vocabulary D4 settled; see "Risk" below |
| D8 | `--require-tools` only promotes `unavailable` to blocking when combined with `--run`. Passed alone it is a no-op: a rule the user never asked to evaluate cannot be "missing its tool" | `--require-tools` promoting `unavailable` regardless of `--run` (would make every un-evaluated rule fail CI even when CI never asked to evaluate anything) | [DESIGN], refining [ASSUMED] Q2.5 |
| D9 | `ast-grep` enters `KNOWN_TOOLS` with its own `resolve()` — real ast-grep rule files declare one rule per YAML document as a top-level `id:` field (not semgrep's nested `rules: [{id: ...}]` list), located via `sgconfig.yml`'s `ruleDirs:` — but `run()` unconditionally reports `unavailable` in this release: ast-grep's JSON output shape is less stable across versions than semgrep's and no scenario in this release needs it | Reusing semgrep's `rules:`-list reader on the (incorrect) assumption the two tools share a config shape — rejected once checked against ast-grep's actual rule-file format, which never nests under `rules:`; or leaving `ast-grep` out of `KNOWN_TOOLS` entirely (Q2.2's stated alternative); or shipping an unproven `--run` against a guessed output shape | [ASSUMED] Q2.2 (inclusion) + [DESIGN] (the `run()` scope cut, and the dedicated reader) |
| D10 | `oasdiff` resolution matches the contract id against a short **vendored** list of real oasdiff breaking-change check ids shipped with the adapter — never against any file in the repository | Scanning CI config (GitHub Actions YAML, a Makefile, ...) for an oasdiff invocation — rejected because CI formats are too varied for a documented subset, and it degenerates into "does this repo mention the string" | [SETTLED] Q2.2 (reader shape) + [DESIGN] (the consequence, below) |

**The consequence of D10, stated plainly because it is easy to miss:** oasdiff is the one tool
where `unbound` can only mean "not a real oasdiff check id" (a typo), never "this repository does
not enable that check" — because oasdiff has no per-repo declarative list of active checks to read.
A `deterministic` rule bound to `oasdiff#response-required-property-removed` resolves in *every*
repository that spells the id correctly, whether or not that repository runs oasdiff at all. This is
weaker than the guarantee the other five tools give, and the CLI's evidence string says so on every
oasdiff row (see "Per-tool resolution").

## On-disk / runtime contract

```
runtime/checkers/
  text.mjs                # config-file glob resolution + line reading, shared by every reader
  spawn.mjs                # one place "the binary is not on PATH" is detected, for every --run
  registry.mjs              # adapter registration; asserts agreement with KNOWN_TOOLS
  import-linter.mjs         # INI subset (.importlinter/setup.cfg/tox.ini) + TOML subset (pyproject.toml)
  dependency-cruiser.mjs    # JSONC subset; JS config → unreadable-config (not statically readable)
  semgrep.mjs               # YAML subset: id: under a top-level rules: list
  ast-grep.mjs              # reuses semgrep.mjs's reader; run() always unavailable (D9)
  gitleaks.mjs               # TOML subset: [[rules]] id = "..."
  pytest-archon.mjs          # regex over test_*.py / *_test.py; no config file
  oasdiff.mjs                 # vendored check-id list (D10); optional .oasdiff.yaml for --run's spec pair
  check-rules.mjs            # the CLI
```

Every adapter is registered by `check-rules.mjs` and exports:

```js
{
  tool: "import-linter",
  configCandidates: [".importlinter", "setup.cfg", "tox.ini", "pyproject.toml"],
  resolve(root, contract) ->
    { resolved: true, location: { file, line? }, evidence: string }
    | { resolved: false, reason: "unbound" | "unreadable-config", evidence: string },
  run(root, contract, resolution) ->
    { status: "pass" | "fail" | "unavailable" | "error", evidence: string },
}
```

`resolve()` never requires the tool binary. `run()` is only ever called after a successful
`resolve()`, and is only called at all under `--run`. `registry.mjs` asserts, at CLI startup, that
`registeredTools()` and `runtime/baseline/decisions.mjs`'s `KNOWN_TOOLS` name exactly the same set —
the mechanical form of D2/Q2.2's rule "a tool enters `KNOWN_TOOLS` only when it has a working
adapter." `runtime/baseline/decisions.mjs` gains one entry, `"ast-grep"`, in `KNOWN_TOOLS` (its
`BINDING` regex already accepts hyphenated tool names, so no regex change is needed).
`runtime/baseline/frontmatter.mjs` is untouched, per the decisions doc's explicit instruction not to
widen it for this purpose.

## Per-tool resolution: what is read, and what is deliberately not

| Tool | Config candidates | Contract identity | What is read | What is deliberately **not** parsed |
|---|---|---|---|---|
| `import-linter` | `.importlinter`, `setup.cfg`, `tox.ini`, `pyproject.toml` | contract `name` | INI: `[importlinter:contract:*]` sections' `name =` line. TOML: `[[tool.importlinter.contracts]]` array-of-tables' `name = "..."` line | `type`, `layers`, `containers`, and every other contract field — opaque, skipped by indentation/section boundary, never inspected. An INI continuation line (a multi-line value) appearing *before* a section's `name =` is rejected loudly, since it could hide the name; one appearing after is skipped safely. |
| `dependency-cruiser` | `.dependency-cruiser.json`, `.dependency-cruiser.jsonc`, then `.dependency-cruiser.{js,cjs,mjs}` | rule `name` (in `forbidden[]`/`allowed[]`) | JSON, with `//` and `/* */` comments stripped outside string literals (JSONC) | A JS config is **not statically readable** — reported as `unreadable-config` naming the file, never executed. Every field on a rule object besides `name` (`from`, `to`, `severity`, `comment`) is opaque. |
| `semgrep` | `.semgrep.yml`, `semgrep.yml`, `.semgrep/**.yml`, `rules/**.yml`, `sgconfig.yml` | rule `id` | A narrow structural scan for a top-level `rules:` list and, per item, an `id:` field either inline with the `-` or at the item's field indent | `pattern`, `pattern-either`, `message`, `metadata`, `languages` — all opaque and skipped by indentation, **including multi-line block scalars** (`pattern: \|`): YAML requires a block scalar's content to be indented deeper than its own key, so a `pattern: \|` block appearing *before* `id:` in the same item is skipped safely, never misread as a field (proven — see "Worked proof: the semgrep reader"). What **is** rejected loudly: a tab anywhere in the file, a bare anchor/alias marker occupying a field's own line, an anchor/alias attached to the `id` value itself (`id: &shared-id name` — the one case that could otherwise silently corrupt the extracted name), and a `---`/`...` document separator encountered *while a `rules:` list is being read* — the idiomatic leading `---` that opens an otherwise ordinary file, appearing before any `rules:` key, is harmless and is not rejected. |
| `ast-grep` | `sgconfig.yml` (read for its `ruleDirs:` list), then `.ast-grep/**.yml`/`.ast-grep/**.yaml`/`rules/**.yml`/`rules/**.yaml` as a fallback when no `ruleDirs:` is found | rule `id` | Its own reader, distinct from semgrep's: ast-grep rule files declare **one rule per YAML document** as a top-level (column-0) `id:` field, not nested under a `rules:` list — several rules in one file are ordinarily separated by a `---` document marker, which is a normal boundary here, never an error | `language`, `rule`, `fix`, `metadata` — opaque. A tab, or an anchor/alias attached to the `id` value, is rejected loudly for the same reason semgrep's reader rejects them. |
| `gitleaks` | `.gitleaks.toml`, `gitleaks.toml` | `[[rules]]` `id` | `[[rules]]` array-of-tables headers and each block's single-line `id = "..."` field | `regex`, `tags`, `allowlist`, `keywords` — opaque. A multi-line string (`"""`/`'''`) appearing before a block's `id =` line is rejected loudly. |
| `pytest-archon` | none — `**/test_*.py`, `**/*_test.py` | test function name / pytest node id | A regex over `def <name>(` lines in collected test files | **The function body is never inspected.** This adapter can only confirm "a test function with this name exists," never "this test calls `pytest_archon.archrule` and actually enforces the boundary." The evidence string says so explicitly on every resolved row — this is the one adapter that can never rule out a same-named test that asserts nothing. |
| `oasdiff` | `.oasdiff.yaml`, `.oasdiff.yml` (only used for `--run`'s spec-pair, per D10) | an oasdiff breaking-change check id | The contract id against a vendored constant list shipped in `oasdiff.mjs`, kept current by hand as oasdiff adds checks | **CI configuration is never scanned** to confirm oasdiff actually runs in this repository (Q2.2 explicitly forbids the "literal string match" shortcut this would require). See D10's consequence above — this is the weakest guarantee of the six. |

## The four outcomes, and why they must never collapse

| Situation | `resolve()` says | `check-rules.mjs` row status | Blocking? |
|---|---|---|---|
| Contract found in a config the reader understands | `{ resolved: true, location, evidence }` | `pass` (with `--run`, tool ran and the contract holds) or `fail` (tool ran, contract violated) or `unavailable` (default mode, or `--run` with the binary missing) | `fail` always blocking (severity-gated below); `unavailable` only under `--require-tools --run` |
| Contract genuinely absent from a config the reader understands, or no config file at all for that tool | `{ resolved: false, reason: "unbound", evidence }` | `unbound` | Yes — this is the failure `verification` exists to catch |
| Config present but in a shape the reader cannot honestly parse | `{ resolved: false, reason: "unreadable-config", evidence }` | `unreadable-config` | Yes, but distinctly — the fix is the reader's input, not the rule |
| Reader or runner threw an exception it did not anticipate | — (caught by `check-rules.mjs`) | `error` | Yes |

`unbound` and `unreadable-config` are kept apart (D4) because they tell the user to fix different
things: a rule naming a contract that truly does not exist, versus a config file this adapter cannot
honestly read. Folding them together would make both look like "your rule is wrong" when half the
time it is "our reader gave up."

## The CLI

```
node <plugin-root>/runtime/checkers/check-rules.mjs [--dir <path>] [--run] [--require-tools] [--json]
```

Mirrors `build-constitution.mjs`'s shape deliberately: `--dir` overrides discovery (reusing
`discoverDirectory` from `runtime/baseline/build-constitution.mjs` rather than re-implementing it),
zero dependencies, an explicit machine mode, non-fatal-by-default tool absence. Human output is one
line per deterministic rule:

```
domain-imports-nothing  unbound  import-linter#does-not-exist  (no contract named 'does-not-exist' in .importlinter)
```

`--json` emits `{ rows: [...], skippedNonDeterministic: <n> }` with the same fields. Non-deterministic
rules are counted in `skippedNonDeterministic`, never graded — the drift-drain's rule from the
decisions doc (Q3.4) applies here too: a `narrative` or `review` rule is not this CLI's business.

**Exit codes**, and how `severity` — shipped inert in 0.3.1 — becomes load-bearing:

| Code | Meaning |
|---|---|
| `0` | No blocking rule failed. `unbound`/`unreadable-config`/`fail`/`error` on a `warning`-severity rule are tolerated here (see `3`). `unavailable` rows are always tolerated unless `--require-tools --run`. |
| `1` | Usage error, missing decisions directory, unparseable decision file — matches `build-constitution.mjs` exactly. |
| `2` | At least one **`severity: blocking`** rule is `fail`, `unbound`, `unreadable-config`, or `error`; or (`--run --require-tools`) `unavailable`. |
| `3` | No blocking failure, but at least one **`severity: warning`** rule is in one of those states. Distinct from `0` so CI can surface warnings without parsing output, and distinct from `2` so a warning never blocks a merge. |

## Worked proof (not merely asserted)

This design was validated end-to-end against a real fixture before being written down, using a
throwaway repository with a genuine `.importlinter`:

```ini
[importlinter]
root_package = myapp

[importlinter:contract:one]
name = domain-isolation
type = layers
layers=
    myapp.domain
    myapp.infra
```

and a decision file with three rules — one bound to the real contract, one bound to a contract that
does not exist, one bound to `gitleaks` with no gitleaks config present at all:

```
domain-imports-nothing  unavailable  import-linter#domain-isolation  (import-linter contract 'domain-isolation' in .importlinter:5 — run with --run to evaluate)
gitleaks-example        unbound      gitleaks#aws-key                (no gitleaks config found)
unbound-example         unbound      import-linter#does-not-exist    (no contract named 'does-not-exist' in .importlinter)
0 non-deterministic rule(s) counted, not graded.
```
exit code `2` (the blocking `unbound-example` rule).

Isolating the resolvable rule alone and cycling the flags proved the full state machine:

| Flags | Result | Exit |
|---|---|---|
| *(none)* | `unavailable` — "run with --run to evaluate" | `0` |
| `--require-tools` alone | `unavailable`, unchanged — a no-op without `--run` (D8) | `0` |
| `--run`, binary missing | `unavailable` — "lint-imports is not on PATH" | `0` |
| `--run --require-tools`, binary missing | same row, now blocking | `2` |
| `--run`, a stub `lint-imports` prints `domain-isolation KEPT` | `pass` | `0` |
| `--run`, the stub prints `domain-isolation BROKEN` | `fail`, evidence carries the tool's own output | `2` |

This is the full bind → resolve → evaluate → exit-code pipeline, proven mechanically rather than
described.

**Worked proof: the semgrep reader.** Against
```yaml
rules:
  -
    pattern: |
      $X.execute($SQL)
    id: sql-injection
```
(`pattern:` before `id:`, the field order a first draft of this design assumed would fail)
`resolve()` returns `{ resolved: true, evidence: "semgrep contract 'sql-injection' in .semgrep.yml:5" }`
— correct, because the block scalar's content is necessarily indented deeper than `pattern:` itself.
Against
```yaml
rules:
  - id: no-eval
    pattern: eval(...)
  - id: &shared-id no-pickle
    pattern: pickle.loads(...)
```
it returns `{ resolved: false, reason: "unreadable-config", evidence: ".semgrep.yml: an anchor/alias
on an id value is not supported" }` for `no-pickle`, naming line 4 — the one construct the reader
cannot honestly resolve without risking a silent misread.

## Is tool config generated, or only read?

**Only read (D5).** Three grounds, all already binding: D5 of the SP1 design ("a rule binds to a
checker the repo already owns," with "a tool-agnostic constraint DSL" explicitly rejected);
`shared/recording-decisions.md` §3 ("naming a contract that already exists... Do not invent a
binding to make a rule look enforced"); and the structural one — if arch-crew authored the contract
it then resolves, the binding proves nothing about the repository, because the tool config would be
the baseline's own output used as its own oracle (`skills/test-patterns/references/oracles.md` names
this exact shape). `check-rules.mjs` may, in a future extension, print a suggested config snippet
clearly marked as something the user adds by hand — it never writes one. This release does not add
that suggestion output; it is out of scope (see below).

## The wording change

`runtime/baseline/constitution.mjs`'s `verificationNote()` changes from a claim to a pointer:

```diff
- return `Verified by \`${rule.verifiedBy}\` — binding shape checked; the contract itself is not yet resolved.`;
+ return `Verified by \`${rule.verifiedBy}\` — run the rule checker to resolve this binding and evaluate it.`;
```

This is a pure wording change — `renderConstitution()`'s inputs, sorting, and determinism guarantees
are untouched, and `constitution.md` still carries no resolution status (a `--check`ed artifact
cannot depend on the working tree's tool-config state at a moment in time; resolution status belongs
to `check-rules.mjs`'s own output, never to the generated rollup). Three other places carry the same
retraction, all updated in this release:

1. `docs/release-0.3.1.md`, "Known limitations," first bullet — marked resolved with a pointer to
   `docs/release-0.3.2.md` and `check-rules.mjs`'s own limits (the per-tool table above), rather than
   silently rewritten — a dated release note is a historical record, not a living rollup.
2. `shared/recording-decisions.md` §3 gains one sentence: a rule may be raised to `deterministic`
   only after `check-rules.mjs` actually resolves the binding — turning a prose-only guardrail into a
   mechanically checkable one, fanned out to all four skills by the existing `sync-shared.mjs` step.
3. `test/scenarios/baseline-capture.json`'s `binding-exists` and `no-real-binding` scenarios gain a
   note that their outcome is now checker-backed, and the `no-invented-bindings` criterion becomes
   layer-1 checkable for the first time (a fixture-backed test, not only agent judgement) — see
   Validation.

The golden constitution fixture (`test/fixtures/constitution.expected.md`) changes because
`test/fixtures/decisions/0001-layered-domain.md` carries a `deterministic` rule; this is expected
regeneration, not drift, exactly as the decisions doc anticipates.

## Packaging

**No adapter change is required.** `runtime/` already ships to both targets byte-identically
(`agentPackaging.canonicalRuntime`, established in SP1); `runtime/checkers/` is a new directory
under an already-copied tree. The only packaging-relevant addition is a `test/build.test.mjs`
assertion that `check-rules.mjs` runs from each target package (mirroring the existing
`build-constitution.mjs` assertion), so a future change that breaks the copy is caught the same way.

## Validation

**Layer 1 — package contract, deterministic, no model.** A new `test/checkers.test.mjs` with a
fixture corpus at `test/fixtures/checkers/<tool>/`, following the three house patterns: golden-file
comparison of extracted contract lists, shuffled config-file discovery order producing identical
results, and every loud failure asserted with its line number. `check-rules.mjs`'s own exit-code
matrix is tested against scratch repositories built with `mkdtemp`, the same pattern
`build-constitution.mjs`'s tests already use. `registry.mjs`'s agreement assertion is tested both
ways: a tool in `KNOWN_TOOLS` with no adapter, and an adapter for a tool not in `KNOWN_TOOLS`, both
fail loudly.

**Layer 2 — force-driven scenarios.** No new scenario set. The decisions doc is explicit that SP2
"mostly changes what runtimes do" and is graded in layer 1; the one model-judgement surface it
touches — `baseline-capture.json`'s `binding-exists`/`no-real-binding` scenarios — already exists and
only needs its `expect.notes` updated to say the outcome is now checker-backed, plus the new
`checker-confirms-binding` addition to `docs/validating-skills.md`'s description of that set. This is
a documentation-only change to an existing file, not a new scenario set, per C4's inversion rule
("never grade in layer 2 something layer 1 could decide").

## Out of scope

- Writing or patching a tool's config file (D5). A suggested-snippet report is a candidate for a
  later release, not built here.
- CI parsing to confirm oasdiff (or any tool) is actually invoked (D10's consequence, accepted).
- A `run()` implementation for `ast-grep` (D9); it always reports `unavailable`.
- Any per-rule caching of resolution results across runs — every invocation resolves fresh, which is
  the honest behaviour given tool configs can change between runs and this is a read-only,
  side-effect-free CLI.
- SP3's drift drain reading `check-rules.mjs`'s output at a commit boundary — that consumer is SP3's
  to build; this sub-project only guarantees the CLI exists, is scriptable, and its `--json` shape is
  stable enough to be consumed later.
- The E2E fixture-repository test that exercises this against SP4's migration output and SP5's
  security rules (SP6's `E2E-1`) — this design proves the mechanism (see "Worked proof") but the
  formal fixture-based E2E test is SP6's to author, once SP4 and SP5 exist to produce input.

## Risks

- **The semgrep/ast-grep reader's loud-failure path is narrow, and that cuts both ways.** It was
  proven against a fixture with `pattern: \|` (a multi-line block scalar) placed *before* `id:` in the
  same rule item — real-world field ordering — and it resolved correctly, because YAML's own
  indentation rules guarantee block content can never be mistaken for a field at the tracked indent.
  That is good for coverage: the common case of "some other field comes before `id:`" does not
  spuriously fail. But it means the guardrail mostly protects against constructs (anchors, aliases,
  tabs, multi-document files) that are rare in hand-written semgrep configs, so a reviewer should not
  assume "it resolved" implies "a full YAML parser would agree" for every construct outside this
  narrow set — only for the ones this document enumerates.
- **`unavailable` overloads two causes into one status (D7).** "You didn't ask to evaluate this" and
  "you asked, but the tool isn't installed" read identically in `--json` unless the evidence string is
  parsed. Chosen deliberately to keep the settled six-state vocabulary intact rather than widen it
  unilaterally; if a consumer (SP3's drain, or a future dashboard) needs to tell these apart
  programmatically, a `reason` sub-field is the natural, additive extension — not a status rename.
- **oasdiff's guarantee is structurally weaker than the other five tools' (D10).** This is stated
  three times in this document on purpose (the table, the dedicated paragraph, and here) because it
  is the one place a reader could mistake "resolved" for "this repo actually runs this check."
- **pytest-archon can only prove a same-named function exists, never that it asserts anything.** A
  rule bound to `pytest-archon#test_domain_isolation` where that test's body is `pass` resolves
  cleanly and, if run, reports `pass` — correctly, by this adapter's stated contract, and
  incorrectly by the rule's actual intent. This is not a defect to silently patch (semantic test
  inspection is exactly the "model approximating a tool" the project forbids); it is a limitation to
  keep visible in the evidence string on every row this adapter produces.
