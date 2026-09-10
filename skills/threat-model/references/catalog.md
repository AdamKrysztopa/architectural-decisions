# Security control catalog — controls, costs, and review cues

Take a control's **force**, its **cost**, and its **review cue** from here, not from your own priors,
so every row of an output carries a real trade-off rather than a name.

A control in this catalog is not a recommendation. It is an option with a price. `decision-tree.md`
decides whether the price is worth paying for a named asset, actor, and impact.

---

## I. Identity and access

### Boundary authentication

**Intent.** Verify the identity of any caller who reaches a boundary from outside the trust
perimeter, before anything downstream trusts what it is told.

**Force.** An unauthenticated boundary trusts whoever can route a request to it. The actor it
defends against needs no credential and no insider access — just a URL.

**Cost.** A credential-issuance and revocation path, session or token lifecycle management, and an
ongoing dependency on whatever verifies the credential (an identity provider, a JWKS endpoint, a
shared secret) staying available and correctly rotated.

**Cheaper alternative.** Network placement — a private subnet, an allow-list, a VPN — closes the
gate for a boundary no listed actor can reach directly. The reopening signal is a new route added
to the same service, or the network perimeter growing to include an actor it used to exclude.

**Review cue.** Grep the route table or gateway config for handlers with no auth middleware
attached, then check each one against whether it is deliberately public or simply missed. Where the
gate closed on a forwarded identity from a layer in front, send a request **directly to the backend**
with a forged identity header (`X-Forwarded-User`, `X-Authenticated-User`, or whatever the layer
sets) and see what happens — if the backend accepts it, the two preconditions in decision-tree.md's
`Boundary authentication` gate are not actually met, whatever the design intended.

**Evidence class.** `review` by default — a person reads the middleware and confirms which routes
are unauthenticated on purpose. `deterministic` when a `semgrep` rule flags a route registered
without the auth decorator.

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

### Token-scoped service identity (mTLS / workload identity)

**Intent.** Give each service its own verifiable identity on a service-to-service call, instead of
trusting the network itself to vouch for the caller.

**Force.** A flat internal network makes every caller equally trusted, which means a single
compromised service can call anything else as itself. The actor this defends against is a
compromised or spoofed caller already inside the perimeter — the actor network segmentation alone
cannot exclude.

**Cost.** Certificate or token issuance and rotation for every service, a registry of which service
may call which, and a new failure mode when the identity provider itself is unavailable.

**Cheaper alternative.** Network segmentation (a private subnet, a security group) closes the gate
for any actor who cannot reach the link at all; buy per-call identity only for the actors
segmentation cannot exclude, or take it for free from a mesh sidecar the platform already runs.

**Review cue.** Pick one internal call at random and ask what stops a different, unrelated service on
the same network from making it. If the answer is "nothing", this control is missing where it is
needed.

**Evidence class.** `review` for which links carry mutual TLS or a signed token; `deterministic`
where the mesh or gateway policy itself is linted for deny-by-default.

### Tenant identity derived from the session

**Intent.** Derive which tenant a request belongs to from something the caller cannot set — the
authenticated session or token — never from a request parameter the caller supplies.

**Force.** A tenant id read from a query string, a body field, or a header is a value the caller
chose. The actor this defends against is an authenticated user of tenant A who edits one field to
read tenant B's data — no exploit required, just a parameter.

**Cost.** Every query, cache key, and background job must carry and check the session-derived tenant
id; a single code path that reads it from the request instead reopens the whole class.

**Cheaper alternative.** None — this is close to free once the session already carries an identity.
The expensive fallback, if the leak keeps recurring, is enforcing the filter at the data layer itself
(row-level security, a scoped connection) so a missed check in application code cannot bypass it.

**Review cue.** Grep for the tenant identifier's variable name everywhere it is read from a request
object — body, query, header, route param — rather than from the session or token.

