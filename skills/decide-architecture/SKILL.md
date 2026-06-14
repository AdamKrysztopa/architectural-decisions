---
name: decide-architecture
description: "Use when choosing or assessing software architecture — picking a structure/topology for a new system, or reviewing whether an existing codebase's architecture fits. Triggers on questions like 'how should I structure this service', 'should this be microservices or a monolith', 'is our layering right', 'we're adding events/CQRS/a queue — does it fit', or any greenfield architecture decision or architecture-focused code review. Branches automatically: greenfield → a short selection interview that composes a stack; existing code → a review against the pattern catalog with targeted moves. Reach for this even when the user hasn't named a specific pattern."
---

# decide-architecture : compose the right architecture, or audit the one you have

Architecture is not one list with a single winner — it is **several axes that compose**: how code
is structured inside a deployable, how processes split and talk, how data is refined, plus
overlays. A real system picks *one per axis that applies* and skips the rest. The job of this skill
is to make those picks deliberately, and — crucially — to recommend the **least architecture that
meets the requirement**. Every axis you add buys capability at the price of operational complexity;
each one must earn its place. Over-architecting a thin CRUD app is as much a failure as
under-architecting a system that genuinely needs microservices.

The knowledge lives in two references you read on demand, so this file stays a workflow:
- `references/decision-tree.md` — the greenfield selection interview (the questions, in order).
- `references/catalog.md` — every pattern: when to reach for it, its cost, and the **review cue**
  (what it looks like in code, and the smell that says "introduce this").

## Step 0 — Establish where the user is

Everything branches on one question: **greenfield or refactoring?** Are we choosing an
architecture for something new, or assessing/evolving code that already exists?

Usually the request makes it obvious ("I'm starting a new payments service" = greenfield; "is our
monolith's layering right?" = refactoring). If it's genuinely ambiguous, ask — one short question.
Don't ask if there's a clear signal (a repo to read, a named existing system → refactoring; a blank
slate or "I'm about to build" → greenfield).

If the user is building an **agentic / LLM system** (an agent that reasons, calls tools, and acts),
that's a different axis set — say so and hand off to the `agentic-patterns` skill, which owns that
decision tree. This skill covers regular software systems.

## Mode A — Greenfield: the selection interview

Read `references/decision-tree.md` and walk it.

1. **Interview, don't lecture.** Ask one axis at a time as a concrete either/or, using the cue
   phrasing in the tree so the user can self-identify. Batch a couple of closely related questions
   if it keeps momentum, but never dump all twelve at once — the branches *skip* irrelevant axes
   (e.g. Saga only matters under microservices), and that pruning is the point.
2. **Skip what's already answered.** If the user already told you there's no UI, no data pipeline,
   one deployable — don't re-ask. Spend questions only where the choice is genuinely open.
3. **Compose the stack.** Collect one pick per answered axis into a labelled result. Pull the
   *why* and the *cost* for each pick from `references/catalog.md` so every recommendation carries
   its trade-off, not just a name.
4. **Surface the contextual notes** the tree calls for (e.g. microservices → also API Gateway/BFF,
   service mesh, stability patterns; volatile seam already covered if the structure is hexagonal).

Output — a "Your stack" summary the user can act on:

```
## Your architecture stack

| Axis | Pick | Why it fits | Cost to accept |
|------|------|-------------|----------------|
| Structure | <pattern> | <one line> | <one line> |
| Topology  | <pattern> | ... | ... |
| ...only the axes that apply... |

**Also consider:** <contextual notes>

**The least-architecture check:** <one or two sentences confirming nothing here is speculative —
or flagging any axis the user could defer until a real forcing function appears.>
```

## Mode B — Refactoring: architecture review of existing code

Here the deliverable is an honest assessment, not a fantasy redesign. The bias is toward the
**smallest change that removes real pain** — never a rewrite unless the evidence demands it.

1. **Map the current architecture.** Read enough of the codebase to name what's actually there on
   each axis: structure (layered? slices? rings?), topology (monolith? services?), data flow, UI,
   background work. Use the **review cues** in `references/catalog.md` to read the code's intent.
2. **Find the mismatches.** Compare the real shape against what the system needs. Look for the
   smells the catalog names: layer scatter, domain logic importing infrastructure types, a growing
   type-switch begging for a plugin/strategy, network calls with no stability patterns, a shared DB
   pretending to be microservices, events that should be direct calls (or vice-versa). Distinguish
   *genuine pain* (slow delivery, fragile changes, scaling walls) from *aesthetic mismatch* — only
   the former justifies change.
3. **Recommend targeted moves.** For each real issue: the pattern to introduce, why it fits *this*
   code, the cost, and a concrete first step. Prefer incremental paths (Strangler Fig over rewrite;
   introduce one port before going full hexagonal; extract one service before a fleet).

Output — a review the user can prioritise:

```
## Architecture review

**Current shape:** Structure: <…> · Topology: <…> · Data: <…> · UI: <…>

### Findings
1. **<smell / mismatch>** — <where, with file refs> · Impact: <the real pain> ·
   Move: <pattern to introduce> (`catalog` ref) · First step: <smallest safe change> · Cost: <…>
2. ...

**Leave alone:** <parts that are fine as-is — say so explicitly, so the user doesn't over-correct.>
```

## Recording the outcome (write the file)

A decision that lives only in a chat transcript is lost. Persist it.

**Greenfield → an ADR.** After presenting the stack, write `docs/adr/NNNN-short-title.md` (lowercase
words joined by hyphens, e.g. `0001-modular-monolith-with-hexagonal-core.md`) — a 4-digit number,
one past the highest existing ADR in `docs/adr/` (else `0001`). Create `docs/adr/` if absent. Use
this MADR-style template:

```
# NNNN. <decision title, e.g. "Adopt a modular monolith with a hexagonal core">

- Status: Accepted
- Date: <YYYY-MM-DD>
- Deciders: <the user / team, if known>

## Context
<the forces from the interview — what's being built, and the load / team / domain facts that drove
each axis. This is *why*, not just what.>

## Decision
<the composed stack: the axis · pick · why table you just presented>

## Consequences
<the cost accepted for each pick, the contextual notes triggered (gateway/mesh/stability/…), and
the least-architecture caveat: which axes were deferred and the concrete signal that would reopen
them.>
```

**Refactoring → a review report.** Write the review to `docs/architecture-review-<YYYY-MM-DD>.md`
(Current shape + Findings + Leave-alone). If a finding is a direction the user commits to, offer to
capture that one as its own ADR too.

Write the file and report its path. Ask first only if the repo layout is unclear or the user is
clearly still just exploring options rather than deciding.

## Why this shape

Naming the trade-off for every pick is deliberate: an architecture recommendation without its cost
is just fashion, and fashion is how teams end up with distributed monoliths and CQRS on a CRUD app.
The greenfield/refactoring split matters because the two situations have opposite risks — greenfield
tempts you to add patterns "for later"; legacy tempts you to rewrite. Both are resisted by the same
principle: change the architecture only as fast as a real requirement forces it.
