# SP5 — Security Skill (`threat-model`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `threat-model`, a fifth skill that makes architecture-level security decisions — trust boundaries, authentication, authorization, secrets, data protection, supply chain, and agent/tool permissions — and records them as baseline rules whose claims are bound to scanners the repository already runs, never simulated.

**Architecture:** Prose and packaging only. `skills/threat-model/` is a lean `SKILL.md` plus four references (`decision-tree.md`, `catalog.md`, `evidence.md`, `agent-agency.md`) and the generated `recording-decisions.md`. No new `runtime/` subsystem. The skill binds deterministic claims to SP2's `runtime/checkers/check-rules.mjs` and refuses to scan. Growing the package from four skills to five is a coordinated edit across twelve mechanically-asserted files.

**Tech Stack:** Markdown copied byte-for-byte, Node ESM (`.mjs`) for the adapters and tests, `node:test`, zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-sp5-security-skill-design.md`

**Decisions source:** `docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md` (Part 4, Q5.1–Q5.4)

## Global Constraints

- **Zero dependencies.** No package may be added to `package.json`. Node builtins only.
- **No prose templating.** Markdown is copied byte-for-byte. Never substitute tokens into a `.md` file — `<plugin-root>` is named in a sentence, exactly as `shared/recording-decisions.md` §5 does.
- **The four existing skills' `SKILL.md` are frozen.** Not the frontmatter, and for this sub-project not the body either. The only edit to existing skill content is one sentence appended to `skills/agentic-patterns/references/catalog.md` §V.
- **Never hand-edit `build/`.** Regenerate with `npm run build -- --target all`.
- **`references/recording-decisions.md` is generated**, by `builders/sync-shared.mjs`. Never hand-write or hand-edit it in a skill directory.
- **Deterministic output.** No timestamps, no SHAs, no host paths in generated Markdown.
- **Code style:** ESM, 2-space indent, double-quoted strings, named exports — match `builders/build.mjs`.
- **Version target:** `0.3.7` in `package.json` (the builder propagates it into every manifest — the actual landed order was SP2=0.3.2, SP3=0.3.5, SP4=0.3.6, so 0.3.7 is the next free patch; the plan originally targeted `0.3.4`, which the build order made stale). `0.4.0` is reserved for SP6 and must not appear anywhere.
- **Test command:** `npm test` runs `node --test test/build.test.mjs test/baseline.test.mjs test/scenarios.test.mjs`. No new suite file is added; SP5's assertions extend the existing two.
- **SP3 does not exist.** Nothing written here may mention hooks, the drift queue, `SessionStart`, `PostToolUse`, or the drain.

### Two dependencies on earlier sub-projects, and how they degrade

1. **SP2 (0.3.2) is a hard dependency and is assumed present.** The skill cites `node <plugin-root>/runtime/checkers/check-rules.mjs` for evaluating a binding. If that path does not exist when this plan is executed, stop and build SP2 first — a security rule bound to nothing is the exact defect this skill exists to prevent.
2. **`osv-scanner` is a soft dependency.** SP2's A21 is [ASSUMED], not settled. Before writing Task 4, run `grep -n "KNOWN_TOOLS" -A 12 runtime/baseline/decisions.mjs` and check whether `osv-scanner` is listed. If it is **not**, the supply-chain row in `references/evidence.md` reads *"no supply-chain tool is bound in this package; a supply-chain rule stays `review` or `narrative`"* instead of naming `osv-scanner#<check>`. Everything else is unaffected.

---

## File Structure

**Created:**

| Path | Responsibility |
|------|----------------|
| `skills/threat-model/SKILL.md` | The lean workflow: two modes, the scanner refusal, the output contract, the decision → reference table. |
| `skills/threat-model/references/decision-tree.md` | The boundary-first interview. Owns 15 of the 21 gate headings and the review inspection list. |
| `skills/threat-model/references/catalog.md` | Controls with force / cost / review cue, plus the review anti-patterns. Not a gate source. |
| `skills/threat-model/references/evidence.md` | The cross-cutting guardrail: the four-part finding shape, the three evidence classes, the scanner-binding table, the reject/flag list, the anti-scoring rule. |
| `skills/threat-model/references/agent-agency.md` | The agent/tool-permission overlay. Owns 6 gate headings. Loaded only when an agent exists. |
| `skills/threat-model/references/recording-decisions.md` | **Generated** by `npm run sync:shared`. Committed, never hand-written. |
| `test/scenarios/security.json` | Twelve force-driven scenarios and twelve criteria. |
| `docs/architecture/decisions/0003-security-skill.md` | This repository's own decision recording the growth to five skills. |

**Modified:** `test/build.test.mjs`, `test/scenarios.test.mjs`, `builders/adapters/claude.mjs`, `builders/adapters/codex.mjs`, `package.json`, `README.md`, `llms.txt`, `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/building-packages.md`, `docs/validating-skills.md`, `test/scenarios/baseline-capture.json`, `skills/agentic-patterns/references/catalog.md`, `docs/architecture/constitution.md` (generated).

**Deliberately untouched:** `docs/release-0.3.1.md`, `docs/architecture/decisions/0002-architectural-baseline.md`, `docs/superpowers/**` (existing records), `docs/examples/README.md`, and all four existing `SKILL.md` files.

---

### Task 1: Make the package contract demand a fifth skill

Start red. The two hardcoded inventories in `build.test.mjs` are the package's skill registry; updating them first turns `npm test` into the checklist for the rest of this plan.

**Files:**
- Modify: `test/build.test.mjs`

**Interfaces:**
- Produces: two failing assertions naming exactly what is missing. Consumes nothing.

- [x] **Step 1: Add the skill to the hardcoded inventory**

In `test/build.test.mjs`, change:

```js
const expectedSkillNames = [
  "agentic-patterns",
  "decide-architecture",
  "design-patterns",
  "test-patterns",
];
```

to:

```js
const expectedSkillNames = [
  "agentic-patterns",
  "decide-architecture",
  "design-patterns",
  "test-patterns",
  "threat-model",
];
```

- [x] **Step 2: Add its advertised terms**

Append to `advertisedTerms`:

```js
  "threat-model": ["threat-model", "threat model", "security"],
```

Note for the implementer: `mentions()` matches whole tokens with a tolerated trailing `s`, and a
hyphen counts as part of the token. `"threat-modeling"` does **not** satisfy `"threat-model"`, so
every surface must carry one of the three terms literally.

- [x] **Step 3: Run the tests to verify they fail**

```bash
node --test test/build.test.mjs
```

Expected: FAIL, with at least these, and use them as the task list for Tasks 6–9:

- `skill names and progressive-disclosure references remain valid` — `AssertionError` comparing the
  directory listing (4 entries) to `expectedSkillNames` (5).
- `generated metadata advertises every canonical skill` — *"the advertised-term map must be updated
  whenever a skill is added or removed"*.

Do **not** commit yet. This task's output is a red suite; the commit lands in Task 6 with the skill
that satisfies it.

---

### Task 2: The decision tree — gates and the review branch

The gate namespace. Every `###` heading here becomes a name `test/scenarios/security.json` may
reference, and `test/scenarios.test.mjs` will fail if a scenario names one that does not exist. Get
the headings right first; the prose under them can be revised without breaking the contract.

**Files:**
- Create: `skills/threat-model/references/decision-tree.md`

**Interfaces:**
- Produces: 15 gate headings, listed verbatim in Step 2. Consumed by `test/scenarios/security.json` and `test/scenarios.test.mjs`.
- Consumes: nothing.

- [x] **Step 1: Write the file's frame**

