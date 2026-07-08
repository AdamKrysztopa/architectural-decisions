# Architecture selection — the greenfield interview

This is the decision tree behind the "build your stack" recommender. The thesis it encodes:
**architecture is not one list — it is three (plus overlays) that compose.** You pick *one per
axis*, and the answer is the composed stack, not a single winner. Most systems need only a few
axes; skip any that don't apply.

Walk the questions in order. Ask them as concrete either/or choices (the `sub` cues below help
the user self-identify). Skip a question whenever the project already answers it or its `when`
condition isn't met. After the relevant questions, assemble the stack with the composition rules
at the bottom.

> If the user is building an **agentic / LLM system**, that is a different axis set — hand off to
> the `agentic-patterns` skill, which owns that decision tree. This skill covers regular software
> systems (services, APIs, apps, data systems).

## Questions

### Q1 — Structure: what mostly drives change inside the codebase?
The structural axis. Pick exactly one.
- **Mostly CRUD and simple screens** (small/new app, team new to the code) → **Layered (N-tier)** `#p-layered`
- **Features shipped in parallel** (thin domain; teams rarely touch the same files) → **Vertical Slice** `#p-slice`
- **A rich, rule-heavy domain** (long-lived logic worth isolating from infrastructure) → **Hexagonal / Onion / Clean** `#p-rings`
- **Pluggable, third-party capability** (others extend the product against a contract) → **Microkernel / Plugin** `#p-microkernel`

### Q2 — Domain modelling (DDD overlay)
*Is the domain complex enough to model deliberately — many business rules, a shared ubiquitous
language, natural sub-domains?*
- **Yes** → add **Domain-Driven Design** as an overlay (bounded contexts, aggregates, domain events).
- **No** (thin domain, mostly moving data) → no overlay.

### Q3 — Topology: how do you need to deploy and scale?
The distribution axis. Pick exactly one.
- **One deployable is fine** (just want clean internal module boundaries) → **Modular Monolith** `#p-modular-monolith`
- **A few separately-deployed services, one shared database** → **Service-Based** `#p-service-based`
- **Independent services, each owning its data** (org size or scale forces it) → **Microservices** `#p-microservices`

