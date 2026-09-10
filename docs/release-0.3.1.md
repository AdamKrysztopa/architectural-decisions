# Release 0.3.1 — the architectural baseline

## What shipped in 0.3.1

- **The decision-file format.** A decision is a Markdown file with a small, fixed frontmatter
  subset (`key: value`, inline lists, one level of list-of-maps) and free-form prose. It carries
  `id`, `status`, `skill`, `date`, `commit`, and zero or more `rules`, each with `id`, `statement`,
  `scope`, `severity`, and `verification`. Anything outside the fixed subset — block scalars,
  anchors, nested maps — is rejected with a line number rather than silently accepted.
- **The generated constitution.** `runtime/baseline/build-constitution.mjs` discovers a
  repository's decisions directory — the first of `docs/adr/`, `docs/architecture/decisions/`,
  `doc/adr/`, `adr/` that already holds a parseable decision file (see "Coexisting with existing
  prose ADRs" below) — reads every decision file, and rolls the rules of the `active`
  ones into `constitution.md` — sorted by rule id, each rule showing its verification class and
  linking back to the decision file that states it. The file carries a do-not-edit banner; nothing
  ever hand-edits it.
- **The `--check` contract.** Run with `--check`, the generator does not write: it compares the
  freshly rendered constitution against the one on disk and exits 0 when they match, non-zero
  (with the specific mismatch or parse error) when they don't. This is the command a reviewer or CI
  step runs to catch a decision file that was added or edited without regenerating the rollup.
- **The capture step in all four skills.** `shared/recording-decisions.md` is the canonical
  capture workflow, synced byte-for-byte into `skills/*/references/recording-decisions.md` by
  `builders/sync-shared.mjs`. Every skill's body now closes with this step: read the constitution
  first, write one decision file at `status: proposed` when the run made a recommendation
  (including an explicit refusal), classify each rule's `verification` honestly, and supersede
  rather than duplicate when a subject is already covered.
- **The generator shipped to both targets.** `runtime/baseline/` is packaged into both
  `build/claude` and `build/codex` alongside the four skills, so a skill run in either host can
  invoke the same zero-dependency script via `$CLAUDE_PLUGIN_ROOT` or the installed Codex plugin
  directory.

## Scope

This is **sub-project 1 of six** in the arch-crew architectural-baseline upgrade. It ships as a
**patch release, not 0.4.0**: the pre-release checklist for the full upgrade spans all six
sub-projects, and only this one is built. `0.4.0` is reserved for the release that satisfies that
checklist. The five deferred sub-projects:

2. **Deterministic compliance checkers** — actually running the tools a `deterministic` rule names
   (`import-linter`, `dependency-cruiser`, `semgrep`, etc.) and reporting pass/fail, rather than
   only validating that the binding is well-formed.
3. **Drift-observation loop with hooks** — detecting when code diverges from an active rule as it
   happens, via host hooks, rather than only at the point someone runs `--check`.
4. **Migration / reverse discovery** — inferring an initial decision-file baseline from an existing
   codebase that has never recorded one, instead of starting empty.
5. **Security extension** — a rule and binding vocabulary for security-specific constraints
   (secrets handling, dependency provenance, auth boundaries) beyond the general schema.
6. **Docs and examples rollup** — a consolidated worked walkthrough of the baseline across all four
   skills, once the above land, rather than the per-skill mentions this release carries.

## Coexisting with existing prose ADRs

A repository that already keeps conventional Nygard/MADR-style prose ADRs in `docs/adr/` (or
`doc/adr/`, `adr/`) can adopt the baseline without moving them. Discovery walks the candidate
directories in order and picks the first one that already holds at least one file that **parses**
as a schema decision; a directory that merely exists, with only prose ADRs in it, is skipped in
favor of the next candidate — typically `docs/architecture/decisions/`. Only if no candidate
directory holds a single parseable decision does discovery fall back to the first one holding any
`NNNN-slug.md`-shaped file at all, so a real typo in your one decisions directory still fails loudly
instead of silently resolving to an empty default. The capture step never writes into, converts, or
reformats a prose ADR directory — it writes schema decisions to `docs/architecture/decisions/`
alongside it.

## Known limitations

- ~~A `verified_by` binding is validated for shape and known tool only; the named contract is not
  resolved inside the tool's config.~~ **Resolved in 0.3.2** — see `docs/release-0.3.2.md` and
  `runtime/checkers/check-rules.mjs`'s own per-tool limits (some readers, e.g. oasdiff's, resolve
  against a vendored list rather than a file in the repository; JS dependency-cruiser configs are
  not statically readable at all).
- `status: proposed` on capture, and the rollup ignoring proposed rules, are enforced by **prose
  instruction to the model in the shared reference — not mechanically**. Nothing in the runtime
  prevents a skill writing `status: active` directly. Human review of the decision file is the
  actual gate.
- The baseline version is the **git commit containing `constitution.md`**, recovered from git
  history; no SHA is written into the file (writing one would make `--check` report staleness on
  every commit).
- ~~A greenfield run records the same decision twice~~ — **resolved in 0.3.6.** All four skills now
  write a single decision file; the prose-ADR write is gone. See `docs/release-0.3.6.md`.

## Compatibility

The four skills' names, descriptions, and triggering are unchanged; existing greenfield and
refactoring workflows are untouched. The addition is a closing step in each skill's body — the
capture workflow described above. Existing users need no migration.

## Verification

A reviewer can run, from the repository root:

```sh
npm test
npm run sync:check
npm run build -- --target all
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check
```

And confirm no lingering reference to the reserved version:

```sh
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/release-0.3.1.md
```

This must return nothing.
