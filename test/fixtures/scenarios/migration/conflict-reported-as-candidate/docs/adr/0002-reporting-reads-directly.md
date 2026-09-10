# 2. Reporting reads the billing tables directly

Date: 2025-10-30
Status: Accepted

## Context
Rebuilding invoice history from events took eight hours and the finance team
needed month-end figures the same day.

## Decision
The reporting job **reads the billing service's tables directly**, read-only,
under `services/**`. It does not go through the event stream.

## Consequences
Reporting is coupled to billing's schema. A billing migration can break
month-end.
