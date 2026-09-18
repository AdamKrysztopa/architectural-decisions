# Agentic pattern catalog

The workflow ↔ agent spectrum: **pick the least autonomy that solves the problem.** Patterns nest
and compose (an orchestrator's worker runs a ReAct loop whose output an evaluator refines). Each
entry: what it is · when to reach for it · its cost / failure mode · the review cue for auditing
existing agent code. Entries added for depth also say **when not** to use them.

Every `#ap-*` anchor resolves on <https://www.mechai.pl/wizards/agentic-patterns.html>. The page
also catalogues Chain-of-Thought and Dao et al.'s subsystem patterns (Selector, Deliberator,
Planner, Executor, Reflector) ([DAO]); they rarely change a design decision, so they are not
repeated here. Bracketed keys are sources, listed at the end.

## 0. No agent
- **Single call (no agent)** `#ap-intro` — one well-prompted model call, optionally with a *fixed*
  fetch-once retrieval: the augmented-LLM building block ([BEA]). *When:* the task can be done in
  one pass. The most common right answer and the cheapest, most testable one. *Review cue:* an
  agent, chain, or loop wrapped around what one call already does.

## I. Reasoning, acting, refining
- **ReAct** `#ap-react` — interleave Thought → Action → Observation in a loop. *When:* open-ended
  tasks where the next step depends on the last result. *Cost:* can loop forever / burn tokens; acts
  on bad observations. *Review cue:* a ReAct loop with **no step budget, no loop detection, no
  observation validation** is the most common production defect.
- **Tool Use** `#ap-tool-use` — the agent emits a structured, schema-validated call the runtime
  executes. *When:* any agent that must act. *Review cue:* untyped/unvalidated tool args, vague tool
  descriptions, tools that can't report failure cleanly ([WT]).
- **Reflection (self-reflection)** `#ap-reflection` — the *same* model critiques and revises its
  own output ([LIU] 4.9). Feedback from a different agent or model is cross-reflection
  ([LIU] 4.10) — that is Evaluator-Optimizer. *When:* there's a clear correctness signal to check
  against. *Cost:* unbounded self-revision; a model grading itself shares its own blind spots.
  *Review cue:* reflection with no iteration cap or no early-exit on a clean critique.
- **Plan-and-Execute** `#ap-plan` — a planner decomposes the goal into ordered steps before an
  executor acts. *When:* long-horizon, multi-system tasks. Keep the plan high-level: granular
  up-front specs cascade their errors downstream ([HD]). *Cost:* brittle if it can't re-plan on
  failure. *Review cue:* a plan that's generated once and never revised when steps fail.
- **Agentic RAG / Adaptive Retrieval** `#ap-agentic-rag` — retrieval as a *runtime decision*: the
  loop decides whether to retrieve, which source, grades what came back, and re-queries on weak
  evidence (Self-RAG, Corrective RAG / CRAG, Adaptive RAG). *When:* answer quality depends on
  evidence the model must gather iteratively, not a single fixed fetch. *Cost:* a multiple of static
  RAG's tokens and latency — ≈ 3–10× tokens and 2–5× latency is a rule of thumb, not a measured
  figure; the published numbers are agents ≈ 4× and multi-agent ≈ 15× the tokens of chat ([MAR]).
  So route easy queries to a one-shot fast path and reserve the loop for hard ones. *Review cue:* a
  fixed retrieve→generate pipeline that keeps returning thin/irrelevant chunks with no grading or
  re-query step — **under-built RAG masquerading as "just preprocessing."** *Prerequisite:* don't
  reach for it before advanced *static* RAG (hybrid dense + BM25, a reranker, an eval harness) is
  sound — an agent looping over a weak retriever just pays more to be wrong.
- **Tree Search / multi-path planning** `#ap-tree-search` — propose several next steps, score the
  resulting states, expand the best open one, and backtrack when a branch dies ([LIU] 4.8). Depth,
  breadth, and total expansions are all capped, with an explicit "budget exhausted" end. *When:*
  early choices are hard to undo and a state can be scored — puzzles, scheduling, plan search.
  *Not when:* one plan with re-planning suffices, or nothing can score a partial state; LLM
  estimates of how promising a state is are often overconfident, so score exactly in code wherever
  possible. *Cost:* calls multiply with breadth × depth. *Review cue:* no expansion cap; an LLM
  scoring states that code could score exactly.
