# Agentic patterns — catalog + "design your agentic system" wizard

Date: 2026-06-11
New file: `agentic-patterns.html` (single-file, zero-dependency; reuses the architecture /
Python docs' visual system & CSS tokens). Third sibling: architecture → Python → agentic.

Source: `inputs/qa-agentic-patterns-deep-learn.pdf` (Adam Krysztopa — Q&A: Agentic Patterns,
20 questions, three pattern families). Extend where the catalog needs connective tissue.

## Goal
A sibling catalog of agentic (LLM-agent) control-flow patterns: when to reach for each, with
an SVG control-flow diagram, a short illustrative trace/snippet, and Use-when / Cost rows —
plus a composed selection wizard, like the architecture doc's "build your stack."

## Organizing thesis
The workflow ↔ agent spectrum: **pick the least autonomy that solves the problem.** Patterns
nest and compose (an orchestrator's worker runs a ReAct loop whose output an evaluator
refines). Callout (like the siblings' ddd-note / gof-note): "the best agentic system is the
simplest one that meets the requirement; every loop, hand-off, or extra call must earn its keep."

## Visual treatment
Mirrors the Python doc. Full (Tier 1) entries get an SVG control-flow diagram (loops, fan-out,
hand-offs, hierarchies — existing color classes & per-figure markers) **and** a short
illustrative trace/snippet rendered in a `pre.code` block: a ReAct Thought/Action/Observation
trace, the Tool Use JSON call, or tight control-flow pseudocode. Plus `.spec` rows:
Use-when / Cost-or-failure-mode. Reuse the Python doc's `pre.code`, `.cards`, `.card`, wizard CSS.

## Depth — 3 tiers, all wizard-reachable (as in the Python doc)
- **Tier 1 — Full (~12):** oneline + prose + SVG + trace/snippet + spec rows.
  ReAct, Tool Use, Reflection, Plan-and-Execute, Routing, Prompt Chaining, Parallelization,
  Orchestrator-Workers, Evaluator-Optimizer, Supervisor, Handoff/Swarm, Human-in-the-Loop.
- **Tier 2 — Compact card (~11):** intent + note + 4–6 line snippet, no diagram.
  Chain-of-Thought, Multi-Agent Mesh, Integrator, Retriever, Recorder, Selector, Deliberator,
  Executor, Coordinator, Reflector, Controller.
- **Tier 3 — One-liner (~6):** name + intent + verdict.
  Planner (sys-theoretic; cross-ref Plan-and-Execute), Skill Build, Sidecar,
  Cognitive Middleware, Control Plane as a Tool, SHIELDA structured error handling.

## Structure
Header → intro (spectrum + augmented-LLM loop) + callout → Part I Core practitioner patterns ·
II Multi-agent topologies · III System-theoretic patterns (Dao et al., 11 subsystem patterns
in 4 classes) · IV Memory, learning & reliability · V Governance & human oversight ·
VI Enterprise integration → Part VII wizard → "How to choose" closer → References → footer.

## Wizard — composed agentic design (same engine/style as the architecture wizard)
Agentic patterns compose, so the wizard builds a *layered design*, not one pick. Steps
(branches skip irrelevant layers):
1. **Autonomy gate** — single prompt / workflow / agent? (steers away from agents by default)
2. If workflow → which shape: prompt chaining / routing / parallelization / evaluator-optimizer.
3. If agent → single agent or multiple?
4. Reasoning loop → ReAct / Plan-and-Execute / Reflection.
5. If multiple → topology: orchestrator-workers / supervisor / swarm / mesh.
6. Memory → stateless / Retriever+Recorder / experience (Skill Build).
7. Reliability → Integrator validation, SHIELDA error handling, step budgets (surface by need).
8. Governance → high-stakes/irreversible actions? → HITL action guards + Controller + observability.
9. Enterprise integration → greenfield / Sidecar / Cognitive Middleware / Control Plane as a Tool.

Output: a "Your agentic design" card — one pick per relevant layer, each linking to its section
anchor (`#ap-...`), plus contextual notes surfaced automatically: "a single good agent usually
beats a swarm"; "cap iterations + early-exit on Reflection/Evaluator loops"; "add Integrator +
step budget to harden a raw ReAct loop"; HITL+Controller for high-stakes. Same vanilla-JS IIFE,
path/trail stacks, Back/Start-over, keyboard accessible, `<noscript>` fallback, `aria-live`.

## References
A sources block at the end listing the sheet's 16 references ([1] Anthropic, [2] ReAct/Yao,
[3] Ng, [4] Dao et al., [5] Self-Refine, [6] CoT, [7] Toolformer, [8] Voyager, [9] SHIELDA,
[10] Magentic-UI, [11] storage→experience survey, [12] Control Plane as a Tool, [13] Happiest
Minds, [14] GoF, [15] AIMA, [16] OpenAI Swarm). Each Tier-1/2 entry carries `[n]` markers.

## Out of scope
No external libs, no build step — single portable HTML file. No live LLM calls; snippets are
illustrative traces/pseudocode. GoF mapping (Selector=Mediator, Tool Use=Proxy/Adapter,
Controller=Observer) noted inline, not as a separate part.
