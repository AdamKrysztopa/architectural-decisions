# Example — `arch-crew:agentic-patterns`, greenfield: when the answer is "no agent"

The most valuable thing this skill does is talk you *out* of building an agent you don't need.

**Prompt:** "I want an AI agent that takes an uploaded PDF and gives a one-paragraph summary. Maybe
with retrieval if the PDF is long. That's it."

**What the skill did:** the autonomy gate (decision-tree Q1) recognized this as a single,
predictable transformation — no runtime decisions, no loop, no external actions — and stopped there,
treating "maybe retrieval" as deterministic preprocessing (a *fixed*, fetch-once step), not a reason
to escalate. The line is **fixed-fetch vs. adaptive retrieval**: had the system needed to *decide*
what / whether / how-many-times to retrieve and re-query on weak evidence, that would be **agentic
RAG** — a genuine agent loop — and the gate would escalate to Q3, not demote to preprocessing. Here
it doesn't, so "no agent" holds. Output:

---

## No agent — a single well-prompted call (with optional retrieval)

**Decision: No agent. No workflow. One well-prompted LLM call.**

1. **PDF text extraction** — a normal library call. Deterministic, no LLM.
2. **Length check / optional retrieval** — if the text fits the context window, pass it through; if
   too long, chunk + embed + select the representative slice, or map-reduce. Conditional
   preprocessing around **one** final call.
3. **One summarization call** — "Summarize the following document in one paragraph."

**Guardrails that still apply:** keep observability (log input size, which path ran, latency,
tokens) — the line between a demo and production. No step budget / loop cap / HITL needed: no loop,
no irreversible action.

**Deliberately NOT built:** any agent, ReAct loop, multi-agent topology, durable memory, or
tool-calling framework — they'd add cost, latency, and failure modes for zero benefit on a one-shot
transformation.

**The signal that would justify an agent later:** if the system must *decide actions at runtime* —
choose which document to fetch, answer follow-ups conversationally, call external systems. Until
then, one call is the correct architecture.
