# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, and others) working in or with this repo.

## What this repo is

**arch-crew** — a Claude Code plugin of three architectural-decision skills. Each helps choose an
architecture for new work, or audit existing code, and writes the decision down (ADR / review).

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
