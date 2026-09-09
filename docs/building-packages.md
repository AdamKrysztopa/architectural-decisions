# Building agent packages

## Purpose

`arch-crew` keeps skill knowledge portable while distributing only the files each coding agent
needs. Claude Code and Codex are supported targets today. Cursor, GitHub Copilot, and other agents
are not supported until they have an adapter, an installer catalog, and validation.

## Source of truth and generated output

| Location | Role | Editing rule |
|---|---|---|
| `skills/` | Canonical workflows and references | Edit here for any skill-content change. |
| `docs/` and `docs/examples/` | Canonical shared documentation and examples | Edit here, not in a package copy. |
| `builders/adapters/<target>.mjs` | Thin target adapter | Change only for a target's layout or metadata contract. |
| `test/` | Package contract suite and force-driven scenario sets | Edit here when a skill gains a reference, a gate, or a scenario. |
| `build/<target>/` | Deterministic, target-only distributable package | Generated and committed; never hand-edit. |
| `.claude-plugin/` | Claude Code compatibility façade | Preserve existing marketplace behavior and plugin identity. |

Generated artifacts are committed intentionally: Git-backed marketplaces can install the exact,
reviewed package without requiring a build step on the user's machine. This makes each release diff
larger, but avoids drift between repository source and marketplace output. CI fails if a clean
rebuild changes, adds, or removes a generated artifact.

## Build and validate

Run these from the repository root:

```sh
npm run build -- --target claude
npm run build -- --target codex
npm run build -- --target all
npm test
git diff --check
git status --short
```

Build only the affected target while iterating; run `all` before release. `npm test` runs both
suites (`npm run test:build` and `npm run test:scenarios` run them individually).

Keep the shared references in sync (also run automatically by `npm run build`):

    npm run sync:check

Verify a repository's constitution matches its decision files:

    node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check

Resolve every deterministic rule's binding against this repository's own tool config (no tool
required; add `--run` to also evaluate, `--require-tools` to make a missing tool binary blocking
under `--run`):

    node runtime/checkers/check-rules.mjs --dir docs/architecture/decisions

Inspect the drift queue and drain it into an evidence packet:

    node runtime/drift/drift.mjs status --root .
    node runtime/drift/drift.mjs drain --root . --json

`build/claude/hooks/hooks.json` is a generated target file, declared in package.json's
`agentPackaging.generatedTargetFiles`, and is never hand-edited.

Validation must
confirm that each target contains its expected manifest and canonical skill files, contains no files
from another agent, and that the Claude skill trees match the canonical `skills/` files
byte-for-byte. A clean rebuild of committed artifacts should leave no diff.

The package-contract suite fails when a canonical skill is missing from either target's output, when
a required reference is absent, when `SKILL.md` points at a reference that does not exist (or ships a
reference it never tells the model to load), when a manifest points at a missing path, when plugin
and marketplace versions disagree, when the root Claude façade differs from the generated manifest it
mirrors, or when prose in the shipped docs claims a different number of skills than are packaged. CI
additionally rebuilds and fails on any diff. See
[validating the skills](validating-skills.md) for the second layer — the force-driven scenario sets
that grade the skills' reasoning rather than their packaging.

### Host validation before release

The Node tests enforce the repository contract, but they do not replace each host's parser and
installer. In a disposable CLI environment, run:

```sh
claude plugin validate build/claude --strict
claude plugin validate .claude-plugin/marketplace.json --strict
claude plugin marketplace add ./
claude plugin install arch-crew@arch-crew

codex plugin marketplace add .
codex plugin add arch-crew@arch-crew
codex plugin list --json
```

Confirm both installed plugins are versioned correctly and contain only their target manifest plus
the four generated skill trees. Remove the temporary plugin and marketplace registrations after
the smoke test. The Codex CLI currently has no separate non-mutating plugin validator, so its actual
marketplace installation is the release gate.

## Installation contracts

Claude Code remains backward-compatible:

```text
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

Codex uses the generated marketplace package:

```sh
codex plugin marketplace add AdamKrysztopa/architectural-decisions
codex plugin add arch-crew@arch-crew
```

After Codex installation, start a new session before using bundled skills.

## Adding a target adapter

1. Check the agent's current documented packaging and installation contract.
2. Add one small `builders/adapters/<target>.mjs` definition that declares the output directory,
   allowlisted runtime trees, and JSON manifest/catalog renderers. Register any generated
   repository-root files and their dedicated boundaries in `agentPackaging.generatedRootFiles` and
   `agentPackaging.generatedRootDirectories`; the builder rejects undeclared, missing, duplicate,
   out-of-boundary, or stale root outputs.
3. Keep workflows, references, prompts, templates, checklists, and examples in canonical shared
   locations. Add a narrowly scoped overlay only if the agent cannot consume a portable skill file.
4. Add validation proving the output is deterministic, target-only, and preserves canonical files
   that are copied.
5. Generate and commit `build/<target>/`, document its installer, and add it to the all-target build.

Do not add speculative adapters or agent directories. An adapter exists to encode a real host
contract, not to reserve a name.

## Why generation is deliberately simple

The build copies Markdown unchanged and serializes agent metadata as structured JSON. There is no
Jinja-style templating engine because current adapters do not require conditional prose, loops, or
escaping within workflow content. If a future, documented host contract genuinely needs those
capabilities, introduce the narrowest renderer or overlay that solves that contract; do not turn
the shared workflows into templates by default.
