---
id: 0003
status: superseded
superseded_by: 0002
skill: decide-architecture
date: 2026-08-01
commit: 3333333
rules:
  - id: shared-db-is-fine
    statement: Services may share one database.
    severity: warning
    verification: narrative
---
# A shared database is acceptable

## Context
An early call, made before the second service existed.

## Decision
Share one database.

## Consequences (cost)
Coupled deploys.
