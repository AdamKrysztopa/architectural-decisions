# Agent and tool permissions — the agency overlay

Load this **only** when the system contains an agent, an automated actor, or a tool-calling loop.
Most systems have none; skip it and say so.

**The seam with `agentic-patterns`.** That skill decides an agent's *control flow* — how much autonomy
the loop has, whether it needs human oversight as a reliability property, how memory and topology are
shaped. This file decides what the agent's *permissions actually reach* and what one wrong autonomous
action costs. If the question is "should this be one agent or several, and does the loop need
approval?", hand off to `arch-crew:agentic-patterns`. If it is "what can this agent's credentials
touch, and who pays when it is wrong?", it is here.

The through-line: **an agent is an actor with credentials, and it is the one actor in your system that
can be argued into using them.**

### Tool permission scoping

**Open when** the agent holds more than one tool, or any tool whose action reaches past read-only
inspection — a write, a delete, a spend, a send, an execution. Every tool granted is a capability
that any actor who can steer the agent's input effectively inherits.

**Closed when** the agent has exactly one tool and that tool can only read. A single-purpose
summariser wired to one read-only search index has no permission surface to scope beyond what the
source system already enforces.

**Cost.** A permission model to define and keep current as tools are added — one scope per tool, not
one scope for the agent — and the discipline to shrink it back down when a tool is removed rather
than leaving the grant behind.

**Cheaper first.** Narrowing the tool itself before wrapping it in a policy layer: a "read one
repository" tool instead of a general git client, a parameterised query instead of raw SQL access.
The cheapest permission scope is one the tool's own interface cannot exceed.

**Evidence class.** Usually `review` — reading the tool registry against the task and confirming each
grant is used is a design read. `deterministic` only where a policy engine enforces the scope in code
and a rule can assert it exists.

**Reopen when** a tool is added, a tool's own capability grows (a "read" endpoint gains a write mode
upstream), or the agent's task changes.

### Blast radius of an autonomous action

**Open when** an action the agent can take, taken wrongly, costs something beyond the agent's own
session — money moved, a message sent externally, a record changed that another system reads, a
resource deleted. Name the actor who pays.

**Closed when** every action the agent can take is confined to a sandbox or scratch space nothing
else reads, and a wrong action costs only a retry.

**Cost.** Constraining the action's reach — a staging-only credential, a dry-run mode, a review
queue — which is exactly the throughput the agent was built to remove, so this cost is felt as
friction against the agent's own purpose.

**Cheaper first.** Shrinking the action itself before adding a review layer around it — a "propose a
change" tool instead of a "commit the change" tool moves the blast radius to the review step for
free.

**Evidence class.** `review` — "what does this action's failure cost, and who pays" is a design read,
not something a scanner infers from a diff.

**Reopen when** a new tool is added, an existing tool's reach grows, or an incident reveals a cost
nobody named.

### Human approval on irreversible actions

**Open when** the agent can take an action a person cannot cheaply undo — money sent, a message
delivered outside the system, a record deleted, a production change released, a decision acted on
before anyone reviews it.

**Closed when** every action the agent can take is cheaply reversible by the person it affects. A
summariser that writes nothing does not need an approval step, and adding one buys latency and an
on-call human for no named impact.

**Cost.** A human in the loop for every gated action — the latency of waiting for them, the on-call
burden of being them, and the real risk that a person watching a stream of "approve" requests
rubber-stamps instead of reading.

**Cheaper first.** Narrowing the action to something reversible before adding a human to approve the
irreversible version — a staged change with a rollback instead of a direct write, a scheduled send
instead of an immediate one.

**Evidence class.** `review` — confirming an approval step exists and actually blocks the action,
rather than logging after the fact, is a design read.

**Reopen when** a new irreversible action is added, an existing action's reversibility changes (a
"draft" becomes "auto-send"), or an approval step is found to be advisory rather than blocking.

### Untrusted content in the context window

**Open whenever** the agent's context contains content an actor you listed can influence — a customer
message, a web page, a repository issue, a retrieved document, a tool's output — **and** a description
of the concern requires naming all three legs, not just the first: (1) untrusted content is in the
context, (2) the agent can reach private or consequential data or actions, and (3) the agent has *any*
channel that leaves the system — a send tool, an outbound HTTP call, a rendered link a person will
click, a file written somewhere another system reads. All three legs present is prompt injection with
an exfiltration path, not a hygiene concern. This gate opens for read-only agents too, and it also
opens for a **third-party tool server** (an MCP server or similar) whose tool descriptions and
results enter the context exactly like any other untrusted source — that is not covered by `Third-
party service trust` in the main decision tree, which governs data the system sends out, not
instructions the system reads in.