### Q4 — Scale *(ask only if Service-Based or Microservices)*
*Is load extreme and bursty enough that the database itself becomes the bottleneck?*
- **Yes** (spikes storage can't absorb; need near-linear elastic throughput) → add **Space-Based** `#p-space-based`
- **No** → nothing.

### Q5 — Saga *(ask only if Microservices)*
*Does one business transaction span several services and need to undo cleanly on partial failure?*
- **Yes** → add **Saga** `#p-saga`
- **No** → nothing.

### Q6 — Events
*Do other parts need to react to things — audit, notifications, integrations — without the
producer knowing who consumes them?*
- **Yes** (fan-out to reactive consumers) → add **Event-Driven** `#p-event-driven`
- **No** (direct calls are fine) → nothing.

### Q7 — Read/write asymmetry
*How asymmetric are reads and writes, and how much history do you need?*
- **Symmetric — plain CRUD** → nothing.
- **Read-heavy or different read shapes** (denormalised read models pay off) → **CQRS** `#p-cqrs`
- **Full history is the source of truth** (heavy audit, replay, temporal queries) → **CQRS + Event Sourcing** `#p-cqrs`

### Q8 — Background work
- **None** (work happens inside the request) → nothing.
- **Long-running or stateful jobs** (batch, agent loops, async tasks) → **Broker / Message Queue** `#p-distributed-rest`
- **Spiky, short, glue work** (scale-to-zero functions on events) → **Serverless / FaaS** `#p-distributed-rest`

> Don't double-count with Q6: Q6 is the *fan-out mechanism* (who reacts to an event); Q8 is *where
> the work runs* (off the request path). An event-driven system often also needs a queue — that's
> two distinct picks, not the same one twice.

### Q9 — Data: what's the data story? *(the gate)*
- **No real data platform** (app persistence only) → nothing; skip Q9.1–Q9.4.
- **A chain of transform stages** (ingest → transform → publish, or an agent graph) → **Pipe-and-Filter
  / Pipeline** `#p-pipeline`; skip Q9.1–Q9.4.
- **Specialists collaborating via shared state** (multi-agent converging) → **Blackboard** `#p-blackboard`; skip Q9.1–Q9.4.
- **A real analytics / ML data platform** (data stored, refined, processed and owned at scale) →
  walk the four sub-axes Q9.1–Q9.4. They are *orthogonal*: a platform picks one of each and composes
  them, so don't treat them as competing.

The data axis is four questions, not one (the paper's framing): *where data lives · how it's refined
· how it moves · who owns it.* Ask them only when Q9 = "real data platform".

#### Q9.1 — Storage substrate: where does the data live? *(pick one)*
- **Structured & modelled before load** (schema-on-write; pure BI/reporting) → **Data Warehouse** `#p-warehouse`
- **Raw & cheap, interpreted at query time** (schema-on-read; varied/unknown data) → **Data Lake** `#p-lake`
  *(warn: without governance a lake becomes a swamp)*
- **Both — open storage with ACID, schema & BI** (Delta/Iceberg/Hudi) → **Lakehouse** `#p-lakehouse` *(the 2026 default)*

#### Q9.2 — Refinement: how is the data refined or modelled?
- **No formal refinement model** → nothing.
- **Quality tiers Bronze→Silver→Gold** → **Medallion** `#p-medallion`
- **Auditable historical model** (Hubs/Links/Satellites; heavy-audit domains) → **Data Vault** `#p-vault`

#### Q9.3 — Processing model: how does data move? *(pick one)*
- **Batch only** (periodic loads are enough) → nothing extra.
- **Batch correctness plus streaming freshness** → **Lambda / Kappa** `#p-lambda` *(prefer Kappa if you can replay)*
  *(Tie-break vs Q7's Event Sourcing: ES replays your **domain history** to rebuild application
  state; Lambda/Kappa reprocesses **analytics data** for dashboards/metrics. You can have both,
  for different reasons.)*
- **Continuous, end to end, near-zero latency** (Kafka → Flink/Spark → lakehouse) → **Modern Streaming** `#p-streaming`

#### Q9.4 — Ownership & governance: who owns the data?
- **One central team, single conformed platform** → nothing extra.
- **Central core feeding departmental marts** (consistency at the core, autonomy at the edges) → **Hub-and-Spoke** `#p-hub-spoke`
- **Domains own data-as-a-product** (a central team is the bottleneck) → **Data Mesh** `#p-data-mesh`
  *(an org pattern first — don't adopt it for a small team)*
- *Contextual note:* scattered sources you can't physically move → surface **Data Fabric** `#p-fabric`,
  an AI-assisted metadata/governance layer. Mesh decentralises ownership; Fabric centralises
  integration & governance — many platforms run both.

### Q10 — Volatile seam
*Is there one volatile external dependency you'll likely swap, fake or mock — an LLM/MT provider,
a payment gateway, a third-party API?*
- **Yes** → add **a single Hexagonal port** at that seam `#p-rings`.
  *Exception:* if Q1 already chose Hexagonal/Onion/Clean, the structure already isolates it —
  note that no extra seam is needed instead of adding one.
- **No** → nothing.

### Q11 — Presentation
- **No UI** (API or service only) → nothing.
- **One team owns the UI** (single app or SPA) → **MVC / MVP / MVVM** `#p-mvc`
- **Several teams own different areas** (large UI split across teams) → **Micro-frontends** `#p-microfrontends`

### Q12 — Concurrency
*Do you need massive concurrency with fault isolation — many independent stateful entities
processed in parallel (Erlang / Akka territory)?*
- **Yes** → add **Actor model** `#p-actor`
- **No** → nothing.

## Composing the stack

Collect one pick per answered axis into a labelled stack:
`Structure` · `Modelling` (DDD, if yes) · `Topology` · `Scale` (Space-Based, if yes) ·
`Transactions` (Saga, if yes) · `Integration` (Event-Driven, if yes) · `Read/write` (CQRS/ES) ·
`Background jobs` · `Data` · `Volatile seam` · `Presentation` · `Concurrency`.

The **Data** axis is special: a real data platform contributes *several* rows at once — one each for
`Data — storage`, `Data — refinement`, `Data — processing`, `Data — ownership` (Q9.1–Q9.4) — because
those questions are orthogonal. A simple app or a plain pipeline contributes at most one.

### Contextual notes to surface automatically
- **Microservices** → you'll also likely want an **API Gateway / BFF** at the edge, a **service
  mesh** for cross-cutting concerns, and **Strangler Fig** if migrating off legacy.
- **Microservices or Service-Based** → once calls cross a network, wrap each in **stability
  patterns** — circuit breakers, bulkheads, retries with timeouts.
- **Microservices + extreme scale** → consider **cell-based** architecture.
- **Data Mesh** → it's an *organisational* pattern as much as a technical one; it solves a
  people-and-scale problem, so don't adopt it for a small team just for the architecture.
- **Data Lake chosen** → pair it with governance/catalog from day one, or it becomes a data swamp.
- Always close with the thesis: the goal is the *least* architecture that meets the requirement;
  every axis you add buys capability at the cost of operational complexity — make each earn it.
