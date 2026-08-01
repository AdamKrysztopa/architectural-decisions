# Example — `arch-crew:test-patterns`, greenfield: an invoicing service

The interesting move here is *where the evidence lands*. An invoicing service has money in it, so the
instinct is a large browser suite "because it's critical". Criticality is a reason to get the evidence
right, not a reason to buy it at the most expensive level available.

## Scenario

A new invoicing service. Domain calculations (line items, discounts, multi-jurisdiction tax,
rounding, totals), PostgreSQL persistence with migrations, an external payment provider behind an
HTTP API, and a Kafka topic that publishes `InvoiceIssued` for a downstream ledger owned by another
team. Two journeys the business names without hesitation: *issue an invoice and collect payment*, and
*a payment webhook reconciles an outstanding invoice*. One team, one deployable, weekly releases,
rollback is a redeploy.

## User prompt

> "New invoicing service — FastAPI, PostgreSQL, Stripe, and it publishes to Kafka for the ledger
> team. Tax calculation is genuinely fiddly. What should we test?"

## Repository observations

- `domain/` holds pure calculation code: `LineItem`, `TaxRule`, `Money` with explicit rounding —
  no I/O, high branching, the densest logic in the repo.
- `adapters/db/` uses SQLAlchemy with Alembic migrations, several hand-written queries, and a
  `NUMERIC(12,4)` money column — a type-coercion seam.
- `adapters/payments/` wraps the provider SDK; a documented fallback marks an invoice
  `payment_pending` when the provider times out.
- `events/` publishes an Avro-ish JSON payload to Kafka. The **ledger team deploys independently**
  and consumes that payload.
- No UI in this repository. The customer-facing portal is a separate frontend product.

The last observation does most of the work: there is no browser here to test.

## Composed evidence portfolio

**System context:** money movement, one deployable, one team, weekly releases, rollback by redeploy.
A wrong total is a customer-visible financial error; a duplicate charge is worse.
**Assumptions:** single tenant, no regulatory acceptance obligation stated. Both marked provisional.
**Critical failure surfaces:** wrong tax or total; a payment charged twice or lost between provider
and database; the ledger team broken by a payload change; a migration that works on SQLite and fails
on PostgreSQL numerics.

| Risk or claim | Selected evidence | Why it belongs | Cost accepted | Evidence deliberately omitted | Reopen when |
|---|---|---|---|---|---|
| Wrong tax, discount, rounding, or total | Unit tests over `domain/`, example-based per jurisdiction rule | Highest branching density in the repo, no environment needed | Milliseconds; cases to maintain per rule change | Browser coverage of the same rules | A new jurisdiction or discount type lands |
| Money arithmetic loses or invents value | Property-based tests: line items sum to the total, rounding is conservative, invoice totals are invariant under line reordering | A real invariant exists, so the oracle is independent of the code | Slower runs; shrink-report triage | A reference implementation to diff against | An invariant is found not to hold |
| Query, migration, or `NUMERIC` coercion fails only on the real engine | Narrow integration tests against ephemeral PostgreSQL (one boundary) | A mocked driver verifies the mock; coercion and migrations are engine-specific | Container startup in CI (~seconds) | An in-memory database substitution | Container startup starts gating the loop |
| Payment charged twice or lost mid-flight | Unit tests on the idempotency key and state machine + narrow integration test against a provider stub server | The logic is local; the wire behavior is one boundary | A stub server to own | A sandbox account in the fast pipeline | The provider changes its idempotency semantics |
| The documented `payment_pending` fallback never actually runs | Resilience: unit test on the timeout/fallback branch + narrow integration with the provider refused and slowed | A stated guarantee with no test is a claim nobody checked | Fault-injection seam in the client | Chaos exercises against real infrastructure | An incident traces to an unexercised failure path |
| The ledger team breaks on a payload change | Consumer-driven contract on the `InvoiceIssued` schema, verified in both pipelines | Producer and consumer **can be released independently** — the gate opens | A shared pact artifact and cross-pipeline discipline | Broad E2E across both services | The ledger team merges into this deployable |
| Someone reads or voids another tenant's invoice | Negative authorization cases at the API boundary against the real middleware | A positive-path suite proves the feature works, not that it is protected | Roughly doubles cases at the auth seam | A penetration test | Multi-tenancy, external users, or a public API appears |
| Issue → pay → mark paid fails only when fully wired | **Two** E2E journey tests: issue-and-collect, and webhook reconciliation | Both halves named: a concrete journey *and* a wiring failure (config, routing, provider credentials, topic naming) no narrower test exposes | Environment ownership, test data, the slowest feedback in the suite | Per-screen or per-endpoint browser coverage | A third critical journey appears |

