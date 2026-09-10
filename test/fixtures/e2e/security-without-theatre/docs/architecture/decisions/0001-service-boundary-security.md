---
id: 0001
status: active
skill: threat-model
date: 2026-09-09
commit: ccccccc
rules:
  - id: no-committed-secrets
    statement: No credential may be committed to the repository.
    scope: ["services/payments/**"]
    severity: blocking
    verification: deterministic
    verified_by: gitleaks#generic-api-key
  - id: payments-authz-reviewed
    statement: Every payments endpoint enforces authorization before touching a customer's balance.
    scope: ["services/payments/**"]
    severity: blocking
    verification: review
  - id: internal-network-assumed-trusted
    statement: The service assumes the internal network is not hostile.
    severity: warning
    verification: narrative
---
# Payments service trust boundary

## Context
## Decision
## Consequences (cost)
