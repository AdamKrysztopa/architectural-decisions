# Agentic pattern catalog

The workflow ↔ agent spectrum: **pick the least autonomy that solves the problem.** Patterns nest
and compose (an orchestrator's worker runs a ReAct loop whose output an evaluator refines). Each
entry: what it is · when to reach for it · its cost / failure mode · the review cue for auditing
existing agent code.

## I. Reasoning, acting, refining
- **ReAct** `#ap-react` — interleave Thought → Action → Observation in a loop. *When:* open-ended
  tasks where the next step depends on the last result. *Cost:* can loop forever / burn tokens; acts
  on bad observations. *Review cue:* a ReAct loop with **no step budget, no loop detection, no
  observation validation** is the most common production defect.
- **Tool Use** `#ap-tool-use` — the agent emits a structured, schema-validated call the runtime
  executes. *When:* any agent that must act. *Review cue:* untyped/unvalidated tool args, vague tool
  descriptions, tools that can't report failure cleanly.
- **Reflection** `#ap-reflection` — generate → self-critique → revise. *When:* there's a clear
  correctness signal to check against. *Cost:* unbounded self-revision. *Review cue:* reflection
  with no iteration cap or no early-exit on a clean critique.
- **Plan-and-Execute** `#ap-plan` — a planner decomposes the goal into ordered steps before an
  executor acts. *When:* long-horizon, multi-system tasks. *Cost:* brittle if it can't re-plan on
  failure. *Review cue:* a plan that's generated once and never revised when steps fail.

## II. Developer-steered control flow (workflows)
- **Prompt Chaining** `#ap-prompt-chaining` — fixed sequence, each step feeds the next. *When:*
  known, decomposable stages. *Review cue:* a chain doing what one well-prompted call could.
- **Routing** `#ap-routing` — a classifier dispatches input to a specialised handler/model. *When:*
  distinct input categories. *Cost:* silent misroutes. *Review cue:* no default route, no confidence
  threshold.
- **Parallelization** `#ap-parallelization` — independent calls concurrently, then aggregate (by
  sectioning or voting). *When:* independent subtasks or majority-vote guardrails. *Review cue:*
  sequential calls that have no data dependency.
- **Evaluator-Optimizer** `#ap-evaluator-optimizer` — a generator and a *separate* evaluator loop
  until criteria pass. *When:* measurable quality bar. *Cost:* unbounded loops. *Review cue:* no
  iteration cap; evaluator and generator are the same undifferentiated prompt.

## III. Multi-agent topologies (only when one agent can't hold the task)
- **Orchestrator-Workers** `#ap-orchestrator-workers` — a lead decomposes dynamically and delegates
  to workers. *When:* sub-tasks you can't enumerate up front. *Cost:* coordination overhead.
- **Supervisor (Hierarchical)** `#ap-supervisor` — a fixed roster of named specialists, central
  view. *When:* coder/tester/reviewer style, easy guardrails.
- **Handoff (Swarm)** `#ap-handoff` — peers transfer control via a hand-off tool, no central
  orchestrator. *When:* low-coordination chains (triage → billing → refunds).
- **Multi-Agent Mesh** `#ap-mesh` — agents over an event backbone (A2A / Kafka). *When:* AI-native
  rebuild. *Cost:* the hardest to debug; eventual-consistency and dropped-message failure modes.
- **Coordinator** `#ap-coordinator` — structured inter-agent messaging (contracts, who-talks-to-whom).
  *Always add it with any multi-agent topology* to prevent dropped context and deadlocks.
- **Review cue for this whole section:** a multi-agent design where a single well-tooled agent would
  do — the most common over-engineering. Multiplied cost, latency, and communication failure with no
  payoff.

## IV. Memory, learning & reliability
- **Retriever + Recorder** `#ap-retriever` — Recorder writes state out of the window; Retriever reads
  back the relevant slice. *When:* runs must survive the context window. *Review cue:* a long-running
  agent relying solely on context — state is lost on overflow/restart.
- **Skill Build** `#ap-skill-build` — grow a library of reusable executable skills from experience
  (Voyager-style). *When:* a long-lived agent that should improve over time.
- **Integrator** `#ap-integrator` — validate incoming tool data before it enters reasoning. *When:*
  stale/wrong observations are the risk. *Review cue:* tool output trusted blindly.
- **SHIELDA error handling** `#ap-shielda` — map failures to a phase-aware recovery taxonomy instead
  of blind retries. *When:* many distinct failure modes. *Review cue:* one generic `except: retry`.
- **Step budget** — a hard cap so loops fail safe. *Every* loop needs one. *Review cue:* its absence.

## V. Governance & human oversight
- **Human-in-the-Loop** `#ap-hitl` — a control point for human approval before irreversible/high-risk
  actions. *When:* payments, deploys, account changes. *Cost:* alert fatigue → rubber-stamping if
  scoped too broadly; scope tightly with a reject+feedback path. *Review cue:* irreversible actions
  with no gate.
- **Controller** `#ap-hitl` — continuously monitors policy/behavior alongside the agent. Pairs with
  HITL for high-stakes systems.
- **Observability / Tracing** `#ap-observability` — trace every Thought/Action/Observation, tokens,
  cost, tool latency. The line between a demo and production. *Review cue:* no tracing — failures are
  un-diagnosable.

## VI. Enterprise integration
- **Sidecar** `#ap-sidecar` — bolt AI alongside an app without touching its core. Lowest-risk seam.
- **Cognitive Middleware** `#ap-cognitive-middleware` — route each request between a deterministic
  path and an AI path. *When:* high-stakes, mostly-rule-based.
- **Control Plane as a Tool** `#ap-control-plane` — hide tool routing and governance behind one tool
  interface as the toolset grows. *When:* a large/growing tool surface to govern.

## The standing review checklist
When auditing agent code, these are the recurring defects — check each: **(1)** is this an agent
when a workflow or single call would do? **(2)** is it multi-agent when one agent would do? **(3)**
does every loop have a step budget + early-exit? **(4)** are tool outputs validated before use?
**(5)** is there durable memory if runs outlive the context window? **(6)** are irreversible actions
gated by HITL? **(7)** is everything traced? Most agentic failures are one of these seven, not a
missing exotic pattern.
