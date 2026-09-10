---
id: 0002
status: active
skill: decide-architecture
date: 2026-09-09
commit: 7da6235
rules:
  - id: markdown-copied-byte-for-byte
    statement: Shared Markdown is copied byte-for-byte; no prose templating engine is introduced.
    scope: ["skills/**", "shared/**"]
    severity: blocking
    verification: review
  - id: zero-runtime-dependencies
    statement: The shipped runtime uses Node builtins only.
    scope: ["runtime/**"]
    severity: blocking
    verification: review
  - id: skill-frontmatter-is-frozen
    statement: The four skills' name and description frontmatter must not change; triggering is part of the shipped release.
    scope: ["skills/agentic-patterns/SKILL.md", "skills/decide-architecture/SKILL.md", "skills/design-patterns/SKILL.md", "skills/test-patterns/SKILL.md"]
    severity: blocking
    verification: review
---
# The baseline is a directory of decisions with a generated constitution

## Context
arch-crew had no memory: every skill run reasoned from scratch and its decision, with the cost of
each pick, was lost when the session ended.

## Decision
Decision files are the source of record. The constitution is generated from the active ones by a
zero-dependency Node script shipped with the package, and capture writes `status: proposed` for a
human to promote.

## Consequences (cost)
arch-crew becomes a tool package rather than pure knowledge: consuming repositories need Node, and
the four skills' bodies now carry a capture step. Unreviewed `proposed` files will accumulate until
a staleness sweep exists.

## Amendment (2026-09-10)
`skill-frontmatter-is-frozen`'s `scope` originally read `["skills/*/SKILL.md"]`, a glob that matched
whichever skills existed at read time. 0003 added `threat-model` as a fifth skill without an entry in
`test/fixtures/skill-freeze/frontmatter-0.3.1.json` — its frontmatter is new at 0.3.7 and not
byte-frozen — so the glob over-matched against this rule's own statement, which names only four. The
`scope` above now lists the four frozen `SKILL.md` paths explicitly; the statement, severity, and
verification are unchanged, and this remains true of the four it always named. This is a correction
to a scope glob's technical reach, not a rewrite of the decision's substance, so it is made in place
rather than through a superseding decision — recorded here for the same reason 0003 recorded, rather
than silently editing, its own reasoning for leaving this rule as originally written.