- **Code-execution tool orchestration ("code mode")** `#ap-code-execution` — the model writes one
  short program that calls tools as functions; the program runs in a sandbox and only its final
  result returns to the context, so intermediate data never passes through the model ([CX]).
  *When:* many tool calls over large intermediate data (filter 500 records, join two exports).
  *Not when:* a few calls with small results — plain Tool Use is simpler — or there is no real
  sandbox to run model-written code in. *Cost:* sandbox infrastructure and a new execution surface
  (hand its boundary to `arch-crew:threat-model`). *Review cue:* a token screen or stripped namespace
  treated as a security sandbox; no execution timeout; large tool results paged through the context
  one call at a time.

## II. Developer-steered control flow (workflows)
- **Prompt Chaining** `#ap-prompt-chaining` — fixed sequence, each step feeds the next. *When:*
  known, decomposable stages. *Review cue:* a chain doing what one well-prompted call could.
- **Routing** `#ap-routing` — a classifier dispatches input to a specialised handler/model, once, up
  front. *When:* distinct input categories. *Cost:* silent misroutes. *Review cue:* no default route,
  no confidence threshold. Escalating a cheap model's weak answer is Model Cascade.
- **Model Cascade** `#ap-model-cascade` — a cheap model answers first; a validator or its stated
  confidence decides whether to escalate to a strong model. Scaling effort to query complexity
  ([MAR]; [AZ] on choosing a model per agent for cost). *When:* most requests are easy and an answer
  can be checked. *Not when:* nothing reliable can check the cheap answer — self-reported confidence
  is unreliable unless the cheap tier is told when it must report low — or latency on hard requests
  matters more than cost. *Cost:* hard requests pay for both tiers. *Review cue:* escalation gated
  on raw self-confidence with no validator; nobody measures the escalation rate.
- **Parallelization** `#ap-parallelization` — independent calls concurrently, then aggregate (by
  sectioning or voting). *When:* independent subtasks or majority-vote guardrails. *Review cue:*
  sequential calls that have no data dependency.
- **Evaluator-Optimizer (cross-reflection)** `#ap-evaluator-optimizer` — a generator and a
  *separate* evaluator loop until criteria pass ([LIU] 4.10; also called maker-checker or
  generator-verifier, [AZ]). *When:* measurable quality bar. *Cost:* unbounded loops. *Review cue:*
  no iteration cap; evaluator and generator are the same undifferentiated prompt (that is
  Reflection).

## III. Multi-agent topologies (only when one agent can't hold the task)
The line that matters is **who keeps control of the answer**: a manager that calls specialists and
writes the answer itself, or a specialist that takes over the conversation ([OAM]).
- **Orchestrator-Workers** `#ap-orchestrator-workers` — a lead decomposes at runtime and delegates
  to workers. Anthropic files it as a *workflow* — it differs from Parallelization only in that the
  subtasks are decided at runtime ([BEA]) — and later runs the same shape as a multi-agent system
  ([MAR]). *When:* sub-tasks you can't enumerate up front. *Cost:* coordination overhead.
- **Supervisor (Hierarchical)** `#ap-supervisor` — the manager keeps control of the final answer;
  a roster of specialists does parts of the work and reports back. *When:* coder/tester/reviewer
  style, easy guardrails, one voice to the user. Agents-as-tools is its concrete shape.
- **Agents-as-tools** `#ap-agents-as-tools` — each specialist sub-agent is wrapped as a tool the
  manager calls, possibly several in parallel; the manager owns the final answer ([OAM], [LCS]).
  *When:* specialists need their own prompt or clean context but the user talks to one agent.
  *Not when:* the specialist should own the rest of the conversation (Handoff), or plain tools on
  one agent would do. *Review cue:* a sub-agent tool that returns its whole trace instead of a
  result; nested loops with no budget.
- **Handoff (decentralized)** `#ap-handoff` — the active agent transfers control through a handoff
  tool, and the specialist owns the rest of the turn; no central orchestrator ([OAM]). Swarm, the
  original reference implementation, is retired in favour of the OpenAI Agents SDK ([SW]). *When:*
  stages genuinely share little context — e.g. intake → legal review → fulfilment owned by separate
  teams. *Not when:* the steps are related work one agent could do with tools (answering questions
  *and* issuing a refund is one agent).