**Evidence class.** `review` — confirming the source of the tenant id is a code read. `deterministic`
only where a lint rule or a database policy enforces it structurally.

### Schema validation at the boundary

**Intent.** Make the invalid *shape* of a request unrepresentable at the boundary, rather than
trusting every downstream handler to check it. This is defence in depth for the injection class, not
the control that closes it — see `Structural separation of code and data at the sink` for the control
that actually stops a validated-but-attacker-controlled value from being interpreted as syntax.

**Force.** A request whose shape was never checked forces every downstream handler to defend against
malformed input on its own. That is a real defect class, but it is distinct from injection: a field
can have exactly the right shape (a string, the right length, the right character set) and still be
attacker-controlled data that becomes SQL, a template directive, or a shell command the moment it
reaches an unparameterised sink.

**Cost.** A validation layer (a schema, a typed DTO) to keep in sync with the contract as it
evolves, and a decision about failure behavior — reject, sanitize, or quarantine — at every boundary
that has one.

**Cheaper alternative.** Not cheaper than the sink-side control — `Structural separation of code and
data at the sink` closes the injection class outright and is usually free where the language's
standard library already offers it (a parameterised query API). Schema validation is worth buying
anyway, for the malformed-shape defects it catches that structural separation does not, but it must
never be sold as the injection control on its own.

**Review cue.** Find a handler that reads a field straight off the request body with no schema or
type between it and where it is used — this finds malformed-shape gaps. It does **not** tell you
whether injection is closed; for that, see `Structural separation of code and data at the sink`'s
review cue, which looks at the sink instead of the boundary.

**Evidence class.** `review` for placement; `deterministic` where a real scanner exists, e.g. a
`semgrep` rule that flags a request field reaching a handler with no schema between them.

### Structural separation of code and data at the sink

**Intent.** Make an untrusted value physically unable to be interpreted as syntax at the point it
reaches a parser, a query, a template, a shell, or a filesystem path — so validating the value at the
boundary is defence in depth, not the control that closes the injection class.

**Force.** A schema at the boundary proves the value has the right shape; it does not prove the value
is safe once it is concatenated into a query, a template, or a shell string downstream. A validated
string is still attacker-controlled data — the actor who supplied it controls every character that
reaches the sink, whatever checked it on the way in.

**Cost.** Parameterised or prepared queries, an auto-escaping template engine used correctly, argv-form
process execution (never building a shell string), and path canonicalisation plus an allow-list all
cost a rewrite of the call sites that currently concatenate, plus the discipline to keep new call
sites from reintroducing the pattern.

**Cheaper alternative.** None — this is the cheaper-and-stronger option, not the expensive one. It is
usually free where the language or framework's standard library already supports it (a parameterised
query API, an auto-escaping template engine); the expensive direction is boundary validation alone,
which still requires every sink to be individually audited for how it uses the value.

**Review cue.** Find the query, template, or exec call and ask whether the untrusted value crosses it
as *data* or as *syntax* — string concatenation or f-string interpolation into a query or shell
command is the finding, whatever validation happened upstream.

**Evidence class.** `review` for placement; `deterministic` where a `semgrep` rule forbids the
concatenation or interpolation shape at the sink (a query built by string formatting, `shell=True`
with an interpolated string, `exec()` given a joined string) and that rule exists in the repository's
config.

### One-way credential verification

**Intent.** Make a stored credential verifier — a password hash, a token-signing key's public
counterpart — useless to whoever reads it at rest, by construction, rather than protected only by
whoever can reach the storage.

**Force.** A password hashed with a fast digest (MD5, SHA-256 alone) or, worse, reversibly encrypted,
is only as safe as the key or the compute budget of whoever reads the verifier — cracking is a
database dump away, not a network compromise away. This is distinct from `Storage encryption`: that
control protects data the application must read back; a verifier the application only ever *compares
against* must never be reversible in the first place, so encrypting it is the wrong control, not a
weaker version of the right one.