**Deterministic tests vs stochastic evaluations:** not applicable — nothing here is stochastic.

**Generated-test oracle assessment:** the tax rules come from a published rate table and the finance
team's worked examples. Those are the oracle; expected values must be taken from them, never from
running the calculator. Any AI-assisted test over `domain/` must cite the rule or the worked example
it encodes.

**Primary recommendation:** put the weight on `domain/` units plus one real-PostgreSQL integration
seam, and buy exactly two E2E journeys — not a browser suite.

**Consequences and trade-offs:** CI stays under a few minutes; the two E2E tests are the only tests
needing an owned environment, and they will be the first to go flaky. Nothing here covers the
customer portal — that product owns its own evidence.

**The smallest-portfolio check:** the only expensive rows are two journey tests and one container.
Every other row runs in the ordinary suite.

## Deliberately omitted evidence

- **A large browser suite.** There is no browser in this repository. "It handles money" justifies
  correct evidence, not expensive evidence.
- **Broad multi-component integration.** Every failure named above reproduces at one boundary.
- **A contract test on the payment provider.** We do not own their pipeline; a contract needs both
  sides to verify it. A stub server plus their published API docs is the honest substitute.
- **Load testing.** No latency, throughput, or capacity number has been named. Production percentiles
  will answer "is it fast enough?" more cheaply.
- **Mutation testing.** The suite does not exist yet. Ask the mutation question while writing the tax
  tests; buy the tool only if a defect later escapes a green `domain/`.
- **A separate QA phase or independent sign-off.** No regulator, no contractual acceptance, rollback
  is a redeploy.

## Reopening signals

A regulator or audit obligation enters scope → independent assurance and traceability. A second team
starts producing invoices → more contracts. A latency SLO is agreed → integration-scoped load
testing. The portal starts being tested from this repository → a journey-weighted rethink.

## Generated ADR (excerpt)

```markdown
# 0004. Risk-led evidence portfolio for invoice processing

- Status: Accepted
- Date: 2026-08-01
- Deciders: invoicing team

## Context

Invoicing moves money: multi-jurisdiction tax calculation, PostgreSQL persistence with migrations, an
external payment provider, and an `InvoiceIssued` topic consumed by the independently deployed ledger
service. One team, weekly releases, rollback by redeploy. There is no UI in this repository.

## Decision

| Included evidence | Risk addressed | Cost accepted | Deliberately skipped | Reopen when |
|---|---|---|---|---|
| Domain unit + property tests | Incorrect tax, rounding, and totals | Test maintenance per rule change | Browser variants of the same rules | Domain workflow or jurisdiction changes |
| PostgreSQL integration at the persistence seam | Query, migration, and numeric-coercion incompatibility | Container startup | In-memory database substitution | — |
| Provider stub + idempotency and fallback tests | Double charge, lost payment, untested degraded mode | A stub server to own | Sandbox calls in the fast pipeline | Provider idempotency semantics change |
| `InvoiceIssued` consumer contract | External schema drift breaking the ledger team | Contract ownership in both pipelines | Provider-owned E2E across services | The ledger merges into this deployable |
| Negative authorization cases | Cross-tenant read or void | Roughly double the cases at the auth seam | Penetration test | Multi-tenancy or a public API appears |
| Two E2E journeys | Deployment, routing, and complete payment flow | Environment ownership | Per-screen browser coverage | New critical journeys appear |

## Consequences

CI stays in the low minutes. The two E2E journeys are the only evidence requiring an owned
environment and are the expected source of flakiness; they are owned by the team, not delegated.
Expected values for tax tests come from the published rate table and finance's worked examples —
never from running the calculator — because an implementation-derived oracle would promote a rounding
bug to a specification. Deferred: load testing until a number is named, independent assurance until
an obligation exists, mutation testing until a defect escapes a green domain suite.
```
