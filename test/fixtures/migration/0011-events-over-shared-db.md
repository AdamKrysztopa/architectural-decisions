---
id: 0011
status: proposed
skill: decide-architecture
date: 2026-09-09
commit: aa1ca89
rules:
  - id: no-shared-db-writes
    statement: Services must not write to another service's tables.
    scope: ["services/**"]
    severity: blocking
    verification: review
---
# Events over a shared database

## Context
Migrated from a prose ADR. Two services had begun writing to the same tables.

## Decision
Publish events; each service owns its own storage.

## Consequences (cost)
Eventual consistency, and a broker to operate.

## Sources
- `docs/adr/0003-shared-db-writes.md` (repository commit aa1ca89)
