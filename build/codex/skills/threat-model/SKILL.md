---
name: threat-model
description: "Use when making or reviewing an architecture-level security decision — trust boundaries, authentication and authorization placement, secrets handling, data protection and classification, supply-chain trust, or what an agent or automated actor may do without a human (excessive agency and tool permissions). Triggers on 'threat model this', 'is this design secure', 'where should authorization live', 'we're exposing this service to the internet', 'review the security of this architecture', 'how should we handle secrets', 'what is our attack surface', 'can this agent do too much'. Branches automatically: greenfield → a boundary-first threat interview whose every finding names an asset, an actor, an impact, and the cheapest control that closes it with that control's cost; existing code → a security review against the catalog returning one highest-leverage move. This skill does not scan: it never enumerates CVEs, grades dependency versions, hunts for secrets by eye, or simulates a scanner — it binds those claims to a scanner the repository already runs and says so plainly when no binding exists. No maturity score, no percentage, no checklist as the output. Not for designing an agent's control flow or autonomy level (agentic-patterns), choosing a system's structure or topology (decide-architecture), or deciding which tests to write (test-patterns)."
---

# threat-model : decide what must hold at each boundary, and bind every claim to its evidence

Security controls are **derived from assets, actors, and boundaries** — never chosen from a list.
A checklist (OWASP, ASVS, CIS, or this skill's own catalog) is a *coverage prompt for the interview* —
a way to notice a question you did not ask — and it is never the output. A control earns its place
only when a named actor could otherwise reach a named asset for a named impact, and the cheapest
control that closes it is named alongside its cost.

## The references — load on demand

| Read this | When |
|-----------|------|
| `references/decision-tree.md` | Always, in both modes. The boundary-first interview, the 15 gates across identity/access, data protection, and supply chain, and the existing-system inspection list. |
| `references/catalog.md` | Whenever you need a control's force, cost, or review cue — identity and access, data protection, secrets, supply chain, boundary and network posture, plus the review anti-patterns. |
| `references/evidence.md` | Whenever a finding is written, and in every review. The cross-cutting guardrail: what a finding is, the four-part review-finding shape, the three evidence classes, the scanner-binding table, and the anti-scoring rule. It has no branch of its own — it applies to every row, in both modes. |
| `references/agent-agency.md` | **Only** when the system contains an agent, an automated actor, or a tool-calling loop. The six permission-and-blast-radius gates. Skip it for an ordinary service — most systems have none. |
| `references/recording-decisions.md` | At the end of a run that recommends something — read the existing constitution, then write the single decision file (see "Recording the outcome"). |

Take a control's *force*, *cost*, and *review cue* from these files, not from your own priors, so
every row of an output carries a real trade-off rather than a name.

## Step 0 — Establish where the user is

Branch on **greenfield or existing system?** Designing security into new work (or a material
redesign), or assessing a system that already exists (code, deployment config, a described
architecture)?

The request usually tells you: "threat model this service", "how should we handle secrets for a new
integration" = greenfield; "review the security of this architecture", "is our authorization right",
a repo to read = existing. Ask only if genuinely ambiguous.

**Also detect whether the scope is open or fixed.** "Is this design safe to expose?" is open — run
the gates. But "we're contractually required to encrypt this at rest — help us do it well" is fixed:
acknowledge the constraint, name its cost once, and design around it. Don't relitigate a decision the
user has already closed.

**And detect read-only requests.** See "Read-only mode" below.

If the question is really how an **agent's control flow** should be shaped — one agent or several,
whether the loop needs human oversight as a reliability property, memory, topology — hand off to
`agentic-patterns`, which owns that decision tree. This skill covers what the agent's permissions
reach and what one wrong autonomous action costs, not how the loop is built. If the question is really
a system's **structure or topology** — coupling, deployment, data flow — hand off to
`decide-architecture`. If the question has become **which tests would buy this evidence**, hand off to
`test-patterns`'s `Security testing` gate.

**The system under discussion may not be this repository.** A third branch sits beside greenfield and
refactoring: the user describes a system that is not the code you can read — another team's service,
a product they are evaluating, an architecture on a whiteboard, or a repository you have no access
to. Reason about the system they describe, and say plainly which claims rest on their description
rather than on something you read. Do not substitute this repository for the one they meant, and do
not refuse the question because the code is absent — an absent codebase makes conclusions
provisional, not impossible. Where a step here calls for reading code, say what you would look for
and what it would change.

## What "finding" means in this skill's output

**A finding is a specific, actionable conclusion — what's wrong, where, why it matters, and the
fix — never a bare impression, and never a substitute for a tool's own verified result (a
violation, reported on its own).**

