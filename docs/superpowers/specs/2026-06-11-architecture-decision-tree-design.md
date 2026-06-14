# Architecture catalog — completeness pass + clickable decision wizard

Date: 2026-06-11
Target file: `architecture-patterns.html` (single-file, zero-dependency reference)

## Goal

1. Close genuine completeness gaps in the pattern catalog.
2. Add a clickable, branching **decision wizard** at the end that outputs a *composed
   stack* (one pick per axis), faithful to the doc's "three axes, they compose" thesis.

## Part 1 — Patterns to add (approved: all four)

Written in the existing voice (`oneline` italic summary, prose paragraph, optional SVG
`figure.diagram` using the existing color classes, `.spec` strengths/costs/use-when rows
where the surrounding entries have them).

1. **Space-based architecture** — new entry in Part III (distributed topology).
   In-memory data grid replicated across processing units; data pumps async-write to the
   DB out of band, removing the central-DB bottleneck. Use when: extreme/elastic load,
   unpredictable spikes. Diagram: processing units + replicated cache + data pump → DB.
2. **Service-based architecture** — short entry in Part III, after Microservices &
   Modular Monolith. The pragmatic middle: a few coarse-grained domain services sharing
   **one** database (no per-service DB). Use when: want deployable separation without the
   distributed-data tax. Small diagram showing coarse services over a shared DB.
3. **Micro-frontends** — new entry 2.2 in Part II (Presentation). Frontend counterpart to
   microservices: a shell composes independently built/deployed UI fragments owned by
   different teams. Diagram: shell/container + 3 fragments.
4. **Data Mesh** — entry in Part IV contrasting Medallion/Lakehouse. Decentralized,
   domain-oriented data ownership; each domain ships data *as a product* on shared
   self-serve infra. The "vs" for the centralized lakehouse.

Light, consistent touch-ups: add the new names to the relevant parenthetical example
lists in the intro and "How they compose" sections. No rewriting of existing prose.

## Part 2 — Decision wizard

- **Style:** branching stepped wizard, one question at a time, Back + restart, ends on a
  "Your stack" summary card. New `<section>` placed just before the "How they compose"
  closer. Reuses existing CSS tokens/classes; new minimal styles namespaced under a
  `#decider` / `.dt-` prefix so they cannot collide with catalog styles.
- **Tech:** vanilla JS in one inline `<script>`. No external deps. Keyboard accessible
  (buttons, focus management, ARIA live region announcing the current step / result).
- **Question flow** (answers build the stack; branches skip irrelevant axes):
  1. What drives change in your code? → Layered / Vertical Slice / Hexagonal-Onion-Clean / Microkernel
  2. Domain rule-heavy enough to model deliberately? → adds **DDD** overlay (y/n)
  3. How must you deploy & scale? → Modular Monolith / Service-based / Microservices
     - if Microservices/Service-based and extreme elastic scale → suggest **Space-based**
     - if Microservices: transaction spans services? → adds **Saga**
  4. React to events without producer knowing consumers? → adds **Event-Driven**
  5. Read/write asymmetry or heavy audit? → none / CQRS / CQRS + Event Sourcing
  6. Long-running or spiky background work? → none / Broker-Queue / Serverless
  7. Process/refine data at scale? → none / Pipeline / Lambda-Kappa / Medallion / Data Mesh / Blackboard
  8. One volatile external dependency? → adds a single **Hexagonal port** at that seam
  9. Have a UI? → MVC/MVP/MVVM; if multiple teams own the frontend → **Micro-frontends**
- **Contextual notes** surface automatically: Microservices → API Gateway/BFF, Service
  Mesh, Strangler Fig (for migration); high-concurrency → Actor model / Reactive.
- Every primary recommendation links to its in-page section (`#` anchors added to the
  relevant `h3`s).
- **Coverage:** every Part I–V pattern is reachable as a recommendation or a note.

## Out of scope

Peer-to-peer, primary-replica, Flux/Redux, RAG-as-pattern (noted, not added).
No build tooling, no external libraries — the file stays a single portable HTML document.