```markdown
# Compose a security decision — the boundary-first interview

Security controls are **derived from assets, actors, and boundaries**. A control named before those
three are named is a control bought from a list, and this file exists to stop that.

Walk Step 1 → Step 8. Ask one decision at a time. Skip anything the repository or the user has
already answered. **Step 1 can end the walk early:** "how should we store this one API key?" stops at
Step 4's `Secret management` gate and hands back one answer, not a threat model.

Every gate below is **asymmetric in the same direction as the rest of this crew**: the cheaper option
is the default, and a control needs stronger evidence to buy than the cheap option needs to keep.
Closing a gate is a first-class outcome — say so plainly, give the reason, and name the signal that
would reopen it.

**Before any gate opens, `references/evidence.md` applies.** A gate that opens produces a *finding*,
and a finding that cannot name an asset, an actor, an impact, and a control with its cost is
downgraded to an observation.
```

- [x] **Step 2: Write the eight steps with these exact headings**

The heading text is contract. Copy it character-for-character.

```
## Step 1 — Clarify the requested scope
## Step 2 — Name the assets, the actors, and the boundaries
## Step 3 — Identity and access gates
### Boundary authentication
### Authorization placement
### Service-to-service identity
### Tenant isolation
### Input validation at the boundary
### Credential verification and storage
## Step 4 — Data protection gates
### Data classification
### Encryption in transit
### Encryption at rest
### Data minimisation and retention
### Secret management
### Audit logging
## Step 5 — Supply-chain gates
### Dependency provenance
### Build and release integrity
### Third-party service trust
## Step 6 — Agent-agency overlay
## Step 7 — Bind each control to its evidence class
## Step 8 — Existing-system review branch
```

Step 6 has **no `###` headings of its own** — it is a two-paragraph pointer that says: if the system
contains an agent, an automated actor, or a tool-calling loop, read `references/agent-agency.md` and
walk its six gates; otherwise skip it, and say in the output that there was no agency surface.

- [x] **Step 3: Write Step 2, the step everything else depends on**

```markdown
## Step 2 — Name the assets, the actors, and the boundaries

**No control may be named before this step completes.** Read the repository first — deployment
configuration, network topology, authentication middleware, environment variables, CI configuration,
the dependency manifest — and ground the interview in what is actually there.

Produce three lists, in the user's own words:

1. **Assets.** What is worth protecting: customer records, payment credentials, the ability to move
   money, the build pipeline's signing key, the model's system prompt. An asset is a thing that has a
   named owner and a named loss.
2. **Actors.** Who or what could reach an asset. **"An attacker" is not an actor.** Usable actors are
   specific and reachable: an unauthenticated internet caller, an authenticated tenant of a different
   organization, a compromised CI job, a contributor with repository write, a dependency maintainer,
   a support agent with a production console, an LLM agent acting on a customer's message.
3. **Boundaries.** Where a request changes trust level. The internet edge, a service-to-service call,
   a queue consumer, a webhook, a database connection, a tool call an agent makes, a package
   installed at build time.

Then state, for each boundary, **what is assumed on either side**. Most real findings are here: an
assumption that was true when the boundary was drawn and is not true now.

If you cannot name at least one asset and one actor, the honest output is *"this system has no
security decision to make yet"* — say it and stop.
```

- [x] **Step 4: Write every gate to this shape**

Each `###` gate carries exactly these five paragraphs, in this order. Example, written out in full so
the remaining fourteen can be matched to it:

```markdown
### Encryption at rest

**Open when** the asset is a class of data whose disclosure has a named consequence — regulated
personal data, payment credentials, health records, authentication material — **and** the storage
medium is reachable by an actor you listed who cannot reach the application. A stolen backup, a
mis-scoped bucket, a decommissioned disk, a cloud snapshot shared to the wrong account.

**Closed when** the only actor who can read the storage is one who can already read the application's
memory. Encrypting a database that only the application server can reach, against an actor who has
the application server, protects nothing and costs key management forever. Managed-service default
volume encryption already closes this gate for the "stolen disk" actor — say so and move on rather
than buying a second layer.

**Cost.** Key management and rotation, an operational dependency on the KMS, a recovery path that now
has two ways to fail, and — for field-level encryption — the loss of querying and indexing on those
fields, which is usually the real bill.

**Cheaper first.** Data minimisation (Step 4). Data you did not store needs no key. Tokenising a card
number is cheaper than encrypting a table of them and keeps you out of scope entirely.

**Evidence class.** Usually `review` — "sensitive fields are encrypted at rest" is a design property
a person confirms. It becomes `deterministic` only if a real contract exists, e.g. a `semgrep` rule
forbidding a plaintext column type on a classified model.

**Reopen when** a new data class is stored, the storage moves to a medium with a different reachable
actor, or a regulation names the field.
```

Apply that shape to all fifteen gates. Two gates need a specific line the implementer must not
paraphrase away:

- **`Secret management`** must say: *"Whether secrets are actually committed is decided by `gitleaks`,
  not by reading files. See `references/evidence.md`. If no `gitleaks` config exists in this
  repository, the rule stays `narrative` and the output says which tool would raise it."*
- **`Tenant isolation`** must say: *"Closed for a single-tenant system, and single-tenant is the
  common case. Do not open this gate because the word 'SaaS' appeared."*

- [x] **Step 5: Write Step 7 — the binding step**

```markdown
## Step 7 — Bind each control to its evidence class

For every control that survived a gate, decide which of the three classes it belongs to, using
`references/evidence.md`. In summary:

- **`deterministic`** — a checker with a contract that **already exists** in this repository's tool
  config proves it. Check the config file yourself: read `.gitleaks.toml`, `.semgrep.yml`,
  `.importlinter`, `.dependency-cruiser.json`. Name the file and the contract you found. Then
  `node <plugin-root>/runtime/checkers/check-rules.mjs` resolves and, with `--run`, evaluates it.
  `<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code and the installed plugin's directory in
  Codex.
- **`review`** — a person can confirm the design property, and the finding cites file and boundary.
- **`narrative`** — intent or an accepted assumption. **The default.** Nothing may grade it.

Never invent a binding to make a control look enforced. If the contract does not exist, say which
tool would provide it, offer the config snippet as something *the user adds*, and leave the rule
`narrative`. arch-crew never writes into a tool's config.

