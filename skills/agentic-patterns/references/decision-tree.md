# Design your agentic system — the layered interview

Agentic patterns **compose into layers** (like an architecture stack, not a single pick): a
reasoning loop sits on Tool Use, optionally inside a topology, with memory, reliability, governance,
and an integration seam. The thesis that governs every step:

> **The best agentic system is the simplest one that meets the requirement.** Start at the *bottom*
> of the autonomy spectrum and only climb when the level below demonstrably can't do the job. Every
> loop, hand-off, and extra call must earn its keep — they multiply cost, latency, and failure modes.

Walk the steps in order; later steps are skipped unless their branch is active. Assemble the
selected layers into the final design.

## Q1 — Autonomy gate (always ask first)
*How much autonomy does the task actually need? Start at the bottom.*
- **A single well-prompted call could do it** (answer/summarize/classify once, optionally with
  retrieval) → **No agent. One call.** `#ap-intro` — the cheapest, most testable, most reliable
  option. Stop here. Add Tool Use only if it must act on a system. *(This is the most undervalued
  answer — reach for it more often than feels natural.)*
- **Predictable steps a developer can lay out** → **Workflow** → go to Q2.
- **Open-ended — the model must decide steps at runtime** → **Agent** → go to Q3.

## Q2 — Workflow shape *(if Workflow)*
A workflow is developer-steered: predictable, cheaper, testable. Pick the shape:
- **A fixed sequence, each step feeds the next** (outline → draft → polish) → **Prompt Chaining**
  `#ap-prompt-chaining`.
- **Distinct input categories need different handling** (support triage; cheap-vs-escalated models)
  → **Routing** `#ap-routing`. *Note:* add a default/uncertain route + confidence thresholds — a
  misroute fails silently.
- **Independent subtasks, or repeated votes** (fan-out sections; majority-vote a guardrail) →
  **Parallelization** `#ap-parallelization`.
- **Generate, then score against criteria, and loop** (draft vs. a rubric until it passes) →
  **Evaluator-Optimizer** `#ap-evaluator-optimizer`. *Note:* cap iterations (1–3), early-exit on a
  pass.

A workflow design usually ends here (plus reliability/governance from Q7–Q9 if relevant).

## Q3 — Reasoning loop *(if Agent)*
Every agent design also gets **Tool Use** `#ap-tool-use` as its foundation — every action is a
typed, schema-validated tool call; reliability rides on tool design.
*How should the agent reason and act?*
- **React step-by-step to each tool result** (decide one step at a time) → **ReAct** `#ap-react`.
  *Note:* bound it — a hard step budget + loop detection, and an Integrator to validate observations
  before they enter reasoning.
- **Commit to a plan up front, then execute** (long-horizon, multi-system) → **Plan-and-Execute**
  `#ap-plan` (re-plan on failure).
- **Draft, self-critique, and revise** (clear correctness signal to check) → **Reflection**
  `#ap-reflection`. *Note:* cap reflection iterations (1–3), exit when the critique is clean.

## Q4 — How many agents? *(if Agent)*
- **A single well-tooled agent** → **the right default.** A good single agent beats most
  multi-agent designs. Skip Q5.
- **Multiple specialised agents** → only when one agent genuinely cannot hold the task → go to Q5.

## Q5 — Topology *(if multiple agents)*
Also add **Coordinator** `#ap-coordinator` — structured inter-agent messaging (contracts,
who-talks-to-whom) to prevent dropped context and deadlocks.
- **A lead decomposes dynamically at runtime** (sub-tasks you can't enumerate up front) →
  **Orchestrator-Workers** `#ap-orchestrator-workers`.
- **A fixed roster of named specialists, central view** (coder/tester/reviewer; easy guardrails) →
  **Supervisor (Hierarchical)** `#ap-supervisor`.
- **Peers hand off control down a chain** (triage → billing → refunds; low coordination) →
  **Handoff (Swarm)** `#ap-handoff`.
- **Many agents over an event backbone** (AI-native rebuild on Kafka / A2A) → **Multi-Agent Mesh**
  `#ap-mesh`.
> Always surface: a single good agent often beats a multi-agent system — added agents multiply
> cost, latency, and communication failure. Confirm one truly cannot hold the task.

## Q6 — Memory *(if Agent)*
*What does it need to remember?*
- **Nothing beyond the current context** (short tasks fitting one window) → **Stateless.** *Note:*
  add a Recorder the moment a run must survive the context window.
- **Durable state across the context window** (resume a long investigation; recall prior facts) →
  **Retriever + Recorder** `#ap-retriever` — Recorder writes state out; Retriever reads back the
  relevant slice.
- **Learn reusable skills over time** (a long-lived agent that should improve) → **Skill Build
  (+ Retriever / Recorder)** `#ap-skill-build` — grow a library of executable skills, Voyager-style.

## Q7 — Reliability *(if Agent)*
*What is the main reliability risk to harden against?*
- **Acting on stale or wrong tool data** (a perception failure) → **Integrator** `#ap-integrator` —
  validate incoming tool data before it enters reasoning.
- **Many failure modes to recover from** (tools, memory, reasoning all fail differently) →
  **SHIELDA error handling** `#ap-shielda` — map failures to a phase-aware recovery taxonomy instead
  of blind retries.
- **Runaway loops or cost / low stakes** → a **step budget** so the loop fails safe rather than
  running up a bill. Even low-stakes loops want one.

## Q8 — Governance
*Does it take any irreversible or high-stakes actions (payments, deploys, account changes)?*
- **Yes** → **Human-in-the-Loop + Controller** `#ap-hitl` — action guards gate the irreversible
  steps; a Controller monitors policy continuously; trace everything. *Note:* scope HITL tightly to
  genuinely dangerous actions with a "reject + feedback" path, or reviewers rubber-stamp.
- **No** → **Observability / Tracing** `#ap-observability` — trace every Thought/Action/Observation,
  tokens, and tool latency. This is the line between a demo and production; include it regardless.

## Q9 — Integration with existing software
*How does this fit your existing software?*
- **A new, AI-native build** → no legacy seam. *(If multi-agent: a Multi-Agent Mesh over an event
  backbone fits.)*
- **Bolt onto an app without touching its core** → **Sidecar** `#ap-sidecar` — lowest-risk
  integration.
- **Mix deterministic and AI paths per request** (high-stakes, mostly-rule-based) → **Cognitive
  Middleware** `#ap-cognitive-middleware`.
- **A large / growing toolset to govern** → **Control Plane as a Tool** `#ap-control-plane` — hide
  tool routing and governance behind one tool interface.

## Composing the design
Stack the selected layers, e.g.: `Autonomy` → `Reasoning loop` (+ Tool Use) → `Topology`
(+ Coordinator, if multi) → `Memory` → `Reliability` → `Governance / Observability` →
`Integration`. Each layer names its pattern and the one-line reason it's there. Close with the
least-autonomy reminder and the standing notes the active branches triggered (cap loops, step
budgets, single-agent-first, HITL for irreversible actions, trace everything).
