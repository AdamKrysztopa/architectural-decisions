---
id: 0004
status: active
skill: decide-architecture
date: 2026-09-09
commit: fixture0
rules:
  - id: no-shared-db-writes
    statement: Services must not write to another service's tables.
    scope: ["services/**"]
    severity: blocking
    verification: deterministic
    verified_by: import-linter#svc-db-isolation
  - id: domain-pure
    statement: The domain package must not import infrastructure.
    scope: ["src/domain/**"]
    severity: warning
    verification: review
  - id: team-distributed
    statement: We chose events because the team is distributed.
    severity: warning
    verification: narrative
---
# Events over a shared database

## Context
Two services had begun writing to the same tables.

## Decision
Publish events; each service owns its own storage.

## Consequences (cost)
Eventual consistency, and a broker to operate.
