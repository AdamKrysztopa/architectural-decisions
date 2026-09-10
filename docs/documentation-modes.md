# Documentation modes and the authority model

**Status:** active · **Applies to:** 0.4.0 and later

This document answers one question precisely, because getting it wrong is what
produced [the reconciliation
spec](superpowers/specs/2026-09-10-requirements-reconciliation.md): **what, in a
repository using arch-crew, is authoritative — and who decided?**

---

## Two layers, and why they are separate

| | **Human documentation** | **Machine enforcement metadata** |
|---|---|---|
| What it is | The architecture record a person reads and maintains | Rules, scopes, severities, `verified_by` bindings, statuses |
| Who writes it | The team | The team, in the same edit — but read by tools |
| Shape | **Selectable**: many ADRs, or living documents | **Fixed.** Identical in both modes |
| Consumers | People | The rollup, `arch check`, the drift loop, rule injection |
| Varies by mode? | **Yes. That is what the mode is.** | **No. Never.** |

The 0.3.x design collapsed these into one thing — schema decision files were
both the human record and the machine record — and the documentation-mode
requirement was then closed as unbuildable because "ADR-only mode has no
`constitution.md`, and SP3 and SP5 are built on that artifact."

That reasoning was sound *given* the collapse and wrong without it. Separating
the layers dissolves the cost entirely: the rollup, the drain, the injection and
the cross-checks all bind to the machine layer, which does not vary. Only
**capture and rendering** vary.

---

## The two modes

Selected explicitly, persisted in `arch-crew.json`, never inferred:

```sh
arch mode                                              # what is selected now
arch mode adr [--dir docs/architecture/decisions]
arch mode living --document docs/architecture/overview.md [--document ...]
```

### `adr` — many ADRs (the default)

One file per decision in a decisions directory. Each file **is** its own human
record: context, decision, consequences. The rule metadata rides in its
frontmatter.

Right for a team that wants an append-only trail of individual decisions, each
with its own date, status and supersession chain.

### `living` — one or several living architecture documents

The human record is a **document**, written and maintained as a document. A
decision is a `##` section of it. The section's prose is the record; its rule
metadata sits in fenced blocks beside the prose that explains it:

````markdown
## Data ownership

```arch-decision
id: 1
status: active
skill: decide-architecture
date: 2026-09-10
commit: 0000000
```

Services own their own tables. A cross-service read goes through the owning
service's API, never its database — we accepted the extra hop to keep schema
changes local to one team.

```arch-rule
id: services-own-their-tables
statement: A service owns its own tables; no other service reads them directly.
scope: ["src/**"]
severity: blocking
verification: narrative
```
````

**A section with no blocks is ordinary prose and is ignored.** The document is
the team's to write; only the fenced blocks are the runtime's to read.

**This is the requirement's actual point.** A team in living mode maintains
*one or several documents*. They are not made to keep thirty ADR-shaped files so
the runtime has somewhere to read `scope` and `severity` from. That was the
substitution the reconciliation spec refused, and this is what refusing it looks
like in practice.

---

## The authority model

Stated as rules, in precedence order:

1. **The human documentation record is authoritative for *intent*.** In `adr`
   mode that is the ADR files; in `living` mode it is the living documents. It
   is what a person is expected to read, and what a disagreement is settled
   against.

2. **`constitution.md` is authoritative for nothing.** It is a *generated
   rollup* of the machine layer, carries a do-not-edit banner, and is
   regenerated from the record. If it disagrees with the record, it is stale and
   the record wins. `arch constitution --check` exits 2 to say so.

3. **The machine layer is authoritative for *what is enforced*.** A rule that is
   not expressed as an `arch-rule` / frontmatter rule is not enforced, however
   clearly the prose states it. This is a deliberate asymmetry: prose the tools
   cannot read must not silently become a gate.

4. **`status: active` is the boundary, and only a human crosses it.** A decision
   is `proposed` until a person runs `arch promote`. Nothing — not a skill, not
   a migration, not a drift drain — promotes on its own. In `living` mode
   promotion flips exactly one `status:` line inside the document and touches
   nothing else.

5. **The mode is the user's and is never inferred.** No command changes it as a
   side effect. A repository with no `arch-crew.json` is in `adr` mode with a
   discovered decisions directory, which is exactly what this package did before
   modes existed.

6. **Designated authoritative sources are a separate axis** — see
   [`authoritative-sources.md`](authoritative-sources.md). The documentation mode
   says where *this repository's own decisions* live. A designated source is an
   artifact the team declares binding on top of that (a PRD, an API contract, a
   security requirement). Conflicts between them are reported, never resolved
   silently.

---

## What is guaranteed not to change with the mode

Tested directly in `test/documentation-mode.test.mjs` — the same two decisions
are expressed both ways and the outputs compared:

- rule ids, statements, scopes, severities, verification kinds, `verified_by`
  bindings, and which decision each rule belongs to;
- decision ids, statuses, skills, and supersession;
- cross-decision validation (duplicate ids, duplicate rule ids, dangling
  `superseded_by`);
- the generated rollup, **except** the source links and the one sentence naming
  where the record lives;
- `arch check`, the drift drain's classification, and rule injection.

If you are adding a consumer of the machine layer, read it through
`runtime/baseline/record.mjs` (`resolveRecord`). That is the one seam. A consumer
that reaches for `discoverDirectory` or `loadDecisions` directly will work in
`adr` mode and quietly see nothing in `living` mode.

---

## Switching modes

Switching is not migration. `arch mode living --document ...` changes where the
runtime looks; it does not move anything.

To actually move 30 ADRs into one or several living documents, use
`arch migrate`, which produces the traceability report — **migrated · merged ·
superseded · omitted · conflicting · unresolved** — so nothing is lost silently.
See [`migrating-to-living-documents.md`](migrating-to-living-documents.md). The
old ADRs may stay in Git history or an archive directory; the living documents
become the authoritative record only after a human promotes them.
