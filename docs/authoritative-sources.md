# Authoritative sources

**Status:** active · **Applies to:** 0.4.0 and later

A project explicitly designates the artifacts it is held to. Until it does,
**nothing is authoritative** — and nothing will be designated for it.

This is the requirement [the reconciliation
spec](superpowers/specs/2026-09-10-requirements-reconciliation.md) records as
having been *inverted*: a requirement to let a team designate its own
authoritative inputs became a guarantee that only decision files were
authoritative. This document describes what was built instead.

---

## Why it exists

Without a registry, the drift loop can only ever say *"this contradicts a
decision file."* It cannot say:

> This change is in code governed by the API contract you designated
> authoritative, and it touches the PII path your security requirements cover.

It could not say that because it had no way to know those documents existed. The
loop was narrower than the requirement by exactly the set of documents teams
actually argue about.

---

## What can be designated

| Kind | Default precedence |
|---|---|
| `security-requirement` | 60 |
| `api-contract` | 50 |
| `prd` | 40 |
| `architecture-document` · `living-document` · `adr` | 30 |
| `engineering-standard` | 20 |
| `diagram` · `other` | 10 |

Precedence is a default, overridable per source with `--precedence`. What it
does is **order a conflict report**. It does not resolve one — see below.

---

## Using it

```sh
arch sources list                    # what is designated, with provenance
arch sources add --id payments-api --kind api-contract \
    --path api/payments.yaml \
    --covers payments --scope 'src/payments/**' \
    --by platform --on 2026-09-01 --provenance "signed off in the Q3 review"
arch sources change --id payments-api --path api/v2/payments.yaml
arch sources remove --id payments-api
arch sources checked --id payments-api --baseline 4a91c02
```

**Two different fields, two different jobs:**

- `--covers` names the **subjects** a source is authoritative about (`payments`,
  `pii-retention`). Two sources covering one subject are what makes a conflict
  *establishable* rather than guessed from prose.
- `--scope` names the **code** a source governs, as the same glob dialect a
  rule's `scope` uses, validated by the same matcher. This is what lets the
  drift drain connect an edit to a document.

Everything lives in `arch-crew.json` — one committed, diffable, reviewable file.
**No database.** Nothing derived from the filesystem is written back: `present`
and the current digest are computed on read, so there is no cache that can go
stale against the repository it describes.

---

## Traceability to the baseline being checked

`arch sources checked --id X --baseline <ref>` records *which version* of a
source a reconciliation rested on, pinning the digest of the bytes actually
read. Three states are then distinguishable, and the distinction is the point:

| State | Meaning |
|---|---|
| `never checked` | No claim has been reconciled against it |
| `unchanged since <ref>` | Claims resting on it still hold |
| `CHANGED since <ref>` | Claims resting on it are **unverified — not wrong** |

That last wording is deliberate and is asserted in the tests. A source moving
does not falsify what was concluded from it; it removes the evidence for it.

---

## Conflicts are reported, never resolved

When two designated sources are authoritative about the same subject, the
registry reports it and **lists both**:

```
Conflicts (1) — reported, not resolved:

  [precedence-ordered] payments
    payments-api outranks payments-prd on 'payments', but the disagreement is
    not resolved by that — read both
```

At equal precedence it says so plainly (`unresolvable-by-precedence`, "a human
must decide which governs") rather than breaking the tie arbitrarily.

`arch sources list` exits **3** when a conflict is reported — distinct from `1`
("this command failed"), so a CI gate can tell a broken invocation from a real
disagreement between two documents.

Also reported: a designated source that is **missing** from the repository, and
one that has **changed since it was last checked**.

---

## What drift does with it, and what it will never do

`arch drift drain` reports, per designated source touched by the session:

- **`governs`** — edited paths that fall inside the source's `scope`;
- **`edited`** — the designated artifact itself was edited.

**The evidence gate holds without exception.** Every entry in this layer carries
`judgement: "review"`. A designated source can produce a **finding**; it can
never produce a **violation**:

> A violation requires a tool that ran and failed. No checker speaks for a PRD,
> an API contract, or a security requirement — they are read by people. The
> deterministic lane is therefore structurally out of reach for this layer, and
> `test/authoritative-sources.test.mjs` asserts that no packet entry here
> carries a checker binding or a checker verdict.

So the vocabulary is unchanged: **violation** (a tool failed), **finding**,
**insufficient evidence**, or **proposed decision**. The registry adds material
to the second; it cannot promote anything into the first.

---

## What is deliberately not here

- **No discovery, no `--auto`, no scan.** Designation is an explicit human act.
  A registry that adopted what it found in `docs/` would make every stale draft
  in the repository binding, which is worse than having no registry.
  `test/authoritative-sources.test.mjs` asserts there is no way in.
- **No semantic conflict detection.** The runtime does not read prose and does
  not pretend to. It reports the structural conflicts it can actually establish
  — shared subject, missing artifact, moved baseline — and leaves the reading to
  the human. Claiming more would be exactly the fabrication the skills' own
  evidence rules forbid.
- **No content mirroring.** The registry stores a path and a digest, never a
  copy. There is one source of truth for a source's contents: the source.