- **Group Chat / Debate** `#ap-group-chat` — every agent reads and writes one shared transcript; a
  manager picks the next speaker and decides when to stop ([AZ]; debate-based cooperation, [LIU]
  4.14). *When:* a decision gains from opposed perspectives — design review, several checkers on one
  draft. *Not when:* the work decomposes into tasks; every turn re-reads the whole growing
  transcript. *Review cue:* no turn cap or termination policy; a "consensus" that drops the dissent.
- **Magentic (task-ledger orchestration)** `#ap-magentic-ledger` — a manager keeps a task ledger
  (facts, plan) and a progress ledger, assigns agents step by step, and re-plans when progress
  stalls ([AZ]). *When:* open-ended multi-step tasks with no known solution path. *Not when:* the
  path is known — Plan-and-Execute or a workflow is cheaper. *Cost:* a manager call every step.
  *Review cue:* no stall counter or re-plan limit; a ledger that is written once and never updated.
- **Blackboard (self-claiming workers)** `#ap-blackboard` — peer workers claim open tasks from
  shared state and mark them done; an atomic claim is the only coordination, with no orchestrator
  ([CC]). *When:* many independent, similar tasks. *Not when:* tasks depend on each other or need a
  central view. *Review cue:* claims without an atomic compare-and-set (two workers, one task); no
  end condition.
- **Multi-Agent Mesh** `#ap-mesh` — agents publish and subscribe over an event bus (Kafka-style).
  *When:* AI-native rebuild. *Cost:* the hardest to debug; eventual-consistency and dropped-message
  failure modes.
- **Coordinator** `#ap-coordinator` — structured inter-agent messaging (contracts,
  who-talks-to-whom). Across process or vendor boundaries the contract is a protocol such as A2A:
  point-to-point, with Agent Cards and a task lifecycle ([A2A]) — not an event bus. *Always add a
  Coordinator to any multi-agent topology* to prevent dropped context and deadlocks.
- **Review cue for this whole section:** a multi-agent design where a single well-tooled agent would
  do — the most common over-engineering. Multiplied cost, latency, and communication failure with no
  payoff.

## IV. Memory, learning & reliability
- **Retriever + Recorder** `#ap-retriever` — Recorder writes state out of the window; Retriever reads
  back the relevant slice. *When:* runs must survive the context window. *Review cue:* a long-running
  agent relying solely on context — state is lost on overflow.
- **Memory types (semantic / episodic / procedural)** `#ap-memory-types` — what the Recorder
  writes: facts about the user or domain, past interactions replayed as examples, and the agent's
  own instructions rewritten from feedback ([LGM]). *When:* deciding what a durable memory holds.
  *Not when:* the agent is stateless. *Cost:* procedural memory edits the agent's own prompt — the
  same replay-a-wrong-lesson risk as Skill Library. *Review cue:* one undifferentiated memory blob;
  instructions rewritten with no review or rollback.
- **Context Compaction / Summarization** `#ap-compaction` — periodically summarize or prune the
  *running* trace so a long loop doesn't degrade ("lost in the middle") or overflow; clearing old
  tool results is the lightest form ([CE]). Distinct from Retriever/Recorder, which persist state
  *out* of the window; this manages what stays *in* it. *When:* long ReAct or Plan-and-Execute runs,
  long chats. *Review cue:* a loop that just appends every observation until quality quietly falls
  off a cliff.
- **Sub-agent context isolation** `#ap-subagent-isolation` — give a spawned worker a clean window
  with only the slice it needs, and take back a condensed summary rather than its trace ([CE]).
  *When:* orchestrator/supervisor topologies. *Review cue:* workers drowning in irrelevant parent
  context.
- **Progressive disclosure (skills and tools)** `#ap-progressive-disclosure` — only names and
  one-line descriptions sit in context; the agent loads a skill's full instructions, or a tool's
  schema, when it needs them ([SK], [CX]). *When:* a large or growing set of skills or tools.
  *Not when:* a handful of tools fit comfortably in context. *Cost:* a load step per use; a skill
  with a vague description is never loaded. *Review cue:* every instruction and tool schema loaded
  eagerly; descriptions too vague to choose between.
- **Skill Library (self-authored)** `#ap-skill-build` — the agent saves working code from
  experience as reusable skills (Voyager-style; [CX], [DAO]). Not Anthropic's Agent Skills, which
  are human-authored and loaded by progressive disclosure. *When:* a genuinely long-lived agent that
  should improve over time. *Cost:* the heaviest memory option — a learned skill can encode and
  replay a wrong approach, so it needs curation and validation.
