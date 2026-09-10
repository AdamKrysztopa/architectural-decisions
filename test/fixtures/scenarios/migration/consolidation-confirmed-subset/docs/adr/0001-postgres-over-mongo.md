# 1. Postgres over MongoDB

Date: 2025-03-04
Status: Accepted

## Context
We needed a primary store for orders and invoices. Both are relational and
both need transactions across more than one table.

## Decision
We use Postgres. MongoDB was rejected because the transactional guarantees we
need are not the ones it optimises for.

## Consequences
We take an operational dependency on a managed Postgres instance, and schema
changes need migrations.
