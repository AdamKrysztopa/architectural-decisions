---
id: 0004
status: proposed
skill: test-patterns
date: 2026-09-09
commit: 4444444
rules:
  - id: contract-tests-at-service-edges
    statement: Independently released services need consumer-driven contract tests.
    scope: ["services/**"]
    severity: blocking
    verification: review
---
# Contract tests at service edges

## Context
Services are released independently.

## Decision
Add consumer-driven contract tests at each edge.

## Consequences (cost)
A pact broker to run and own.