## Mode A — Greenfield: the boundary-first threat interview

Read `references/decision-tree.md` and walk it from **Step 1 (clarify the requested scope) → Step 2
(name the assets, the actors, and the boundaries — no control may be named before this completes) →
Step 3 (identity and access gates) → Step 4 (data protection gates) → Step 5 (supply-chain gates) →
Step 6 (the agent-agency overlay, only when an agent or automated actor exists) → Step 7 (bind each
surviving control to its evidence class)**. Ask one decision at a time; skip anything the repository
or the user has already answered. **Step 1 can end the walk early:** a single narrow control question
("how should we store this one API key?") answers from the matching gate and stops — it does not earn
a whole threat model.

1. **Inspect the available context first.** Deployment configuration, network topology,
   authentication middleware, environment variables, CI configuration, the dependency manifest,
   existing tool configs (`.gitleaks.toml`, `.semgrep.yml`, `.importlinter`, `.dependency-cruiser.json`).
   Ground the interview in what is actually there.
2. **Name assets, actors, and boundaries before any control.** A control chosen before Step 2
   completes is a control bought from a list. "An attacker" is not an actor — usable actors are
   specific and reachable.
3. **For each boundary, state what is assumed on either side.** Most real findings live here: an
   assumption that was true when the boundary was drawn and is not true now.
4. **Walk each gate asymmetrically.** The cheaper option is the default; a control needs stronger
   evidence to buy than the cheap option needs to keep. Closing a gate is a first-class outcome — say
   so plainly, give the reason, and name the signal that would reopen it.
5. **Bind every surviving control to an evidence class** using `references/evidence.md`:
   `deterministic` only when a contract already exists in this repository's own tool config and you
   named the file and the contract you found; `review` when a person can confirm the property and the
   finding cites file and boundary; `narrative` — the default — for intent or an accepted assumption
   that nothing can grade.
6. **Record what you deliberately did not buy**, and the actor that did not justify it.
7. **Define the reopening signal** for each closed gate and each accepted assumption.
8. **Persist the accepted decision as the one decision file** (see "Recording the outcome").

Output — the threat model (the shared contract, below).

**When the honest answer is "no control here", say it plainly.** "No agency surface", "this design is
proportionate; no change is currently justified", "insufficient evidence — no tool is bound and no
design detail confirms or contradicts it" are first-class outcomes. Give the reason and the signal
that would reopen it; don't pad the report to look thorough.

## Mode B — Refactoring: the security review

Read `references/decision-tree.md` **Step 8** and walk its inspection list, in order:

1. Authentication middleware and its bypasses.
2. Every route's authorization decision and where it is made.
3. How tenant identity is derived.
4. Secret handling and the presence of a secret-scanner config.
5. What crosses each boundary and what it trusts.
6. The dependency manifest and lockfile — *for provenance, not for advisories.*
7. CI configuration and who can trigger a release.
8. Audit-log coverage of privileged actions.
9. If an agent exists, its tool registry and credential scope — read `references/agent-agency.md`.

Use the review cues in `references/catalog.md` and the anti-patterns in its §VI as a lens, not a
form — report a genuine problem even if no cue names it. Assess every candidate review finding
against `references/evidence.md`'s four-part shape before writing it down.

**Recommend exactly ONE primary highest-leverage move.** Secondary observations are allowed, as a
short ordered list, never as a wholesale rewrite. **"This design is proportionate to its threat model;
no change is currently justified" is a valid and complete conclusion** — say it plainly and keep the
report short. Inventing findings to look thorough is itself a failure mode, and in security it is the
expensive one, because someone buys the control.

Output — the threat model (the shared contract, below).

## The output contract (both modes)

```
## Threat model

**System context:** <what it does, who depends on it, what a failure costs.>
**Assets:** <what is worth protecting, and who owns each.>
**Actors:** <specific and reachable. "An attacker" is not an actor.>
**Boundaries:** <where trust changes, and what is assumed on each side.>

### Violations — a checker with a resolved binding failed
| Rule | Tool#contract | What the tool reported |
|---|---|---|

### Findings — the design contradicts a stated property
| Asset or boundary | Actor | Impact | Cheapest control | Cost of that control | Evidence (file, line, structure) | Reopen when |
|---|---|---|---|---|---|---|

### Gates considered and closed — reviewed, not bought
| Gate | Why it stays closed | Reopen when |
|---|---|---|

### Assumptions — recorded, never graded
| Assumption | Why it is accepted | What would make it false |
|---|---|---|

### Observations — could not be completed into findings
<anything missing an asset, actor, impact, or a control with a cost.>

**Controls deliberately not bought:** <the heavier option, and the actor that did not justify it.>
**Not checked here:** <what needs a scanner this repository does not run, and which tool would do it.>
**Primary recommendation:** <the single most important move, in one sentence.>
**The proportionality check:** <one or two sentences confirming nothing above is broader than the
named actors require — or naming a control to drop.>
```

