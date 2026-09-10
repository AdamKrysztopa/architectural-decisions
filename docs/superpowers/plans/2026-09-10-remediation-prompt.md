# Arc Crew 0.4.0 — remediation driver prompt

Paste the block below to start (or resume) the remediation. It is written to be run repeatedly:
each firing does exactly one step, then stops.

---

You are continuing the Arc Crew 0.4.0 remediation on branch `sp2-sp6-release-0.4.0` (PR #4).
**Do not merge, tag, or release.** PR #4 stays open as the implementation branch.

## Read first (in this order)
1. `docs/superpowers/specs/2026-09-10-requirements-reconciliation.md` — the two product-level
   blockers and why they exist.
2. `docs/release-gate-0.4.0.md` §11 — the corrected gate result and the N/B/A defect list.
3. `docs/release-checklist-0.4.0.md` — the ten sections and the standing NO-GO.
4. `CLAUDE.md` — repository rules.

## Hard rules
- **Preserve what works.** Do not redesign SP2–SP6. The deterministic checkers, the proposed →
  active human promotion gate, the non-authoritative drift queue, the evidence packet, migration
  traceability, the dispatcher, and the non-blocking hooks all stay.
- **Never weaken a scenario expectation** to make a run pass. Change one only where the record
  establishes the expectation itself is wrong, and say which in the commit message.
- **Never hand-edit `build/`** — regenerate with `npm run build -- --target all`.
- **Never edit a generated `skills/*/references/*.md`** — edit `shared/` and run `npm run sync:shared`.
- Zero runtime dependencies; Node builtins only. Deterministic output: no timestamps, no host paths.
- Editing any `SKILL.md` body means regenerating `test/fixtures/skill-freeze/body-manifest.json`
  **deliberately**, and it invalidates the scenario gate — the full 48-scenario re-run is owed before
  any GO.
- Linear history: one squashed commit per step. Do not push or tag without being asked.
- Finish every step with `npm test`, `npm run sync:check`, and a clean
  `npm run build -- --target all`.

## How to work
Do **one numbered step per firing**, then stop and report: what changed, what you ran, what proves
it, and what you deliberately did not do. Do not start the next step. If a step is already complete,
say so with the evidence and stop.

When you add or change behaviour, add a test that fails without the change — then prove it is not
vacuous by breaking the product, watching the test fail, and reverting.

## The steps

**0. Land the work already in the tree.** Uncommitted: N1–N5, D1–D3, D6, D7, N11, the regenerated
body manifest, and the reconciliation spec. Review the diff, confirm the suite is green, commit.

**1. Documentation mode (product blocker 1).** Restore the user-selected mode the requirement asked
for, using the smallest change that works. Separate the two layers rather than building two
pipelines:
- *Human documentation mode* — selectable and persisted: `adr` (many ADRs) or `living` (one or
  several living architecture documents). This is the primary human architectural record.
- *Machine enforcement metadata* — rules, scopes, severities, `verified_by`, and the generated
  rollup the runtime reads. Present and identically shaped in **both** modes.
In `living` mode the user must **not** be forced to maintain dozens of ADR-shaped files to satisfy
the runtime. Every existing consumer (SP2 report, SP3 injection and drain, SP4 traceability, SP5
cross-checks) binds to the machine layer, which must not vary by mode. Document the resulting
authority model explicitly, and test both modes.

**2. Authoritative sources (product blocker 2).** Build the minimal registry the requirement asked
for. A project explicitly designates artifacts — PRDs, architecture documents and diagrams,
engineering standards, API contracts, security requirements, selected ADRs, living architecture
documents, other chosen repository artifacts. Never auto-designate anything. Persist in minimal
project configuration; **no database**. Support add / remove / change, provenance, source
identity/path, precedence and conflict policy, and traceability to the baseline version checked.
**Conflicts between two authoritative sources are reported, never silently resolved.**

**3. Wire drift to the registry.** Drift observation must be able to say "this change contradicts the
API contract and the security requirements you designated as authoritative" — today it can only
contradict a decision file. Keep the evidence gate intact: a tool failure is a violation, everything
else stays a finding, insufficient evidence, or a proposed decision.

**4. Re-verify ADR → living-document migration.** Prove a project with ~30 traditional ADRs can end
as one or several coherent living architecture documents when the user selects that mode. The
traceability report must cover **migrated · merged · superseded · omitted · conflicting ·
unresolved**. Old ADRs may remain in history/archive; the living docs become the authoritative human
record only after explicit human approval.

**5. Skill and reference defects.** Work `docs/release-gate-0.4.0.md` §11.6: N6–N10
(`shared/migrating-decisions.md`), N12 (D1–D7 as re-cut), N13, and anything from N1–N5 step 0 left
open. Pay particular attention to: test-patterns Step 3 routing; independent-oracle remediation;
safety-critical testing gates; migration proposal-cap behaviour; migration "neither mode applies";
described-vs-present repository handling; threat-model boundary-first output ordering.

**6. Harness.** B2 — re-stage and re-run every scenario listed in gate record §6.2 against
representative fixtures, and build the fixtures A4/A5/A6 and `security/public-api-surface-change`
need. B3′ — grade `test-patterns/healthy-existing-suite` and the missing `drift-drain` case. B4 —
re-run `drift-drain/rule-outlived-its-subject`.

**7. Scenario expectations.** Amend A1–A3 as §11.5 specifies, and A4–A6 **only** if they still fail
after correct fixture staging. Each row in §11.5 states which half must survive — preserve it.

**8. Release verification.** Rebuild both targets. Run the full deterministic suite. Confirm
generated files are current. Run the real-tool E2E lane with actual `import-linter` and `gitleaks`
(`ARCH_CREW_E2E_REAL_TOOLS=1`). Run the package-content `gitleaks` audit over `build/`. Clean-install
the built Claude plugin and **confirm the installed plugin is the candidate 0.4.0, not a cached
0.3.x** — the stale 0.3.0 install is what produced the security set's false 0/11 last time. Clear the
GitHub Actions Node runtime deprecation warning, or consciously accept it in writing.

**9. The gate.** Run all 48 scenarios from fresh sessions against representative fixtures. Log the
runner and grader model tier for every run. **Grade every scenario — no ungraded cases.** Reconcile
the results against `docs/superpowers/specs/2026-09-10-requirements-reconciliation.md` and the
original requirements, not only the amended checklist.

**10. Decide.** Update `docs/release-checklist-0.4.0.md` with current evidence and current test
counts, and record a new explicit GO/NO-GO. **Do not tag 0.4.0 unless it is GO.** If it is NO-GO,
say so plainly and list what remains.

## Standing instruction
Report honestly. If a step cannot be completed, finish everything that does not depend on it, then
say exactly what is blocked and why. Do not re-specify a requirement to make it satisfiable — and
note that an `[ESCALATE]` item may not be resolved by the implementation that raised it, which is
how blocker 1 reached the release in the first place.
