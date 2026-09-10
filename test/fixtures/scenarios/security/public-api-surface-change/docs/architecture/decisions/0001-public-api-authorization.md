---
id: 0001
status: active
skill: threat-model
date: 2026-09-09
commit: 4c5d6e7
rules:
  - id: every-operation-carries-security
    statement: Every operation in the published contract carries a security requirement.
    scope: ["api/openapi.yaml"]
    severity: blocking
    verification: deterministic
    verified_by: oasdiff#api-operation-added-without-security
  - id: authorization-in-the-handler
    statement: Authorization is decided in the handler that owns the report rows; confirmed for every existing operation in the prior review.
    scope: ["api/**"]
    severity: blocking
    verification: review
  - id: single-organization-data
    statement: The API serves one organization's data. There is no second tenant on the actor list.
    severity: warning
    verification: narrative
---
# Public API authorization

## Context
The API is published to one organization's integrators. Reports belong to that
organization; there is no cross-organization read path and no tenant column.

## Decision
The contract is the boundary: an operation with no security requirement fails
the build. Authorization stays in the handler that owns the rows.

## Consequences (cost)
The contract check is a hard gate on every pull request that touches
`api/openapi.yaml`, including deliberate public endpoints, which then need an
explicit exception rather than silence.
