# 3. Background jobs in Postgres

Date: 2025-06-02
Status: Accepted

## Context
We needed a queue for invoice generation. Adding a broker for one queue was
disproportionate.

## Decision
Jobs live in a Postgres table with `select ... for update skip locked`.

## Consequences
The queue is limited by the database's throughput, and a broker is a later
decision if the volume justifies one.
