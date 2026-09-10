---
id: 0001
status: active
skill: decide-architecture
date: 2026-09-09
commit: aaaaaaa
rules:
  - id: no-eval-usage
    statement: Application code must not call eval().
    scope: ["app/**"]
    severity: blocking
    verification: deterministic
    verified_by: semgrep#no-eval
---
# No dynamic eval

## Context
## Decision
## Consequences (cost)
