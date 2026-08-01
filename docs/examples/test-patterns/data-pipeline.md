# Example — `arch-crew:test-patterns`, greenfield: an analytical data pipeline

The failure mode this example exists to prevent is **one bucket labelled "pipeline tests"**. Code
tests, schema and contract checks, data-quality evidence, and production monitoring fail differently,
cost differently, and are owned by different people. Merging them produces a suite that is
simultaneously noisy and blind.

## Scenario

A nightly Airflow pipeline. It ingests three upstream sources — an event stream owned by the
platform team, a CRM export owned by an external SaaS vendor, and a currency-rate feed — joins and
aggregates them into a `daily_revenue` table in the warehouse, which feeds a finance dashboard and a
downstream churn model. Late-arriving events are normal. Backfills happen after every upstream
incident.

## User prompt

> "Nightly Airflow job, three sources, writes `daily_revenue` for the finance dashboard. What do we
> test? The team keeps saying 'we should add dbt tests' and I don't know if that's the whole answer."

## Repository observations

- `transforms/` is pure Python over DataFrames: currency normalization, a sessionization window, a
  revenue-recognition rule with a 30-day boundary. No I/O — testable directly.
- `dags/daily_revenue.py` has a `catchup=True` window and a task that reads `{{ ds }}` — replay is a
  first-class operation, so **idempotency is a real risk**, not a theoretical one.
- The CRM export is a vendor CSV drop. Its schema has changed twice this year, discovered both times
  by a broken dashboard.
- `daily_revenue` is consumed by finance (a person looks at it daily) **and** by the churn model
  (nothing looks at it).
- No tests exist. There is a `great_expectations/` directory containing 400 auto-generated
  expectations from a profiling run; nobody has ever triaged an alert from it.

That last observation is the pipeline analogue of coverage theatre: generated expectations nobody
reviewed, with no named consumer and no action on failure.

## Composed evidence portfolio

**System context:** nightly batch, replayable, feeding one human-reviewed dashboard and one automated
consumer. A bad load is discovered by finance today; the churn model would never notice.
**Assumptions:** no regulatory obligation on the revenue figure. Provisional.
**Critical failure surfaces:** a wrong revenue-recognition boundary; a rerun that double-counts; the
vendor changing the CRM schema again; late events silently excluded; a partial run publishing an
incomplete day.

| Risk or claim | Selected evidence | Why it belongs | Cost accepted | Evidence deliberately omitted | Reopen when |
|---|---|---|---|---|---|
| Revenue-recognition boundary is wrong | **Code test** — unit tests over `transforms/` with small fixtures, including the 30-day boundary on both sides | Densest logic; runs in milliseconds; the rule is documented, so the oracle is independent | Fixture curation | A full pipeline run to check the same rule | The recognition rule changes |
| A rerun double-counts, or a backfill diverges from the original run | **Code test** — idempotency test: run the transform twice over the same window, assert identical output; plus a late-arriving and duplicate-record fixture | `catchup=True` makes replay routine; this is deterministic on small fixtures | A second fixture set | Chaos-style orchestration testing | Replay semantics change |
| Currency normalization silently drops unmatched rates | **Code test** — parameterized cases including a missing rate and a stale rate | A named failure with a cheap home | — | — | A new currency or rate source appears |
| The vendor changes the CRM schema again | **Data contract** — negotiated schema + version, enforced at the ingest step, with the vendor notified on breach | Producer is a **different organization**, and it has broken us twice. Both halves of the gate are satisfied | Negotiation and enforcement in the ingest DAG | A contract with the internal platform team's event stream | The internal stream starts breaking us too |
| A structurally valid but wrong `daily_revenue` is published | **Data-quality assertions, build-time** — row count within a historical band, no null `revenue`, `order_id` unique, referential integrity to `dim_customer` — run over the *candidate* table and **failing the build** before publish | Build-cadence assertions over an artifact we are about to publish may legitimately block the deploy | Runtime per run | Publishing first and alerting after | An assertion starts tripping on normal variation |
| Yesterday's good data says nothing about tonight's | **Production monitoring, data-cadence** — freshness, run success and duration, row-count and null-rate drift — routed to the on-call data engineer, **paging a person, not reddening someone's build** | Scheduled pipeline; the churn model would never notice a bad load | Alert ownership | A dashboard with no route to a person | The pipeline becomes one-off |
| Orchestration wiring, partitioning, or task dependencies fail | *Nothing yet* | No such failure has occurred and each piece is deterministic on fixtures | — | **A full pipeline run on sample data** — the pipeline analogue of E2E, with the same costs | A partial run publishes an incomplete day, or a skipped upstream dependency goes unnoticed |