- **Integrator** `#ap-integrator` — validate incoming tool data before it enters reasoning. *When:*
  stale/wrong observations are the risk. *Review cue:* tool output trusted blindly.
- **SHIELDA error handling** `#ap-shielda` — map failures to a phase-aware recovery taxonomy instead
  of blind retries ([SH]). *When:* many distinct failure modes. *Review cue:* one generic
  `except: retry`.
- **Step budget** `#ap-step-budget` — a hard cap on steps, tool calls, or turns, ending in an
  explicit "budget exhausted" result so the loop fails safe. *Every* agent loop needs one,
  including the loops inside a topology (supervisor rounds, handoffs, group-chat turns). A
  framework's recursion limit is a backstop, not a budget. *Review cue:* its absence.
- **Durable execution / resumable runs** `#ap-durable-execution` — checkpoint every step to a
  durable store; after a crash, resume from the last checkpoint by run id without re-running
  completed steps; retry transient faults per step ([LGF]; the harness stays stateless and replays
  an external session log, [MA]). Retriever/Recorder persists *memory*; this persists the
  *position in the run*. *When:* runs must survive a process restart — long runs, human pauses
  measured in hours, side effects costly to repeat. *Not when:* a short run can simply start over.
  *Cost:* a persistent store, and side effects that must be idempotent. *Review cue:* a long run
  or a pending approval held only in process memory; a retry that re-executes a non-idempotent
  side effect.
- **Time travel (replay and fork)** `#ap-time-travel` — list a run's checkpoint history, replay
  from a past checkpoint, or fork it with an edited value ([LGT]). *When:* debugging a bad run,
  or asking "what if the human had answered differently". *Not when:* there are no checkpoints, or
  as a production control path. *Cost:* nodes after the fork point run again, side effects
  included. *Review cue:* forking a run whose later steps act on external systems, with no guard.

## V. Governance & human oversight
- **Human-in-the-Loop** `#ap-hitl` — a control point where a human approves, edits, or rejects
  before an irreversible or high-risk action. The human can also be *notified* (no pause) or
  *asked a question* (pause for missing input) ([LAA]); MCP standardises the question as
  elicitation ([MCPE]). *When:* payments, deploys, account changes. *Cost:* alert fatigue →
  rubber-stamping if scoped too broadly; scope tightly with a reject+feedback path. *Review cue:*
  irreversible actions with no gate.
- **Ambient agent (notify / question / review)** `#ap-ambient` — triggered by an event stream
  (inbox, queue, monitor) rather than a chat turn, and reaches a human only through the three
  interrupt kinds: notify, question, review ([LAA]). *When:* background work over a stream of
  events. *Not when:* a user is present in a chat — ordinary HITL is enough. *Cost:* interrupt
  fatigue, and pauses that need durable execution. *Review cue:* everything routed to review
  (rubber stamps) or nothing is (silent actions).
- **Controller** `#ap-controller` — continuously monitors policy/behavior alongside the agent. Pairs
  with HITL for high-stakes systems.
- **Input/Output/Tool Guardrails** `#ap-guardrails` — a lightweight guard (a classifier or small
  model) screens *inputs* (jailbreak, PII, off-scope), *outputs* (safety, schema, groundedness), and
  *each tool call* before and after it runs; a tripped guard halts the run ([OAR]). Cheap, always-on,
  and *orthogonal* to the other two: Controller watches behavior, HITL gates irreversible actions,
  Guardrails filter what crosses a boundary. *When:* any user-facing or untrusted input, at any
  autonomy level. *Review cue:* raw user input reaching tools, raw tool results reaching the model,
  or raw model output reaching users, with nothing in between.
- **Observability / Tracing** `#ap-observability` — trace every Thought/Action/Observation, tokens,
  cost, tool latency. The line between a demo and production, so always included. *Review cue:* no
  tracing — failures are un-diagnosable.
- **Offline agent evaluation** `#ap-agent-eval` — run the system over a fixed task set and grade
  the end state: deterministic checks wherever code can decide, a rubric judge only where it
  can't, and a naive baseline graded alongside to prove the harness discriminates ([MAR], [WT];
  [LIU] 4.18). Tracing shows what happened; evaluation says whether it was right. *When:* anything
  shipped, and before every model or prompt change. The evaluation strategy itself belongs to
  `arch-crew:test-patterns`. *Review cue:* quality judged from traces or by eye; a judge grading
  what code could check.