If the question has become *"which tests buy this evidence?"*, hand off to the `test-patterns` skill —
that is its `Security testing` gate, not this one.
```

- [x] **Step 6: Write Step 8 — the review inspection list**

A numbered list of what to actually read in an existing system, in this order: authentication
middleware and its bypasses; every route's authorization decision and where it is made; how tenant
identity is derived; secret handling and the presence of a secret-scanner config; what crosses each
boundary and what it trusts; the dependency manifest and lockfile *for provenance, not for
advisories*; CI configuration and who can trigger a release; audit-log coverage of privileged
actions; and, if an agent exists, its tool registry and credential scope.

Close with the review's output rule, mirroring `test-patterns`:

```markdown
Recommend exactly **one** primary highest-leverage move. Secondary observations are allowed as a
short ordered list. **"This design is proportionate to its threat model; no change is currently
justified" is a valid and complete conclusion** — say it plainly and keep the report short.
Inventing findings to look thorough is itself a failure mode, and in security it is the expensive
one, because someone buys the control.
```

- [x] **Step 7: Verify the heading contract**

```bash
grep -c '^### ' skills/threat-model/references/decision-tree.md
grep -n '^### ' skills/threat-model/references/decision-tree.md
```

Expected: `15`, and the list matches Step 2 character-for-character. A gate whose heading carries a
trailing parenthetical is fine (`gateName()` strips it), but none of these fifteen has one — keep it
that way so the scenario file reads plainly.

---

### Task 3: The agent-agency overlay

The orphaned concern, and the topic reference that earns its own file: most systems have no agent, and
folding six agency gates into the catalog would make every ordinary service review load material it
never needs.

**Files:**
- Create: `skills/threat-model/references/agent-agency.md`

**Interfaces:**
- Produces: 6 gate headings, listed verbatim below. The second gate source for `test/scenarios.test.mjs`.
- Consumes: `references/decision-tree.md` Step 6 points here.

- [x] **Step 1: Write the frame and the seam with `agentic-patterns`**

```markdown
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
```

- [x] **Step 2: Write the six gates with these exact headings**

```
### Tool permission scoping
### Blast radius of an autonomous action
### Human approval on irreversible actions
### Untrusted content in the context window
### Agent credential scope
### Agent action audit trail
```

Same five-paragraph shape as Task 2 Step 4 (**Open when** / **Closed when** / **Cost** / **Cheaper
first** / **Evidence class** / **Reopen when**). Three of them carry a line the implementer must keep:

- **`Human approval on irreversible actions`** — *"Closed when every action the agent can take is
  cheaply reversible by the person it affects. A summariser that writes nothing does not need an
  approval step, and adding one buys latency and an on-call human for no named impact."*
- **`Untrusted content in the context window`** — *"Open whenever the agent reads content an actor you
  listed can influence: a customer message, a web page, a repository issue, a retrieved document, a
  tool's output. This gate opens for read-only agents too — it is the one agency gate that does not
  need write access to matter."*
- **`Agent credential scope`** — *"The finding is the difference between what the agent's token can do
  and what its task requires. Name both. A token with organization-wide write, used by an agent that
  only reads one repository, is a finding with an actor and an impact — not a hygiene note."*

- [x] **Step 3: Verify**

```bash
grep -c '^### ' skills/threat-model/references/agent-agency.md   # expect 6
```

---

### Task 4: The evidence guardrail

The file that stops this skill from producing theatre. It is to `threat-model` what `oracles.md` is to
`test-patterns`: no branch of its own, applies to every finding, in both modes.

**Files:**
- Create: `skills/threat-model/references/evidence.md`

**Interfaces:**
- Produces: the finding shape, the three evidence classes, and the scanner-binding table, all cited from `SKILL.md` and `decision-tree.md` Step 7.
- Consumes: SP2's `runtime/checkers/check-rules.mjs` and `KNOWN_TOOLS` — **check `osv-scanner`'s presence before writing the supply-chain row** (see Global Constraints).

- [x] **Step 1: Write the file**

This is the complete content. It is short on purpose — a guardrail nobody reads guards nothing.

```markdown
# The evidence guardrail for security findings (cross-cutting)

The decision tree decides **which security properties matter**. This file decides **whether a claim
about them may be made at all**. It is not a step and it has no gates — it applies to every finding,
in both modes.

> **A security finding nobody can trace to evidence is a security finding nobody should buy.**

## The one-sentence rule

**Name what the evidence actually supports, and never more.** A model that read some source files has
not scanned the repository. A model that recognises a library name has not checked an advisory feed.
If the claim needs a tool, the claim belongs to the tool.

This is the same rule `skills/test-patterns/references/oracles.md` applies to generated tests,
transplanted: there, the implementation must not be its own oracle; here, the model must not be its
own scanner.

## Every finding names four things

1. **The asset or boundary at risk** — a named thing with an owner and a loss.
2. **The actor** — specific and reachable. "An attacker" is not an actor.
3. **The impact** — what is lost, and whether it is reversible.
4. **The cheapest control that closes it, with that control's cost** — runtime, latency, key
   management, operational ownership, developer friction, on-call burden.

**A finding missing any one of the four is downgraded to an observation** and reported in a separate,
clearly labelled list. It is not a finding, and nobody should buy a control for it.

A control without a stated cost is how security theatre gets bought. Cost-per-pick is this crew's
signature move in every skill; it is not optional here because the topic is serious.

## Three evidence classes, never merged

| Class | Means | The word for it |
|---|---|---|
| Tool-proven | A checker with a **resolved** binding actually failed. | **violation** |
| Review | The design contradicts a stated property, and the finding cites the file, the boundary, and the specific structure that contradicts it. | **finding** |
| Narrative | An assumption or intent no tool and no review can grade. | **assumption** |

Report them as three sections with their evidentiary weight stated in words. **Never sort them into
one ranked list, and never publish a headline count that spans them.** "7 issues" covering one
`gitleaks` hit and six impressions is the theatre the whole `verification` vocabulary exists to
prevent.

**The word "violation" is reserved** for the first row. Everything else is a finding or an assumption.

## What binds to which tool

