# Events for Billing Integration

## Status

Accepted

## Context

Billing currently learns about order-state changes by polling the orders database on a schedule.
This has caused billing to act on stale state, and the polling query has twice been named in an
incident review as a source of load on the orders database during peak traffic.

## Decision

Billing learns about order-state changes only from events published by the orders service. Billing
must not read the orders service's database, directly or through a shared table, to discover state
changes.

## Consequences

Billing's view of order state is eventually consistent instead of always current. In exchange,
orders and billing no longer share a database dependency, and the polling load on the orders
database is removed.
