# The oracle-independence guardrail (cross-cutting)

The three evidence dimensions decide **what evidence the portfolio contains**. This file decides
**whether that evidence can be trusted at all**. It is not a fourth dimension and it has no shape of
its own — it applies to every row of every portfolio, in both modes.

> **Generated coverage without an independent oracle is coverage theatre.**

Load this file whenever tests are generated, inferred, recorded, or snapshotted rather than derived
from a stated requirement — which now includes most AI-assisted test writing.

## The one-sentence rule

**The implementation under test must not be the sole oracle used to generate both the test inputs
and the expected outcomes.** If the expected value came from running the code, the test can detect
*change*; it can never detect *wrongness*. It has silently promoted the code's current behavior —
bugs included — to a specification.

This is a measured effect, not a stylistic preference: generated oracles are **prone to** reproducing
an implementation's *actual* rather than *intended* behavior (Konstantinou, Degiovanni & Papadakis,
arXiv:2410.21136 — measured across 24 Java repositories).

## The gate — five questions, in order

Ask all five of any generated, recorded, or snapshotted test before it is allowed into the suite. A
"no" at 1–3 is disqualifying; a "no" at 4–5 means the test is weak and needs strengthening before it
counts as evidence.

1. **Where does the expected behavior come from?** Name the source out loud. "The test passes" is not
   an answer.
2. **Is that source independent of the implementation?** Could it have been written before the code,
   or by someone who could not see it?
3. **Could the same defect have influenced both the implementation and the expected output?** A
   misread spec, a wrong unit, an off-by-one in a shared helper, a model that inferred intent from
   the code it was shown — all produce a test that agrees with the bug.
4. **Does the test assert externally meaningful behavior?** A requirement, an observable outcome, a
   contract — not a restatement of the code's internal steps.
5. **Would mutation or deliberate fault injection demonstrate assertion strength?** Change a
   comparison, an operand, or a boundary by hand: does anything fail? You do not need a mutation
   *tool* to ask the mutation *question*.

The review question that compresses all five:

> **What requirement would this test detect if the implementation changed?**

If the honest answer is "any change at all, and nothing in particular", the test is a change
detector, not evidence.

## Acceptable independent oracles

Any one of these is enough, provided it exists **outside** the implementation:

- a **specification** or documented requirement;
- a **standard**, protocol definition, or published format;
- an **invariant** or property that must hold regardless of implementation (round-trip, idempotence,
  ordering, conservation, monotonicity);
- an **independently implemented reference model** — a slow-but-obvious version, a previous system, a
  library known to be correct;
- **production examples** with known-correct outcomes;
- a **historical defect case** — the bug report *is* the specification;
- **human-reviewed expected behavior**, where a person who understands the requirement approved the
  expected value;
- a **metamorphic relation** — "if the input is scaled, the output must scale", "reordering the input
  must not change the result" — usable even when no single expected value is known;
- a **domain constraint** — a total that must reconcile, a balance that must not go negative, a tax
  rule with a published table.

Record *which* oracle each generated test rests on. An oracle nobody can name is an oracle nobody
checked.

## Reject or flag

- **Implementation code used to infer expected behavior** — the expected value was read off, printed
  out, or inferred from the code by a person or a model.
- **The assertion merely restates the implementation** — `assert result == a * rate` next to
  `return a * rate`. It is a mirror, not a test.
- **Snapshots accepted without review** — a snapshot asserts *sameness*, not *correctness*; it has no
  oracle of its own. Bulk-approved snapshots are the fastest way to freeze a bug.
- **A language model inventing expected outputs with no independent basis** — including synthetic
  evaluation cases nobody reviewed, which is the same defect wearing an eval costume
  (`evaluation.md` → golden evaluation datasets).
- **Coverage cited as the justification** — "it raised coverage 12 points" says the lines executed,
  not that anything was verified.
- **Happy-path-only generated suites** — generators overwhelmingly produce the case the code was
  written for; boundaries, error paths, and negative authorization cases are where the requirement
  actually lives.

## Legitimate uses of implementation-derived tests

Not every implementation-derived test is a defect — but each has a stated purpose and an expiry.

- **Characterization tests** before restructuring undocumented legacy code. They deliberately pin
  current behavior, bugs included, as a *scaffold for change*. They are not a specification, and they
  must be revisited once intent is known.
- **Snapshot and approval tests** where a human genuinely reads the diff on every change. The human
  review *is* the oracle; remove the review and the oracle disappears with it.

State the purpose in the test or its docstring. An unlabelled characterization test becomes a
specification by accretion within a year.

## In the two modes

**Greenfield.** Name the oracle for each row of the portfolio that will be generated or recorded, and
say which failure it would detect. If a row has no independent oracle available yet, that is a finding
— often the honest move is to write the acceptance examples first.

**Existing suite.** Sample the tests, do not trust the directory. Look for expected values that match
the implementation's shape too closely, assertion-free tests, bulk-updated snapshots, generated test
files committed in one sweep, and any module whose tests were all green when a defect escaped through
it. Report the oracle assessment as its own section — it is frequently the highest-leverage finding in
a suite that looks healthy by every other measure.
