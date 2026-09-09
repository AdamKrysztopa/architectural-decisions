---
id: 0012
status: proposed
skill: decide-architecture
date: 2026-09-09
commit: aa1ca87
rules:
  - id: billing-owns-its-writes
    statement: Only the billing service may write to billing's own tables.
    scope: ["services/billing/**"]
    severity: warning
    verification: narrative
---
# Billing owns its own writes

## Context
Migrated from a prose note about billing's write path.

## Decision
Billing keeps sole write access to its own tables.

## Consequences (cost)
None beyond what was already true; this only writes down existing practice.

## Sources
- `docs/adr/0004-billing-notes.md` (repository commit aa1ca87)