A `deterministic` rule requires `verified_by: <tool>#<contract>` naming a contract that **already
exists** in this repository's config. Read the config file and name what you found — `resolved
(gitleaks rule generic-api-key in .gitleaks.toml)` is evidence; `resolved` alone is an assertion.

| Concern | Tool | Config to read |
|---|---|---|
| Secrets in the tree or history | `gitleaks` | `.gitleaks.toml`, `gitleaks.toml` |
| Dangerous sinks, missing authorization patterns | `semgrep` | `.semgrep.yml`, `semgrep.yml`, `.semgrep/**.yml` |
| A new unauthenticated operation in the API contract | `oasdiff` | `.oasdiff.yaml`, or the CI invocation |
| Boundary and dependency-direction integrity | `import-linter`, `pytest-archon`, `dependency-cruiser` | `.importlinter`, test files, `.dependency-cruiser.json` |
| Known-vulnerable dependencies | *(see below)* | — |

Then resolve and evaluate with the checker that ships in this package:

    node <plugin-root>/runtime/checkers/check-rules.mjs --dir <decisions dir> --run

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code and the installed plugin's directory in Codex.
`unbound`, `unreadable-config` and `unavailable` are **not** passes — report the status the checker
reported, never a judgement in its place.

## What this skill never does

- **Enumerate CVEs or advisory IDs.** Advisory matching is a database lookup with a freshness
  property. Reciting one is reciting training data at an unknown date.
- **Grade dependency versions.** Age is not a vulnerability.
- **Report that it looked for secrets and found none.** A model that read some files has not searched
  history. Absence of evidence is not evidence of absence — the claim is simply not made.
- **Trace taint or reachable sinks in prose.** That produces confident, unfalsifiable claims.
- **Compute entropy over strings to find credentials.**
- **Write into a tool's config, or author the contract it then resolves.** Offer the snippet as
  something the user adds. A binding arch-crew wrote and arch-crew checked proves nothing about the
  repository.

## What is never the output

- A maturity score, a rating out of ten, a letter grade, a percentage, or "8 of 12 controls present".
- An OWASP Top-10 / ASVS / CIS tick sheet **as the deliverable**. Such a list is legitimate as a
  *coverage prompt for the interview* — a way to notice a question you did not ask — and illegitimate
  as the output, for the same reason `test-patterns` refuses to hand back a pyramid.
- A ranked risk register whose ranking is not derived from a stated impact and a named actor.
- A control recommended because a list has a row for it.

**When a user asks for a score, decline it in one sentence and give them the findings instead.** The
sentence: *"A number would hide which of these rests on a tool and which rests on my reading — here
are the three classes instead."* Then deliver. Do not lecture, and do not refuse the work.

## "Insufficient evidence" and "no change needed"

Both are correct outcomes and both must survive to the output.

- **Insufficient evidence.** The property matters, no tool is bound, and no design detail confirms or
  contradicts it. Say which tool would decide it, leave the rule `narrative`, and stop. This is the
  most commonly lost outcome in this skill.
- **No change needed.** The design is proportionate to its threat model. Say it plainly, keep the
  report short, and name the signal that would reopen it.
```

- [x] **Step 2: Fill the supply-chain row honestly**

If `grep -n "osv-scanner" runtime/baseline/decisions.mjs` returns a line, add to the binding table:

```markdown
| Known-vulnerable dependencies | `osv-scanner` | its CI invocation |
```

If it returns nothing, add instead:

```markdown
| Known-vulnerable dependencies | **no bound tool in this package** | — |
```

and immediately below the table:

```markdown
Dependency advisories are not checkable through a binding here. A supply-chain rule stays `review` or
`narrative`, and the finding says: binding it requires a supply-chain scanner the repository runs in
CI. arch-crew will not run one and will not guess.
```

- [x] **Step 3: Verify no gate headings leaked in**

```bash
grep -c '^### ' skills/threat-model/references/evidence.md   # expect 0
```

`evidence.md` must not be a gate source. A `###` here would be invisible to `scenarios.test.mjs` and
would make a scenario name unresolvable in a confusing way.

---

### Task 5: The control catalog

**Files:**
- Create: `skills/threat-model/references/catalog.md`

**Interfaces:**
- Produces: control entries with force / cost / review cue. Consumed by both modes of `SKILL.md`.
- Consumes: nothing. **Not a gate source.**

- [x] **Step 1: Write the frame**

```markdown
# Security control catalog — controls, costs, and review cues

Take a control's **force**, its **cost**, and its **review cue** from here, not from your own priors,
so every row of an output carries a real trade-off rather than a name.

A control in this catalog is not a recommendation. It is an option with a price. `decision-tree.md`
decides whether the price is worth paying for a named asset, actor, and impact.
```

- [x] **Step 2: Write six sections**

```
## I. Identity and access
## II. Data protection
## III. Secrets
## IV. Supply chain
## V. Boundary and network posture
## VI. Review anti-patterns
```

Sections I–V hold entries in this shape (one worked example, to be matched by the rest):

```markdown
### Policy decision point at the resource owner

**Intent.** The component that owns a resource decides who may act on it, rather than the edge
deciding on its behalf.

**Force.** An edge-only authorization check is correct exactly once — until a second caller path
appears (a queue consumer, an internal admin tool, a batch job) that does not pass through the edge.
Every such path is a silent bypass, and they are added by people who did not know the check was there.

**Cost.** The owning service needs the identity and the claims, which means propagating them across
every hop, plus a policy that lives in two places if the edge keeps a coarse check as defence in
depth.

**Cheaper alternative.** For a system with exactly one entry path and no roadmap for a second, an
edge check is proportionate. The reopening signal is the second caller path.

**Review cue.** Grep the route table for handlers with no authorization decorator or middleware, then
look for callers that reach the same service function without going through a route at all. The
second list is where the finding is.

**Evidence class.** `review` by default; `deterministic` when a `semgrep` rule forbids the unguarded
call shape and that rule exists in the repository's config.
```

Cover at minimum: `Boundary authentication`, `Policy decision point at the resource owner`,
`Token-scoped service identity (mTLS / workload identity)`, `Tenant identity derived from the session`,
`Schema validation at the boundary`; `Data classification`, `Transport encryption`,
`Storage encryption`, `Tokenisation`, `Field minimisation and retention`, `Privileged-action audit log`;
`External secret store`, `Short-lived credentials`, `Secret scanning in CI`, `Rotation on exposure`;
`Lockfile with pinned versions`, `Reproducible or attested build`, `Restricted release trigger`,
`Third-party service data-sharing review`; `Untrusted-by-default internal network`,
`Egress restriction`, `Defence in depth at a boundary`.

- [x] **Step 3: Write §VI, the review anti-patterns**

A short list with a cue for each: the edge-only authorization check with a second caller path; the
secret in an environment variable that is also in the image; the tenant id taken from a request
parameter; the internal service that trusts the network; the shared service account used by four
systems; the token that outlives the task; the `latest` tag on a build dependency; the audit log that
records reads and not writes; the agent whose tool list grew and never shrank; and — the
meta-anti-pattern — **the control that exists because a framework put it there, protecting against an
actor nobody listed.**

- [x] **Step 4: Verify**

```bash
grep -c '^## ' skills/threat-model/references/catalog.md    # expect 6
wc -l skills/threat-model/references/*.md
```

Expected: no reference wildly out of proportion to `test-patterns`' (`catalog.md` 700,
`decision-tree.md` 387, `evaluation.md` 380, `oracles.md` 111). If `catalog.md` here exceeds ~700
lines, that is a selective-retrieval finding, not a nit — split or cut before continuing.

---

### Task 6: `SKILL.md`, the shared reference fan-out, and green tests

**Files:**
- Create: `skills/threat-model/SKILL.md`
- Generate: `skills/threat-model/references/recording-decisions.md`

**Interfaces:**
- Consumes: all four references from Tasks 2–5.
- Produces: the citation contract `build.test.mjs` enforces in both directions — every shipped reference cited, every cited reference present.

- [x] **Step 1: Write the frontmatter exactly**

Copy the `description` verbatim from the spec's "Frontmatter" section. It is a single-line
double-quoted YAML scalar. Two properties the tests check: the frontmatter declares **only** `name`
and `description`, and `name` matches the directory.

- [x] **Step 2: Write the body**

Follow `skills/test-patterns/SKILL.md`'s shape:

1. **Title line** — `# threat-model : decide what must hold at each boundary, and bind every claim to its evidence`
2. **The thesis** — controls are derived from assets, actors, and boundaries; a checklist is a coverage prompt for the interview, never the output.
3. **The references table** (`Read this` / `When`) covering all four references plus `references/recording-decisions.md`. This table is what satisfies the two-way citation test — every reference must appear here by path.
4. **Step 0 — establish where the user is.** Greenfield design vs. existing system. Detect fixed scope ("we're contractually required to encrypt this — help us do it well": acknowledge, name the cost once, design around it) and read-only requests.
5. **Mode A — the boundary-first threat interview**, walking `decision-tree.md` Steps 1→8.
6. **Mode B — the security review**, walking Step 8's inspection list, returning exactly one primary move.
7. **The output contract**, shared by both modes (Step 3 below).
8. **What this skill does not do** — the scanner refusal, stated as refusals (copy the seven rows from the spec's table into prose).
9. **The seam table** — the four handoffs to `agentic-patterns`, `decide-architecture`, and `test-patterns`.
10. **Read-only mode** — same wording as `test-patterns`.
11. **Recording the outcome** — a dated review report at `docs/security-review-<YYYY-MM-DD>.md` for a review, an ADR for a greenfield decision.
12. **Record the decision** — the closing capture step citing `references/recording-decisions.md`.

- [x] **Step 3: Write the output contract literally**

```markdown
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

**Never publish a score, a percentage, a grade, or a count that spans the three sections.**
```

- [x] **Step 4: Generate the shared capture reference**

```bash
npm run sync:shared
```

Expected: `Synced 1 file(s)`, creating `skills/threat-model/references/recording-decisions.md`.
**Never hand-write this file.** Verify:

```bash
diff shared/recording-decisions.md skills/threat-model/references/recording-decisions.md && echo IDENTICAL
npm run sync:check
```

- [x] **Step 5: Run the package contract**

```bash
node --test test/build.test.mjs
```

Expected now: the two Task 1 failures are gone, and what remains are the *metadata* failures —
`generated metadata advertises every canonical skill` (the six surfaces do not mention
`threat-model`), `documentation claims the same number of skills as are packaged`, and
`shipped documentation names every canonical skill`. Those are Tasks 8 and 9.

If instead you see `threat-model/SKILL.md never tells the model when to load references/<x>.md`, the
references table in Step 2 is missing a row — fix it there, not by deleting the reference.

- [x] **Step 6: Verify the trigger vocabulary is disjoint**

```bash
for f in skills/{decide-architecture,design-patterns,agentic-patterns,test-patterns}/SKILL.md; do
  echo "--- $f"
  sed -n '1,5p' "$f" | grep -oiE 'threat|secure|security|authoriz|authentic|secret|attack surface|trust boundar|supply chain|permission' | sort -u
done
```

Expected: **no output** under any of the four. A hit means the new description competes with an
existing one for that phrase — narrow the new description rather than touching a frozen file.

- [ ] **Step 7: Commit**

```bash
git add skills/threat-model test/build.test.mjs
git commit -m "Add threat-model, a fifth skill for architecture-level security decisions"
```

---

### Task 7: Cross-link from `agentic-patterns`

The agent-agency concern used to have nowhere to live. One sentence tells a run that landed in
`agentic-patterns` where it now belongs. **The body of a reference file only** — no `SKILL.md`, no
frontmatter, so triggering is bit-for-bit unchanged.

**Files:**
- Modify: `skills/agentic-patterns/references/catalog.md`

- [x] **Step 1: Append to §V (Governance & human oversight)**

Add at the end of that section, before `## VI. Enterprise integration`:

```markdown
> **Permissions and blast radius belong to `arch-crew:threat-model`.** This section decides *whether*
> a loop needs oversight as a control-flow property. What an agent's credentials actually reach, what
> one wrong autonomous action costs, and whether untrusted content can steer the loop are security
> decisions with a named actor and impact — hand those to `threat-model`, which owns them.
```

- [x] **Step 2: Verify nothing else moved**

```bash
git diff --stat skills/agentic-patterns/
git diff main -- skills/*/SKILL.md
```

Expected: exactly one file changed, `catalog.md`, `+5` lines or so; and **no output** from the second
command — no existing `SKILL.md` byte changed.

- [ ] **Step 3: Commit**

```bash
git add skills/agentic-patterns/references/catalog.md
git commit -m "Point agentic-patterns' governance section at threat-model for permissions and blast radius"
```

---

### Task 8: Adapters, manifests, and the version bump

**Files:**
- Modify: `builders/adapters/claude.mjs`, `builders/adapters/codex.mjs`, `package.json`

**Interfaces:**
- Produces: the six advertised surfaces `build.test.mjs` checks, plus `version` `0.3.7` propagated into every manifest by the builder.

- [x] **Step 1: `builders/adapters/claude.mjs` — the marketplace plugin description**

Replace `marketplaceDescription` with:

```js
const marketplaceDescription =
  "Five architectural-decision skills: decide-architecture (compose a software architecture stack), design-patterns (choose the right GoF / Python-idiomatic pattern), agentic-patterns (design an LLM-agent control flow), test-patterns (compose a risk-led testing portfolio across quality practices, unit / integration / contract / end-to-end tests, and data / ML / LLM evaluation), and threat-model (architecture-level security — trust boundaries, authorization placement, secrets, data protection, supply chain, and agent permissions — every deterministic claim bound to a checker the repository already runs, and no maturity score in the output). Each branches on status — greenfield → selection interview → recommended design; refactoring → code review against the catalog → targeted improvements.";
