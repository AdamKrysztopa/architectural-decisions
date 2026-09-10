---
id: 0002
status: proposed
skill: decide-architecture
date: 2026-09-09
commit: eeeeeee
rules:
  - id: orders-use-postgres
    statement: The orders service must persist its state in PostgreSQL, which it alone writes to.
    scope: ["services/orders/**"]
    severity: blocking
    verification: narrative
---
# PostgreSQL for the orders service

## Context
Migrated from a prose ADR. The orders service's storage choice existed only as prose before this
migration. No tool config exists to check this mechanically, so the rule starts narrative.

## Decision
The orders service persists all order state in a single PostgreSQL database that only it writes to.

## Consequences (cost)
The team must run and operate a PostgreSQL instance for this service.

## Sources
- `docs/adr/0002-postgres-for-orders.md` (repository commit eeeeeee)
