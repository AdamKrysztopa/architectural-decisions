# 0001. Generate agent-specific packages from shared Agent Skills

- Status: Accepted
- Date: 2026-07-31
- Deciders: arch-crew maintainers

## Context

`arch-crew` has three reusable architectural-decision workflows, but the repository is distributed
as a Claude Code plugin. Supporting Codex and future coding agents by copying and editing those
workflows would cause content drift. At the same time, putting every agent manifest in one installed
package would leak irrelevant files and make compatibility harder to reason about.

Claude compatibility is a release invariant: the existing marketplace command, plugin identity,
skill names, invocation namespace, relative references, and workflow bytes must continue to work.
Codex currently packages distributable skills with `.codex-plugin/plugin.json` and discovers a
repository marketplace at `.agents/plugins/marketplace.json`.

## Decision

| Concern | Decision | Why it fits | Cost accepted |
|---|---|---|---|
| Canonical content | Keep `skills/`, `docs/`, and examples as shared source | `skills/` already follows the portable Agent Skills layout | The repository does not have a single `source/` umbrella directory |
| Build | Use a zero-dependency Node builder | Node is already present and JSON can be generated safely without templates | A small build script and tests must be maintained |
| Adapters | One thin target definition per agent | Adapters select files and render manifests without owning workflow logic | Each new ecosystem still needs an explicit contract and validation |
| Artifacts | Generate allowlisted `build/<target>/` trees | Installations receive only their target's runtime files | Generated files are duplicated on disk |
| Distribution | Commit deterministic build artifacts | Git-backed marketplaces can install them directly | Pull requests include generated diffs; CI must detect stale output |
| Claude | Preserve the root marketplace and direct-plugin compatibility surface | Existing users keep the same commands and skill namespace | A small root compatibility façade remains Claude-specific |
| Codex | Add a Codex manifest and repository marketplace | Uses Codex's documented plugin distribution surface | Codex packaging must be rechecked as the product evolves |
| Templating | Generate structured JSON directly; copy Markdown byte-for-byte | There are no conditional prose transformations to justify Jinja | If a future host cannot consume Agent Skills, a narrow overlay may be needed |

The builder interface is deliberately small: a target declares its output root, manifest renderer,
and runtime allowlist. Shared files are copied without transformation. A future target is added by
implementing that contract plus its installer catalog and validation tests.

## Consequences

- Claude and Codex artifacts can be rebuilt independently or together.
- No target adapter may modify canonical skill logic. Host-specific metadata belongs in its manifest
  or a narrowly scoped overlay.
- A clean rebuild must be reproducible and leave the Git worktree unchanged.
- Target packages must reject undeclared files, including another agent's manifest or local settings.
- The Claude artifact is compared to the canonical skill trees byte-for-byte.
- Adding Cursor, Copilot, or another host starts with its current documented package contract; it does
  not pre-emptively add abstractions to the shared workflows.
- A general templating engine will be reconsidered only when at least one real adapter needs
  conditions, loops, or escaping that structured generation cannot express clearly.