> **Permissions and blast radius belong to `arch-crew:threat-model`.** This section decides *whether*
> a loop needs oversight as a control-flow property. What an agent's credentials actually reach, what
> one wrong autonomous action costs, and whether untrusted content can steer the loop are security
> decisions with a named actor and impact — hand those to `threat-model`, which owns them.

## VI. Enterprise integration
- **Sidecar** `#ap-sidecar` — bolt AI alongside an app without touching its core. Lowest-risk seam.
- **Cognitive Middleware** `#ap-cognitive-middleware` — route each request between a deterministic
  path and an AI path. *When:* high-stakes, mostly-rule-based.
- **Control Plane as a Tool** `#ap-control-plane` — hide tool routing and governance behind one tool
  interface as the toolset grows. *When:* a large/growing tool surface to govern.
- **MCP tool integration** `#ap-mcp` — the agent's tools live in a separate server that speaks the
  Model Context Protocol and are discovered when the agent starts ([LCM]). *When:* tools shared
  across agents or hosts, or supplied by a third party. *Not when:* a few in-process functions one
  agent uses. *Cost:* a process boundary; every discovered tool definition lands in context unless
  loaded on demand ([CX]); a third-party server is a supply-chain trust decision
  (`arch-crew:threat-model`). *Review cue:* a server error returned as a successful result; every
  server tool bound with no narrowing.

## The standing review checklist
When auditing agent code, these are the recurring defects — check each: **(1)** is this an agent
when a workflow or single call would do? **(2)** is it multi-agent when one agent would do? **(3)**
does every loop have a step budget + early-exit? **(4)** are tool outputs validated before use?
**(5)** is there durable memory if runs outlive the context window? **(6)** are irreversible actions
gated by HITL? **(7)** is everything traced? Most agentic failures are one of these seven, not a
missing exotic pattern.

**(8) The counter-check — the one that guards the *other* direction:** is a workflow or single call
silently doing an agent's job *badly*? — e.g. a hardcoded retrieval pipeline that keeps missing
because it can't re-query (under-built agentic RAG), or a fixed chain that breaks whenever inputs
don't fit its shape. Under-building is rarer than over-building, but it's a real defect: flag it —
don't *only* ever subtract autonomy. Checks (1)–(7) all remove autonomy; (8) exists so the review
isn't one-sided.

**(9) The stale-scaffold check:** re-test every scaffold (context resets, sprint splits, evaluators)
on each model upgrade — harnesses encode assumptions that go stale ([HD], [MA]). A scaffold that a
newer model no longer needs is cost with no payoff.

## Sources
- [A2A] <https://a2a-protocol.org/latest/specification/>
- [AZ] <https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns>
- [BEA] <https://www.anthropic.com/engineering/building-effective-agents>
- [CC] <https://www.anthropic.com/engineering/building-c-compiler>
- [CE] <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- [CX] <https://www.anthropic.com/engineering/code-execution-with-mcp>
- [DAO] <https://arxiv.org/abs/2601.19752>
- [HD] <https://www.anthropic.com/engineering/harness-design-long-running-apps>
- [LAA] <https://blog.langchain.com/introducing-ambient-agents/>
- [LCM] <https://docs.langchain.com/oss/python/langchain/mcp/tools>
- [LCS] <https://docs.langchain.com/oss/python/langchain/multi-agent/subagents>
- [LGF] <https://docs.langchain.com/oss/python/langgraph/fault-tolerance>
- [LGM] <https://docs.langchain.com/oss/python/concepts/memory>
- [LGT] <https://docs.langchain.com/oss/python/langgraph/use-time-travel>
- [LIU] <https://arxiv.org/abs/2405.10467>
- [MA] <https://www.anthropic.com/engineering/managed-agents>
- [MAR] <https://www.anthropic.com/engineering/multi-agent-research-system>
- [MCPE] <https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation>
- [OAM] <https://openai.github.io/openai-agents-python/multi_agent/>
- [OAR] <https://openai.github.io/openai-agents-python/guardrails/>
- [SH] <https://arxiv.org/abs/2508.07935>
- [SK] <https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills>
- [SW] <https://github.com/openai/swarm>
- [WT] <https://www.anthropic.com/engineering/writing-tools-for-agents>