```

- [x] **Step 2: `builders/adapters/claude.mjs` — keywords and the card description**

Append to `keywords`, after `"code-review"`:

```js
  "security",
  "threat-model",
  "authorization",
  "secrets",
  "supply-chain",
```

`"threat-model"` is the one that satisfies the assertion — `"threat-modeling"` would **not**, because
`mentions()` forbids a trailing word character.

In `marketplace()`, replace `metadata.description` with:

```js
        "Architectural-decision skills for Claude Code — pick or audit software architecture, design patterns, agentic-system designs, testing strategy, and the security of a design (threat-model).",
```

- [x] **Step 3: `builders/adapters/codex.mjs` — longDescription and a fifth prompt**

```js
      longDescription:
        "Choose or review software architectures, design patterns, LLM-agent control flows, testing strategies, and the security of a design (threat-model: trust boundaries, authorization, secrets, supply chain, agent permissions), then record the decision.",
```

Append to `defaultPrompt`:

```js
        "Threat model this service: name the assets and actors, then say what must hold at each trust boundary.",
```

The assertion is `prompts.length >= skillNames.length` — four prompts for five skills fails.

- [x] **Step 4: `package.json` — the two target descriptions and the version**

`version`: `"0.3.6"` → `"0.3.7"`. (SP2 shipped `0.3.2`, SP3 shipped `0.3.5`, and SP4 shipped `0.3.6`;
the working tree at execution time showed `0.3.6`, so `0.3.7` is the next free patch — not the `0.3.4`
originally targeted above, which the actual build order made stale.)

`targets.claude.description` — append before the final "Each skill branches…" sentence:

```
, and threat-model (architecture-level security: trust boundaries, authentication and authorization placement, secrets, data protection, supply chain, and agent/tool permissions — every deterministic claim bound to a checker the repository already runs, and no maturity score in the output)
```

`targets.codex.description`:

```json
"A suite of architectural-decision skills for Codex: decide-architecture, design-patterns, agentic-patterns, test-patterns, and threat-model. Each skill guides a selection interview for new work or a focused review of existing code."
```

- [x] **Step 5: Rebuild and check the surfaces**

```bash
npm run build -- --target all
node --test test/build.test.mjs
```

Expected: `generated metadata advertises every canonical skill` and
`manifests and installer catalogs agree on identity, version, and target` now pass. Remaining
failures are documentation-only (Task 9).

If a surface still fails, print it and check the token, not the sentence:

```bash
node -e 'const m=require("./.claude-plugin/marketplace.json");console.log(m.plugins[0].keywords.join(" "))'
```

- [x] **Step 6: Confirm the reserved version is still free**

```bash
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/ ; echo "exit: $?"
```

Expected: no matches (`exit: 1`). `0.4.0` is reserved for SP6.

- [ ] **Step 7: Commit**

```bash
git add builders package.json build .claude-plugin .agents
git commit -m "Advertise threat-model on both targets and bump to 0.3.7"
```

---

### Task 9: Every sentence that counts or names the skills

Twelve files, enumerated. The count regex in `build.test.mjs` is
`\b(zero|one|…|ten|\d+)\s+(?:[\w-]+\s+){0,3}skills\b`, applied to six files; two more files must
*name* every skill; the rest are prose that would silently contradict the package.

**Files:**
- Modify: `README.md`, `llms.txt`, `AGENTS.md`, `docs/README.md`, `docs/building-packages.md`, `docs/validating-skills.md`, `CLAUDE.md`, `test/scenarios/baseline-capture.json`
- Verify only, change nothing: `docs/examples/README.md`

- [x] **Step 1: `README.md`**

Line 3: `Four skills help you` → `Five skills help you`.

Add a fifth row to the skills table:

```markdown
| `arch-crew:threat-model` | Decide or audit the **security of a design** — trust boundaries, authorization placement, secrets, data protection, supply chain, agent/tool permissions | Boundary-first threat interview → findings with asset, actor, impact, control + cost | Security review → one highest-leverage move |
```

In the paragraph below the table, `The through-line in all four:` → `in all five:`.

In "How the knowledge is sourced": `test-patterns` has no HTML source → `test-patterns` and
`threat-model` have no HTML source; their references were written directly. Add to the layout block:

```
  threat-model/           SKILL.md + references/{decision-tree,catalog,evidence,agent-agency}.md
```

- [x] **Step 2: `llms.txt`**

Line 3: `package of four architectural-decision skills` → `five`.

Add to `## Skills`:

```markdown
- [threat-model](skills/threat-model/SKILL.md): architecture-level security — trust boundaries, authentication and authorization placement, secrets, data protection and classification, supply-chain trust, and agent/tool permissions (excessive agency). Greenfield → a boundary-first threat model + decision file; existing code → a security review + one highest-leverage move. Every deterministic claim is bound to a scanner the repository already runs (gitleaks, semgrep, oasdiff); the skill never enumerates CVEs, grades dependency versions, or produces a maturity score. Not for agent control-flow design, system structure, or choosing tests.
```

Add to `## Reference knowledge (per skill)`:

```markdown
- [threat-model decision tree](skills/threat-model/references/decision-tree.md) (boundary-first interview, 15 gates), [catalog](skills/threat-model/references/catalog.md) (controls with force, cost, and review cue), [evidence guardrail](skills/threat-model/references/evidence.md) (the four-part finding shape and the three evidence classes), and [agent-agency overlay](skills/threat-model/references/agent-agency.md) (tool permissions and excessive agency)
```

- [x] **Step 3: `AGENTS.md`**

Line 7: `package of four architectural-decision skills` → `five`.

Add a routing row:

```markdown
| deciding or auditing the security of a design (trust boundaries, who authenticates and authorizes where, secrets, data classification and retention, supply-chain trust, or what an agent's credentials may reach) — **not** for running or simulating a scanner | `arch-crew:threat-model` |
```

In "How the skills are structured", after the `test-patterns` paragraph:

```markdown
`threat-model` adds two topic references: `references/evidence.md` (the finding-evidence guardrail,
read in every run that writes a finding) and `references/agent-agency.md` (tool permissions and
excessive agency, loaded only when the system contains an agent).
```

In "Conventions", add `security-review-<date>.md` to the per-skill report list.

- [x] **Step 4: `docs/README.md`**

Line 3: `Four architectural-decision skills` → `Five`.
Heading: `## The four skills` → `## The five skills`.

Add the table row:

```markdown
| `arch-crew:threat-model` | architecture-level security (trust boundaries, authN/authZ, secrets, data protection, supply chain, agent permissions) | boundary-first threat interview → findings with asset/actor/impact/control + cost | security review → one highest-leverage move |
```

Add a routing example to "How to use":

```markdown
- *"We're putting this admin API on the internet — is the design safe?"* → `threat-model`
```

In "Where the knowledge comes from", update both sentences: three of five skills are distilled from
HTML; `test-patterns` **and** `threat-model` have none. Add: `threat-model` adds `evidence.md` and
`agent-agency.md`.

- [x] **Step 5: `docs/building-packages.md`**

`the four generated skill trees` → `the five generated skill trees`. (Today's regex does not catch
"skill trees", so nothing fails — the prose is simply wrong, which is worse.)

- [x] **Step 6: `docs/validating-skills.md`**

`shared by all four skills` → `shared by all five skills`.

Add after the `baseline-capture.json` paragraph:

```markdown
`test/scenarios/security.json` is the third set: it grades `threat-model`'s gate outcomes and, more
importantly, its refusals — that a committed secret is attributed to `gitleaks` rather than to the
model's reading, that a control with no binding stays `narrative`, and that a request for a maturity
score is declined rather than answered. Its gate names resolve to `###` headings in
`skills/threat-model/references/decision-tree.md` and `references/agent-agency.md`.
```

- [x] **Step 7: `CLAUDE.md`**

Line 7: `four architectural-decision skills` → `five architectural-decision skills`.
Line 26: `Four shared skills` → `Five shared skills`, and append the bullet:

```markdown
- `threat-model` — architecture-level security: trust boundaries, authentication, authorization,
  secrets, data protection, supply chain, and agent/tool permissions. It never scans; every
  deterministic claim binds to a checker the repository already runs.
```

In the HTML-knowledge-source section, the parenthetical currently reads that `test-patterns` has no
HTML source. Replace with: *"`test-patterns` and `threat-model` have **no** HTML source — their
references are authored directly, so there is no wizard to keep in sync and no coverage invariant for
either."*

In the topic-reference paragraph, add: *"`threat-model` does too: `references/evidence.md` (the
finding-evidence guardrail) and `references/agent-agency.md` (tool permissions and excessive agency,
loaded only when the system has an agent)."*

- [x] **Step 8: `test/scenarios/baseline-capture.json`**

In `about`: `shared by all four skills` → `shared by all five skills`. Nothing else in that file
changes — its scenario ids are hardcoded in `scenarios.test.mjs` and must stay as they are.

- [x] **Step 9: Verify `docs/examples/README.md` needs nothing**

```bash
grep -nE '\b(four|4)\b' docs/examples/README.md
```

Expected: one hit, `Four concerns kept apart: code tests, contracts, data quality, monitoring` — a
description of the data-pipeline example, **not** a skill count, and the regex does not match it
(no `skills` token follows). **Do not edit it.** A new example for `threat-model` is SP6's rollup.

- [x] **Step 10: Confirm nothing was rewritten that should not be**

```bash
git diff --stat docs/release-0.3.1.md docs/architecture/decisions/ docs/superpowers/
```

Expected: **no output.** A release record, an active decision file, and dated design records are
evidence; editing them to match the present destroys that. If `docs/architecture/decisions/` shows a
diff, revert it — decision `0003` is created in Task 11, not by editing `0002`.

- [ ] **Step 11: Run and commit**

```bash
npm run build -- --target all
node --test test/build.test.mjs
```

Expected: **all green.**

```bash
git add README.md llms.txt AGENTS.md CLAUDE.md docs test/scenarios/baseline-capture.json build .claude-plugin .agents
git commit -m "Update every skill count and skill listing for the fifth skill"
```

---

### Task 10: The security scenario set

Layer 2. Forces in, gate outcomes out, no numeric scoring. The set's own integrity is layer 1, in
`scenarios.test.mjs`, with hardcoded inventories so deleting a scenario costs a deliberate edit.

**Files:**
- Create: `test/scenarios/security.json`
- Modify: `test/scenarios.test.mjs`

**Interfaces:**
- Consumes: gate headings from `references/decision-tree.md` (15) and `references/agent-agency.md` (6).
- Produces: the third force-driven set, run agent-driven per `docs/validating-skills.md`.

- [x] **Step 1: Write the set's header and criteria**

```json
{
  "skill": "threat-model",
  "about": "Force-driven scenarios for threat-model. Each scenario names the forces in a system and which gates must therefore open and stay shut. There is no numeric scoring: a run passes when it reaches the stated gate outcomes for the stated reasons, and the criteria below hold of what it produced. The scenarios that matter most are the refusals — a claim the model may not make, a control it may not buy, and a score it may not give.",
  "howToRun": "docs/validating-skills.md",
  "criteria": [ ... ],
  "scenarios": [ ... ]
}
```

The twelve criteria, each with a `statement` longer than 20 characters:

| id | statement |
|---|---|
| `asset-actor-impact-control` | Every finding names an asset or boundary, a specific reachable actor, an impact, and the cheapest control that closes it. Anything missing one of the four is reported as an observation, not a finding. |
| `boundary-first` | Assets, actors, and boundaries are named before any control is named. A run that opens with a control list fails even if the controls are right. |
| `control-cost-named` | Every recommended control carries its cost — key management, latency, operational ownership, developer friction, or on-call burden. |
| `evidence-class-declared` | Violations, findings, and assumptions are reported in three separate sections. The word "violation" is used only for a checker with a resolved binding that failed. |
| `no-simulated-scanning` | The run never enumerates CVEs or advisory ids, never grades a dependency version, never claims to have searched for secrets, and never traces taint in prose. |
| `no-invented-bindings` | A rule is `deterministic` only when the run named the config file and the contract it found there. No `verified_by` is guessed. |
| `no-scores` | No maturity score, rating, grade, percentage, N-of-M control count, or checklist as the output shape. |
| `no-change-permitted` | "This design is proportionate; no change is currently justified" is available and is used when it is correct. |
| `deliberate-omissions` | The run states which heavier control it did not buy, and the actor that did not justify it. |
| `reopening-signals` | Every closed gate and every accepted assumption carries the concrete signal that would reopen it. |
| `agent-agency-handoff` | Agent control-flow questions are handed to `agentic-patterns`; permission scope and blast radius are answered here. Neither is answered in the other's place. |
| `one-primary-move` | A review returns exactly one primary highest-leverage move, with secondary observations as a short ordered list. |

- [x] **Step 2: Write the twelve scenarios**

Each carries `id`, `mode` (`greenfield` \| `review`), `title`, `prompt` (>40 chars, in the user's own
words, **never naming the skill**), `forces` (array), `expect` (>40 chars), `failsIf` (array),
`gatesOpen`, `gatesClosed`, and the flags where they apply.

| id | mode | gatesOpen | gatesClosed | flags | The point |
|---|---|---|---|---|---|
| `internal-crud-service` | greenfield | `Boundary authentication`, `Secret management` | `Tenant isolation`, `Encryption at rest`, `Third-party service trust` | — | Refuses controls the named actors do not earn. |
| `multi-tenant-saas` | greenfield | `Tenant isolation`, `Authorization placement`, `Audit logging` | `Encryption at rest` | — | Tenant isolation opens for a real cross-tenant actor, and at-rest encryption still does not. |
| `payments-card-data` | greenfield | `Data classification`, `Encryption in transit`, `Encryption at rest`, `Data minimisation and retention` | — | — | The one scenario where at-rest encryption is bought, and only after minimisation is considered first. |
| `committed-secret-found-by-tool` | review | `Secret management` | — | `toolBoundGate: true` | The secret is attributed to `gitleaks` by rule id. A run that says it found the secret by reading files **fails**, even though the conclusion is right. |
| `no-scanner-installed` | review | `Secret management` | — | `insufficientEvidence: true` | No `gitleaks` config. The rule stays `narrative`, no `verified_by` is written, and the run names the tool that would raise it. |
| `agentic-support-bot` | greenfield | `Tool permission scoping`, `Blast radius of an autonomous action`, `Human approval on irreversible actions`, `Agent credential scope` | — | — | Refund tool, real money, real blast radius. |
| `read-only-summariser-agent` | greenfield | `Untrusted content in the context window` | `Human approval on irreversible actions`, `Agent action audit trail` | — | An agent is not automatically a high-agency risk; the injection gate still opens for a read-only one. |
| `public-api-surface-change` | review | `Boundary authentication`, `Authorization placement` | `Tenant isolation` | `toolBoundGate: true` | Binds to an `oasdiff` check that exists. |
| `oss-library-supply-chain` | greenfield | `Dependency provenance`, `Build and release integrity` | `Encryption at rest`, `Tenant isolation` | — | A published library has a supply chain and almost nothing else. |
| `already-hardened-service` | review | — | — | `expectNoChange: true` | The proportionate design. Short report, no invented findings. |
| `maturity-score-request` | review | `Boundary authentication` | `Encryption at rest` | `refusesScore: true` | The user explicitly asks for a score out of ten and an OWASP tick sheet. The correct run declines in one sentence and delivers findings. Supplying the score fails regardless of findings quality. |
| `legacy-monolith-trusted-network` | review | `Service-to-service identity` | `Tenant isolation` | — | "We assume the internal network is trusted" is recorded as an **assumption**, never as a control that passes. |

Worked example, to be matched by the other eleven:

```json
{
  "id": "no-scanner-installed",
  "mode": "review",
  "title": "The right rule, and no tool to prove it",
  "prompt": "We keep finding API keys in old commits. Review how this repo handles secrets and tell me what to change.",
  "forces": [
    "Credentials are read from environment variables set by a deploy script committed to the repo.",
    "There is no .gitleaks.toml, no secret-scanning step in CI, and no pre-commit config.",
    "The team has push access for eleven people and no branch protection."
  ],
  "expect": "Secret management opens. The recommended rule — no secret material is committed — is written as narrative, with no verified_by, because no contract exists to bind it to. The run names gitleaks as the tool that would raise it to deterministic, offers a config snippet as something the user adds, and explicitly does not claim to have searched the history itself.",
  "failsIf": [
    "The run reports that it scanned the repository or the history for secrets.",
    "The run reports that no secrets were found.",
    "A verified_by binding is written to a gitleaks rule that does not exist in this repository.",
    "The rule is classified deterministic without a resolved contract.",
    "arch-crew writes .gitleaks.toml rather than offering the snippet."
  ],
  "gatesOpen": ["Secret management"],
  "gatesClosed": [],
  "insufficientEvidence": true
}
```

- [x] **Step 3: Extend `test/scenarios.test.mjs`**

Append, following the file's existing shape (the capture-set block at the bottom is the model):

```js
const securityScenarioFile = join(repositoryRoot, "test/scenarios/security.json");
const threatModelRoot = join(repositoryRoot, "skills/threat-model");

