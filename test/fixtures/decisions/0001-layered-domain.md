---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-01
commit: 1111111
rules:
  - id: domain-imports-nothing
    statement: The domain package must not import infrastructure.
    scope: ["src/domain/**"]
    severity: blocking
    verification: deterministic
    verified_by: import-linter#domain-isolation
  - id: prefer-boring-storage
    statement: Reach for Postgres before a specialised store.
    severity: warning
    verification: narrative
---
# Layered domain with an isolated core

## Context
The team is small and the domain rules outlive the delivery mechanism.

## Decision
Keep a layered structure with the domain at the centre.

## Consequences (cost)
An extra mapping layer between persistence and domain types.