**Cost.** A deliberately slow one-way function (argon2id, scrypt, or bcrypt with a per-user salt)
costs CPU on every login and needs a migration path when the cost parameter is raised; token
verification needs the signing algorithm and audience pinned in code rather than trusted from the
token's own header.

**Cheaper alternative.** None cheaper once the system verifies the credential itself. The actual
cheaper option is not verifying it at all — delegate to an identity provider and forward a verified
identity instead (see `Boundary authentication`).

**Review cue.** Find the code that verifies a password or token and check the algorithm by name —
not by the variable name that claims what it is. `encrypt`, `AES`, or a fast digest on a field the
schema calls a password hash is this control's absence, whatever the field is named.

**Evidence class.** `review` — confirming the algorithm and salt discipline is a code read.
`deterministic` only where a `semgrep` rule forbids a fast digest or reversible encryption on a field
the schema marks as a password or token secret.

---

## II. Data protection

### Data classification

**Intent.** Name the handling tier a piece of data belongs to before deciding anything about
encryption, retention, or access — so the rest of this section has a target to point at instead of
"sensitive" doing all the work.

**Force.** Without a stated class, every later control is negotiated field by field, and the
negotiation loses to shipping deadlines. The actor is nobody in particular — this control defends
against a team forgetting which data was ever meant to be protected.

**Cost.** A taxonomy to maintain, and a tagging or tracking mechanism (a field, a schema annotation)
that goes stale unless something keeps it honest.

**Cheaper alternative.** A short, named list of classes tied directly to real consequences
(regulatory, contractual, reputational) is cheaper than adopting a generic enterprise classification
scheme wholesale.

**Review cue.** Pick a schema at random and ask what class its fields belong to. If nobody can
answer without checking with someone else, classification has not actually happened.

**Evidence class.** `narrative` almost always; `review` only when one field's classification is
disputed and someone confirms it against the schema.

### Transport encryption

**Intent.** Keep an asset unreadable to anyone who can observe the network segment it crosses. TLS
does a second job this control's name obscures: it proves which server answered. A platform's
link-level encryption of the segment closes the first job for the passive-observer actor; it does
nothing for the second — a compromised or impersonating workload on the same segment is unaffected by
"the backbone is encrypted," and only application-level TLS with a verified server identity closes it.

**Force.** A plaintext link across the internet, a shared cloud network, or an inter-datacenter hop
is readable by anyone who can position themselves on the wire — no credential needed, just a
vantage point.

**Cost.** Certificate issuance and renewal, and a new operational failure mode — an expired
certificate taking the link down — that did not exist before.

**Cheaper alternative.** Terminate TLS at a managed load balancer or gateway the platform already
operates, rather than managing certificates inside every service.

**Review cue.** Find a boundary carrying an asset and confirm what layer terminates TLS for it,
rather than assuming "it's probably encrypted somewhere".

**Evidence class.** `review` to confirm every listed boundary is covered; `deterministic` where a
config scanner checks for a plaintext listener.

### Storage encryption

**Intent.** Keep a stolen or mis-scoped copy of stored data unreadable to whoever obtained it, when
that actor cannot also reach the running application.

**Force.** A stolen backup, a mis-scoped bucket, a decommissioned disk, or a cloud snapshot shared to
the wrong account is readable by anyone who copies it, unless the data itself is encrypted
independent of access control.

**Cost.** Key management and rotation, an operational dependency on the KMS, a second way for
recovery to fail, and — for field-level encryption specifically — the loss of querying and indexing
on those fields, which is usually the real bill.

**Cheaper alternative.** Data minimisation — data you did not store needs no key — and tokenisation,
which keeps you out of scope for the field entirely instead of encrypting it.

**Review cue.** For a classified field, ask who can read the storage medium directly without going
through the application, and whether that actor is different from "anyone who already has the
application server."

**Evidence class.** `review` by default; `deterministic` only where a real contract exists, e.g. a
`semgrep` rule forbidding a plaintext column type on a classified model.

