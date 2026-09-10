---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-09
commit: bbbbbbb
rules:
  - id: no-catalog-in-billing
    statement: The billing module must not read the catalog module's pricing table directly.
    scope: ["services/billing/**"]
    severity: blocking
    verification: review
  - id: prefer-events
    statement: Cross-module reads should go through the published event stream.
    scope: ["services/**"]
    severity: warning
    verification: narrative
  - id: db-isolation-checked
    statement: Billing owns its own tables.
    scope: ["services/billing/**"]
    severity: blocking
    verification: deterministic
    verified_by: import-linter#missing-in-this-fixture
---
# Billing owns its boundary

## Context
## Decision
## Consequences (cost)
