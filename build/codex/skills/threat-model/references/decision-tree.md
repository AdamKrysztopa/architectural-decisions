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

## Step 1 — Clarify the requested scope
*Is this one narrow control question, or a system's whole security posture?*
- **One control** ("how should we store this API key?", "does this endpoint need auth?") → answer
  it directly from the matching gate in Steps 3–5 and stop. Naming the asset and the actor for that
  one control (a narrowly-scoped pass through Step 2) is still required — a control chosen without
  them is a control bought from a list.
- **A system, a new service, or a new trust boundary** → walk Step 2 in full before opening any
  gate.
- **An existing system under review** → go to Step 8; fall back to Steps 2–7 only where the review
  surfaces a gap the existing design never decided.

Skip anything the repository or the user has already answered — do not re-litigate an authentication
scheme that is already implemented and adequate; note it as already closed and move on.

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
   a support agent with a production console, an LLM agent acting on a customer's message, **a
   compromised or mis-scoped workload on the same network segment**, reached by lateral movement or
   by SSRF from one of your own services. This last one is the actor every "network placement is
   cheaper" gate below has to be checked against before it closes — do not drop it just because
   nothing on the rest of the list looks like it.
3. **Boundaries.** Where a request changes trust level. The internet edge, a service-to-service call,
   a queue consumer, a webhook, a database connection, a tool call an agent makes, a package
   installed at build time.

Then state, for each boundary, **what is assumed on either side**. Most real findings are here: an
assumption that was true when the boundary was drawn and is not true now.

If you cannot name at least one asset and one actor, the honest output is *"this system has no
security decision to make yet"* — say it and stop.

## Step 3 — Identity and access gates
*Who is allowed to do what, and where is that decided?* Walk these six gates against the actors and
boundaries named in Step 2 — do not open one for an actor who cannot reach the boundary it defends.

### Boundary authentication

**Open when** a request enters at a boundary reachable by an actor you listed who is not already
inside the trust perimeter — the internet edge, a public API, a webhook receiver, a mobile client, a
CLI token. Any actor who can reach the boundary without first authenticating is the actor this gate
defends against.

**Closed when** the boundary is only reachable from a network segment nothing on your actor list can
reach, or a layer in front of it (a gateway, a service mesh sidecar, a managed load balancer) already
terminates authentication and forwards a verified identity — say which layer, and do not re-terminate
it a second time for the same actor. Closing on a forwarded identity requires **both** of these,
stated explicitly, not assumed: (1) the backend accepts connections only from that layer — a network
policy, mTLS from the sidecar, or a signed header the backend itself verifies, not just "traffic
usually comes through the gateway"; and (2) the backend strips or rejects any caller-supplied identity
header before trusting the one the layer set. Missing either one reopens this exactly the way an
edge-only authorization check reopens when a second caller path appears (see `Authorization
placement`) — a caller who can reach the backend directly, or who can set the trusted header itself,
bypasses the whole control.

**Cost.** A credential-issuance and revocation path, session or token lifecycle management, and an
ongoing dependency on whatever verifies the credential (an identity provider, a JWKS endpoint, a
shared secret) staying available and correctly rotated.

