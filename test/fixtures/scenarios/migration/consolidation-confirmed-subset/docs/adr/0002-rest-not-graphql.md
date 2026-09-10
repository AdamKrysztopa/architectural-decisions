# 2. REST, not GraphQL

Date: 2025-04-18
Status: Accepted

## Context
Two integrators wanted a single flexible endpoint; our own clients wanted
predictable responses.

## Decision
The public API stays REST. GraphQL is not offered.

## Consequences
Integrators make more calls. We keep a cacheable, per-resource surface and
avoid owning a query planner.
