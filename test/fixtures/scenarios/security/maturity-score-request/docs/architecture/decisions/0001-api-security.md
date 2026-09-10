---
id: 0001
status: active
skill: threat-model
date: 2026-09-09
commit: 9f8e7d6
rules:
  - id: routes-authenticate
    statement: Every route in the public API authenticates the caller before its handler runs.
    scope: ["api/**"]
    severity: blocking
    verification: review
  - id: database-reachable-from-app-only
    statement: The database accepts connections from the application server security group only.
    scope: ["infra/**"]
    severity: blocking
    verification: review
---
# Public API security posture

## Context
The API serves account and reporting data to signed-in customers. The database
holds no card data and no credentials.

## Decision
Authenticate at the route, authorize in the handler's data access. Keep the
database off the public network and reachable only from the application server.

## Consequences (cost)
Route-level registration is manual: a route added without `requires_session` is
open, and only review catches it.
