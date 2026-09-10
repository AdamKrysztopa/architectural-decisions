---
id: 0002
status: active
skill: decide-architecture
date: 2026-09-09
commit: 2222222
rules:
  - id: edge-terminates-protocol
    statement: The edge router terminates the protocol and hands domain types inward.
    scope: ["src/edge/**"]
    severity: blocking
    verification: review
---
# The edge router replaces the gateway

## Context
The gateway package accumulated routing, retries and translation. The edge
router was written to replace it and took over the last endpoint.

## Decision
`src/edge` terminates the protocol. The gateway package was removed once the
last caller had moved.

## Consequences (cost)
Two decisions now describe the same responsibility; 0001 still names a path
that no longer exists.
