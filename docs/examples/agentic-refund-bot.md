# Example — `arch-crew:agentic-patterns`, greenfield: an agent that touches money

When autonomy *is* warranted, the skill composes a layered design and makes governance load-bearing.

**Prompt:** "A customer-support assistant for our e-commerce store. It answers order questions and
can take real actions: issue refunds, change shipping addresses, cancel orders. It talks to our
order system and payment provider. Medium volume, one developer. We care a lot about not letting it
do something irreversible by mistake."

**What the skill did:** escalated to an agent (open-ended requests, runtime action choice) but no
higher — a single agent, not a swarm — and put HITL gates on the irreversible writes. Output:

---

## Single ReAct support agent with HITL gates for irreversible actions

| Layer | Pattern | Why it's here | Watch out for |
|-------|---------|---------------|---------------|
| Autonomy | **Agent** | Open-ended requests; the model must choose action + order at runtime. | Don't climb to multi-agent. |
| Reasoning loop | **ReAct** (+ **Tool Use**) | Each step depends on the last tool result (look up → confirm → act). | Hard step budget + loop detection; typed, schema-validated tools. |
| Topology | **Single agent** | One well-tooled agent holds orders + payments; one developer. | Resist per-action agents. |
| Memory | **Stateless** | Single-session chats fit one context window. | Add a Recorder if runs must resume; audit log still required. |
| Reliability | **Integrator** + **Step budget** | Main risk is acting on stale order data (double-refund, cancel-after-ship). | Re-check order state at action time. |
| Governance | **Human-in-the-Loop + Controller** | The central requirement: refunds/cancels/address-changes are irreversible. Gate exactly these; trace everything. | Scope HITL to writes only, with reject+feedback, or reviewers rubber-stamp. |
| Integration | **Sidecar** | Bolt onto the existing store without touching its core. | Keep blast radius behind the gates. |

**Guardrails from day one:** HITL gates on every irreversible write; step budget + loop detection;
Integrator validation with action-time state re-check (idempotency vs double-refund); full tracing
plus a durable audit log of approved writes.

**Deliberately NOT built (with the signal that reopens each):** multi-agent topology (until one
agent can't reason over the toolset reliably); durable memory (until threads must resume across
sessions); SHIELDA error taxonomy (until blind retries get unsafe); Control Plane as a Tool (until
the toolset grows large).
