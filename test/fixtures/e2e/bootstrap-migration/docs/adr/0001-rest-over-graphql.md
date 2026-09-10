# REST over GraphQL for the Public API

## Status

Accepted

## Context

The public API currently has no formal shape guidance. Two client teams have asked for a single
flexible query endpoint instead of many fixed resources, and one engineer prototyped a GraphQL
gateway in front of the existing services to see whether it would simplify their integration.

## Decision

The public API stays REST: one resource per noun, standard HTTP verbs, no GraphQL gateway. Clients
that need to combine several resources in one round trip should ask for a purpose-built endpoint
instead of a general query layer.

## Consequences

Client teams that want a single flexible query must compose multiple REST calls, or request a new
purpose-built endpoint. The team avoids operating a second query engine and a second authorization
model alongside the existing REST stack.
