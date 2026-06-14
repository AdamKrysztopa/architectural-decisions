# arch-crew — documentation

Three Claude Code skills that make **architectural decisions** with you, then write them down.
Greenfield? They run a short selection interview and recommend a design. Existing code? They review
it against a pattern catalog. Every recommendation carries its cost; the bias is always toward the
**least architecture that meets the requirement.**

> Validated across 20 real-world cases (both modes, real repositories) — it correctly recommends
> *doing less* as readily as doing more. See the [examples](examples/).

## Install

```
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

## The three skills

| Invoke | For | Greenfield → | Existing code → |
|--------|-----|--------------|-----------------|
| `arch-crew:decide-architecture` | software architecture (structure, topology, data, overlays) | selection interview → composed stack + ADR | review → targeted moves + report |
| `arch-crew:design-patterns` | GoF + Python-idiomatic design patterns | which-pattern interview → one recommendation + Pythonic form | smell → pattern review |
| `arch-crew:agentic-patterns` | LLM-agent systems (autonomy, loops, memory, governance) | layered design interview → "your agentic design" + ADR | seven-defect agent review |

## How to use

You usually don't name the skill — just describe the decision and the right one triggers:

- *"How should I structure this new payments service?"* → `decide-architecture` (greenfield)
- *"Is our monolith's layering right?"* → `decide-architecture` (refactoring)
- *"Which pattern fits — I've got a growing if/elif picking an algorithm?"* → `design-patterns`
- *"Should this be one agent or several? How do I add human approval?"* → `agentic-patterns`

Each skill first works out **where you are** (greenfield vs. refactoring), then:

**Greenfield — a short interview.** It asks one decision at a time, skipping questions your project
already answers, and composes the result. You get a recommendation table (each pick + why + cost)
and, for architecture/agentic decisions, an **ADR** written to `docs/adr/NNNN-*.md` so the decision
outlives the chat. (`design-patterns` is chat-first; it writes an ADR only for module-shaping choices
or on request.)

**Refactoring — a review.** It maps your code onto the catalog, finds real mismatches (not aesthetic
ones), and proposes the smallest change that removes genuine pain — often "leave it, this is fine."
You get a review report in `docs/`.

## What you get

- A recommendation with the **trade-off named** for every pick — no fashion-driven advice.
- A durable **ADR** (greenfield) or **review report** (refactoring) — see [examples](examples/).
- A standing bias against over-building: the skills will tell you you don't need an agent, don't
  need microservices, or don't need a pattern when that's the honest answer.

## Where the knowledge comes from

The decision logic and catalogs are distilled into each skill's `references/` (the model reads
these on demand) from three single-file HTML pattern references kept locally as the source of truth.
`SKILL.md` stays a lean workflow.

## For coding agents

This repo ships [`AGENTS.md`](../AGENTS.md) and [`llms.txt`](../llms.txt) so AI coding tools can
discover the skills and route the right one. The skill `description` fields are the trigger surface.
