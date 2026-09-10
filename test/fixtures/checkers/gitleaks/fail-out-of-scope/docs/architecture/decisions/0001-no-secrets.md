---
id: 0001
status: active
skill: threat-model
date: 2026-09-09
commit: aaaaaaa
rules:
  - id: no-hardcoded-secrets
    statement: Application code must not contain hardcoded API keys.
    scope: ["lib/**"]
    severity: blocking
    verification: deterministic
    verified_by: gitleaks#test-api-key
---
# No hardcoded secrets

## Context
## Decision
## Consequences (cost)