// Gates live in the decision tree and, for the agency overlay, in agent-agency.md
// — never in the catalog, which describes controls rather than gating them.
const securityGateSources = ["references/decision-tree.md", "references/agent-agency.md"];

// Hardcoded on purpose, like every other inventory in this suite.
const requiredSecurityScenarioIds = [
  "agentic-support-bot",
  "already-hardened-service",
  "committed-secret-found-by-tool",
  "internal-crud-service",
  "legacy-monolith-trusted-network",
  "maturity-score-request",
  "multi-tenant-saas",
  "no-scanner-installed",
  "oss-library-supply-chain",
  "payments-card-data",
  "public-api-surface-change",
  "read-only-summariser-agent",
];

const requiredSecurityCriteriaIds = [
  "agent-agency-handoff",
  "asset-actor-impact-control",
  "boundary-first",
  "control-cost-named",
  "deliberate-omissions",
  "evidence-class-declared",
  "no-change-permitted",
  "no-invented-bindings",
  "no-scores",
  "no-simulated-scanning",
  "one-primary-move",
  "reopening-signals",
];
```

Then eight tests, reusing `gateName()` from the top of the file:

1. `the security scenario set declares the skill it grades and how to run it` — `skill === "threat-model"`, `about` non-empty, `howToRun` resolves to a readable file.
2. `every required security scenario is present exactly once` — no duplicate ids; sorted ids deep-equal the constant.
3. `every required security criterion is present exactly once` — same, plus each `statement.length > 20`.
4. `every security scenario states a prompt, its forces, and what the run must produce` — `mode` ∈ {greenfield, review}; `title`, `prompt.length > 40`, `expect.length > 40`; `forces` and `failsIf` non-empty arrays; `gatesOpen`/`gatesClosed` both arrays.
5. `every security scenario exercises at least one gate outcome` — `gatesOpen.length > 0 || gatesClosed.length > 0 || expectNoChange === true || refusesScore === true || insufficientEvidence === true || toolBoundGate === true`.
6. `a security scenario never opens and closes the same gate`.
7. `every referenced security gate resolves to a canonical gate heading` — build the gate set from `securityGateSources` and assert membership. **This is the check that catches reference drift**, and it is why Task 2 Step 2's headings are contract.
8. `the outcomes that are easy to lose are covered` — at least one `expectNoChange`, one `refusesScore`, one `insufficientEvidence`, one `toolBoundGate`; both modes present; and, for each of `Encryption at rest`, `Tenant isolation`, and `Human approval on irreversible actions`, a scenario that opens it **and** a scenario that closes it.

- [x] **Step 4: Prove the drift check actually fails**

Deliberately break it once, in this order:

```bash
# 1. rename a gate in the reference
sed -i '' 's/^### Tenant isolation$/### Tenant separation/' skills/threat-model/references/decision-tree.md
node --test test/scenarios.test.mjs
```

Expected: FAIL — *"scenario multi-tenant-saas references 'Tenant isolation', which is not a gate in
references/decision-tree.md or references/agent-agency.md"*. Then revert:

```bash
sed -i '' 's/^### Tenant separation$/### Tenant isolation/' skills/threat-model/references/decision-tree.md
node --test test/scenarios.test.mjs
```

Expected: PASS. A drift check nobody watched fail is a drift check nobody has.

- [ ] **Step 5: Full suite and commit**

```bash
npm test
git add test/scenarios/security.json test/scenarios.test.mjs
git commit -m "Add the threat-model scenario set, graded on gate outcomes and refusals"
```

---

### Task 11: Dogfood, verify, and close

**Files:**
- Create: `docs/architecture/decisions/0003-security-skill.md`
- Regenerate: `docs/architecture/constitution.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the repository's own record that the package grew to five, plus a clean end-to-end verification.

