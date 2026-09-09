# Release 0.3.2 — deterministic compliance checkers

## What shipped in 0.3.2

- **Binding resolution.** `runtime/checkers/check-rules.mjs` resolves every `verification:
  deterministic` rule's `verified_by` binding against the repository's own tool configuration — no
  tool installation required. A rule bound to a contract that was renamed, deleted, or never existed
  now reports `unbound`, not a silent pass.
- **Six checker adapters, `runtime/checkers/`:** `import-linter` (INI + TOML), `dependency-cruiser`
  (JSONC; a JS config is reported `unreadable-config`, never executed), `semgrep` (a YAML-subset
  reader for a `rules:` list) and `ast-grep` (its own reader for the different shape ast-grep rule
  files actually use — a top-level `id:` per YAML document, `sgconfig.yml`'s `ruleDirs:` locating
  where to look; `ast-grep`'s `--run` is not implemented this release), `gitleaks` (TOML),
  `pytest-archon` (no config file — a contract is a test function name; the function body is never
  inspected), and `oasdiff` (a vendored list of real check ids — the one adapter that cannot tell
  whether this repository actually runs the check, only whether the id is a real one).
- **Four outcomes, never collapsed:** `unbound` (contract absent), `unreadable-config` (a config the
  reader cannot honestly parse), `unavailable` (not evaluated — either `--run` was not requested, or
  the tool binary is missing), and, under `--run`, `pass`/`fail` from the tool's own output.
- **`severity: blocking | warning` becomes load-bearing.** Shipped inert in 0.3.1, it now drives
  `check-rules.mjs`'s exit code: `0` clean, `1` usage error, `2` a blocking rule failed to resolve or
  evaluate, `3` only warning-severity rules did.
- **`ast-grep` joins `KNOWN_TOOLS`**, with a working adapter — the rule this project already applied
  to the other six tools.
- **The generated constitution's wording changes** from a claim ("binding shape checked; the contract
  itself is not yet resolved") to a pointer ("run the rule checker to resolve this binding and
  evaluate it"), and 0.3.1's "Known limitations" entry for this gap is marked resolved.

## Scope

Sub-project 2 of six, build order SP2 → SP4 → SP5 → SP3 → SP6. Ships as a **patch release**; `0.4.0`
stays reserved for the release satisfying the full pre-release checklist (sub-project 6).

## Deliberate limitations

- **Only read.** No adapter, and no CLI flag, writes into a tool's config file. `check-rules.mjs` may
  in a future release print a suggested config snippet clearly marked as something the user adds by
  hand; it does not do so in 0.3.2.
- **`oasdiff` resolves against a vendored check-id list, never a file in the repository.** Unlike the
  other five tools, `oasdiff#<contract>` resolves in *every* repository that spells a real check id
  correctly, whether or not that repository runs oasdiff at all. This is the weakest guarantee of the
  six adapters, and is stated on every oasdiff row's evidence.
- **`pytest-archon` can only prove a same-named test function exists, never that its body asserts
  anything.** The evidence string says so on every row.
- **`ast-grep --run` is not implemented.** Static resolution only; `--run` always reports
  `unavailable`, stated in the adapter itself.
- **No caching.** Every invocation resolves fresh from the working tree.

## Compatibility

No `SKILL.md` frontmatter changes. `shared/recording-decisions.md`'s body gains one sentence,
fanned out to all four skills by the existing sync step; no skill's triggering behaviour changes.

## Verification

```sh
npm test
npm run sync:check
npm run build -- --target all
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check
node runtime/checkers/check-rules.mjs --dir docs/architecture/decisions
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/
```

The last command must return nothing.
