---
id: 0002
status: active
skill: decide-architecture
date: 2026-04-19
commit: 3c2b1a0
rules:
  - id: one-primary-store
    statement: Orders live in Postgres; no second primary store is introduced without a decision.
    scope: ["src/infra/**"]
    severity: warning
    verification: review
---
# Postgres for orders

## Context
A specialised store was proposed for one access pattern.

## Decision
Keep one primary store until a measured limit forces a second.

## Consequences (cost)
Some queries stay slower than a purpose-built store would make them.