### Tokenisation

**Intent.** Replace a sensitive value with a reference that is useless outside the system that
issued it, so the value itself never has to be stored, encrypted, or shipped to a third party.

**Force.** Any control bought to protect a value costs nothing to bypass if the value did not need
to exist in your system at all. A tokenisation service put between you and the raw value removes the
value from every downstream actor's reach, including your own developers.

**Cost.** A tokenisation provider or service to operate or buy, and a detokenisation path that
becomes a privileged operation of its own and needs the same scrutiny as the value it stands in for.

**Cheaper alternative.** Field minimisation — not collecting the value — is cheaper still, when the
raw value is never actually needed downstream.

**Review cue.** Find a field holding a card number, a national id, or an equivalent high-value
credential, and check whether the raw value or a reference is what is actually stored and passed
around.

**Evidence class.** `narrative` or `review` — this is a design choice a person confirms, not
something a scanner grades.

### Field minimisation and retention

**Intent.** Stop collecting, or keep data only as long as, its stated purpose requires — on the
premise that data never kept cannot be stolen.

**Force.** A field captured "in case" and never read is a liability with no offsetting benefit — the
actor here again is nobody in particular; it is breach impact multiplying for free.

**Cost.** A deletion job to build and trust, and a real risk of deleting something a later feature or
an auditor needed — retention has to be a decision, not an accident.

**Cheaper alternative.** None cheaper — not collecting the field in the first place is the cheapest
form of this control there is, and should be asked before any encryption or access-control spend on
a field.

**Review cue.** Pick a table or schema and ask, field by field, who reads it and how long it needs to
live. A field nobody can answer for is a minimisation candidate.

**Evidence class.** `narrative` by default (a stated policy); `deterministic` only where a scheduled
deletion job is itself checked by a test — a `test-patterns` concern, not this skill's.

### Privileged-action audit log

**Intent.** Make the use of a privileged action reconstructable after the fact — who read a record,
who approved a payout, who changed a permission — not just that the system holds the data.

**Force.** Without a record of use, a privileged actor's abuse of legitimate access is
indistinguishable from ordinary operation until the damage is already visible elsewhere.

**Cost.** Storage and retention for logs that must themselves be tamper-resistant, and the
discipline to log the actor and the object, not just "an update happened".

**Cheaper alternative.** Extend an existing structured-logging or observability pipeline the system
already runs, rather than building a bespoke audit-log subsystem.

**Review cue.** Pick a privileged action (an admin edit, a payout approval) and try to answer "who
did this and when" from the logs alone. If you cannot, the log does not exist yet, regardless of
what else is written.

**Evidence class.** `review` — confirming a privileged action is actually logged, with actor and
object, is a design read. Rarely `deterministic`; a log line existing is not the same claim as a log
line being correct.

---

## III. Secrets

### External secret store

**Intent.** Hold credentials in a system built to issue, rotate, and audit them, rather than in a
file, an environment variable, or a config map that travels with the code.

**Force.** A secret in an environment variable is a secret in every place that variable is read — a
container image, a CI log, a crash dump, a debugging session. The actor is anyone who can read any
of those, which is usually a much longer list than "anyone with production access."

**Cost.** A secrets manager or vault to operate, an issuance process for every consumer, and a
blast-radius conversation for every service that now depends on that manager being available.

**Cheaper alternative.** Not storing the secret at all — a short-lived, per-request credential or a
managed identity the platform grants without a static value to hold — is cheaper than any
storage-and-rotation scheme, and is worth asking before adopting a vault.

**Review cue.** Read *structure*, not values: check where each credential is set — a vault or
secret-manager reference, versus a plain environment variable baked into a deployment manifest, a
committed compose file, or a CI config — and whether a secret-manager reference exists at all for it.
Whether a credential is actually present in the tree or history belongs to `gitleaks`, never to
reading files by eye; report the structural gap (no vault reference exists) as the finding, not a
claim about what value is or isn't committed.