**Deterministic tests vs stochastic evaluations:** the four **code test** rows assert deterministic
behavior of `transforms/` and the DAG's replay semantics. The **data-quality** and **monitoring** rows
evaluate *data*, which is not under our control and varies legitimately — they carry thresholds and
bands, not assertions. Keeping the two apart is what stops a normal seasonal dip from failing a build
and a real transform regression from being triaged as "the data changed".

**Generated-test oracle assessment:** **reject the 400 auto-generated Great Expectations.** They were
profiled from historical data — the artifact is its own oracle, no consumer is named, and no one acts
when they fire. Replace with the six assertions above, each tied to a downstream consequence and a
named owner. *Generated coverage without an independent oracle is coverage theatre, and it holds for
data expectations exactly as it does for unit tests.*

**Primary recommendation:** four concerns, four homes — transform code tests, one data contract with
the vendor, six build-time data-quality assertions, and freshness/volume monitoring on the data's
cadence. Delete the 400 profiled expectations.

**Consequences and trade-offs:** the on-call engineer now owns six alerts and must keep the bands
honest. Nothing here catches an orchestration-level failure; that is an accepted, named gap with a
reopening signal.

**The smallest-portfolio check:** no full-pipeline run, no staging warehouse, no contract with the
internal team. Everything except the vendor contract runs on fixtures or on the warehouse we already
have.

## Deliberately omitted evidence

- **A full pipeline run on sample data.** The E2E analogue: slow, environment-heavy, and it would
  re-prove what the fixtures already prove. Reopened only if orchestration itself becomes the risk.
- **A data contract with the internal platform team.** Same company, and their stream has never
  broken us. Monitoring covers it; a contract would be ceremony.
- **The 400 profiled expectations.** Deleted, not kept "just in case" — an unowned noisy assertion is
  worse than none.
- **Distribution-shift alerting on every column.** Two columns feed a decision; the rest feed a chart
  a human reads.

## Reopening signals

A partial run publishes an incomplete day → orchestration evidence. The churn model starts driving an
automated action → tighter build-time gating, because human review disappears from the path. The
internal event stream breaks us → a second contract. `daily_revenue` enters financial reporting →
traceability and independent assurance.

## Generated ADR (excerpt)

```markdown
# 0002. Four-concern evidence portfolio for the daily-revenue pipeline

- Status: Accepted
- Date: 2026-08-01
- Deciders: data platform team

## Context

Nightly Airflow pipeline joining an internal event stream, an external vendor CRM export, and a
currency feed into `daily_revenue`, consumed by a human-reviewed finance dashboard and an automated
churn model. `catchup=True`: replay and backfill are routine. The vendor schema has broken us twice.
400 profiled Great Expectations exist and have never been triaged.

## Decision

Four concerns kept separate, each with its own gate and owner:

| Concern | Included evidence | Risk addressed | Cost accepted | Deliberately skipped | Reopen when |
|---|---|---|---|---|---|
| Transformation code | Unit tests incl. recognition boundary, idempotency, late/duplicate records | Wrong logic; double-counted reruns | Fixture curation | Full pipeline run on sample data | Orchestration itself fails |
| Schema ownership | Data contract with the CRM vendor, enforced at ingest | Third-party schema drift | Negotiation + enforcement | A contract with the internal platform team | The internal stream breaks a consumer |
| Data quality | Six build-time assertions over the candidate table, blocking publish | A structurally valid but wrong table reaching finance | Runtime per run | The 400 profiled expectations (deleted) | An assertion trips on normal variation |
| Operations | Freshness, run success, volume and null-rate drift, paged to on-call | A silently missing or stale load | Alert ownership | Per-column distribution alerting | The pipeline becomes one-off |

## Consequences

The profiled expectation set is removed: expectations derived from the data they check have no
independent oracle, name no consumer, and produce alerts nobody actions. Build-cadence assertions
block publication; data-cadence signals page an owner instead of reddening an unrelated build —
blocking a deploy on upstream data punishes whoever happens to be shipping. Orchestration-level
failure is an accepted, named gap.
```
