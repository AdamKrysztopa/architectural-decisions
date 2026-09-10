# Security skill (`threat-model`) — design

**Date:** 2026-09-09
**Status:** approved (design)
**Scope:** sub-project 5 of the arch-crew upgrade
**Target version:** 0.3.4
**Decisions source:** `docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md` (Part 4, Q5.1–Q5.4)

## Why

Every skill in this crew makes an architectural decision and names its cost. None of them can be
asked *"is this design safe to expose?"* — and the question is not a variant of any of the four.
`decide-architecture` composes structure and topology; `agentic-patterns` composes an agent's control
flow; `design-patterns` shapes objects; `test-patterns` decides what evidence a system needs.
Security cuts across all four and lands cleanly in none.

Two concerns in particular are currently orphaned:

- **Trust boundaries and authorization placement** — `decide-architecture` draws boundaries for
  coupling and deployment reasons, and never asks who is authorized at each one.
- **Agent and tool permissions, and excessive agency** — `agentic-patterns` decides *whether* a loop
  needs human oversight as a control-flow property. Nobody asks what an agent's credentials actually
  reach, or what an autonomous action costs when it is wrong. That question spans `agentic-patterns`
  and `decide-architecture` and fits in neither.

The failure mode this sub-project must avoid is worse than the gap. Security is the domain where a
language model is most tempted to produce something that *reads* as work — a maturity score, an OWASP
tick sheet, a list of plausible CVEs — and where a reader is least likely to check. That is the
security equivalent of a generated test with no oracle, and this repository already has a name for
it: `skills/test-patterns/references/oracles.md`. This skill is that guardrail, transplanted.

## Where this sits in the upgrade

Build order is **SP2 → SP4 → SP5 → SP3 → SP6** (decisions doc, C1). At the moment SP5 lands:

| Sub-project | State when SP5 is built | What SP5 may assume |
|---|---|---|
| SP1 (baseline) | Shipped in 0.3.1 | Decision files, `verification`, `verified_by`, `constitution.md`, the capture reference. |
| SP2 (checkers) | Shipped in 0.3.2 | `runtime/checkers/check-rules.mjs` resolves a `verified_by` binding against the repo's own tool config and reports `pass / fail / unbound / unreadable-config / unavailable / error`. |
| SP4 (migration) | Shipped in 0.3.3 | Reverse discovery and the traceability report exist and may be used to bootstrap a security baseline. |
| SP3 (drift loop) | **Does not exist** | Nothing. No hook, no drift queue, no drain. SP5 must not reference any of them. |
| SP6 (hardening) | Does not exist | Nothing. |

**One SP2 assumption is explicitly soft.** The `osv-scanner` adapter is [ASSUMED] in the decisions
doc (A21), not settled. SP5 must therefore work whether or not it landed: supply-chain rules are
expressible as `deterministic` **only if** `osv-scanner` (or an equivalent the repository already
runs) is in `KNOWN_TOOLS` with a working adapter. If it is not, supply-chain rules stay `review` or
`narrative` and the skill says which tool would raise them. This is stated in
`references/evidence.md` as a sentence, not encoded as a build-time dependency.

