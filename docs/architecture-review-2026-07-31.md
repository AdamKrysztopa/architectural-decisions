# Architecture review: agent-agnostic distribution

**Current shape:** Structure: one hand-maintained Claude Code plugin at the repository root ·
Topology: three self-contained Agent Skills with relative references · Build: none ·
Distribution: one Claude marketplace catalog whose package source is the repository root

## Findings

1. **The workflow content is already portable, but its package is Claude-specific.** The three
   `skills/<name>/SKILL.md` trees use the Agent Skills shape and contain no Claude-only workflow
   logic. The coupling is in `.claude-plugin/`, install documentation, and package metadata, not in
   the skills themselves. Moving or forking the workflows would add risk without adding portability.

2. **The repository root is both authoring tree and distribution artifact.** The Claude marketplace
   currently uses `source: "./"`, so an installation can collect repository collateral that is not
   needed at runtime. Adding another agent's package at the root would make that leakage worse.
   Each marketplace should instead point to a target-specific, allowlisted artifact.

3. **Release metadata can drift.** Name and version currently appear in `package.json`, the Claude
   plugin manifest, and several marketplace fields. A builder should derive target manifests from
   one metadata source and tests should reject disagreement.

4. **Generated artifacts are required for repository-backed installation.** A local build directory
   can be ignored, but a marketplace cloning this Git repository cannot install files that were not
   committed. The lowest-complexity release model is therefore to commit deterministic `build/`
   outputs and verify that rebuilding produces no diff. A separate distribution branch or repository
   remains possible later, but would add release coordination now.

5. **The ignored HTML files are an authoring aid, not a viable build input.** They are described as
   the knowledge source but are unavailable to consumers and CI. Versioned `SKILL.md` and reference
   files must be the canonical runtime input. Any future re-distillation from HTML is a separate
   authoring workflow and must produce a reviewed change to the canonical Markdown.

## Recommended moves

1. Keep `skills/`, `docs/`, and `docs/examples/` as the shared, hand-maintained source. A new
   `source/` wrapper would only rename an already-standard layout and would disturb direct users.
2. Add one deterministic, zero-dependency Node builder with a small target adapter per ecosystem.
3. Generate `build/claude/` and `build/codex/` from the same skill trees. Never template or rewrite
   shared skill content.
4. Keep `.claude-plugin/marketplace.json` as the existing Claude installer entry point, but point its
   package source to `./build/claude`. Add `.agents/plugins/marketplace.json` for Codex, pointing only
   to `./build/codex`.
5. Validate target inventories, manifest schemas, version coherence, relative references, and
   byte-for-byte skill parity. Run the installed CLIs' structural validators where available.

## Leave alone

The three skill workflows, their progressive-disclosure references, skill names, and the
`arch-crew:<skill>` Claude invocation namespace are already right-sized. They should remain
byte-identical during this packaging migration. A general templating engine, framework, or semantic
content conversion is not justified.
