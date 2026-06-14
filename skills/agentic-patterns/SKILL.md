---
name: agentic-patterns
description: "Use when designing or assessing an LLM-agent system — 'how should I build this agent', 'do I need multiple agents or one', 'should this be a workflow or an agent', 'how do I add memory/tools/human approval', 'is my ReAct loop / multi-agent setup right', or any agent-architecture code review. Branches automatically: greenfield → a layered design interview (autonomy → reasoning loop → topology → memory → reliability → governance → integration); existing agent code → a review against the catalog's seven recurring defects. Pushes toward the least autonomy that works. Reach for this whenever agents, tools, multi-agent, RAG-agents, orchestration, or LLM control flow come up, even if no pattern is named."
---

# agentic-patterns : design the simplest agent that meets the requirement, or audit the one you have

The single most important principle in agentic design: **the best agentic system is the simplest
one that meets the requirement.** Start at the bottom of the autonomy spectrum — a single
well-prompted call — and climb to a workflow, then a single agent, then multiple agents *only* when
the level below demonstrably can't do the job. Every loop, hand-off, and extra call multiplies cost,
latency, and failure modes; each must earn its keep. Most agentic failures in the wild are not a
missing exotic pattern — they're an over-built system, or a basic missing guard (no step budget, no
human gate, no tracing).

Agentic patterns **compose into layers** (like an architecture stack, not a single pick): a
reasoning loop on Tool Use, optionally inside a topology, with memory, reliability, governance, and
an integration seam.

Knowledge lives in two references you read on demand:
- `references/decision-tree.md` — the layered design interview, bottom of the autonomy spectrum up.
- `references/catalog.md` — every pattern (when / cost / review cue) and the **seven recurring
  defects** to check existing agent code against.

## Step 0 — Establish where the user is

Branch on **greenfield or refactoring?** Designing a new agentic system, or assessing one that
exists (code, a running agent, a described setup)?

The request usually tells you: "how should I build…" / "I want an agent that…" = greenfield;
"review my agent" / "is our multi-agent setup right?" / a repo to read = refactoring. Ask only if
ambiguous.

## Mode A — Greenfield: the layered design interview

Read `references/decision-tree.md` and walk it from the **autonomy gate** up.

1. **Push down the spectrum first.** Genuinely test whether a single call or a workflow suffices
   before recommending an agent — this is the highest-leverage thing the skill does. The honest
   answer is often "you don't need an agent." Don't skip the gate to get to the fun part.
2. **Walk the layers in order**, skipping branches that don't apply (workflow designs skip the
   agent-only layers; single-agent designs skip topology). Ask one layer at a time.
3. **Compose the design** — stack the selected layers, each naming its pattern and the one-line
   reason it's there, with the *cost* from `references/catalog.md`.
4. **Surface the standing notes** the active branches trigger: cap loops + early-exit, step budgets,
   single-agent-first, HITL for irreversible actions, trace everything.

Output — a "Your agentic design" the user can build from:

```
## Your agentic design

| Layer | Pattern | Why it's here | Watch out for |
|-------|---------|---------------|---------------|
| Autonomy | <single call / workflow / agent> | ... | ... |
| Reasoning loop | <ReAct / Plan-and-Execute / Reflection> (+ Tool Use) | ... | ... |
| ...only the layers that apply... |

**Guardrails to include from day one:** <step budget, loop cap, HITL gates, tracing — per the
active branches.>

**The least-autonomy check:** <one or two sentences confirming nothing here is more autonomous than
the task requires — or flagging a layer to drop.>
```

## Mode B — Refactoring: agent-system review

The deliverable favours **subtracting autonomy and adding guardrails** over adding machinery. A
huge fraction of real agent problems are fixed by removing agents, not adding them.

1. **Map the current design.** From the code or description, name each layer: autonomy level,
   reasoning loop, single vs. multi, memory, reliability, governance, integration.
2. **Run the seven-defect checklist** from `references/catalog.md`: (1) agent where a workflow/call
   would do, (2) multi-agent where one agent would do, (3) loops without a step budget + early-exit,
   (4) unvalidated tool outputs, (5) no durable memory when runs outlive the context window, (6)
   ungated irreversible actions, (7) no tracing. Most findings live here.
3. **Recommend conservatively.** Prefer collapsing a multi-agent design to one good agent, or a
   workflow to a single call, over adding a new pattern. Add only the guardrails the system actually
   lacks.

Output:

```
## Agentic system review

**Current design:** Autonomy: <…> · Loop: <…> · Agents: <…> · Memory: <…> · Governance: <…>

### Findings
1. **<defect>** — <where, file ref> · Impact: <cost/latency/risk> · Fix: <pattern to add, or
   autonomy to remove> · First step: <smallest safe change>
2. ...

**Simplify:** <agents/loops to collapse or remove.>
**Sound as-is:** <parts that are already right.>
```

## Recording the outcome (write the file)

A design that lives only in a chat transcript is lost. Persist it.

**Greenfield → an ADR.** After presenting the design, write `docs/adr/NNNN-short-title.md` (lowercase
words joined by hyphens, e.g. `0001-single-react-agent-with-hitl-gates.md`) — a 4-digit number, one
past the highest existing ADR in `docs/adr/` (else `0001`). Create `docs/adr/` if absent. Use this
MADR-style template:

```
# NNNN. <decision title, e.g. "Single ReAct agent with HITL gates for the support bot">

- Status: Accepted
- Date: <YYYY-MM-DD>
- Deciders: <the user / team, if known>

## Context
<the task and its forces — what the system must do, the autonomy genuinely required, the stakes /
latency / cost constraints that drove each layer.>

## Decision
<the composed design: the layer · pattern · why table you just presented>

## Consequences
<the cost/watch-out for each layer, the guardrails included from day one (step budgets, loop caps,
HITL, tracing), and the least-autonomy caveat: what was deliberately *not* built and the signal
that would justify climbing the spectrum.>
```

**Refactoring → a review report.** Write the review to `docs/agentic-review-<YYYY-MM-DD>.md`
(Current design + Findings from the seven-defect checklist + Simplify / Sound-as-is). If a finding
is a direction the user commits to, offer to capture it as its own ADR.

Write the file and report its path. Ask first only if the repo layout is unclear or the user is
clearly still just exploring rather than deciding.

## Why this shape

The autonomy gate leads on purpose: the costliest agentic mistakes are made *before* any pattern is
chosen, by reaching for an agent (or a swarm) when something simpler and more reliable would serve.
Naming the cost beside every layer, and leading review mode with the seven-defect checklist, keeps
the focus where real failures happen — over-engineering and missing guardrails — rather than on
collecting exotic patterns.
