# Requirements reconciliation — 0.4.0 against the original Arc Crew requirements

**Date:** 2026-09-10 · **Status:** proposed · **Trigger:** human review of PR #4

The 0.4.0 release gate is NO-GO on its own scenario evidence. This document records something the
gate could not catch: two places where the *requirement* was rewritten to match what was built,
rather than the build being corrected to match the requirement.

Neither is a coding defect. Both are specification drift, and the second is the more serious.

---

## 1. Documentation mode (checklist §2) — a surfaced escalation, closed without the human

**Required:** the user selects "traditional ADRs" or "living architectural documentation", the choice
is persisted, and the toolchain honours it consistently.

**Shipped:** one mechanism. Schema decision files are the sole source of record; `constitution.md` is
their generated read-only rollup. No mode, no persistence.

**How it happened, precisely.** This is not a case of nobody noticing:

1. SP1's baseline design spec took **D3** — "the Constitution is a generated rollup" — and explicitly
   rejected "two selectable modes (ADR vs Constitution)".
2. The SP2–SP6 decisions document then escalated the conflict correctly and loudly:
   `2026-09-09-upgrade-decisions-sp2-sp6.md` Part 6, item **E1**, marked **`[ESCALATE] — not answered
   here`**, and stated in terms: *"This is a product decision, not an engineering preference."* It
   costed both paths honestly.
3. SP6's design spec then answered it as **D1** — Path A — and **rewrote checklist §2** so the item
   "stops asking about a mode that was never implemented."

So the machinery worked right up to the last step: the question was raised for human approval, and
then closed by the implementation rather than by the human. That is the exact failure mode this
product exists to prevent, performed by the product's own build.

**What Part 6 got right, and what it missed.** Its cost analysis of a genuine mode switch is sound,
and its cost 4 is the real one: in ADR-only mode there is no `constitution.md`, and SP3's rule
injection and SP5's cross-checks are both built on that artifact. Part 6 concluded a mode switch
would need "an index to replace it — which is, in most of its properties, a constitution under
another name."

That conclusion assumed the mode governs **both** the human artifact and the machine artifact. It
does not have to. Separating the two dissolves cost 4 entirely:

- **Human documentation mode** — what a person reads and maintains as the architecture record.
  Selectable: many ADRs, or one/several living documents.
- **Machine enforcement metadata** — the rules, their scopes, severities and `verified_by` bindings,
  plus the generated rollup the runtime reads. Always present, always the same shape, regardless of
  mode.

Every consumer Part 6 worried about (SP2's report, SP3's drain and injection, SP4's traceability,
SP5's cross-checks) binds to the *second* layer, which never varies. Only capture and rendering vary.

**The requirement that must actually be met:** in living-document mode a user must not be forced to
maintain dozens of ADR-shaped files merely because the runtime wants rule metadata. Machine metadata
may live wherever verification needs it; it may not masquerade as the human record.

## 2. Authoritative sources (checklist §3) — the requirement inverted, not deferred

This is the more serious of the two, because unlike §2 it was never escalated, costed, or recorded as
a deviation anywhere.

**Required:** a project explicitly designates artifacts as authoritative inputs — PRDs, architecture
documents and diagrams, engineering standards, API contracts, security requirements, selected ADRs,
living architecture documents — with provenance, precedence, conflict handling, and traceability to
the baseline being checked.

**Shipped:** nothing. There is no source registry and no project configuration expressing one.

**What happened to the section.** Checklist §3 is titled "Authoritative sources and baseline" and its
item now reads: *"decision files remain the only thing anything treats as authoritative — no cache,
no second store, no config file quietly became a second source of truth."* SP6 then satisfied it with
"an audit, not new code."

The section title survived; its meaning was inverted. A requirement to let the user **designate**
authoritative inputs became a guarantee that **nothing but decision files** is authoritative — and
the audit that "proves" it would fail if the requirement had been built. A grep for the requirement's
own vocabulary across every spec and plan in this repository returns nothing: no `PRD`, no
`API contract`, no `engineering standard`, no `authoritative input`. It did not survive into any
design document, which is why no sub-project built it and no reviewer missed it.

**Consequence for the product, not just the paperwork.** Drift observation can only contradict a
decision file. It cannot say "this change contradicts the API contract and the security requirements
you designated as authoritative", because it has no way to know they exist. The drift loop is
narrower than the requirement by exactly the set of documents teams actually argue about.

---

## 3. What this means for the release

The gate's own verdict (NO-GO, 16 blocking scenario failures) stands and is unaffected by this
document. These two items are **additional** blockers, ahead of the N/B/A remediation list, because
both change what the skills and runtime must do — and therefore what the scenarios must grade.

Sequence:

1. Restore the documentation-mode requirement (§1 above), with mode selection explicit and persisted.
2. Build the authoritative-source registry (§2 above), minimal, no database.
3. Re-verify ADR → living-document migration end to end, with a traceability report covering
   migrated · merged · superseded · omitted · conflicting · unresolved.
4. Then work the recorded defect list: N1–N13, B2, B3′, B4, and A1–A6 where correct fixture staging
   confirms the expectation is genuinely wrong.
5. Rebuild both targets, run the full deterministic suite and the real-tool E2E lane, audit package
   contents, clean-install the candidate build, and re-run all 48 scenarios from fresh sessions
   against representative fixtures with runner and grader tiers logged and every case graded.
6. Reconcile results against **these requirements**, not only the amended checklist, and record a new
   GO/NO-GO.

**Do not weaken a scenario expectation** to make a run pass unless the record establishes the
expectation itself is wrong.

## 4. A process rule this episode earns

The escalation in Part 6 was correct and was then closed by the party it was escalated away from. A
`[ESCALATE]` item is not resolvable by the implementation that raised it. Whatever the outcome of the
two blockers above, that rule belongs in `CLAUDE.md`, because the alternative is a build that can
always re-specify its way out of a requirement it finds expensive.