**Evidence class.** Whether a secret is actually committed is decided by `gitleaks`, not by reading
files — see `references/evidence.md`.

### Short-lived credentials

**Intent.** Issue a credential scoped to the lifetime of the task it serves, so a leaked credential
expires before it is useful to whoever finds it.

**Force.** A long-lived credential that leaks is valid for as long as nobody notices — which, for a
credential nobody is watching, can be indefinitely. The actor this defends against is exactly the
one External secret store cannot: someone who already has the value.

**Cost.** An issuance path (a token endpoint, a workload-identity exchange) that must be available
for every task that needs a credential, and a shorter window for legitimate work to retry against
before expiry.

**Cheaper alternative.** None, once issuance already exists — short expiry is close to free to
configure. The real cost is building the issuance path in the first place, which External secret
store usually already pays for.

**Review cue.** Find a credential in use and ask its lifetime. A static API key with no expiry, used
by a long-running service, is this control's absence.

**Evidence class.** `review` — a person confirms the token lifetime in the issuing configuration.

### Secret scanning in CI

**Intent.** Catch a credential before it lands in the tree or the commit history, using a tool built
to recognise credential shapes, not a person skimming a diff.

**Force.** A secret committed once is a secret in history forever unless the history itself is
rewritten — a far more disruptive fix than catching it at the pull request.

**Cost.** A scanning step in CI, and false-positive triage as the tool learns the codebase's actual
patterns.

**Cheaper alternative.** None — this is close to the cheapest control in the whole catalog for the
class of defect it prevents, and should be treated as close to unconditional.

**Review cue.** Check the CI pipeline configuration for a scanning step, and check that the step
actually fails the build rather than only reporting.

**Evidence class.** `deterministic` when `gitleaks` is configured in this repository — see
`references/evidence.md` for the binding. Otherwise `narrative`, and the output says which tool
would provide it.

### Rotation on exposure

**Intent.** Treat a credential's exposure — a committed secret, a leaked log, a departing employee
with access — as an event with a mandatory response, not just a finding to note.

**Force.** A secret that is known to be exposed and not rotated is a secret that is not actually
secret anymore, no matter what the access-control layer around it claims.

**Cost.** An operational runbook that must actually be run under pressure, and every consumer of that
credential needing a coordinated update so rotation does not break the system it was protecting.

**Cheaper alternative.** Short-lived credentials make most exposure self-healing — the leaked value
expires before rotation would have finished anyway. That is not a substitute for having a runbook
for the credentials that are still long-lived.

**Review cue.** Ask what happens, concretely, the next time `gitleaks` (or a person) finds a secret
in a commit. If the answer is "we'd revoke it", ask who does that and how fast — an answer that names
no owner is this control's absence.

**Evidence class.** `narrative` — this is a process commitment a scanner cannot grade; a scanner can
only report the exposure that should trigger it.

---

## IV. Supply chain

### Lockfile with pinned versions

**Intent.** Make the build reproducible from a known-good set of dependency versions, rather than
resolving to whatever the registry serves at build time.

**Force.** An unpinned or range-pinned dependency lets a compromised or typo-squatted release reach
your build the moment it is published, with no review step in between.

**Cost.** A lockfile to maintain, and friction on every upgrade — a deliberate bump-and-review step
instead of drifting forward silently.

**Cheaper alternative.** None cheaper — this is the first layer, not an upgrade from something else.
A full software-bill-of-materials or a signing requirement is the expensive next layer and is not
the default.

**Review cue.** Check whether the lockfile is committed and whether CI installs from it
(`--frozen-lockfile` or equivalent) rather than re-resolving.

**Evidence class.** `deterministic` where a real supply-chain scanner is bound in this repository —
see `references/evidence.md`. No such tool ships bound in this package; the rule stays `review` (is
the lockfile committed and enforced) or `narrative` (is a vulnerability scanner run at all) until one
is configured.

