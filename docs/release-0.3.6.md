# Release 0.3.6 — migration and bootstrap

## What shipped in 0.3.6

- **Consolidation.** `references/migrating-decisions.md` (shared by all four skills) walks turning an
  explicitly confirmed set of existing prose ADRs into schema decision files: candidates are listed,
  never adopted; every migrated decision's prose carries a `## Sources` section naming its input and
  the commit; conflicts and overlaps are reported as candidates, never auto-resolved; no existing file
  is ever edited or deleted.
- **Reverse discovery.** The same reference covers proposing a baseline for a codebase with no
  recorded decisions at all, using `runtime/migration/inventory.mjs`'s pattern-occurrence counter as
  its only mechanical evidence source. Every proposed rule starts `verification: narrative`; raising it
  is a distinct, later, human act. A pass proposes at most 20 decisions and must rank above that.
- **The traceability report.** `runtime/migration/build-migration-report.mjs` writes
  `migration-report.md` beside the decisions directory. It refuses to write an incomplete one — every
  confirmed input must have exactly one disposition, and a migrated/merged decision must actually cite
  the input it claims.
- **`promote`.** `node runtime/baseline/build-constitution.mjs promote NNNN [NNNN ...]` flips a
  decision's `status` from `proposed` to `active` and regenerates the constitution in one auditable
  step. It reuses the existing gate; it does not add a second one, and it does not make hand-editing
  `status: active` impossible.
- **The dual-artifact limitation from 0.3.1 is resolved.** All four skills now write exactly one
  decision file when they make a recommendation. See "Known limitations" in `docs/release-0.3.1.md`.

## Scope

Sub-project 4 of six. The original build order for this upgrade was chosen as SP2 → SP4 → SP5 → SP3 →
SP6 (`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md`, C1); in practice SP3
(the drift-observation loop) shipped as 0.3.5 ahead of this release, so the sequence actually executed
was SP2 (0.3.2) → SP3 (0.3.5) → SP4 (0.3.6). SP2's checker registry (`runtime/checkers/`) already
existed and is what resolves a `verified_by` binding cited in a migration report; SP3's drift loop
already exists too, and this release does not depend on it — migration and the drift drain are
independent consumers of the same baseline.

## Compatibility

The four skills' `name`/`description` frontmatter, and therefore triggering, is unchanged. Existing
`docs/adr/` files are untouched by this release; nothing forces migrating them.

## Verification

```sh
npm test
npm run sync:check
npm run build -- --target all
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/
```

The `grep` must return nothing.
