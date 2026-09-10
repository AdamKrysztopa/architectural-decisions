---
id: 0002
status: active
skill: decide-architecture
date: 2026-09-02
commit: 2222222
rules:
  - id: no-shared-db-writes
    statement: Services must not write to another service's tables.
    scope: ["services/**"]
    severity: blocking
    verification: review
---
# Events over a shared database

## Context
Two services had begun writing to the same tables.

## Decision
Publish events; each service owns its own storage.

## Consequences (cost)
Eventual consistency, and a broker to operate.
