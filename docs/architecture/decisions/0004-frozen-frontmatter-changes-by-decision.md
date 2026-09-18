---
id: 0004
status: active
skill: agentic-patterns
date: 2026-09-18
commit: b0b3f0d
rules:
  - id: shared-markdown-copied-verbatim
    statement: Shared Markdown is copied byte-for-byte; no prose templating engine is introduced.
    scope: ["skills/**", "shared/**"]
    severity: blocking
    verification: review
  - id: runtime-uses-node-builtins-only
    statement: The shipped runtime uses Node builtins only.
    scope: ["runtime/**"]
    severity: blocking
    verification: review
  - id: skill-frontmatter-changes-by-decision
    statement: The four skills' name and description frontmatter match test/fixtures/skill-freeze byte for byte; triggering is part of the shipped release, so a change lands only with a decision that names it and an updated fixture.
    scope: ["skills/agentic-patterns/SKILL.md", "skills/decide-architecture/SKILL.md", "skills/design-patterns/SKILL.md", "skills/test-patterns/SKILL.md"]
    severity: blocking
    verification: review
---
# Frozen skill frontmatter changes only through a decision, and agentic-patterns' description is corrected

## Context
0002 froze the four original skills' name and description, because a description is what makes a
host load a skill. By 0.6.0 agentic-patterns' description had become wrong: it promised "a review
against the catalog's seven recurring defects", while the checklist it names has nine items — the
seven over-building defects, an under-building check, and a check that scaffolds are re-tested on
each model upgrade — and the interview gained an input-boundary layer. A rule with no way to change
a frozen value leaves a false trigger in place for good. 0002's own rules cannot be edited in place,
so this decision supersedes it.

## Decision
0002's three rules carry over under new ids, because a rule id stays unique across every decision
file, superseded ones included. `shared-markdown-copied-verbatim` and
`runtime-uses-node-builtins-only` restate 0002's `markdown-copied-byte-for-byte` and
`zero-runtime-dependencies` word for word. `skill-frontmatter-changes-by-decision` replaces
`skill-frontmatter-is-frozen`: same scope and severity, and it now names how a frozen value changes
— a decision that names the change, and an updated fixture in `test/fixtures/skill-freeze`.

Under that rule, agentic-patterns' description now reads "a review against the catalog's nine-point
checklist (seven over-building defects, one under-building check, one stale-scaffold check)", and
its interview list adds "input boundary". Its name and every trigger phrase are unchanged.

## Consequences (cost)
Triggering for agentic-patterns can shift slightly: the description is longer and names the
checklist rather than defects. Every later description change costs a decision file and a fixture
edit, which is the point — a silent edit still fails `test/skill-freeze.test.mjs`. The other three
frozen descriptions are untouched.