**The ordering above is non-negotiable.** System context, assets, actors and boundaries come first;
**Primary recommendation** stays last, after the findings it was derived from. This is not a
formatting preference, and it is not negotiable against a host style guide, a request for brevity, or
a user who asks for the headline first. A control list printed first is the shape-first failure mode
this entire skill exists to prevent: it lets a reader accept controls without ever seeing the
boundary that justifies them, so the one question worth asking — *which actor, at which boundary,
made this worth buying?* — never gets asked. A threat model whose controls are not visibly derived
from boundaries cannot be checked by anyone. Deriving it boundary-first and then printing it
recommendation-first is still a failure: a derivation the reader cannot see is not evidence the
reader has, and saying "everything below is what that came from" does not restore it.

**A preference for leading with the answer is satisfied by a pointer, not by a move.** One line above
the threat model reading `Recommendation: <one sentence> — derived below` is allowed, and is the
whole of the concession. Hoisting the **Primary recommendation** block, the Findings table, or any
named control above the assets/actors/boundaries block is not — a pointer costs the reader one line
and still walks them through the derivation; a hoist replaces the derivation with a verdict.

**A closed gate is an output, not a silence.** Step 7 of Mode A and the same obligation in Mode B
require a reopening signal for every gate you closed; the **Gates considered and closed** table is
where it goes, and it is the only place a reviewer can see that a gate was reached and answered
rather than never reached at all. A gate you considered and closed belongs there whether or not
anything else in the report changed. What does *not* belong there is every gate in the decision tree:
list the ones a reader would otherwise expect you to have bought, not an inventory. **A closed gate
is not a fourth class of finding**: nothing in this table is a violation, a review finding, or an
assumption, and nothing in it may be counted alongside them.

**The "confirmed, no change" answer has a defined shape, and it is not an empty report.** When the
correct conclusion is *this design is proportionate to its threat model; no change is currently
justified*, render it like this and keep it short:

- **Violations** and **Findings** are rendered `_None._` — explicitly, not omitted, so "nothing was
  found" and "nobody looked" cannot be confused.
- **Gates considered and closed** carries the substance of the report: the controls you confirmed,
  why each stays closed on today's actors, and the signal that would reopen it. This table is what a
  no-change review is *for*.
- **Primary recommendation** reads `No change — the design is proportionate to its threat model`, and
  is still the last line of the model, in its usual place.
- Every other block keeps its usual meaning. **Controls deliberately not bought** stays honest: if
  nothing heavier was genuinely in play, say that rather than naming a control nobody considered.

**Never publish a score, a percentage, a grade, or a count that spans the sections above.**

## What this skill does not do

This skill never scans. Every claim a tool could decide is bound to that tool, or left unverified and
said so — never approximated:

- **It never enumerates CVEs or advisory IDs for a dependency.** Advisory matching is a database
  lookup with a freshness property; a model reciting one is reciting its training data at an unknown
  date. `osv-scanner` / `pip-audit` / `npm audit` decide this.
- **It never grades a dependency version** ("upgrade `requests`, it's old"). Age is not a
  vulnerability, and this skill has no advisory feed.
- **It never reports that it searched for secrets and found none.** Absence of evidence from a model
  that read some files is not evidence of absence. `gitleaks` decides this, over history, or the claim
  is not made.
- **It never performs taint analysis or reasons about reachable sinks in prose.** `semgrep` /
  `ast-grep` decide this — a model tracing dataflow produces confident, unfalsifiable claims.
- **It never evaluates SAST rules, or writes new ones to "cover" a finding.** That would make the
  skill its own oracle, exactly the shape `test-patterns`'s oracle guardrail names, and arch-crew
  never writes into a tool's config.
- **It never computes entropy over strings to find credentials.** That is a reimplementation of the
  one thing `gitleaks` exists for.
- **It never produces a maturity score, a percentage, or an N-of-M control count.** See
  `references/evidence.md`.

