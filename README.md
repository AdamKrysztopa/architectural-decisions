# arch-crew

A suite of **architectural-decision skills** for supported coding agents. Four skills help you
*choose* an architecture, a pattern, or a testing strategy for new work, or *audit* what you already
have — each branching automatically on whether you're greenfield or refactoring.

> The architecture, design-pattern, and agentic skills were **validated across 20 real-world cases**
> spanning both modes and real repositories — they recommend *doing less* (no agent, no
> microservices, no pattern) as readily as doing more. `test-patterns` has its own
> [force-driven scenario set](test/scenarios/test-patterns.json) covering both modes and the
> outcomes that are easy to lose — justified E2E *and* refused E2E, a no-change review, a rejected
> generated-test oracle. See [validating the skills](docs/validating-skills.md).
> **[Full docs →](docs/README.md)** · **[Examples →](docs/examples/README.md)**

| Skill | Use it to… | Greenfield mode | Refactoring mode |
|-------|-----------|-----------------|------------------|
| `arch-crew:decide-architecture` | Pick or assess **software architecture** (structure, topology, data, overlays) | Selection interview → composed stack | Review code → targeted moves |
| `arch-crew:design-patterns` | Pick or assess **GoF / Python-idiomatic design patterns** | Which-pattern interview → one recommendation (+ Pythonic form) | Smell → pattern review |
| `arch-crew:agentic-patterns` | Design or assess an **LLM-agent system** | Layered design interview (autonomy → … → integration) | Seven-defect agent review |
| `arch-crew:test-patterns` | Decide which **evidence** a system needs — quality practices, executable tests (unit/integration/contract/E2E), and data/ML/LLM evaluation | Risk-led evidence portfolio + ADR | Test-suite review + one highest-leverage rebalancing move |

Each skill first works out **where you are** — greenfield (a new design) or refactoring (existing
code) — then either runs a short selection interview or reviews your code against the catalog. The
through-line in all four: recommend the **least architecture that meets the requirement**, and name
the cost of every pick.

## The baseline

Each skill records the decision it reached — including an explicit refusal — as a file under the
repository's decisions directory, with `status: proposed` for a human to promote. A zero-dependency
generator rolls the active ones into `constitution.md`, which the skills read before recommending,
so the crew stops re-litigating decisions it has already made.

A `deterministic` rule's binding is resolved against the repository's real tool config by
`runtime/checkers/check-rules.mjs` — no tool installation required to catch a rule bound to a
contract that does not exist; `--run` opts into actually evaluating it.

## Noticing drift

On Claude Code, arch-crew injects the active rules at session start and quietly records which files
were edited. At a checkpoint you drain those observations: a runtime matches the changed paths
against the active rules, copies each deterministic checker's verdict verbatim, and hands the model
only the rules judgement is actually allowed on. A tool failure is a violation; everything else is a
finding, an honest "insufficient evidence", or a proposed decision. No hook can block an edit, no
finding fails a build, and on Codex — which has no hooks — the same drain runs from git.

## Install for Claude Code

Add the marketplace and install the plugin:

```
/plugin marketplace add AdamKrysztopa/architectural-decisions
/plugin install arch-crew
```

Then invoke a skill directly (e.g. `arch-crew:decide-architecture`) or just describe an architecture
decision and the right skill triggers.

This is the original Claude Code installation path and remains fully backward-compatible.

## What it does once installed

Name a skill, or just describe the decision:

```text
arch-crew:test-patterns Design the testing strategy for this service.
arch-crew:test-patterns Review this repository's testing strategy and identify the single highest-leverage improvement.
Review this RAG agent's tests and evaluations. Separate deterministic software evidence from stochastic evaluation.
```

Routing is automatic — this triggers `test-patterns` with no skill name at all:

```text
Why does our suite take 45 minutes and still miss database failures?
```

The skill then **reads the repository** rather than asking you to describe it: it names the concrete
failure surfaces, composes an evidence portfolio with the cost of every row, and — in review mode —
inspects the real test code and CI config, classifies tests by what they actually touch rather than
by directory name, and returns **one** proportional improvement. It separates deterministic tests
from ML/LLM evaluation, and it rejects generated tests that have no oracle independent of the
implementation. Add *"review only, don't modify files"* and it presents everything without writing
anything.

Otherwise it writes the artifact: an ADR for a greenfield decision, a dated review for an existing
suite.

```markdown
# 0004. Risk-led evidence portfolio for invoice processing

## Decision

| Included evidence | Risk addressed | Cost accepted | Deliberately skipped | Reopen when |
|---|---|---|---|---|
| Domain unit tests | Incorrect tax and total calculations | Test maintenance | Browser variants | Domain workflow changes |
| PostgreSQL integration | Query and migration incompatibility | Container startup | In-memory database substitution | — |
| Provider contract | External schema drift | Contract ownership | Provider-owned E2E | Contract support disappears |
| Two E2E journeys | Deployment and complete payment flow | Environment ownership | Per-screen browser coverage | New critical journeys appear |
```

Use `test-patterns` for **portfolio-level decisions and suite reviews, not for implementing one
ordinary test.** Full worked runs: [examples](docs/examples/test-patterns/).

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
source; its references were written directly. Every skill ships these two:

- `references/decision-tree.md` — the selection interview / decision tree.
- `references/catalog.md` — the patterns with when-to-use, cost, and code-review cues.

`test-patterns` adds two more, because its catalog was large enough that a single file forced the
model to load material most runs never need:

- `references/evaluation.md` — the data / ML / LLM-agent evaluation overlay, loaded only when the
  system has a stochastic surface.
- `references/oracles.md` — the generated-test oracle guardrail, loaded whenever tests are generated
  rather than derived from a requirement.

`SKILL.md` stays a lean workflow and reads those references on demand (progressive disclosure); it
carries a table saying which file answers which decision.

## Packaging and layout

The portable skill workflows and their references in `skills/`, along with the shared docs and
examples, are canonical source. `builders/` contains thin target adapters; it does not own or fork
skill logic. `build/<target>/` is generated, committed release output containing only what that
target needs. This lets a Claude installation receive Claude files and a Codex installation receive
Codex files without cross-agent configuration.

```
skills/
  decide-architecture/    SKILL.md + references/{decision-tree,catalog}.md
  design-patterns/        SKILL.md + references/{decision-tree,catalog}.md
  agentic-patterns/       SKILL.md + references/{decision-tree,catalog}.md
  test-patterns/          SKILL.md + references/{decision-tree,catalog,evaluation,oracles}.md
builders/
  build.mjs               shared deterministic builder
  adapters/               thin target packaging adapters
build/
  claude/                 generated Claude package
  codex/                  generated Codex package
test/
  build.test.mjs          package contract
  scenarios/              force-driven skill scenarios
```

The root `.claude-plugin/` files remain as a Claude compatibility façade. See the
[maintainer build guide](docs/building-packages.md) for the build and validation workflow.

## License

MIT
