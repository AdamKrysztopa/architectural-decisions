---
id: 0003
status: proposed
skill: decide-architecture
date: 2026-09-09
commit: eeeeeee
rules:
  - id: billing-reads-events-not-orders-db
    statement: Billing must learn of order-state changes only from published events, never by reading the orders database.
    scope: ["services/billing/**"]
    severity: warning
    verification: narrative
---
# Events for billing integration

## Context
Migrated from a prose ADR. Billing's dependency on the orders database existed only as prose and as
a polling query before this migration. No tool config exists to check this mechanically, so the rule
starts narrative.

## Decision
Billing learns about order-state changes only from events published by the orders service.

## Consequences (cost)
Billing's view of order state is eventually consistent instead of always current.

## Sources
- `docs/adr/0003-events-for-billing.md` (repository commit eeeeeee)
