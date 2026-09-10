---
id: 0001
status: proposed
skill: decide-architecture
date: 2026-09-09
commit: eeeeeee
rules:
  - id: public-api-is-rest
    statement: The public API must be exposed as REST resources; no GraphQL gateway.
    scope: ["services/**"]
    severity: warning
    verification: narrative
---
# REST over GraphQL for the public API

## Context
Migrated from a prose ADR. This repository had no schema decision recorded for the public API's
shape before this migration; the choice existed only as prose in `docs/adr/`. No tool config exists
to check this mechanically, so the rule starts narrative.

## Decision
Expose the public API as REST resources; do not introduce a GraphQL layer.

## Consequences (cost)
Some clients that would prefer a single flexible query endpoint must compose multiple REST calls, or
request a purpose-built endpoint.

## Sources
- `docs/adr/0001-rest-over-graphql.md` (repository commit eeeeeee)
