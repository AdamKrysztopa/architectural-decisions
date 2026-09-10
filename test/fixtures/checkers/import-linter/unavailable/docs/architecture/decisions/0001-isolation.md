---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-09
commit: aaaaaaa
rules:
  - id: svc-db-isolation
    statement: The billing package must not import the catalog package's database module.
    scope: ["svc/billing/**"]
    severity: blocking
    verification: deterministic
    verified_by: import-linter#svc-db-isolation
---
# Services own their own tables

## Context
## Decision
## Consequences (cost)