### Reproducible or attested build

**Intent.** Make it possible to prove that the artifact running in production was actually built
from the source it claims to be built from.

**Force.** Without this, a compromised build step can ship an artifact that matches no reviewed
commit, and nothing downstream would notice.

**Cost.** Build-pipeline changes (hermetic builds, provenance attestation) and infrastructure most
teams do not already have; a genuinely expensive control.

**Cheaper alternative.** Branch protection and required review on the source (Restricted release
trigger) closes most of the risk this control is the expensive answer to — reach for attestation
only when the artifact's integrity is itself the asset an outside party relies on, e.g. a package
other teams or customers install.

**Review cue.** Ask whether anyone could produce a different artifact from the same commit and have
it pass whatever verification exists. If yes, there is no attestation yet, whatever the pipeline is
named.

**Evidence class.** `narrative` almost always; this is rarely bound to a tool this package can check
for.

### Restricted release trigger

**Intent.** Ensure that shipping an artifact requires a second party's review, not just one
contributor's decision.

**Force.** A release pipeline any single contributor with repository write can trigger unreviewed is
a single compromised or careless account away from shipping anything.

**Cost.** A second-party review or approval step on the release path — latency on every release,
paid continuously.

**Cheaper alternative.** None cheaper for the risk it closes; branch protection and required review
is already the cheap layer, not an upgrade from something cheaper still.

**Review cue.** Check the branch-protection and CI-trigger configuration for who can merge to the
release branch and who can trigger the deploy job, not just who the documentation says is supposed
to.

**Evidence class.** `review` for whether review is actually required, not just configured;
`deterministic` where CI configuration itself is linted for a bypassable gate.

### Third-party service data-sharing review

**Intent.** Confirm, per vendor, exactly which assets actually cross the boundary into a service you
do not operate — before trusting the vendor's own security posture with them.

**Force.** A vendor integration added for one purpose tends to accumulate scope — more fields sent
than the original feature needed — because nobody re-checks the payload after the first integration.

**Cost.** A vendor security review or due-diligence process to obtain and re-check periodically, and
the friction of asking "does this really need to go to them" on every new field.

**Cheaper alternative.** Send the vendor the minimum it needs — a token instead of a card number, a
hashed identifier instead of a name — which is cheaper than any amount of vendor due diligence on
the full asset.

**Review cue.** For one third-party integration, read the actual request payload sent, not the
integration's documentation, and compare it against what the feature needs.

**Evidence class.** `narrative` almost always — a vendor's own attestations are read, not run.
`review` when a specific data flow to the vendor is being confirmed against what was actually sent.

---

## V. Boundary and network posture

### Untrusted-by-default internal network

**Intent.** Treat every internal call as requiring its own authentication and authorization, rather
than trusting a caller because it is "on the internal network".

**Force.** A flat internal network, where reaching a service is treated as proof of legitimacy, turns
one compromised service, one misconfigured firewall rule, or one contractor's laptop into access to
everything else on the segment.

**Cost.** Every internal service needs its own identity check (see Token-scoped service identity),
which is real engineering effort spread across the whole internal call graph, not a single perimeter
control.

**Cheaper alternative.** For a small, single-team system with a genuinely closed network and no
plausible lateral-movement actor, a trusted internal network is a proportionate, cheaper default —
the reopening signal is the network growing a second team, a contractor, or a partner connection.

**Review cue.** Pick an internal service and ask what stops a request that reached the network — by
any means — from being treated as legitimate by that service.

**Evidence class.** `review` — confirming whether internal calls check identity is a design read
across the call graph, not a single scanner-checkable fact.

### Egress restriction

**Intent.** Limit which external destinations a service is allowed to reach, so a compromised
process cannot freely exfiltrate data or call out to an attacker-controlled endpoint.

**Force.** Unrestricted egress means a successful compromise of any one service is also a successful
data-exfiltration channel, for free, regardless of how well that service's inbound side was
defended.