## Decisions taken

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| S1 | Security ships as a **fifth skill**, `threat-model` | A shared `references/security.md` fanned into all four; a topic reference on `decide-architecture` only (both lose independent triggering — the four skills' frontmatter is frozen) |
| S2 | The name is `threat-model` — the **activity**, not a catalog | `security-patterns` (reads as "hand me a list of controls", which invites the checklist output this skill exists to refuse); `secure-architecture` (weak trigger surface) |
| S3 | The skill **never scans**. It binds claims to a scanner the repository already runs, or declares the claim unverified | Shelling out to a scanner; approximating one in prose; shipping a rule pack |
| S4 | Every finding names **asset, actor, impact, and the cheapest control that closes it — with that control's cost** | A severity rating; a CVSS-style number; an ordered risk register |
| S5 | **The severity of a finding tracks its evidence class, not its scariness.** Tool-proven, review, and narrative findings are never merged into one ranked list | One combined findings table sorted by severity |
| S6 | Four references: `decision-tree.md`, `catalog.md`, `evidence.md`, `agent-agency.md` (plus the generated `recording-decisions.md`) | One catalog (the agent-agency material is loaded by a minority of runs — the `evaluation.md` argument); five-plus (nothing else earns it) |
| S7 | The cross-link to `agentic-patterns` lives in **its catalog body**, not its `SKILL.md` and never its frontmatter | A description edit (forbidden — frozen bytes) |
| S8 | This repository records the growth to five skills as a **new decision file**, `0003`, rather than editing `0002`'s frontmatter | Editing the `skill-frontmatter-is-frozen` rule in place (violates append-and-supersede, and the existing statement is still true of the four it names) |

## The skill

### Name and namespace

`threat-model`, invoked as `arch-crew:threat-model`. Directory `skills/threat-model/`.

The family already tolerates both shapes — three `-patterns` catalogs and one verb-first
`decide-architecture`. `threat-model` is verb-first on purpose: the deliverable is a *review*, and a
name ending in `-patterns` would advertise a catalog, which is exactly the artifact S4 and the
anti-scoring rule forbid as an output.

### Frontmatter

```yaml
---
name: threat-model
description: "Use when making or reviewing an architecture-level security decision — trust boundaries, authentication and authorization placement, secrets handling, data protection and classification, supply-chain trust, or what an agent or automated actor may do without a human (excessive agency and tool permissions). Triggers on 'threat model this', 'is this design secure', 'where should authorization live', 'we're exposing this service to the internet', 'review the security of this architecture', 'how should we handle secrets', 'what is our attack surface', 'can this agent do too much'. Branches automatically: greenfield → a boundary-first threat interview whose every finding names an asset, an actor, an impact, and the cheapest control that closes it with that control's cost; existing code → a security review against the catalog returning one highest-leverage move. This skill does not scan: it never enumerates CVEs, grades dependency versions, hunts for secrets by eye, or simulates a scanner — it binds those claims to a scanner the repository already runs and says so plainly when no binding exists. No maturity score, no percentage, no checklist as the output. Not for designing an agent's control flow or autonomy level (agentic-patterns), choosing a system's structure or topology (decide-architecture), or deciding which tests to write (test-patterns)."
---
```

### How it triggers without stealing the four

The four descriptions are frozen bytes, so distinctness has to be built entirely into the fifth. Three
mechanisms, in decreasing order of reliability:

1. **Disjoint trigger vocabulary.** None of the four descriptions contains `threat`, `secure`,
   `security`, `authorization`, `authentication`, `secret`, `attack surface`, `trust boundary`,
   `supply chain`, or `permission`. Verified by grep over the four `SKILL.md` frontmatter blocks; the
   plan makes this a step, not an assumption.
2. **Explicit negative clauses.** The description names all three near neighbours and hands each its
   own question back. This is the same device `test-patterns` uses ("Do not use this skill merely to
   implement one ordinary test").
3. **A seam statement in the body**, so that a run which triggers on the wrong side hands off rather
   than answering:

| Question | Owner | Why |
|---|---|---|
| "Should this be one agent or several? Does the loop need human approval?" | `agentic-patterns` | Control-flow design. Oversight is chosen as a reliability property. |
| "What may this agent's credentials reach, and what does one wrong autonomous action cost?" | `threat-model` | Permission scoping and blast radius. Oversight is chosen because a named actor could cause a named impact. |
| "Should the payments service own its own database?" | `decide-architecture` | Coupling and deployment. |
| "Who is authorized to cross the boundary that database sits behind?" | `threat-model` | Trust boundary. |
| "Do we need a security test at the integration level?" | `test-patterns` | Its `Security testing` gate — a cross-level evidence purchase. |
| "Which security property must hold at all, and where is it enforced?" | `threat-model` | The property is decided here; the evidence for it is bought there. |

The last row is the sharpest seam and the plan puts it in both directions: `threat-model`'s
decision-tree says "if the question is which tests buy this evidence, hand off to `test-patterns`",
and the finding format records a control's *verification class*, which is precisely what
`test-patterns` would then shop for.

### Scope

Owned by this skill:

1. **Trust boundaries** — where they are, what crosses each, and what is assumed on either side.
2. **Authentication** — who proves identity at each boundary, and how service-to-service identity works.
3. **Authorization** — where the decision is made, who owns the policy, and tenant isolation.
4. **Secrets** — how they are stored, rotated, scoped, and kept out of the repository.
5. **Data protection** — classification, minimisation, retention, encryption in transit and at rest,
   and audit logging.
6. **Supply chain** — dependency provenance, build and release integrity, and third-party service trust.
7. **Agent and tool permissions, and excessive agency** — the orphaned concern. Its own reference.

Not owned: cryptographic primitive selection, compliance-framework mapping (SOC 2, ISO 27001 control
numbers), incident response, physical security, penetration testing, and — emphatically — anything a
scanner does.

## The hard line: threat review is not vulnerability scanning

This is the sub-project's central constraint, and the decisions doc settles it in one sentence
(Q5.2):

> **If a tool can decide it, the skill's job is to make sure a binding exists. If no tool can decide
> it, the skill's job is to make the decision explicit and honest about being unverifiable.**

### What the skill refuses to do — stated as refusals, not preferences

| The skill never | Because |
|---|---|
| Enumerates CVEs or advisory IDs for a dependency | Advisory matching is a database lookup with a freshness property. A model reciting one is reciting its training data at an unknown date. `osv-scanner` / `pip-audit` / `npm audit` decide this. |
| Grades dependency versions ("upgrade `requests`, it's old") | Same. Age is not a vulnerability, and the skill has no advisory feed. |
| Reports that it searched for secrets and found none | Absence of evidence from a model that read some files is not evidence of absence. `gitleaks` decides this, over history, or the claim is not made. |
| Performs taint analysis or reasons about reachable sinks | `semgrep` / `ast-grep` decide this. A model tracing dataflow in prose produces confident, unfalsifiable claims. |
| Evaluates SAST rules, or writes new ones to "cover" a finding | Reimplementation, and it would make the skill its own oracle: arch-crew authoring the contract it then resolves is the shape `oracles.md` names (and Q2.4 forbids arch-crew writing into a tool's config at all). |
| Computes entropy over strings to find credentials | Reimplementation of the one thing `gitleaks` exists for. |
| Produces a maturity score, a percentage, or an N-of-M control count | See "Findings without theatre". |

### What the skill does instead

- **Decides which security properties must hold**, where they are enforced, and what each costs.
- **Checks whether a binding exists** for the properties a tool could decide, by reading the
  repository's own tool config — the static half of SP2's resolution (Q2.1(a)), which needs no tool
  installed.
- **Reports the binding's status honestly**: bound, unbound, or "no config for this tool in this
  repository". An unbound control stays `narrative` and says which tool would raise it.
- **Emits a suggested config snippet, clearly marked as something the user adds** (Q2.4). It never
  writes it.
- **Hands off to `check-rules`** for evaluation: `node <plugin-root>/runtime/checkers/check-rules.mjs`.
  `<plugin-root>` is named in a sentence, never substituted — the no-prose-templating rule.

### Which scanner covers which concern

Reused, never reimplemented. Every row is a `verified_by` binding, resolved by SP2.

| Concern | Tool | Binding shape |
|---|---|---|
| Secrets in the working tree or history | `gitleaks` | `gitleaks#<rule-id>` from `.gitleaks.toml` |
| Dangerous sinks, missing authorization patterns, unsafe defaults | `semgrep` (or `ast-grep`, if SP2 added it) | `semgrep#<rule-id>` |
| Trust-boundary API surface change (a new unauthenticated endpoint) | `oasdiff` | `oasdiff#<check-id>` |
| Boundary and dependency-direction integrity (edge must not import internals) | `import-linter`, `pytest-archon`, `dependency-cruiser` | `<tool>#<contract>` |
| Known-vulnerable dependencies | `osv-scanner` **if SP2 shipped its adapter**; otherwise none | `osv-scanner#<check>` |

The last row is the honest gap. When no supply-chain tool is bound, the skill says: *"Dependency
advisories are not checked in this repository. This rule is `narrative`. Binding it requires a
supply-chain scanner in CI; arch-crew will not run one and will not guess."*

## Findings without theatre

The output shape is where a security skill goes wrong. The discipline here is the one
`references/oracles.md` applies to generated tests, restated for findings, and it lives in its own
reference (`references/evidence.md`) so it can be loaded in both modes and cited from the review.

### The four things every finding names

1. **The asset or boundary at risk** — a named thing, in the user's terms.
2. **The actor** — who or what could reach it. "An attacker" is not an actor; "an authenticated
   tenant of another organization", "a compromised CI job", "a contributor with repository write" are.
3. **The impact** — what is lost, and whether it is reversible.
4. **The cheapest control that closes it, with that control's cost** — runtime, latency, operational
   ownership, developer friction, key management, on-call burden.

A finding missing any one of the four is downgraded to an *observation* and is reported as such. This
is `oracles.md`'s downgrade rule (a `review-finding` missing its evidence becomes `unclear`) with the
same mechanics.

### Evidence classes, never merged

| Class | What it means | What it may be called |
|---|---|---|
| **Tool-proven** | A checker with a resolved binding actually failed. | A **violation**. The word is reserved for this. |
| **Review** | The design contradicts a stated security property, and the finding cites the file, the boundary, and the specific structure that contradicts it. | A **finding**. |
| **Narrative** | An assumption or intent that no tool and no review can grade — "we treat the internal network as trusted". | An **assumption**. Never a control, never a pass. |

These are reported as three separate sections with their evidentiary weight stated in words. They are
never sorted into one ranked list, and there is never a headline count that mixes them — "7 issues"
spanning one `gitleaks` hit and six impressions is the exact theatre the `verification` vocabulary
exists to prevent.

### Explicitly forbidden output shapes

- A maturity score, a rating out of ten, a letter grade, a percentage, or a "controls present: 8/12".
- An OWASP Top-10 (or ASVS, or CIS) tick sheet **as the output**. Such a list is legitimate as a
  *coverage prompt for the interview* — a way to notice a question you did not ask — and illegitimate
  as the deliverable, for the same reason `test-patterns` refuses to hand back a pyramid.
- A ranked risk register whose ranking is not derived from stated impact and named actor.
- A control recommended because a list has a row for it. **Asymmetric gate**: a control is bought
  because a named threat cannot be mitigated more cheaply elsewhere, never to complete a list.

### "No change needed" is a first-class outcome

A proportionate design is a correct answer, and the scenario set must contain a case where it is the
right one (`expectNoChange`, mirroring `test-patterns`). So is "the evidence does not support a
finding here" — the security analogue of `oracles.md`'s `unclear`. Inventing findings to look
thorough is itself a failure mode, and in security it is the most expensive one, because someone buys
the control.

## Security requirements as baseline rules

The skill's durable output is a decision file in the existing schema. No schema change: the three
`verification` classes already carry exactly the distinction this domain needs.

### `deterministic` — a real binding exists

Only when the contract is already in the repository's tool config and SP2's checker resolves it.

| Rule statement | Binding |
|---|---|
| No secret material is committed to the repository or its history. | `gitleaks#generic-api-key` (or the repo's own rule id) |
| No HTTP route reaches the data layer without passing the authorization decorator. | `semgrep#missing-authz-decorator` |
| The published API contract gains no unauthenticated operation. | `oasdiff#api-security-removed` |
| The edge package must not import service internals. | `import-linter#edge-isolation` / `dependency-cruiser#no-edge-to-internals` |
| No dependency carries an advisory above the agreed threshold. | `osv-scanner#<check>` — **only if that adapter exists**; otherwise this row is not available |

### `review` — needs judgement, gradeable as a soft signal

- Every trust-boundary crossing authenticates its caller. (*What counts as a boundary is judgement.*)
- The authorization decision is made by the component that owns the resource.
- Tenant identity is derived from the session, never from a request parameter.
- Personal data fields are minimised and carry a stated retention period.
- An agent's tool set is the minimum required for its task.
- Irreversible actions require human approval.

### `narrative` — intent, explicitly ungradeable

- We treat the internal network as untrusted; every service call is authenticated.
- Our threat actor model is an opportunistic external attacker plus a curious insider; a funded
  targeted adversary is out of scope for this system.
- We accept a shared static secret with the payments provider until mTLS is available.

**The default is `narrative`,** as `shared/recording-decisions.md` §3 already requires of every rule.
A control is raised to `deterministic` only when the binding genuinely resolves, and to `review` only
when the intent is confirmed. A plausible-sounding control with no binding is the security version of
an unbacked `deterministic` claim, and it is worse than the honest `narrative` one for the same
reason.

## The references

| File | Loaded when | Why it is separate |
|---|---|---|
| `references/decision-tree.md` | Always, both modes | Required of every skill. The boundary-first interview, the gates, and the existing-system inspection list. |
| `references/catalog.md` | Whenever a control's force, cost, or review cue is needed | Required of every skill. Controls with when/cost/review-cue, plus the review anti-patterns. |
| `references/evidence.md` | Whenever a finding is written, and in every review | The cross-cutting guardrail — the four-part finding shape, the three evidence classes, the scanner-binding table, the reject/flag list, and the anti-scoring rule. It has no branch of its own; it applies to every row, in both modes. Exactly `oracles.md`'s relationship to `test-patterns`. |
| `references/agent-agency.md` | **Only** when the system contains an agent, an automated actor, or a tool-calling loop | Most systems have none. Folding six agency gates into `catalog.md` would make every ordinary service review load material it never needs — the bar `CLAUDE.md` sets for a topic reference, and the same argument `evaluation.md` won. |
| `references/recording-decisions.md` | At the end of a run that recommended something | Generated by `builders/sync-shared.mjs`. Never hand-written. |

`SKILL.md` carries the decision → reference table, and `test/build.test.mjs` enforces both directions
already: every shipped reference must be cited, every cited reference must exist.

## The decision-tree gates

`###` headings in `decision-tree.md` and `agent-agency.md` are the gate namespace, exactly as
`decision-tree.md` + `evaluation.md` are for `test-patterns`. `catalog.md` is deliberately **not** a
gate source — it describes entries rather than gating them.

**`decision-tree.md`**

- Step 1 — Clarify the requested scope *(can end the walk early: "how do we store this one secret?" stops at Step 4)*
- Step 2 — Name the assets, the actors, and the boundaries *(no control may be named before this step)*
- Step 3 — Identity and access gates: `Boundary authentication` · `Authorization placement` ·
  `Service-to-service identity` · `Tenant isolation` · `Input validation at the boundary`
- Step 4 — Data protection gates: `Data classification` · `Encryption in transit` ·
  `Encryption at rest` · `Data minimisation and retention` · `Secret management` · `Audit logging`
- Step 5 — Supply-chain gates: `Dependency provenance` · `Build and release integrity` ·
  `Third-party service trust`
- Step 6 — Agent-agency overlay → `agent-agency.md`, only if an agent or automated actor exists
- Step 7 — Bind each control: which class, and does a contract exist
- Step 8 — Existing-system review branch: the inspection list

**`agent-agency.md`**

`Tool permission scoping` · `Blast radius of an autonomous action` ·
`Human approval on irreversible actions` · `Untrusted content in the context window` ·
`Agent credential scope` · `Agent action audit trail`

Every gate is asymmetric in the same direction as the rest of the crew: **a control needs stronger
evidence to buy than the cheaper option needs to keep.** Closing a gate is a first-class outcome and
the scenario set grades both directions for the gates most likely to be bought reflexively
(`Encryption at rest`, `Tenant isolation`, `Human approval on irreversible actions`).

## Packaging — the fifth skill's full blast radius

`skills/threat-model/` ships to both targets automatically (`agentPackaging.canonicalSkills` is the
whole tree), and `builders/sync-shared.mjs` enumerates `skills/` so the capture reference fans out to
five without a code change — but the fan-out's **committed output** grows by one file, which must be
generated and committed or `npm run sync:check` and the build-contract test both fail.

Everything below must change in one release, or the package contradicts itself.

### Mechanically asserted — a miss fails `npm test`

| File | What changes | Which assertion |
|---|---|---|
| `test/build.test.mjs` | `expectedSkillNames` gains `"threat-model"` | `skill names and progressive-disclosure references remain valid` |
| `test/build.test.mjs` | `advertisedTerms` gains a `threat-model` key | `generated metadata advertises every canonical skill` asserts the map's keys equal the skill list |
| `builders/adapters/claude.mjs` | `marketplaceDescription`; `marketplace()`'s `metadata.description`; `keywords` | three of the six advertised surfaces |
| `builders/adapters/codex.mjs` | `interface.longDescription`; a fifth `interface.defaultPrompt` entry | one advertised surface, plus `defaultPrompt.length >= skillNames.length` |
| `package.json` | `targets.claude.description`, `targets.codex.description` (the remaining two surfaces); `version` → `0.3.4` | advertised surfaces + `manifests and installer catalogs agree on identity, version, and target` |
| `README.md` | "Four skills help you" → "Five"; a fifth table row naming `threat-model` | count regex **and** `shipped documentation names every canonical skill` |
| `llms.txt` | "package of four architectural-decision skills" → "five"; a `## Skills` bullet; a reference-knowledge bullet | count regex **and** names-every-skill |
| `AGENTS.md` | "package of four architectural-decision skills" → "five"; a routing-table row; the references paragraph | count regex |
| `docs/README.md` | line 3 "Four architectural-decision skills"; the `## The four skills` heading; a fifth table row; the "Where the knowledge comes from" paragraph | count regex |
| `docs/building-packages.md` | "the four generated skill trees" → "five" | in the counted list; the phrase escapes today's regex but the prose is still wrong |
| `docs/examples/README.md` | **no change required** — verify only | in the counted list; "Four concerns kept apart" is not a skill count and must not be edited into one |
| `skills/threat-model/references/recording-decisions.md` | the fan-out's new committed copy | `the shared capture reference is in sync across every skill` + `npm run sync:check` |

### Generated — regenerated, never hand-edited

`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`,
`build/claude/**`, `build/codex/**`, `docs/architecture/constitution.md`. CI (`package-contract.yml`)
fails on any diff after a clean rebuild.

### Prose that is not asserted but must not contradict the package

| File | What changes |
|---|---|
| `CLAUDE.md` | "four architectural-decision skills" (line 7); "Four shared skills" + the bullet list (line 26 ff.); the HTML-source paragraph — *three* of *five* skills are distilled from HTML, and `test-patterns` **and** `threat-model` have none |
| `docs/validating-skills.md` | "shared by all four skills" → five; a paragraph for `test/scenarios/security.json` |
| `test/scenarios/baseline-capture.json` | its `about` string says "shared by all four skills" |

### Deliberately **not** edited

| File | Why |
|---|---|
| `docs/release-0.3.1.md` | A release record. "The four skills" was true of 0.3.1 and stays true of it. Rewriting history to match the present is how a changelog stops being evidence. |
| `docs/architecture/decisions/0002-architectural-baseline.md` | Append-and-supersede (D2, capture reference §4). Its rule `skill-frontmatter-is-frozen` says *"The four skills' name and description frontmatter must not change"* — still literally true, and still binding on those four. Editing an active decision's rule statement in place is exactly what the schema forbids. |
| `docs/architecture/constitution.md` | Generated from the above. It changes only because decision `0003` is added. |
| `docs/superpowers/**` (existing specs and plans) | Dated design records. |
| `skills/{decide-architecture,design-patterns,agentic-patterns,test-patterns}/SKILL.md` | **Frozen.** Not the frontmatter, and — for this sub-project — not the body either. The only existing-skill edit is one sentence in `agentic-patterns/references/catalog.md` (S7). |

### The repository's own baseline

A new decision file `docs/architecture/decisions/0003-security-skill.md`, `status: active`, records
that the package grew to five and that the original four's frontmatter stays frozen. Its rule id must
not collide with `skill-frontmatter-is-frozen` (the generator rejects duplicate rule ids repo-wide),
so it introduces `security-claims-are-bound` and `no-security-scoring` instead — the two rules this
sub-project actually adds to the project's own constitution. This is the dogfood step, and it is what
makes the growth to five an auditable act rather than a diff.

## Validation

Both layers from `docs/validating-skills.md`, split by the one question: *can a tool decide this?*

### Layer 1 — package contract (`npm test`, deterministic, no model)

Additions to `test/build.test.mjs` (no new suite is needed — the fifth skill flows through the
existing assertions once the two hardcoded inventories are updated):

- `expectedSkillNames` and `advertisedTerms` both list five, and the map's keys are asserted equal to
  the directory listing.
- Every advertised surface advertises `threat-model`; `codex defaultPrompt` offers at least five prompts.
- All four references ship, each cited by `SKILL.md`, in both directions.
- `recording-decisions.md` in `skills/threat-model/references/` is byte-identical to `shared/`.
- Both target trees carry the new skill with every file, byte-identical to canonical.
- The counted-documentation regex passes over all six listed files.
- Version `0.3.4` propagates to every manifest; `grep -rn "0\.4\.0"` still returns nothing.

Additions to `test/scenarios.test.mjs` for the new set, reusing the existing shape:

- Hardcoded `requiredSecurityScenarioIds` and `requiredSecurityCriteriaIds` — **hardcoded on purpose**,
  so deleting a scenario costs a deliberate edit rather than silently shrinking the set.
- Gate sources are `references/decision-tree.md` and `references/agent-agency.md`; every
  `gatesOpen`/`gatesClosed` name must resolve to a real `###` heading, so renaming a gate fails `npm test`.
- No scenario opens and closes the same gate.
- Both modes are present; at least one scenario with `expectNoChange`, one with `insufficientEvidence`,
  one with `refusesScore`, and one with `toolBoundGate`.
- For the gates most likely to be bought reflexively, a scenario in each direction:
  `Encryption at rest`, `Tenant isolation`, `Human approval on irreversible actions`.

### Layer 2 — force-driven scenarios (`test/scenarios/security.json`, agent-driven)

Forces in, gate outcomes out, **no numeric scoring**. Twelve scenarios; the ones that carry the
sub-project's real risk are:

- **`committed-secret-found-by-tool`** — the secret is found by `gitleaks`, cited by rule id. A run
  that reports finding it by reading files fails, even though the conclusion is right.
- **`no-scanner-installed`** — the same recommendation with no `gitleaks` config. The rule must stay
  `narrative`, no `verified_by` may be written, and the run must say which tool would raise it. This
  is the "insufficient evidence" outcome, and it is the easiest one to lose.
- **`maturity-score-request`** — the user explicitly asks for a score out of ten and an OWASP tick
  sheet. The correct run declines the score, explains why in one sentence, and returns findings with
  their evidence classes. A run that supplies the score fails regardless of the findings' quality.
- **`already-hardened-service`** — `expectNoChange`. The proportionate design.
- **`read-only-summariser-agent`** — an agent whose agency gates must *close*. An agent is not
  automatically a high-agency risk.
- **`legacy-monolith-trusted-network`** — "we assume the internal network is trusted" is recorded as
  `narrative`, never as a control that passes.

Twelve grading criteria apply to every run: `asset-actor-impact-control`, `boundary-first`,
`control-cost-named`, `evidence-class-declared`, `no-simulated-scanning`, `no-invented-bindings`,
`no-scores`, `no-change-permitted`, `deliberate-omissions`, `reopening-signals`,
`agent-agency-handoff`, `one-primary-move`.

**The inversion to refuse** (decisions doc C4): never grade in layer 2 something layer 1 could decide,
and never let layer 1 assert something only judgement can settle.

## Out of scope

Hooks, the drift queue, and the drain (SP3 — does not exist yet, and nothing in this skill may
reference it). Writing into a tool's config (Q2.4). Running a scanner. Shipping a Semgrep rule pack.
Compliance-framework mapping. A `severity` taxonomy beyond the schema's `blocking | warning`. Any new
runtime subsystem — SP5 adds **no** code under `runtime/`; it is prose, packaging, and tests. A worked
example under `docs/examples/` (SP6's rollup).

## Risks

- **A triggering regression in the four.** The top risk 0.3.1 named, and adding a fifth description
  into the same trigger space is precisely how it would happen. Mitigated by disjoint vocabulary, the
  explicit negative clauses, and by re-running `test/scenarios/test-patterns.json` and
  `test/scenarios/baseline-capture.json` before release — the only layer that can catch it, and the
  one most likely to be skipped for schedule.
- **The coordinated packaging edit.** Twelve mechanically-asserted files. Mitigated by making the
  first task a red test: update the two hardcoded inventories before anything else exists, and let
  `npm test` enumerate the rest.
- **Security theatre creeping back in.** The pressure to produce a score is strongest exactly when the
  user asks for one. Mitigated by `references/evidence.md`, the `no-scores` criterion, and the
  `maturity-score-request` scenario, which grades the refusal rather than the findings.
- **The `osv-scanner` soft dependency.** If SP2 shipped no adapter, a supply-chain rule cannot be
  `deterministic`. Mitigated by making the reference state the fallback in prose; the risk is that a
  run claims a binding that `check-rules` then reports `unbound`, which SP2 already catches as a
  blocking result rather than a pass.
- **Reference bloat.** Four references plus the generated one matches `test-patterns`, which is the
  current ceiling. If `agent-agency.md` grows to where a non-agent run loads it anyway, that is a
  finding for SP6's selective-retrieval check, not a nit.
