# Design your agentic system — the layered interview

Agentic patterns **compose into layers** (like an architecture stack, not a single pick): a
reasoning loop sits on Tool Use, optionally inside a topology, with memory, reliability, governance,
and an integration seam. The thesis that governs every step:

> **The best agentic system is the simplest one that meets the requirement.** Start at the *bottom*
> of the autonomy spectrum and only climb when the level below demonstrably can't do the job. Every
> loop, hand-off, and extra call must earn its keep — they multiply cost, latency, and failure modes.

Walk the steps in order; later steps are skipped unless their branch is active. Assemble the
selected layers into the final design, then add the baseline.

## The baseline — every design, whatever the answers
- **Observability / Tracing** `#ap-observability` — at every autonomy level. Trace every
  Thought/Action/Observation, tokens, cost, and tool latency; this is the line between a demo and
  production.
- **Offline agent evaluation** `#ap-agent-eval` — for anything shipped, next to tracing: a fixed
  task set graded on end state. Tracing shows what happened; evaluation says whether it was right.
  Hand the evaluation strategy to `arch-crew:test-patterns`.
- **Step budget** `#ap-step-budget` — for every *agent* design, as a fixed layer, not a choice: a
  hard cap with an explicit "budget exhausted" end, on the reasoning loop and on any topology loop.

## Q1 — Autonomy gate (always ask first)
*How much autonomy does the task actually need? Start at the bottom.*
- **A single well-prompted call could do it** (answer/summarize/classify once, with a *fixed*
  fetch-once retrieval) → **No agent. One call.** `#ap-intro` — the cheapest, most testable, most
  reliable option. Add Tool Use only if it must act on a system. Skip to Q8, then Q9. *(The most
  undervalued answer — but calibrate, don't over-correct: demote to "no agent" only when the
  positive test below fails.)*
- **Predictable steps a developer can lay out** → **Workflow** → go to Q2.
- **Open-ended — the model must decide steps at runtime** → **Agent** → go to Q3.

**Autonomy IS genuinely required — do NOT demote — when ANY of these hold:**
- the model must decide *at runtime* which action/tool/step comes next, and you cannot enumerate the
  branches in code;
- the task needs *adaptive retrieval* — deciding whether / what / how-many-times to fetch, and
  re-querying on weak evidence. That is **agentic RAG** (`#ap-agentic-rag`), an agent loop — **not**
  preprocessing. Only a *fixed* fetch-once-then-stuff retrieval stays "no agent";
- a step depends on an observation that doesn't exist until an earlier step runs (irreducible feedback);
- the valid path space is too large or too data-dependent to hardcode.

If one holds, an agent (or agentic workflow) is the honest answer — **say so as readily as you say
"no agent."** The gate has teeth on both sides: under-building a genuinely open task into a rigid
pipeline is as real a defect as over-building.

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

A workflow design then takes governance, the input boundary, and integration from Q8–Q10. Q3–Q7
are agent-only.

## Q3 — Reasoning loop *(if Agent)*
Every agent design also gets **Tool Use** `#ap-tool-use` as its foundation — every action is a
typed, schema-validated tool call; reliability rides on tool design.
*How should the agent reason and act?*
- **React step-by-step to each tool result** (decide one step at a time) → **ReAct** `#ap-react`.
  *Note:* loop detection on top of the step budget, and an Integrator to validate observations
  before they enter reasoning.
- **Commit to a plan up front, then execute** (long-horizon, multi-system) → **Plan-and-Execute**
  `#ap-plan` (re-plan on failure).
- **Draft, self-critique, and revise** (clear correctness signal to check) → **Reflection**
  `#ap-reflection`. *Note:* cap reflection iterations (1–3), exit when the critique is clean.
- **Gather and grade evidence iteratively** (answer quality hangs on retrieval the model must
  steer) → **Agentic RAG** `#ap-agentic-rag`. *Note:* route easy queries to a one-shot fast path
  and reserve the loop for hard ones. *Prerequisite:* advanced static RAG (hybrid dense + BM25, a
  reranker, an eval harness) is sound first — a loop over a weak retriever pays more to be wrong.

## Q4 — How many agents? *(if Agent)*
- **A single well-tooled agent** → **the right default.** A good single agent beats most
  multi-agent designs. Skip Q5.
- **Multiple specialised agents** → only when one agent genuinely cannot hold the task → go to Q5.

