---
id: 0001
status: active
skill: threat-model
date: 2026-09-09
commit: a1b2c3d
rules:
  - id: authenticate-every-route
    statement: Every billing route authenticates before its handler runs.
    scope: ["services/billing/**"]
    severity: blocking
    verification: review
  - id: authz-at-the-owner
    statement: Authorization for an invoice is decided by the service that owns the invoice rows, for every caller.
    scope: ["services/billing/**", "jobs/**"]
    severity: blocking
    verification: review
  - id: no-committed-secrets
    statement: No credential may be committed; credentials are issued by the vault per task.
    scope: ["services/**", "jobs/**"]
    severity: blocking
    verification: deterministic
    verified_by: gitleaks#generic-api-key
  - id: frozen-dependency-install
    statement: CI installs only from the committed, hashed lockfile.
    scope: [".github/workflows/**", "requirements.lock"]
    severity: blocking
    verification: review
---
# Billing trust boundary

## Context
Two external audits found unauthenticated internal routes and a credential in
the environment. Both were closed; this decision records the shape that
replaced them so a later change cannot quietly undo it.

## Decision
Authentication is registered on the blueprint, not per handler. Authorization
is decided at the invoice owner, and every caller -- HTTP or batch -- goes
through it. Credentials are short-lived vault tokens. CI installs from a hashed
lockfile and releases require a second party.

## Consequences (cost)
A new caller cannot reach invoices without going through `authorize_invoice_access`,
which is deliberate friction. Vault issuance adds a dependency on the vault
being reachable at task start.