**Closed when** the agent's entire context is assembled by code the system's own authors wrote, with
no actor from Step 2 able to influence any part of it, **or** leg (3) is genuinely absent — the agent
has no outbound channel at all, so influenced content has nowhere to send anything even if it
succeeds. Closing because leg (1) or (2) alone looks small is not this gate closing; check all three.

**Cost.** Filtering and reviewing untrusted content is mitigation, not a boundary — it reduces how
often an attempt succeeds, and it does not change what happens when one does. The actual boundary is
a capability cut: a turn whose context contains untrusted content does not get the consequential
tool for that turn, which costs a harder split between "gathering" turns and "acting" turns in the
agent's own control flow, felt as latency or an extra turn. Sanitisation and a guardrail pass are
real, and cost a taxed latency on every turn — but they are the second cost, paid after the
architectural cut, not instead of it.

**Cheaper first.** **The capability cut, not filtering.** A turn whose context contains untrusted
content does not get the consequential tool — narrow what reaches the model first (extract only the
fields a task needs) and refuse the combination of "read something untrusted this turn" plus "can act
on it this turn" before reaching for a guardrail pass to catch what the cut let through. Then, for the
exfiltration leg specifically: open catalog.md's `Egress restriction` from this gate — an agent with
no outbound channel cannot exfiltrate regardless of what injection succeeds, which is often the
cheaper control to buy than trying to sanitise every untrusted source perfectly.

**Evidence class.** Usually `review` — confirming untrusted content cannot reach a consequential
action without passing the capability cut is a design read. `deterministic` only where an input/output
guardrail with a real policy contract runs and a rule can assert it is wired in, or where an egress
policy is itself checked (see catalog.md's `Egress restriction`).

**Reopen when** a new untrusted source is added to the context (including a new third-party tool
server), an existing source's trust level changes, a new outbound channel is added to the agent's
tool list, or a prompt-injection finding surfaces from that source.

### Agent credential scope

**Open when** the agent holds a credential — a token, an API key, a service identity — for anything
beyond what its task requires. The finding is the difference between what the agent's token can do
and what its task requires. Name both. A token with organization-wide write, used by an agent that
only reads one repository, is a finding with an actor and an impact — not a hygiene note.

**Closed when** the credential's own scope already matches the task — a token minted for exactly the
one resource the agent touches, with no path to anything else.

**Cost.** Minting and maintaining a narrower credential than whatever the platform hands out by
default — often a real integration cost against an identity provider that was not built with
per-agent scoping in mind.

**Cheaper first.** Asking whether the task needs a standing credential at all — a short-lived,
per-invocation token scoped to one call is cheaper to reason about than a long-lived one scoped down
after the fact.

**Evidence class.** `review` — comparing a token's actual scope to the task it serves is a design
read, not something a scanner infers without knowing the task.

**Reopen when** the agent's task grows, the credential is reused by a second agent with a different
task, or the identity provider's default scope changes.

### Agent action audit trail

**Open when** the agent can take an action worth reconstructing after the fact — anything the
`Blast radius of an autonomous action` or `Human approval on irreversible actions` gates already
opened for. If those gates are open, this one almost always is too.

**Closed when** every action the agent takes is already covered by the system's existing audit
logging — the agent's actions are indistinguishable, in the log, from an equivalent human-triggered
action — and the log names the agent as the actor.

**Cost.** Logging the agent's reasoning trail alongside the action it took, not just the action
itself, and keeping that log tamper-resistant like any other privileged actor's log — which is more
volume than a person's equivalent actions produce, because an agent takes more turns to reach the
same decision.

**Cheaper first.** Extending the existing `Audit logging` gate's pipeline to include the agent as a
named actor, rather than building a second, agent-specific logging system.

**Evidence class.** `review` — confirming the agent's actions are logged with actor and object, and
that the log actually distinguishes agent-taken actions from equivalent human ones, is a design read.

**Reopen when** a new autonomous action is added, an incident involving the agent cannot be
reconstructed from the log, or the agent gains a tool whose use is not yet logged.
