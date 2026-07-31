# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, and others) working in or with this repo.

## What this repo is

**arch-crew** — a cross-agent package of three architectural-decision skills. Each helps choose an
architecture for new work, or audit existing code, and writes the decision down (ADR / review).
Claude Code and Codex are currently supported package targets; do not imply support for other
agents until a target adapter and generated package exist.

## When to use these skills

If you are helping a user with any of the following, prefer the matching skill over answering from
scratch — they encode a decision tree, a pattern catalog with costs, and a bias toward the *least*
architecture that meets the requirement:

| User is… | Use |
|----------|-----|
| choosing/structuring a new system, or questioning an existing architecture (monolith vs microservices, layering, events, CQRS, data pipeline) | `arch-crew:decide-architecture` |
| choosing an object/class design pattern, or reviewing one (factory, strategy, observer, decorator, repository), especially in Python | `arch-crew:design-patterns` |
| designing or reviewing an LLM-agent system (one agent vs many, reasoning loop, tools, memory, human approval, multi-agent topology) | `arch-crew:agentic-patterns` |

Each skill branches on project status: **greenfield → a selection interview**; **existing code →
a code review** against the catalog. Trigger them even when the user does not name a pattern.

## How the skills are structured

- `skills/<name>/SKILL.md` — the workflow (lean; read first).
- `skills/<name>/references/decision-tree.md` — the interview / decision logic.
- `skills/<name>/references/catalog.md` — patterns with when-to-use, cost, and code-review cues.

Read `SKILL.md`, then the referenced files on demand. Don't load the `html/` source files — they
are the local knowledge source, not runtime inputs.

## Conventions

- Greenfield decisions are recorded as MADR-style ADRs in `docs/adr/NNNN-short-title.md`.
- Refactoring reviews are written to `docs/<skill>-review-<date>.md`.
- Full usage docs: [`docs/README.md`](docs/README.md). Examples: [`docs/examples/`](docs/examples/).

## Packaging boundaries

- `skills/`, `docs/`, and examples are canonical shared content. Edit a workflow or reference
  there, never in a generated package.
- `builders/adapters/<target>.mjs` is a thin adapter: it selects canonical runtime files and generates only
  target metadata/layout. It must not fork skill logic.
- `build/<target>/` is deterministic, committed output for distribution. Do not hand-edit it;
  regenerate it with `npm run build -- --target <target>`.
- The root `.claude-plugin/` compatibility surface is retained for existing Claude users. Its
  marketplace and install commands must remain unchanged.

For the complete build, validation, and new-adapter process, read
[`docs/building-packages.md`](docs/building-packages.md).