**Cost.** An allow-list to build and maintain as legitimate integrations change, and the operational
pain of a blocked, legitimate call that nobody added to the list yet.

**Cheaper alternative.** None cheaper for the risk it closes on a system that already has a
segmented network to enforce it on; for a system with no network segmentation at all, this control is
not reachable until that exists.

**Review cue.** Ask what a compromised process inside the network could reach outbound, and whether
that list is enforced by policy or just by the absence of anyone trying.

**Evidence class.** `review` — confirming an egress policy exists and matches actual integrations is
a design and config read; `deterministic` where the firewall or security-group config itself is
linted.

### Defence in depth at a boundary

**Intent.** Keep a second, independent control at a boundary even after the primary one is in place,
so one control's failure does not become the whole system's failure.

**Force.** A boundary with exactly one control degrades silently — the control can fail, be
misconfigured, or be bypassed by a new caller path, and nothing else notices until an incident does.

**Cost.** The second control has its own maintenance burden, and a genuine risk: two controls that
both assume the other is doing the real work, so neither actually does.

**Cheaper alternative.** This is itself the more expensive, second-layer option — the cheaper
alternative is a single well-maintained control with a clear owner, which is proportionate for a
low-blast-radius boundary. Reserve defence in depth for boundaries whose failure is the expensive
kind.

**Review cue.** For a critical boundary, name its primary control, then ask what the second,
independent control is. "Nothing" at a boundary whose failure is expensive is the finding; "nothing"
everywhere else is often fine.

**Evidence class.** `review` — this is a design property about how many independent controls exist,
not something one scanner grades.

---

## VI. Review anti-patterns

Use as a lens in Mode B, not a form to fill. Each: what it looks like → what to check.

- **Edge-only authorization with a second caller path** — a check lives only at the API gateway or
  edge, and a second path (a queue consumer, an internal admin tool, a batch job) reaches the same
  resource without passing through it. → Grep for callers of the service function that never went
  through the route; each one is a silent bypass.
- **A secret in an environment variable that is also in the image** — a credential is "moved" to an
  environment variable but is also baked into a container image or a committed compose file, so
  anyone who can pull the image already has it. → Check where the environment variable is actually
  set, not just that the code reads it.
- **The tenant id taken from a request parameter** — the tenant boundary is enforced by a value the
  caller supplies, not the session. → See Tenant identity derived from the session; grep for the
  tenant field read from the request body, query, or header.
- **The internal service that trusts the network** — a service treats "reachable on this network" as
  proof of legitimacy and skips its own identity check. → See Untrusted-by-default internal network.
- **The shared service account used by four systems** — one credential authenticates several
  unrelated systems, so revoking or auditing one means touching all four. → Ask which system
  actually needs this account's privilege, and split it.
- **The token that outlives the task** — a credential issued for one job keeps working long after the
  job that needed it has finished. → See Short-lived credentials; check the issued expiry against
  the task's actual duration.
- **The `latest` tag on a build dependency** — a build pulls whatever a moving tag resolves to today,
  so the same commit can produce a different artifact tomorrow. → See Lockfile with pinned versions;
  grep build and container configs for an unpinned tag or version range.
- **The audit log that records reads and not writes** (or the reverse) — half the privileged-action
  story is captured, so a reconstruction after an incident has a gap exactly where it is needed. →
  See Privileged-action audit log; pick one privileged action and confirm both halves are logged.
- **The agent whose tool list grew and never shrank** — a tool was added for one task and stayed
  available to every later one, so the agent's blast radius is the union of everything it was ever
  asked to do. → This is `agent-agency.md`'s territory; flag it here and hand off.
- **The meta-anti-pattern: the control that exists because a framework put it there, protecting
  against an actor nobody listed.** → Ask what asset it protects and what actor it defends against.
  If Step 2 never named either, the control is decoration, not a decision — and decoration has a
  maintenance cost like anything else in this catalog.
