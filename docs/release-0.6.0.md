# Release 0.6.0 — agentic-patterns: a decision tree that never drops the baseline, and fifteen new patterns

Only `agentic-patterns` changes. The evidence is an audit of the skill against the mechai.pl wizard
and a survey of 2024–2026 pattern taxonomies, each backed by a runnable LangGraph reference
implementation with traces. The mechai.pl page is updated in parallel with the same anchors, names
and outcomes.

## Decision-logic defects fixed (`decision-tree.md`)

- **Tracing was conditional.** It sat only under Q8's "No" branch while claiming to be unconditional.
  It is now part of a baseline every design gets, next to **offline agent evaluation** for anything
  shipped.
- **The step budget was missing from most agent designs.** It is now a fixed layer for every agent
  design. Q7 is reduced to Integrator / SHIELDA / nothing beyond the baseline budget.
- **A single call skipped governance and safety.** A single call that issues a refund got no HITL, and
  a user-facing one got no guardrails. The single-call and workflow paths now pass through Q8
  (governance) and a new **Q9 — input boundary** ("is any input user-facing or untrusted?" →
  Input/Output/Tool Guardrails). Integration is renumbered Q10.
- Q7 is agent-only; the workflow line now says governance, input boundary and integration come from
  Q8–Q10.
- Context Compaction is a standing Q6 note for long ReAct and Plan-and-Execute loops. Durable
  execution is a standing Q7 note for runs that must survive a process restart.
- Mesh is mentioned at integration only if it was chosen at Q5.
- Q3 gains "gather and grade evidence iteratively" → Agentic RAG, with its fast path and static-RAG
  prerequisite.
- The triage → billing → refunds handoff example contradicted the tree's own caution. It is replaced
  by intake → legal review → fulfilment owned by separate teams.

## Catalog (`catalog.md`)

- Split the duplicate `#ap-compaction` anchor: Sub-agent context isolation is `#ap-subagent-isolation`.
  Step budget has `#ap-step-budget`. The header says where the anchors resolve.
- New entries: Single call (no agent), Tree Search, Code-execution tool orchestration, Model Cascade,
  Agents-as-tools, Group Chat / Debate, Magentic task ledger, Blackboard, Memory types, Progressive
  disclosure, Durable execution, Time travel, Ambient agent, Offline agent evaluation, MCP tool
  integration. Each one says when **not** to use it.
- Corrections: Handoff (Swarm) → Handoff (decentralized), citing the OpenAI Agents SDK. A2A moves
  from Mesh to Coordinator. Supervisor vs Orchestrator-Workers is redrawn on who keeps control of the
  answer. Reflection vs Evaluator-Optimizer becomes self- vs cross-reflection. Guardrails gain the
  tool-call boundary. HITL widens to notify / question / review. Skill Build → Skill Library
  (self-authored). The unsourced Agentic RAG cost range is labelled a rule of thumb, next to the
  published figures.
- Checklist item (9): re-test every scaffold on each model upgrade.
- Every new factual claim cites a source URL; sources are listed at the end of the catalog.

## `SKILL.md` and the frozen frontmatter

The review is now a **nine-point checklist**: seven over-building defects, one under-building check,
and one stale-scaffold check. Earlier text said "seven", which silently dropped the under-building
check from the report template. The review and recording sections no longer contradict each other:
a review writes a report, and records a decision file only for a finding the user commits to.

The description frontmatter said "seven recurring defects", and 0002's `skill-frontmatter-is-frozen`
rule forbade correcting it. **Decision 0004 supersedes 0002.** It carries 0002's three rules forward
under new ids (rule ids stay unique across superseded files). The frozen-frontmatter rule now says how
a frozen value changes: a decision that names the change, plus an updated fixture. The
agentic-patterns description is corrected under that rule; its name and trigger phrases are unchanged.

| 0.5.0 rule id | 0.6.0 rule id |
|---|---|
| `markdown-copied-byte-for-byte` | `shared-markdown-copied-verbatim` |
| `zero-runtime-dependencies` | `runtime-uses-node-builtins-only` |
| `skill-frontmatter-is-frozen` | `skill-frontmatter-changes-by-decision` |

## Deliberately not changed

- The shared definition of "finding" (audit S-3) stays verbatim. `test/vocabulary-consistency.test.mjs`
  requires every skill to state it identically, so rewording it is a five-skill change of its own.
- Only the outcomes listed above reach the decision tree. The other new entries live in the catalog
  only, matching the wizard.
