---
id: 0001
status: proposed
skill: decide-architecture
date: 2026-08-14
commit: 7f3ad91
rules:
  - id: list-endpoints-paginate-by-cursor
    statement: Every list endpoint paginates with a cursor and a bounded limit, never an offset.
    scope: ["services/*/api.py"]
    severity: warning
    verification: narrative
---
# List endpoints paginate by cursor

## Context
Observed over `services/*/api.py` in an earlier reverse-discovery pass. Every
list handler reads a `cursor` query parameter and caps `limit`; none of them
accepts an offset. Nobody has confirmed yet whether that is a decision or an
accident of the first service being copied thirteen times.

## Decision
List endpoints expose cursor pagination with a bounded limit. A human must
confirm this is intended before it is anything more than an observation.

## Consequences (cost)
Clients cannot jump to a page by number, and a cursor has to remain decodable
across deploys.

## Sources
Reverse discovery over `services/*/api.py`. No document was read; this rests on
the code as it stood at commit 7f3ad91.
