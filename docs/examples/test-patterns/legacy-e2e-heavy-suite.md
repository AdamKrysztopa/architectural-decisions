# Example — `arch-crew:test-patterns`, review: a legacy E2E-heavy suite

The temptation in this scenario is a satisfying answer: *delete the flaky tests*. That trades a slow
suite for a fast one that knows less. The move is to **relocate the evidence** — take what the E2E
tests are actually proving and re-prove it somewhere cheaper — and only then remove the duplicates.

## Scenario

A seven-year-old Django + React order-management product. CI takes 51 minutes, dominated by 340
Selenium tests. Roughly one run in three fails and is re-run; the runner is configured with
`--reruns 3`. Below the browser layer, service tests mock the ORM. Two production incidents in the
last quarter: a migration that broke on PostgreSQL after passing on SQLite, and a serializer that
silently dropped a nested field for one customer type.

## User prompt

> "Our CI takes 45–50 minutes, the browser tests are flaky, and we *still* shipped a migration bug and
> a serializer bug last quarter. Review the suite and tell me the one thing to change."

## Repository observations

Counts and runtimes measured from `pytest --collect-only`, the CI job summary, and the runner config
— not from directory names:

| Directory | Count | Runtime | What it actually touches |
|---|---|---|---|
| `tests/unit/` | 1,240 | 40 s | 210 of these start a Django test client — integration-scoped |
| `tests/services/` | 380 | 95 s | ORM mocked via `unittest.mock`; **no test executes SQL** |
| `tests/e2e/` | 340 | 44 min | Real browser, real backend, shared staging database |

- `pytest.ini`: `--reruns 3 --reruns-delay 1`, applied suite-wide. No quarantine list, no owner.
- `tests/services/test_orders.py` mocks `Order.objects` for 41 of 44 tests; the assertions check
  which manager methods were called.
- The serializer that dropped the nested field has 12 tests. All 12 mock the serializer's own
  `to_representation`. **No test ever serializes a real model instance.**
- Migration tests: none. Local development uses SQLite; production is PostgreSQL 14.
- `git log` on `tests/e2e/` shows 60% of commits are selector fixes and `time.sleep` adjustments.
- Both escaped defects sit precisely where the suite has no boundary evidence.

## Observed current portfolio

unit 1,240 (40 s, ~210 misclassified) · integration 380 (95 s, **none touching a real database**) ·
E2E 340 (44 min) | CI wall-clock 51 min *(measured)*. Shape: **hourglass**, degrading toward an
ice-cream cone — many tiny units, a mock-only middle, and a broad browser layer carrying the trust.

## Evidence-placement problems

1. **The middle layer proves nothing about the boundary.** `tests/services/` mocks the ORM, so no
   query, migration, constraint, or serialization path is ever executed. Both escaped defects lived
   exactly there. This is the missing-seam signature of the hourglass, and it is why the E2E suite
   grew: it is the only place real SQL runs.
2. **E2E is being used to cover logic with a cheaper home.** A sample of 40 browser tests: 26 assert
   pricing, discount, or status-transition rules that are pure functions; 9 assert form validation
   messages; 5 exercise genuine cross-system wiring. Roughly three quarters of the runtime defends
   logic that would run in milliseconds one level down.
3. **Retries are suppressing the signal, not managing it.** `--reruns 3` suite-wide means a test that
   fails two runs in three still reports green. Nobody owns a flaky test because no flaky test is
   visible.
4. **Directory names are lying.** 210 `unit/` tests start a test client. Any conclusion drawn from
   the counts alone would have been wrong.
5. **Oracle quality is mixed but not the main story.** 12 serializer tests assert against mocked
   output shaped by the implementation — a mirror, not a test. Worth fixing; not the highest-leverage
   move.

## The single highest-leverage move

> **Introduce a real-PostgreSQL integration layer at the persistence and serialization seams, and
> relocate the E2E tests that are covering logic into it and into unit tests — in that order.**

