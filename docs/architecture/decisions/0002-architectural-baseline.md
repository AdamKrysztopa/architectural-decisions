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
    scope: ["skills/*/SKILL.md"]
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
