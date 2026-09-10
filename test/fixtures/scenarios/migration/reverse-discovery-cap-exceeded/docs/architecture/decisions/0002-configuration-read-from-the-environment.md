---
id: 0002
status: proposed
skill: decide-architecture
date: 2026-08-14
commit: 7f3ad91
rules:
  - id: config-declared-in-one-module
    statement: Each service declares every configuration value it reads in its own config module, from the environment.
    scope: ["services/*/config.py"]
    severity: warning
    verification: narrative
---
# Configuration is declared per service, read from the environment

## Context
Observed over `services/*/config.py` in the same earlier pass. Each service has
one config module, and every value in it comes from the environment through
`libs.platform.config`. No service reads an environment variable anywhere else.

## Decision
A service's configuration surface is one module, populated from the
environment. A human must confirm whether the shared helper is the intended
boundary or merely the convenient one.

## Consequences (cost)
A value needed by two services is declared twice, and the helper becomes a
dependency every service has.

## Sources
Reverse discovery over `services/*/config.py`. No document was read; this rests
on the code as it stood at commit 7f3ad91.
