# PostgreSQL for the Orders Service

## Status

Accepted

## Context

The orders service currently stores state in an ad hoc mix of local SQLite files and in-memory
structures left over from its first prototype. As order volume grows, several bugs have already
traced back to two instances of the service disagreeing about the same order's state.

## Decision

The orders service persists all order state in a single PostgreSQL database that it alone owns and
writes to. No other service may write to that database directly.

## Consequences

The team must run and operate a PostgreSQL instance for this service. In exchange, order state has
one durable, transactional source of truth instead of being scattered across per-process storage.