## Q5 — Topology *(if multiple agents)*
Also add **Coordinator** `#ap-coordinator` — structured inter-agent messaging (contracts,
who-talks-to-whom) to prevent dropped context and deadlocks. The axis that separates the shapes is
**who keeps control of the answer**.
- **A lead decomposes dynamically at runtime** (sub-tasks you can't enumerate up front) →
  **Orchestrator-Workers** `#ap-orchestrator-workers`.
- **A manager keeps the answer; named specialists do parts of it** (coder/tester/reviewer; one
  voice to the user; easy guardrails) → **Supervisor (Hierarchical)** `#ap-supervisor`.
- **A specialist takes over the conversation** (stages with little shared context, e.g. intake →
  legal review → fulfilment owned by separate teams) → **Handoff (decentralized)** `#ap-handoff`.
  *Caution:* a sequence of related steps a single agent could do with tools (e.g. answer questions
  *and* issue a refund) is **not** a reason to hand off — that's one agent. Only split when the
  stages are genuinely independent and rarely share context.
- **Many agents over an event bus** (AI-native rebuild on Kafka-style pub/sub) → **Multi-Agent
  Mesh** `#ap-mesh`.
> Always surface: a single good agent often beats a multi-agent system — added agents multiply
> cost, latency, and communication failure. Confirm one truly cannot hold the task.

## Q6 — Memory *(if Agent)*
*What does it need to remember?*
- **Nothing beyond the current context** (short tasks fitting one window) → **Stateless.** *Note:*
  add a Recorder the moment a run must survive the context window.
- **Durable state across the context window** (resume a long investigation; recall prior facts) →
  **Retriever + Recorder** `#ap-retriever` — Recorder writes state out; Retriever reads back the
  relevant slice.
- **Learn reusable skills over time** (a long-lived agent that should improve) → **Skill Library
  (self-authored) (+ Retriever / Recorder)** `#ap-skill-build` — grow a library of executable
  skills, Voyager-style. *Cost:* the heaviest memory option — a learned skill can encode and replay
  a wrong approach, so it needs curation/validation; only worth it for a genuinely long-lived agent.

> **Standing note — Context Compaction** `#ap-compaction`: a ReAct or Plan-and-Execute loop that
> runs long degrades as its trace grows, whatever the memory pick. Summarize or prune the running
> trace (clearing old tool results is the lightest form).

> Memory and observability are **different concerns**: "Stateless" here means no memory carried
> across the context window — it does **not** mean "don't trace." Tracing is in the baseline.
> Memory is also not the *position in the run*: surviving a process restart is Q7's durable
> execution.

## Q7 — Reliability *(if Agent)*
*What is the main reliability risk to harden against, beyond the baseline step budget?*
- **Acting on stale or wrong tool data** (a perception failure) → **Integrator** `#ap-integrator` —
  validate incoming tool data before it enters reasoning.
- **Many failure modes to recover from** (tools, memory, reasoning all fail differently) →
  **SHIELDA error handling** `#ap-shielda` — map failures to a phase-aware recovery taxonomy instead
  of blind retries.
- **Nothing beyond the baseline budget** (short loops, low stakes) → no extra layer.

> **Standing note — Durable execution** `#ap-durable-execution`: if runs must survive a process
> restart (long runs, human pauses measured in hours, side effects costly to repeat), add it
> whatever the pick above — checkpoint every step and resume by run id.

## Q8 — Governance *(every autonomy level)*
*Does it take any irreversible or high-stakes actions (payments, deploys, account changes)?* A
single call that issues a refund needs this as much as an agent does.
- **Yes** → **Human-in-the-Loop + Controller** `#ap-hitl` — action guards gate the irreversible
  steps; a Controller monitors policy continuously. *Note:* scope HITL tightly to genuinely
  dangerous actions with a "reject + feedback" path, or reviewers rubber-stamp.
- **No** → no governance layer; tracing is already in the baseline.

## Q9 — Input boundary *(every autonomy level)*
*Is any input user-facing or untrusted (end users, web pages, email, documents, third-party tool
results)?*
- **Yes** → **Input/Output/Tool Guardrails** `#ap-guardrails` — screen inputs, outputs, and each
  tool call before and after it runs; a tripped guard halts the run.
- **No** (trusted, internal inputs only) → no guardrail layer.

## Q10 — Integration with existing software *(Workflow or Agent)*
*How does this fit your existing software?*
- **A new, AI-native build** → no legacy seam. *(If you chose Mesh at Q5, its event bus is the
  integration.)*
- **Bolt onto an app without touching its core** → **Sidecar** `#ap-sidecar` — lowest-risk
  integration.
- **Mix deterministic and AI paths per request** (high-stakes, mostly-rule-based) → **Cognitive
  Middleware** `#ap-cognitive-middleware`.
- **A large / growing toolset to govern** → **Control Plane as a Tool** `#ap-control-plane` — hide
  tool routing and governance behind one tool interface.

## Composing the design
Stack the selected layers, e.g.: `Autonomy` → `Reasoning loop` (+ Tool Use) → `Step budget` →
`Topology` (+ Coordinator, if multi) → `Memory` → `Reliability` → `Governance` → `Input boundary`
→ `Integration` → `Observability` + `Evaluation`. Each layer names its pattern and the one-line
reason it's there. Close with the least-autonomy reminder and the standing notes the active
branches triggered (cap loops, compaction for long loops, durable execution for restartable runs,
single-agent-first, HITL for irreversible actions, guardrails on untrusted input).
