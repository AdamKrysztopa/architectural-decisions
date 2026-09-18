# arch-crew — documentation

Five architectural-decision skills that make **architectural decisions** with you, then write them down.
Greenfield? They run a short selection interview and recommend a design. Existing code? They review
it against a pattern catalog. Every recommendation carries its cost; the bias is always toward the
**least architecture that meets the requirement.**

> The architecture, design-pattern, and agentic skills were validated across 20 real-world cases
> (both modes, real repositories) — they correctly recommend *doing less* as readily as doing more.
> `test-patterns` is covered by its own force-driven scenario set; see
> [validating the skills](validating-skills.md) and the [examples](examples/).

## Install for Claude Code

```
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

This established installation path remains supported without changes.

## Install for Codex

```sh
codex plugin marketplace add AdamKrysztopa/architectural-decisions
codex plugin add arch-crew@arch-crew
```

Start a new Codex session after installation.

## The five skills

| Invoke | For | Greenfield → | Existing code → |
|--------|-----|--------------|-----------------|
| `arch-crew:decide-architecture` | software architecture (structure, topology, data, overlays) | selection interview → composed stack + ADR | review → targeted moves + report |
| `arch-crew:design-patterns` | GoF + Python-idiomatic design patterns | which-pattern interview → one recommendation + Pythonic form | smell → pattern review |
| `arch-crew:agentic-patterns` | LLM-agent systems (autonomy, loops, memory, governance) | layered design interview → "your agentic design" + ADR | nine-point agent review |
| `arch-crew:test-patterns` | testing strategy — quality practices vs. deterministic executable testing vs. stochastic evaluation, plus the oracle guardrail over all three | risk-led evidence portfolio → risk/evidence/cost table + ADR | suite review → one highest-leverage rebalancing move |
| `arch-crew:threat-model` | architecture-level security (trust boundaries, authN/authZ, secrets, data protection, supply chain, agent permissions) | boundary-first threat interview → findings with asset/actor/impact/control + cost | security review → one highest-leverage move |

## How to use

You usually don't name the skill — just describe the decision and the right one triggers:

- *"How should I structure this new payments service?"* → `decide-architecture` (greenfield)
- *"Is our monolith's layering right?"* → `decide-architecture` (refactoring)
- *"Which pattern fits — I've got a growing if/elif picking an algorithm?"* → `design-patterns`
- *"Should this be one agent or several? How do I add human approval?"* → `agentic-patterns`
- *"Why does our suite take 45 minutes and still miss database failures?"* → `test-patterns`
- *"We're putting this admin API on the internet — is the design safe?"* → `threat-model`

Or name it explicitly:

```text
arch-crew:test-patterns Design the testing strategy for this service.
arch-crew:test-patterns Review this repository's testing strategy and identify the single highest-leverage improvement.
Review this RAG agent's tests and evaluations. Separate deterministic software evidence from stochastic evaluation.
```

**Scope boundary:** use `test-patterns` for **portfolio-level decisions and suite reviews, not for
implementing one ordinary test.** Writing a single test for code you just changed is ordinary
implementation work.

Each skill first works out **where you are** (greenfield vs. refactoring), then:

**Greenfield — a short interview.** It asks one decision at a time, skipping questions your project
already answers, and composes the result. You get a recommendation table (each pick + why + cost)
and, for architecture/agentic/testing decisions, an **ADR** written to `docs/adr/NNNN-*.md` so the
decision outlives the chat. (`design-patterns` is chat-first; it writes an ADR only for module-shaping choices
or on request.)

**Refactoring — a review.** It maps your code onto the catalog, finds real mismatches (not aesthetic
ones), and proposes the smallest change that removes genuine pain — often "leave it, this is fine."
You get a review report in `docs/`.

**Read-only runs.** `test-patterns` honours "review only", "dry run", or "don't modify files": it
presents the complete recommendation and names the path the artifact *would* have taken, without
writing anything.

## What `test-patterns` does with a real repository

It is the newest skill and the one whose behaviour is easiest to show:

1. **Inspects the repository** — architecture notes, dependencies, deployment config, existing test
   directories, CI configuration.
2. **Names concrete failure surfaces** in the system's own terms, before naming any test level.
3. **Composes an evidence portfolio** — one row per risk, each with its force, its cost, the heavier
   option deliberately skipped, and the signal that would reopen it.
4. **Inspects an existing suite properly** — classifying tests by what they actually touch, not by
   directory name, and reading mocks, fixtures, containers, browser drivers, and eval code.
5. **Recommends exactly one proportional improvement**, with the smallest safe first step and what to
   re-measure. "The suite is proportionate; no change is currently justified" is a valid answer.
6. **Writes the artifact** — a MADR-style ADR for a greenfield decision, a dated review for a suite.
7. **Keeps testing and evaluation apart** — deterministic behaviour is asserted; ranking, relevance,
   calibration, and answer quality are evaluated. Neither substitutes for the other.
8. **Rejects generated tests with no independent oracle** — if the expected value came from running
   the code, the test detects change, never wrongness.

A greenfield run ends with a file like this:

```markdown
# 0004. Risk-led evidence portfolio for invoice processing

