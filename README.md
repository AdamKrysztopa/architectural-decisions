# arch-crew

A suite of **architectural-decision skills** for Claude Code. Three skills help you *choose* an
architecture for new work, or *audit* the architecture of code you already have — each branching
automatically on whether you're greenfield or refactoring.

| Skill | Use it to… | Greenfield mode | Refactoring mode |
|-------|-----------|-----------------|------------------|
| `arch-crew:decide-architecture` | Pick or assess **software architecture** (structure, topology, data, overlays) | Selection interview → composed stack | Review code → targeted moves |
| `arch-crew:design-patterns` | Pick or assess **GoF / Python-idiomatic design patterns** | Which-pattern interview → one recommendation (+ Pythonic form) | Smell → pattern review |
| `arch-crew:agentic-patterns` | Design or assess an **LLM-agent system** | Layered design interview (autonomy → … → integration) | Seven-defect agent review |

Each skill first works out **where you are** — greenfield (a new design) or refactoring (existing
code) — then either runs a short selection interview or reviews your code against the catalog. The
through-line in all three: recommend the **least architecture that meets the requirement**, and name
the cost of every pick.

## Install

Add the marketplace and install the plugin:

```
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

Then invoke a skill directly (e.g. `arch-crew:decide-architecture`) or just describe an architecture
decision and the right skill triggers.

## How the knowledge is sourced

The decision logic and pattern catalogs are distilled from three single-file HTML references
(`html/`, kept locally as the source of truth, not shipped) into each skill's `references/`:

- `references/decision-tree.md` — the selection interview / decision tree.
- `references/catalog.md` — the patterns with when-to-use, cost, and code-review cues.

`SKILL.md` stays a lean workflow and reads those references on demand (progressive disclosure).

## Layout

```
.claude-plugin/
  plugin.json
  marketplace.json
skills/
  decide-architecture/   SKILL.md + references/{decision-tree,catalog}.md
  design-patterns/        SKILL.md + references/{decision-tree,catalog}.md
  agentic-patterns/       SKILL.md + references/{decision-tree,catalog}.md
```

## License

MIT
