# Example — `arch-crew:decide-architecture`, greenfield: when heavy is right

The skill resists over-engineering — but when the forces genuinely demand it, it composes the full
stack and every axis earns its place against a stated requirement.

**Prompt:** "A large e-commerce platform. Separate teams own catalog, orders, payments, inventory,
shipping — they must deploy and scale independently. Placing an order spans payments + inventory +
shipping and must roll back cleanly on failure. Many services react to 'order placed'. We're
migrating off a legacy monolith. Read traffic vastly exceeds writes on the catalog."

**What the skill did:** every heavy axis fired against a named force; speculative axes were
explicitly deferred with a reopening signal. Output:

---

## Microservices with per-domain ownership, Saga, Event-Driven integration, and CQRS

| Axis | Pick | Why it fits | Cost to accept |
|------|------|-------------|----------------|
| Structure | Hexagonal / Onion / Clean | Rich, rule-heavy domains isolated from infra; ports absorb the payment-gateway seam | Indirection per service |
| Modelling | Domain-Driven Design | Five sub-domains map onto five teams; shared ubiquitous language | Context-mapping discipline |
| Topology | Microservices | Teams must deploy & scale independently — org genuinely forces it | Distributed data, eventual consistency, ops burden |
| Transactions | Saga | Order spans payments + inventory + shipping; compensate on partial failure | Compensation logic is hard; needs idempotency |
| Integration | Event-Driven | Many services react to "order placed" without the producer knowing them | Harder to trace; eventual consistency |
| Read/write | CQRS | Catalog reads vastly exceed writes; denormalised read model scales independently | Two models to sync; read-model lag |
| Background jobs | Broker / Message Queue | Carries events + saga steps as durable async messages | Delivery semantics, dead-letter, ordering |
| Volatile seam | (covered by Hexagonal) | Payment gateway already isolated behind a port | None beyond the structure chosen |

**Companions triggered by Microservices:** API Gateway / BFF, service mesh, **Strangler Fig** (the
incremental migration path — never big-bang), and stability patterns (circuit breakers, bulkheads,
retries+timeouts) on every cross-network call.

**Deliberately deferred (each with a reopening signal):** Space-Based (until the DB is provably the
bottleneck), Event Sourcing (until full history is the source of truth), data pipeline / lakehouse /
Data Mesh (until analytics needs it), Actor model (until massive stateful concurrency appears),
Micro-frontends (confirm UI ownership first).
