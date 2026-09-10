---
id: 0001
status: active
skill: decide-architecture
date: 2026-03-02
commit: 0a1b2c3
rules:
  - id: domain-imports-nothing
    statement: The domain package must not import infrastructure.
    scope: ["src/domain/**"]
    severity: blocking
    verification: review
---
# Layered domain with an isolated core

## Context
The model had grown database calls inside it and could not be tested without
a container.

## Decision
`src/domain` depends on nothing outside itself. Infrastructure is injected.

## Consequences (cost)
More wiring in the application layer, and a repository interface per aggregate.
