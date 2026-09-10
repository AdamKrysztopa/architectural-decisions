# 1. Services own their tables

Date: 2025-02-10
Status: Accepted

## Context
Two teams were writing to the same rows and neither could change a column.

## Decision
Each service owns its tables. **No service reads or writes another service's
tables**; cross-service data moves over the event stream.

## Consequences
Eventual consistency between services, and a broker to operate.
