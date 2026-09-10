---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-09
commit: 1111111
rules:
  - id: gateway-owns-translation
    statement: Protocol translation happens in the gateway; no handler outside it parses a wire format.
    scope: ["src/legacy/gateway/**"]
    severity: blocking
    verification: review
  - id: domain-imports-nothing
    statement: The domain package must not import infrastructure.
    scope: ["src/domain/**"]
    severity: blocking
    verification: review
---
# The gateway owns protocol translation

## Context
Wire-format parsing had spread into three handlers. We pulled it into one
package so a protocol change touches one place.

## Decision
`src/legacy/gateway` translates; everything behind it speaks domain types.

## Consequences (cost)
One more hop on every request, and a package that must be kept thin.
