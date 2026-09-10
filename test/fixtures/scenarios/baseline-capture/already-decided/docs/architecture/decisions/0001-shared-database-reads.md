---
id: 0001
status: active
skill: decide-architecture
date: 2026-08-14
commit: 7a6b5c4
rules:
  - id: cross-service-reads-via-shared-db
    statement: A service that needs another service's data reads it from the shared database, through that service's read-only view.
    scope: ["services/**"]
    severity: blocking
    verification: review
  - id: views-are-the-contract
    statement: The read-only view is the contract; no service selects from another service's base tables.
    scope: ["services/**"]
    severity: blocking
    verification: review
---
# Service-to-service data access goes through shared-database views

## Context
Two services needed each other's data and we had no broker. A read-only view
per service was the cheapest thing that could work, and it shipped in a week.

## Decision
Cross-service reads go through the owning service's read-only view in the
shared database. No service selects from another service's base tables.

## Consequences (cost)
The database schema is now a shared contract: a base-table change can break a
consumer through its view, and there is no version boundary between them.
