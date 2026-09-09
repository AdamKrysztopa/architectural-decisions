# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, and others) working in or with this repo.

## What this repo is

**arch-crew** — a cross-agent package of five architectural-decision skills. Each helps choose an
architecture, pattern, or testing strategy for new work, or audit existing code, and writes the
decision down (ADR / review).
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
| deciding what evidence a system needs or rebalancing a suite (unit vs integration vs contract vs E2E, pyramid vs trophy, QA's role, flaky or slow CI, escaped defects, mock-heavy suites, property-based / mutation / golden tests, data-quality checks, ML evaluation, LLM and agent evaluation, or whether AI-generated tests rest on a trustworthy oracle) — **not** for implementing one ordinary test | `arch-crew:test-patterns` |
| deciding or auditing the security of a design (trust boundaries, who authenticates and authorizes where, secrets, data classification and retention, supply-chain trust, or what an agent's credentials may reach) — **not** for running or simulating a scanner | `arch-crew:threat-model` |

Each skill branches on project status: **greenfield → a selection interview**; **existing code →
a code review** against the catalog. Trigger them even when the user does not name a pattern.

## How the skills are structured

- `skills/<name>/SKILL.md` — the workflow (lean; read first).
- `skills/<name>/references/decision-tree.md` — the interview / decision logic.
- `skills/<name>/references/catalog.md` — patterns with when-to-use, cost, and code-review cues.

`test-patterns` adds two topic references loaded only when their branch fires:
`references/evaluation.md` (data / ML / LLM-agent evaluation) and `references/oracles.md` (the
generated-test oracle guardrail). Its `SKILL.md` carries a table mapping decision → reference.

`threat-model` adds two topic references: `references/evidence.md` (the finding-evidence guardrail,
read in every run that writes a finding) and `references/agent-agency.md` (tool permissions and
excessive agency, loaded only when the system contains an agent).

Read `SKILL.md`, then the referenced files on demand. Don't load the `html/` source files — they
are the local knowledge source, not runtime inputs.

## Conventions

- Greenfield decisions are recorded as MADR-style ADRs in `docs/adr/NNNN-short-title.md`.
- Refactoring reviews are written to a *topic*-named report in `docs/`, one per skill:
  `architecture-review-<date>.md`, `design-pattern-review-<date>.md`, `agentic-review-<date>.md`,
  `test-suite-review-<date>.md`, `security-review-<date>.md`.
- `test-patterns` honours read-only requests ("review only", "dry run", "don't modify files"): it
  presents the full recommendation and names the path it would have written, without writing.
- Full usage docs: [`docs/README.md`](docs/README.md). Examples: [`docs/examples/`](docs/examples/).
  Validation: [`docs/validating-skills.md`](docs/validating-skills.md).

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