Relocate first, delete second. A browser test that is the only thing proving a discount rule is
*evidence*, however badly placed; removing it before its replacement exists is a coverage loss
disguised as a cleanup.

**Expected benefit:** the two escaped-defect classes (migration incompatibility, serializer drift)
get evidence for the first time, at seconds rather than minutes. Migrating ~26 of the sampled 40
browser tests one level down projects to roughly 220 of 340 across the suite — E2E runtime falls from
~44 minutes toward ~15, and the flaky surface shrinks proportionally because browser tests are where
the flakiness lives.

**Migration scope:** an ephemeral PostgreSQL fixture (`Testcontainers` or the CI service container),
one narrow integration test per repository/serializer seam, then a per-feature sweep moving assertions
down. Smallest safe first step: **write one integration test that serializes a real `Order` with a
nested customer against a real database, and confirm it fails today.** That single test reproduces
last quarter's incident and justifies the rest of the work without a planning document.

**Indicators the change worked:** CI wall-clock; E2E count; number of tests executing real SQL
(currently zero); reruns triggered per week; and the next migration or serializer defect being caught
pre-merge.

## Then, in order

1. **Remove suite-wide `--reruns 3`.** Replace with an explicit quarantine list — each entry an
   owner, a suspected cause, and an expiry date. Track the count as a health metric. Expect the
   failure rate to *appear* to rise; that is the signal returning, not a regression.
2. **Reclassify the 210 misplaced `unit/` tests** into `tests/integration/`. No behavior change —
   it makes the next measurement honest.
3. **Fix the 12 serializer tests' oracle.** Expected payloads should come from the API documentation
   and a reviewed golden example, not from the serializer's own output.
4. **Only then delete the E2E duplicates**, keeping the 5 sampled tests that exercise real
   cross-system wiring plus the named critical journeys.

## Sound as-is

The 1,030 genuine unit tests are fast, readable, and mostly sociable — this is a suite that had good
instincts and lost the middle. `tests/e2e/` is genuinely well written for what it is; the problem is
its scope, not its craft. Nothing here calls for a rewrite.

## Deliberately omitted from the recommendation

- **Deleting tests as the primary move.** It is the fourth step, not the first.
- **Mutation testing.** The suite is still flaky. Fix reliability first; the mutation *question*
  applies now, the tool does not.
- **Contract tests.** One deployable, one team. The independence gate does not open.
- **A coverage target.** Coverage is already high — that is precisely why it was not a warning.

## Reopening signals

If relocation lands and defects still escape at the boundary, the next move is broad integration, not
more E2E. If the browser count stops falling because each remaining test genuinely exercises wiring,
the suite has reached its proportionate shape — stop.

## Generated review report (excerpt)

```markdown
# Test-suite review — 2026-08-01

**Observed suite:** unit 1,240 (40 s; 210 misclassified) · integration 380 (95 s; none touching a
real database) · E2E 340 (44 min) | CI wall-clock 51 min *(measured)*
**Shape:** hourglass, degrading toward an ice-cream cone.

## What it covers · what it misses

Covered: business rules (redundantly, at three levels) and happy-path journeys. Missing: every
boundary. No test in the repository executes SQL against PostgreSQL or serializes a real model
instance. Both Q2 production incidents landed in that gap.

## The single highest-leverage move

Introduce a real-PostgreSQL integration layer at the persistence and serialization seams, and
relocate E2E tests covering logic into it — relocate first, delete second.

**First step:** one integration test serializing a real `Order` with a nested customer against a real
database. It is expected to fail today.

**Expected benefit:** first-ever evidence for both escaped-defect classes; E2E runtime projected from
~44 min toward ~15 min as ~220 tests move down.

**Indicators:** tests executing real SQL (currently 0); E2E count; CI wall-clock; weekly reruns.

## Sound as-is

1,030 genuine unit tests: fast, readable, sociable. No rewrite is warranted.
```