**Cheaper first.** Put the boundary behind a network control (a private subnet, an allow-list, a VPN)
if the actor list can be satisfied that way — network placement is cheaper than a credential scheme
for actors who never needed to reach the boundary at all, **provided the compromised-or-mis-scoped-
workload actor from Step 2 is checked against it too, not just the external actors.** Closing here
does not remove the risk, it relocates it: the control is now the network configuration itself, and
the residual actor is anything that can reach that segment — a compromised neighbour, an SSRF from
your own service, a misconfigured security group. See catalog.md's `Untrusted-by-default internal
network`, which names this as a review anti-pattern when the network configuration is the only
control and nobody is watching it.

**Evidence class.** Usually `review` — a person reads the middleware and confirms unauthenticated
routes are the deliberate ones. Becomes `deterministic` when a rule exists that flags a route
registered without the auth middleware, e.g. a `semgrep` pattern.

**Reopen when** a new route is added to the same service, the boundary becomes reachable from a wider
network, the network configuration itself changes (a new peering, a widened security group), or an
incident traces to a caller nobody authenticated.

### Authorization placement

**Open when** more than one actor on your list can reach the same boundary but is entitled to
different things — a customer and an admin hitting the same API, a tenant's own data versus another
tenant's. Authentication answers "who are you"; this gate answers "where is the decision made".

**Closed when** every actor who can reach the boundary is entitled to everything behind it — a
single-role internal tool, a boundary with exactly one caller. There is no decision to place because
there is nothing to decide between.

**Cost.** A policy that must be kept current as roles and resources change, and a second thing to
test: every route needs both a "works for the allowed caller" case and a "rejected for the wrong one"
case (see `test-patterns`' `Security testing` gate).

**Cheaper first.** Push the check as close to the boundary as the framework allows — a route guard or
middleware — rather than scattering `if user.role ==` checks through business logic, which is cheap
to write once and expensive to audit forever.

**Evidence class.** `review` by default — a person walks the routes and confirms where each check
lives. `deterministic` only where a real contract binds it, e.g. an `import-linter` or
`dependency-cruiser` rule that forbids business-logic modules from reaching the request object
directly, forcing checks to the boundary layer.

**Reopen when** a new role or resource type is added, an authorization check is found inline in
business logic instead of at the boundary, or an incident traces to a decision made in the wrong
layer.

### Service-to-service identity

**Open when** a boundary you listed is a call from one service to another — internally, across a
mesh, or across a trust domain (your service to a partner's) — and the actor list includes "a
compromised or spoofed caller" as reachable on that link.

**Closed when** the services share a network nothing external reaches and the compromised-or-mis-
scoped-workload actor from Step 2 is explicitly checked against that network and excluded — a
same-host call, a single-process monolith, a link already carrying mutual TLS from the platform (a
mesh sidecar) that you did not have to build. Closing on "nothing external reaches it" without
checking that actor is exactly the "internal service that trusts the network" catalog.md names as an
anti-pattern.

**Cost.** Certificate or token issuance and rotation for every service, a registry of which service
may call which, and a failure mode to design for when the identity provider itself is unavailable.

**Cheaper first.** Network segmentation (a private subnet, a security group) closes most of this gate
for actors who cannot reach the link at all; buy per-call identity only for the actors segmentation
cannot exclude. This relocates the risk to the network configuration, not removes it — see
catalog.md's `Untrusted-by-default internal network` for the residual-risk statement and its own
reopening signal.

**Evidence class.** Usually `review` — confirming which links carry mutual TLS or a signed token is a
design read. `deterministic` where a mesh or gateway config is itself checked, e.g. a policy file
linted for "deny by default".

**Reopen when** a new service is added to the call graph, a link crosses a trust domain that used to
be internal, the network segmentation itself changes, or an incident traces to an unauthenticated
internal call.

### Tenant isolation

**Open when** the actor list includes "an authenticated tenant of a different organization" as
reachable to the same storage, cache, queue, or compute — genuinely multi-tenant data or
infrastructure.

**Closed** for a single-tenant system, and single-tenant is the common case. Do not open this gate
because the word 'SaaS' appeared.

**Cost.** Every query, cache key, and background job must carry and check the tenant identifier; a
single missed filter is a cross-tenant data leak, so the check needs to live somewhere it cannot be
skipped — a row-level policy, a scoped connection, a middleware that injects the filter — not
developer discipline alone.

**Cheaper first.** Physical or account-level separation (one database, one deployment per tenant)
closes this gate entirely for a small number of large tenants, at an operational cost that is cheaper
than logical isolation once the tenant count is small enough to manage.

**Evidence class.** `review` for the design (where is the tenant filter enforced, and can it be
bypassed) escalating to `deterministic` where the database itself enforces it, e.g. a Postgres
row-level-security policy or a query-builder rule a linter can check for.

**Reopen when** the system moves from single-tenant to multi-tenant, a new data store is added to the
tenant-scoped set, or an incident traces to a missing tenant filter.

### Input validation at the boundary

**Open when** a boundary accepts structured input — a request body, a query parameter, a file
upload, a message from a queue — from an actor who is not fully trusted, and that input reaches a
parser, a query, a template, a filesystem path, or a command. This gate has two distinct controls,
not one: a schema at the boundary (shape), and structural separation of code and data at the sink
(injection). Both belong here; neither substitutes for the other.

**Closed when** the input is generated entirely by your own trusted service and never touches an
untrusted actor on the way — an internal event whose producer and schema you control end to end.

**Cost.** A validation layer to keep in sync with the schema as it evolves, and a decision about
failure behavior (reject, sanitize, quarantine) at every boundary that has one; separately, rewriting
sink call sites to parameterised queries, an auto-escaping template engine, argv-form execution, and
path canonicalisation.

**Cheaper first.** **Structural separation of code and data at the sink** — a parameterised query,
an auto-escaping template engine used correctly, argv-form process execution, path canonicalisation
plus an allow-list — is the cheaper *and* stronger control: it closes the injection class outright and
is usually free where the language's standard library already supports it. A schema or type at the
boundary (a request DTO) is worth adding too, for the malformed-shape defects it catches, but it is
defence in depth for injection, not the control that closes it — a validated string concatenated into
a query is still attacker-controlled input at the sink.

**Evidence class.** `review` for placement; `deterministic` where a real scanner exists, e.g. a
`semgrep` rule that flags a query, template, or shell call built by concatenating or interpolating an
untrusted value, rather than a rule that only checks for a missing schema.

**Reopen when** a new input surface is added, an injection-class defect is found, or a boundary that
used to be internal becomes reachable externally.

### Credential verification and storage

**Open when** the system itself verifies a credential it holds — a user's password, a bearer token,
an API key presented by a caller — rather than delegating verification to an identity provider it
trusts. The actor is whoever obtains the verifier at rest: a database dump, a backup, a log line the
verification code accidentally wrote.

**Closed when** the system never verifies a credential itself — every caller is authenticated by a
layer in front (see `Boundary authentication`) that forwards a verified identity, and this system
holds no password hash and no token-signing key of its own.

**Cost.** A verifier that is deliberately slow to compute (argon2id, scrypt, or bcrypt with a
per-user salt) costs CPU on every login and needs a migration path when the algorithm's cost
parameter is raised; token verification needs the signing algorithm and the expected audience pinned
in code, not read from the token itself.

**Cheaper first.** None cheaper once the system verifies the credential itself — a fast digest or
reversible encryption is not a cheaper version of this control, it is a different, weaker control
that fails the moment the verifier is read. The only cheaper option is not verifying the credential at
all: delegate to an identity provider (`Boundary authentication`) instead.

**Evidence class.** `review` — a person reads the verification code and confirms the algorithm, that
the salt is per-user, and, for a token, that the signing algorithm and audience are pinned rather
than read from the token's own header. `deterministic` only where a `semgrep` rule forbids a fast
digest (MD5, SHA-256 alone) or reversible encryption on a field the schema marks as a password or
token secret.

**Reopen when** a new credential type is verified, an algorithm's cost parameter has not been raised
in longer than the team's own rotation policy, or an incident traces to a cracked or forged verifier.

## Step 4 — Data protection gates
*What happens to an asset once it is captured, moved, or stored?* Classification (the first gate)
determines how much weight the rest of this step's gates carry — do it first even when it feels like
paperwork.

### Data classification

**Open when** the asset list contains more than one kind of data and they do not all deserve the same
handling — regulated personal data next to public marketing copy, payment data next to log lines.

**Closed when** everything the system holds is already public, or already subject to one uniform
handling policy with no finer distinction to draw — closing here is what lets every later gate in
Step 4 skip a repeated classification argument.

**Cost.** A taxonomy to maintain, and a tagging or tracking mechanism (a field, a schema annotation, a
data-flow diagram) that goes stale unless something keeps it honest.

**Cheaper first.** A short, named list of classes tied directly to the consequences that matter here
(regulatory, contractual, reputational) is cheaper than adopting a generic enterprise classification
scheme wholesale.

**Evidence class.** `narrative` almost always — classification is a stated fact about the data, not
something a scanner confirms. It only becomes `review` where a specific field's classification is
disputed and someone must confirm it against the schema.

**Reopen when** a new data type enters the system, a regulation newly covers a field already stored,
or two classes get merged into handling that should have stayed separate.

### Encryption in transit

**Open when** a boundary you listed carries an asset across a network segment an actor on your list
can observe — the internet, a shared cloud network, a link between data centers you do not fully
control.

**Closed when** the link never leaves a boundary no listed actor can reach — loopback, a single host,
or a platform-guaranteed private link already encrypted below your application. **Name the specific
guarantee and its stated conditions** rather than "many cloud VPC backbones" — provider link
encryption is conditional, not general (e.g. AWS's applies only between specific Nitro-based instance
types under stated region/peering conditions; Azure's depends on SKU and region). Confirm the
condition actually holds for this link before closing on it. Platform link encryption also closes
only the *passive observer* actor — it gives the caller no proof of who it is talking to. If the
actor list includes a compromised or impersonating workload on the same network (see Step 2), that
actor defeats plaintext HTTP on an "encrypted backbone" completely, because the gate never checked who
answered. A boundary with that actor on its list needs TLS with a verified server identity regardless
of what the platform encrypts below it.

**Cost.** Certificate issuance and renewal, and an operational failure mode (an expired certificate
taking down the link) that did not exist before.

**Cheaper first.** Terminating TLS at a managed load balancer or gateway the platform already
operates is cheaper than certificate management inside every service.

**Evidence class.** `review` to confirm every listed boundary is covered; `deterministic` where a
config scanner checks for TLS enforcement, e.g. a load-balancer or ingress policy linted for a
plaintext listener.

**Reopen when** a new boundary is added, a link is found carrying plaintext that was assumed
encrypted, or a certificate expiry causes an outage.

### Encryption at rest

**Open when** the asset is a class of data whose disclosure has a named consequence — regulated
personal data, payment credentials, health records, a signing key or a token the system must be able
to read back — **and** the storage medium is reachable by an actor you listed who cannot reach the
application. A stolen backup, a mis-scoped bucket, a decommissioned disk, a cloud snapshot shared to
the wrong account. This does **not** cover a password or token *verifier* the system only ever
compares against, never reads back — see `Credential verification and storage`: encrypting a
verifier is the wrong control, because a one-way verifier must never be reversible in the first
place.

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

### Data minimisation and retention

**Open when** the asset list contains data collected for one purpose that outlives that purpose, or
fields nobody reads that were captured "in case" — the classic driver of breach impact, since data
that was never kept cannot be stolen.

**Closed when** every field stored is in active use and already has a retention period matching its
purpose — nothing to minimise.

**Cost.** A deletion job to build and trust, and a real risk of deleting something a later feature or
an auditor needed — retention has to be a decision, not an accident.

**Cheaper first.** Not collecting the field at all is cheaper than collecting, classifying, and later
deleting it — ask this before any encryption or access-control spend on a field.

**Evidence class.** `narrative` by default (a stated policy); `deterministic` only where a scheduled
job's deletion is itself checked by a test, which is a `test-patterns` concern, not this skill's.

**Reopen when** a field's purpose is served and it is still being collected, a regulator names a
retention limit, or storage cost or breach impact draws attention to old data nobody uses.

### Secret management

**Open when** the asset list includes credentials — an API key, a database password, a signing key, a
token — that a human or a service needs to hold, and the actor list includes anyone who can read a
repository, a CI log, or an environment dump who should not be able to use that credential.

**Closed when** the value being handled carries no privilege on its own — a public identifier, a
value already rotated to worthlessness, a local development stub — closing needs no control, only a
note that it is not a secret.

**Cost.** A secrets manager or vault to operate, an issuance and rotation process, and a blast-radius
conversation for every consumer that now depends on that manager being available.

**Cheaper first.** Not storing the secret at all — short-lived tokens issued per-request, a managed
identity the cloud platform grants without a static credential to hold — is cheaper than any
storage-and-rotation scheme.

**Evidence class.** Whether secrets are actually committed is decided by `gitleaks`, not by reading
files. See `references/evidence.md`. If no `gitleaks` config exists in this repository, the rule
stays `narrative` and the output says which tool would raise it.

**Reopen when** a new class of credential enters the system, a secret is found committed, or a
rotation fails silently.

### Audit logging

**Open when** the asset list includes something whose *use* — not just its existence — needs to be
reconstructable after the fact: who read a customer's record, who approved a payout, who changed a
permission. Usually paired with a privileged actor from Step 2 (a support agent, an admin, an
automated actor).

**Closed when** the action has no privilege to abuse — a public read, an idempotent action with no
consequence — logging it is noise, not evidence.

**Cost.** Storage and retention for logs that must themselves be tamper-resistant, and the discipline
to log the actor and the object, not just "an update happened".

**Cheaper first.** Reusing an existing structured-logging or observability pipeline the system
already has is cheaper than a bespoke audit-log subsystem — check what's already emitted before
building a second channel.

**Evidence class.** `review` — confirming a privileged action is actually logged, with actor and
object, is a design read. Rarely `deterministic`; a log line existing is not the same claim as a log
line being correct.

**Reopen when** a new privileged action is added, an incident cannot be reconstructed from the logs
that exist, or a regulation names an audit requirement.

## Step 5 — Supply-chain gates
*What are you trusting when you install, build, and release?* These three gates are almost always
open in some form — a package manager and a CI pipeline are the norm — the decision is how much
control each one buys, not whether to look.

### Dependency provenance

**Open when** the asset list includes the build pipeline or the artifacts it produces, and the actor
list includes a dependency maintainer or a compromised upstream package — i.e., essentially always,
once a package manager is in use.

**Closed when** the system has no third-party dependencies at all, or every dependency is vendored
and reviewed in-house — rare, and worth saying explicitly when it is genuinely true.

**Cost.** A lockfile discipline to maintain, and friction on every upgrade if provenance checks are
strict — the cost is paid continuously, not once.

**Cheaper first.** A lockfile with pinned, hashed versions is the cheap first layer; a full
software-bill-of-materials or a signing requirement is the expensive next one and is not the default.

**Evidence class.** `deterministic` where a real tool is bound — see `references/evidence.md` for
whether a supply-chain scanner is configured in this repository. Otherwise `narrative`, and the
output names which tool would provide it. Note: this gate is about **provenance** — is the thing
you're installing what it claims to be — not about known-vulnerability advisories, which are a
separate, faster-moving concern.

**Reopen when** a new dependency source (a private registry, a vendored fork) enters the pipeline, or
an incident traces to a tampered or typo-squatted package.

### Build and release integrity

**Open when** the asset list includes the ability to produce and ship an artifact, and the actor list
includes a contributor with repository write, a compromised CI job, or anyone who can trigger a
release without a second party's review.

**Closed when** release is already gated by a control you'd otherwise duplicate here — required
review before merge, a protected branch, a CI pipeline nobody but CI itself can trigger — say which
control closes it.

**Cost.** A second-party review or approval step on the release path, and signing or provenance
infrastructure if you go further than branch protection.

**Cheaper first.** Branch protection and required review is the cheap first layer and closes most of
this gate; artifact signing and provenance attestation is the expensive next layer, justified only
when the artifact's integrity is itself the asset an outside party relies on.

**Evidence class.** `review` for who can trigger a release and whether review is actually required
(not just configured); `deterministic` where CI configuration itself is linted for a bypassable gate.

**Reopen when** the release path changes (a new CI job, a new deployment target), or an incident
traces to an unreviewed change reaching production.

### Third-party service trust

**Open when** the asset list crosses a boundary into a service you do not operate — a payment
processor, an LLM API, an analytics vendor, an identity provider — and that service can see, store,
or act on an asset you listed.

**Closed when** the third party never receives the asset at all — data is scoped, redacted, or
tokenised before the call — closing here is often cheaper than vetting the vendor.

**Cost.** A vendor's security posture becomes your risk without your control over it; a contract or a
due-diligence review to obtain and re-check periodically.

**Cheaper first.** Sending the third party the minimum it needs (a token instead of a card number, a
hashed identifier instead of a name) is cheaper than any amount of vendor due diligence on the full
asset.

**Evidence class.** `narrative` almost always — a vendor's own attestations are read, not run.
`review` when a specific data flow to the vendor is being confirmed against what was actually sent.

**Reopen when** a new third-party integration is added, the vendor's terms or subprocessors change,
or an incident traces to data sent further than intended.

## Step 6 — Agent-agency overlay

If the actor list from Step 2 includes an agent, an automated actor, or a tool-calling loop —
anything that decides its own next action rather than following a fixed code path — stop here and
read `references/agent-agency.md`. Walk its six gates before continuing to Step 7; they cover
permission scoping, blast radius, human approval, untrusted content, credential scope, and audit
trail for that agent specifically, and none of them are covered by Steps 3–5.

If no such actor exists, skip this step entirely and say so plainly in the output — "no agency
surface" is a complete answer, not a gap in the interview. Do not walk `agent-agency.md` for an
ordinary service just because it happens to call an LLM API in a fixed, non-agentic way; that
boundary is already covered by `Third-party service trust` above.

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

## Step 8 — Existing-system review branch

Inspect, in this order:

1. Authentication middleware and its bypasses.
2. Every route's authorization decision and where it is made.
3. How tenant identity is derived.
4. Secret handling and the presence of a secret-scanner config.
5. What crosses each boundary and what it trusts.
6. The dependency manifest and lockfile — *for provenance, not for advisories.*
7. CI configuration and who can trigger a release.
8. Audit-log coverage of privileged actions.
9. If an agent exists, its tool registry and credential scope.

Recommend exactly **one** primary highest-leverage move. Secondary observations are allowed as a
short ordered list. **"This design is proportionate to its threat model; no change is currently
justified" is a valid and complete conclusion** — say it plainly and keep the report short.
Inventing findings to look thorough is itself a failure mode, and in security it is the expensive
one, because someone buys the control.