- Status: Accepted
- Date: 2026-08-01
- Deciders: invoicing team

## Decision

| Included evidence | Risk addressed | Cost accepted | Deliberately skipped | Reopen when |
|---|---|---|---|---|
| Domain unit tests | Incorrect tax and total calculations | Test maintenance | Browser variants | Domain workflow changes |
| PostgreSQL integration | Query and migration incompatibility | Container startup | In-memory database substitution | — |
| Provider contract | External schema drift | Contract ownership | Provider-owned E2E | Contract support disappears |
| Two E2E journeys | Deployment and complete payment flow | Environment ownership | Per-screen browser coverage | New critical journeys appear |

## Consequences

CI stays in the low minutes. The two E2E journeys are the only evidence requiring an owned
environment. Tax expectations come from the published rate table, never from running the calculator.
Deferred: load testing until a number is named; independent assurance until an obligation exists.
```

Four full worked runs — an invoicing service, a legacy E2E-heavy suite, a data pipeline, and a RAG
agent — are in [`examples/test-patterns/`](examples/test-patterns/).

## What you get

- A recommendation with the **trade-off named** for every pick — no fashion-driven advice.
- A durable **ADR** (greenfield) or **review report** (refactoring) — see [examples](examples/).
- A standing bias against over-building: the skills will tell you you don't need an agent, don't
  need microservices, or don't need a pattern when that's the honest answer.

## Where the knowledge comes from

The decision logic and catalogs live in each skill's `references/` (the model reads these on
demand). `decide-architecture`, `design-patterns`, and `agentic-patterns` are distilled from three
single-file HTML pattern references kept locally as the source of truth; `test-patterns` and
`threat-model` have no HTML source and their references were written directly. `SKILL.md` stays a
lean workflow either way.

Every skill ships `decision-tree.md` and `catalog.md`. `test-patterns` adds `evaluation.md` (the
data/ML/LLM overlay) and `oracles.md` (the generated-test guardrail), because a single catalog was
large enough that most runs would load material they never need. `threat-model` adds
`evidence.md` (the finding-evidence guardrail) and `agent-agency.md` (tool permissions and
excessive agency, loaded only when the system has an agent). `SKILL.md` carries a table saying
which file answers which decision.

## For coding agents and maintainers

This repo ships [`AGENTS.md`](../AGENTS.md) and [`llms.txt`](../llms.txt) so AI coding tools can
discover the skills and route the right one. The skill `description` fields are the trigger surface.

The workflows, references, docs, and examples are shared canonical content. Agent-specific
packages are generated into committed `build/<target>/` trees from thin adapters; they are not a
second place to edit a workflow. For targets, rebuilds, and adapter rules, see the
[package build guide](building-packages.md); for the two validation layers — the package contract
and the force-driven scenario sets — see [validating the skills](validating-skills.md).