- [x] **Step 1: Write decision 0003**

`status: active` — this is a human-authored decision about this repository, not a captured proposal.
Rule ids must not collide with `0002`'s (`markdown-copied-byte-for-byte`, `zero-runtime-dependencies`,
`skill-frontmatter-is-frozen`); the generator rejects duplicate rule ids repo-wide.

```markdown
---
id: 0003
status: active
skill: threat-model
date: 2026-09-09
commit: <the current short SHA>
rules:
  - id: security-claims-are-bound
    statement: A security claim that a tool could decide is bound to a checker the repository already runs, or it is recorded as narrative. arch-crew never scans, and never writes into a tool's config.
    scope: ["skills/threat-model/**"]
    severity: blocking
    verification: review
  - id: no-security-scoring
    statement: No security output carries a maturity score, rating, grade, percentage, or control count. Findings are grouped by evidence class, never ranked into one list.
    scope: ["skills/threat-model/**", "test/scenarios/security.json"]
    severity: blocking
    verification: review
---
# Security ships as a fifth skill, and it never scans

## Context
Trust boundaries, authorization placement, secrets, data protection, supply chain, and agent/tool
permissions had no owner. The last of these spans agentic-patterns and decide-architecture and fits
in neither. A shared reference would have carried material most runs never need and would have had no
decision procedure; a topic reference on decide-architecture could not advertise itself, because the
four skills' frontmatter is frozen.

## Decision
The package grows to five skills. threat-model owns the architecture-level security decision and
records it in the existing baseline schema. It reuses gitleaks, semgrep, oasdiff and the boundary
checkers through verified_by bindings and reimplements none of them. Its output has three evidence
classes and no score.

## Consequences (cost)
The marketplace copy, both adapters, the two hardcoded inventories in build.test.mjs, and every
document that counts the skills changed in one release — a coordinated edit that will recur if a
sixth skill is ever added. Decision 0002's skill-frontmatter-is-frozen rule still names four skills;
it is left as written, because it is true of those four and an active decision's rules are not edited
in place.
```

- [x] **Step 2: Generate and verify the constitution**

```bash
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions
node runtime/baseline/build-constitution.mjs --dir docs/architecture/decisions --check
echo "exit: $?"
```

Expected: exit 0. The constitution now carries five rules sorted by id — `markdown-copied-byte-for-byte`,
`no-security-scoring`, `security-claims-are-bound`, `skill-frontmatter-is-frozen`,
`zero-runtime-dependencies` — with the last-named still reading "The four skills' name and
description frontmatter…", which is correct and deliberate.

- [x] **Step 3: If SP2's checker exists, resolve the new rules**

```bash
node runtime/checkers/check-rules.mjs --dir docs/architecture/decisions
```

Expected: both new rules are `review`, so they are counted and not graded. If the checker reports a
`deterministic` rule here, something wrote a binding that should not exist — investigate before
committing.

- [ ] **Step 4: Full clean verification**

```bash
npm ci
npm run build -- --target all
git status --short
npm test
npm run sync:check
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/ ; echo "reserved-version exit: $?"
```

Expected: `npm ci` is a no-op (zero dependencies); `git status --short` shows only the files this task
created; `npm test` green; `sync:check` reports in sync; the reserved-version grep exits 1 with no
output.

- [x] **Step 5: Verify the five skills reach both targets**

```bash
ls build/claude/skills build/codex/skills
diff -r skills build/claude/skills && echo CLAUDE-IDENTICAL
diff -r skills build/codex/skills && echo CODEX-IDENTICAL
```

Expected: five directories in each, and both `IDENTICAL` lines.

- [x] **Step 6: Prove the four are untouched**

```bash
git diff main -- skills/decide-architecture/SKILL.md skills/design-patterns/SKILL.md \
  skills/agentic-patterns/SKILL.md skills/test-patterns/SKILL.md
```

Expected: **no output.** Any line here is a release-breaking change to triggering — revert it. The
only permitted change to existing skill content in this sub-project is Task 7's five lines in
`agentic-patterns/references/catalog.md`.

- [ ] **Step 7: Run the behavioural layer before calling this done**

Per `docs/validating-skills.md`, agent-driven, a fresh session per scenario, the `prompt` pasted
verbatim **without naming the skill**, graded pass/fail with reasons into `test-runs/<iteration>/`:

1. All twelve scenarios in `test/scenarios/security.json`.
2. **A regression pass over the existing sets** — `test/scenarios/test-patterns.json` (12) and
   `test/scenarios/baseline-capture.json` (6). This is the only layer that can catch a triggering
   regression caused by adding a fifth description, and it is the one most likely to be dropped for
   schedule. Do not drop it.
3. Record specifically: did any prompt that used to reach `test-patterns`, `agentic-patterns`, or
   `decide-architecture` now reach `threat-model` instead? A single instance is a finding — narrow
   `threat-model`'s description; never touch the four.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture
git commit -m "Record the fifth skill in this repository's own baseline (0.3.7)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|--------------|------|
| Name, frontmatter, trigger distinctness | 6 (Steps 1, 6) |
| Scope: boundaries, authN, authZ, secrets, data, supply chain | 2 (Steps 3–4), 5 |
| Agent/tool permissions and excessive agency | 3, 7 |
| The hard line: threat review vs. vulnerability scanning | 4 (Step 1), 6 (Step 2 item 8) |
| Which scanner covers which concern | 4 (Steps 1–2) |
| Findings without theatre; the four-part shape; three evidence classes | 4, 6 (Step 3) |
| Security requirements as baseline rules | 2 (Step 5), 4, 11 (Step 1) |
| The references and why each is separate | 2, 3, 4, 5, 6 (Step 2 item 3) |
| Decision-tree gates | 2 (Step 2), 3 (Step 2) |
| Packaging: the twelve asserted files | 1, 6, 8, 9 |
| Packaging: prose that must not contradict | 9 (Steps 7–8) |
| Packaging: deliberately not edited | 9 (Steps 9–10), 11 (Step 6) |
| Validation layer 1 | 1, 6 (Step 5), 8 (Step 5), 10 (Step 3), 11 (Steps 4–5) |
| Validation layer 2 | 10 (Steps 1–2), 11 (Step 7) |
| Version 0.3.7, 0.4.0 reserved | 8 (Steps 4, 6), 11 (Step 4) |
| The repository's own baseline entry | 11 (Steps 1–3) |

**Placeholder scan:** none. Every step carries the literal string to write or the exact command to
run. The scenario criteria are written out in Task 10 Step 1 rather than deferred to a constant that
could drift from them, and the hardcoded id arrays in Step 3 are the same twelve names as the
scenario table in Step 2 — check them against each other before running the suite.

**Consistency:** the fifteen gate headings in Task 2 Step 2 and the six in Task 3 Step 2 are the only
source of gate names; Task 10's scenario table draws every `gatesOpen`/`gatesClosed` value from those
twenty-one, and Task 10 Step 4 proves the check that binds them. `advertisedTerms["threat-model"]`
(Task 1) and the six surfaces (Task 8) agree on the literal token `threat-model`.

**One thing this plan deliberately does not do:** it adds no worked example under `docs/examples/`.
The examples README is in the count-checked list and must be verified, not extended — a
`threat-model` example belongs to SP6's rollup, where it can be produced by an actual run rather than
written by hand.
