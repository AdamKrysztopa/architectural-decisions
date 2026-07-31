# arch-crew

A suite of **architectural-decision skills** for supported coding agents. Four skills help you
*choose* an architecture, a pattern, or a testing strategy for new work, or *audit* what you already
have — each branching automatically on whether you're greenfield or refactoring.

> The architecture, design-pattern, and agentic skills were **validated across 20 real-world cases**
> spanning both modes and real repositories — they recommend *doing less* (no agent, no
> microservices, no pattern, no E2E suite) as readily as doing more.
> **[Full docs →](docs/README.md)** · **[Examples →](docs/examples/README.md)**

| Skill | Use it to… | Greenfield mode | Refactoring mode |
|-------|-----------|-----------------|------------------|
| `arch-crew:decide-architecture` | Pick or assess **software architecture** (structure, topology, data, overlays) | Selection interview → composed stack | Review code → targeted moves |
| `arch-crew:design-patterns` | Pick or assess **GoF / Python-idiomatic design patterns** | Which-pattern interview → one recommendation (+ Pythonic form) | Smell → pattern review |
| `arch-crew:agentic-patterns` | Design or assess an **LLM-agent system** | Layered design interview (autonomy → … → integration) | Seven-defect agent review |
| `arch-crew:test-patterns` | Separate QA from executable testing; compose **unit, integration, E2E, and data/ML/LLM evaluation** evidence | Risk-led testing portfolio + ADR | Test-suite review + highest-leverage rebalancing move |

Each skill first works out **where you are** — greenfield (a new design) or refactoring (existing
code) — then either runs a short selection interview or reviews your code against the catalog. The
through-line in all four: recommend the **least architecture that meets the requirement**, and name
the cost of every pick.

## Install for Claude Code

Add the marketplace and install the plugin:

```
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

Then invoke a skill directly (e.g. `arch-crew:decide-architecture`) or just describe an architecture
decision and the right skill triggers.

This is the original Claude Code installation path and remains fully backward-compatible.

## Install for Codex

Add the Codex marketplace and install its generated plugin package:

```sh
codex plugin marketplace add AdamKrysztopa/architectural-decisions
codex plugin add arch-crew@arch-crew
```

Start a new Codex session after installation, then invoke a skill or describe the architectural
decision you need to make.

## How the knowledge is sourced

The decision logic and pattern catalogs for `decide-architecture`, `design-patterns`, and
`agentic-patterns` are distilled from three single-file HTML references (`html/`, kept locally as
the source of truth, not shipped) into each skill's `references/`. `test-patterns` has no HTML
source; its references were written directly. Every skill ships the same two files:

- `references/decision-tree.md` — the selection interview / decision tree.
- `references/catalog.md` — the patterns with when-to-use, cost, and code-review cues.

`SKILL.md` stays a lean workflow and reads those references on demand (progressive disclosure).

## Packaging and layout

The portable skill workflows and their references in `skills/`, along with the shared docs and
examples, are canonical source. `builders/` contains thin target adapters; it does not own or fork
skill logic. `build/<target>/` is generated, committed release output containing only what that
target needs. This lets a Claude installation receive Claude files and a Codex installation receive
Codex files without cross-agent configuration.

```
skills/
  decide-architecture/   SKILL.md + references/{decision-tree,catalog}.md
  design-patterns/        SKILL.md + references/{decision-tree,catalog}.md
  agentic-patterns/       SKILL.md + references/{decision-tree,catalog}.md
  test-patterns/          SKILL.md + references/{decision-tree,catalog}.md
builders/
  build.mjs               shared deterministic builder
  adapters/               thin target packaging adapters
build/
  claude/                 generated Claude package
  codex/                  generated Codex package
```

The root `.claude-plugin/` files remain as a Claude compatibility façade. See the
[maintainer build guide](docs/building-packages.md) for the build and validation workflow.

## License

MIT
