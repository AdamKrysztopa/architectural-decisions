# Architecture pattern catalog

Three axes that compose, plus overlays. Each entry: what it is · when to reach for it · its cost
or failure mode · what it looks like in code (the review cue — what to look for when auditing an
existing system, and the smell that says "introduce this").

## I. Structure — how code is organised inside one deployable (pick one)

### Layered (N-tier) `#p-layered`
Stack the code by technical role; each layer depends only on the one below. The default monolith
structure: presentation → application → data access → database.
- **When:** small or new app, CRUD-heavy, team new to the code; simple to start and explain.
- **Cost:** features arrive as vertical concerns, so every change *smears across all layers*.
- **Review cue:** one change touching controller + service + repository + DTO for a single
  feature = layer scatter. If features are the unit of change, consider Vertical Slice.

### Vertical Slice `#p-slice`
Organise by feature; each slice owns its endpoint → logic → data access.
- **When:** thin domain, many features shipped in parallel, teams rarely touch the same files.
- **Cost:** cross-cutting concerns and shared logic can drift/duplicate across slices.
- **Review cue:** code grouped by technical layer with high cross-feature coupling → slices fix it.

### Hexagonal / Onion / Clean (the ring family) `#p-rings`
Concentric rings; the domain sits at the centre, all dependencies point inward; infrastructure is
plugged in through ports & adapters.
- **When:** rich, rule-heavy, long-lived domain worth isolating from infrastructure; or one
  volatile dependency to isolate behind a port.
- **Cost:** indirection and ceremony that a thin CRUD app doesn't need.
- **Review cue:** domain logic importing ORM/HTTP/SDK types directly = leaked dependency; a port
  belongs at that seam.

### Microkernel / Plugin `#p-microkernel`
A minimal core plus features added as plugins against a stable contract.
- **When:** others (or other teams) extend the product against a published contract.
- **Cost:** the contract is now a hard boundary — versioning and plugin isolation become real work.
- **Review cue:** a growing `if type == ...` switch for product variants → a plugin contract.

## Overlay — Domain-Driven Design `#ddd-note`
Bounded contexts, aggregates, ubiquitous language, domain events. **Not** a structure on its own —
it overlays one. Reach for it when the domain has many rules and natural sub-domains; skip it when
the domain is thin and you're mostly moving data.

## II. Presentation — how UI, state and logic talk

### MVC / MVP / MVVM `#p-mvc`
A triangle of responsibilities for one UI — not a whole-system architecture.
- **When:** a single team owns one app/SPA.
- **Review cue:** business rules living in view/controller code → push them inward.

### Micro-frontends `#p-microfrontends`
Microservices applied to the browser: a shell composes independently built/deployed UI fragments.
- **When:** several teams own different areas of a large UI.
- **Cost:** shared-state, routing, and bundle-duplication overhead; only worth it at team scale.

## III. Topology — how independent processes split and talk (pick one)

### Modular Monolith `#p-modular-monolith`
Clear internal module boundaries inside one deployable.
- **When:** one deployable is fine; you want boundaries without the distributed-data tax. **The
  right default** for most teams.
- **Review cue:** strong module boundaries already? Don't split to microservices without a forcing
  reason (org size, independent scaling).

### Service-Based `#p-service-based`
A handful of coarse-grained domain services sharing **one** database.
- **When:** deployable separation without per-service data ownership; the pragmatic middle.
- **Cost:** the shared DB is still a coupling point and a single failure domain.

### Microservices `#p-microservices`
Independently deployable services, each owning its data.
- **When:** org size or scale genuinely forces independent deploy/scale/ownership.
- **Cost:** distributed data, network failure, operational burden, eventual consistency. Don't
  adopt by default — it's a tax you pay for autonomy you must actually need.
- **Companions:** API Gateway/BFF, service mesh, Strangler Fig (migration), stability patterns
  (circuit breakers, bulkheads, retries+timeouts), cell-based at extreme scale.

### Event-Driven `#p-event-driven`
Components publish events to a bus; subscribers react. Producers never call consumers directly.
- **When:** other parts must react (audit, notifications, integrations) without the producer
  knowing who consumes; add consumers without touching producers.
- **Cost:** harder to trace end-to-end; eventual consistency; needs good observability.

### CQRS & Event Sourcing `#p-cqrs`
Split the write path from the read path; optionally store the events themselves as the source of
truth (Event Sourcing).
- **When CQRS:** read-heavy or many read shapes — denormalised read models pay off.
- **When +ES:** full history is the source of truth — heavy audit, replay, temporal queries.
- **Cost:** two models to keep in sync; ES adds replay/versioning/snapshotting complexity.

### Saga `#p-saga`
Coordinate a business transaction across services with compensating actions on failure.
- **When:** one transaction spans services and must undo cleanly on partial failure (no single DB
  transaction covers it).
- **Cost:** compensation logic and partial-failure reasoning are genuinely hard.

### Space-Based `#p-space-based`
Keep the working set in a replicated in-memory grid; write through to the DB asynchronously, out of
the request path.
- **When:** extreme, bursty load where the database is the bottleneck; need elastic throughput.
- **Cost:** in-memory consistency, data-loss windows, and grid operations.

### The rest of the distributed toolbox `#p-distributed-rest`
**Broker / Message Queue** (long-running/stateful async jobs), **Serverless / FaaS** (spiky,
short, scale-to-zero glue), API Gateway/BFF, service mesh, sidecar.

## IV. Data — how data is processed and refined at scale

- **Pipe-and-Filter / Pipeline** `#p-pipeline` — a chain of independent transform stages
  (ingest → transform → publish). When: staged data/ETL or an agent graph.
- **Lambda / Kappa** `#p-lambda` — batch layer for correctness + speed layer for freshness
  (Lambda); or one stream for everything (Kappa). When: need both reprocessable accuracy and low
  latency.
- **Medallion / Lakehouse** `#p-medallion` — Bronze→Silver→Gold quality tiers. When: refining data
  quality for a lakehouse.
- **Data Mesh** `#p-data-mesh` — decentralised, domain-owned data-as-a-product on shared self-serve
  infra. When: a central data team is the bottleneck; many domains own their data. The decentralised
  contrast to the centralized lakehouse.
- **Blackboard** `#p-medallion` — specialists collaborate via shared state, converging on a
  solution. When: multi-agent or multi-stage problem-solving with no fixed pipeline.

## V. Overlays — styles that ride on the others
- **Actor model** `#p-actor` — many independent stateful entities processed in parallel with fault
  isolation (Erlang/Akka). When: massive concurrency with isolation.
- **Stability / resilience** `#p-resilience` — circuit breakers, bulkheads, retries with timeouts;
  mandatory once calls cross a network.
- **Strangler Fig** — incrementally replace a legacy system behind a façade.