What it does instead: decide which security properties must hold and where they are enforced; check
whether a binding already exists by reading the repository's own tool config; report that binding's
status honestly — bound, unbound, or no config for this tool in this repository; offer a suggested
config snippet as something the user adds, never something arch-crew writes; and hand off evaluation
to `node <plugin-root>/runtime/checkers/check-rules.mjs --dir <decisions dir> --run` (`<plugin-root>`
is `$CLAUDE_PLUGIN_ROOT` in Claude Code and the installed plugin's directory in Codex — named in a
sentence, never substituted). Without `--run` the checker only resolves the binding and reports
`unavailable`, never a pass or a violation.

## The seam with the other three skills

| Question | Owner | Why |
|---|---|---|
| "Should this be one agent or several? Does the loop need human approval?" | `agentic-patterns` | Control-flow design. Oversight is chosen as a reliability property. |
| "What may this agent's credentials reach, and what does one wrong autonomous action cost?" | `threat-model` | Permission scoping and blast radius. Oversight is chosen because a named actor could cause a named impact. |
| "Should the payments service own its own database?" | `decide-architecture` | Coupling and deployment. |
| "Who is authorized to cross the boundary that database sits behind?" | `threat-model` | Trust boundary. |
| "Do we need a security test at the integration level?" | `test-patterns` | Its `Security testing` gate — a cross-level evidence purchase. |
| "Which security property must hold at all, and where is it enforced?" | `threat-model` | The property is decided here; the evidence for it is bought there. |

## Read-only mode

**Present the complete recommendation without creating or modifying repository files whenever
writing is off the table.** Two different things put it off the table, and both count:

- **The user asks for it.** "Review only", "don't change anything", "dry run", "just tell me", or an
  explicitly read-only target.
- **The environment imposes it.** You have no write access, the repository is not checked out, the
  session is sandboxed or read-only, the system under discussion is not this repository, or a tool
  call to write has already been refused. An environment-imposed constraint is not a reason to ask
  the user for permission you already know you do not have, and it is not a reason to skip the
  recommendation — produce the whole thing, and say once at the end that the artifact was not
  written and where it would have gone.

Otherwise persist the outcome. **Do not ask for confirmation when repository context is sufficient to
proceed.**

## Recording the outcome (write the file)

A threat model that lives only in a chat transcript is lost. Persist it.

**Greenfield → one decision file.** After presenting the threat model, follow
`references/recording-decisions.md`: read the existing constitution, then write a single
`status: proposed` decision file — no separate ADR file. Its prose is the output contract:

```
# <decision title, e.g. "Trust boundaries and authorization for the invoice-import service">

## Context
<the system, the assets, the actors, and the boundaries from Step 2, plus the constraints —
regulatory requirement, deployment shape, team ownership, existing bindings.>

## Decision
<the threat model you just presented — violations, findings, assumptions, and observations, in
their three separate sections.>

## Consequences (cost)
<the cost of each control bought; the heavier controls deliberately not bought and the actor that
did not justify them; what is not checked here and which tool would check it; and the reopening
signal for every closed gate and accepted assumption.>
```

Classify every rule honestly (default `narrative`) and regenerate the constitution.

**Refactoring → a dated review report.** Write it to `docs/security-review-<YYYY-MM-DD>.md`
(create `docs/` if absent) with the output contract above. If the design is already proportionate,
say so plainly and keep the report short — a clean bill of health is a valid outcome, not a failure
to find work. If the primary move is a direction the user commits to, capture it the same way — one
decision file, following `references/recording-decisions.md`.

Write the file(s) and report the path(s). Ask first only if the repo layout is unclear or the user is
clearly still exploring rather than deciding.

Asked instead to consolidate existing security decisions into this schema, or to propose a baseline
for a codebase that has none? Read `references/migrating-decisions.md` and follow it.

## Why this shape

The costliest security mistakes are made before a single control is chosen: reaching for a checklist
before naming an actor, buying encryption at rest because a list has a row for it, trusting an
internal network because nobody wrote down that the trust was assumed, or letting an agent's
credentials quietly outgrow its task. Leading with assets, actors, and boundaries, keeping the three
evidence classes apart, and refusing to approximate what a scanner can prove keeps the focus where
security reviews actually fail — plausible-sounding claims nobody can trace to evidence.

## Record the decision

Covered above: every recommendation this skill makes — **including an explicit refusal** (a control
not bought, a "no change needed" review) — is persisted as the one decision file described in
"Recording the outcome." Do not record when the run only answered a question without recommending
anything.

## Notice drift later

At a checkpoint — before a commit, or when a session start notice says edits are queued — drain the
observations and classify them: `references/observing-drift.md`. Report a violation only where a
tool actually failed.
