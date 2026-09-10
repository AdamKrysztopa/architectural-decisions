# Release Hardening — design

**Date:** 2026-09-09
**Status:** draft — needs human review before implementation begins
**Scope:** sub-project 6 (final) of the arch-crew architectural-baseline upgrade
**Target version:** 0.4.0
**Build order this spec assumes:** SP2 (deterministic checkers) → SP4 (migration and bootstrap) →
SP5 (security extension) → SP3 (drift-observation loop) → **SP6, this spec** — per
`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md` §C1. By the time SP6 is
implemented, SP2–SP5 have each shipped as their own patch release (0.3.2–0.3.5) and their runtime,
skills, and scenario sets already exist. SP6 adds no new product capability; it is the sub-project
that proves the other five hold together and cuts the release the checklist gates.

## Why

0.3.1 shipped sub-project 1 only, and its release notes said so outright: `0.4.0` is reserved for
"the release that satisfies the full pre-release checklist." The user maintains that checklist —
ten sections: (1) repository and compatibility, (2) documentation modes, (3) authoritative sources
and baseline, (4) migration and bootstrap, (5) compliance and architectural drift, (6)
hooks/commands/CI, (7) security extension, (8) tests and end-to-end scenarios, (9) documentation and
release package, (10) final release decision. Its release gate, stated plainly: **do not release if
architectural authority can be changed silently, existing workflows regress, migration loses
decisions without traceability, or a deterministic violation is reported as verified without a
reliable check.**

Every one of those four failure modes is a real, checkable property of a system that by now spans
five skills and a runtime with checkers, a drift queue, a migration path, and a security review. SP6
does not build that system — SP2–SP5 did. SP6 **builds the evidence that it is safe to tell users it
works**, and closes the two things nothing before it could close on its own:

1. **§2 is factually wrong as written.** It assumes a user-selectable "ADR vs. living-document" mode.
   Sub-project 1 explicitly rejected that (D3, the baseline design spec) and shipped one mechanism —
   decision files as the source of record, `constitution.md` as their generated rollup. The checklist
   item has to change to match what was actually built, not be ticked against a design that was never
   made.
2. **Nothing before SP6 proves the whole lifecycle end-to-end.** Each of SP2–SP5 is validated on its
   own terms (`docs/validating-skills.md`'s two layers, applied per sub-project). Nothing yet asks
   "does a new project actually reach an approved baseline," "does an existing repo actually reach one
   without losing a decision," "does drift actually resolve into either a fix or a recorded
   evolution." Those are SP6's four end-to-end scenarios.

## Decisions taken

| # | Decision | Rejected alternative |
|---|----------|----------------------|
| D1 | §2 is rewritten to state coexistence — decision files are the sole authority, the constitution is a generated read-only rollup, there is no mode to select or persist | Reintroduce a persisted "traditional ADR vs. living document" mode switch in SP4 (Part 6, Path B of the decisions doc) |
| D2 | Security ships as a fifth skill (already decided at SP5); SP6's job is to **audit**, not re-decide, that every "four skills" surface was actually updated | Treat the skill count as fixed and let a stale "four" survive in prose SP6 doesn't touch |
| D3 | The four end-to-end scenarios map one-to-one onto SP2–SP5. Each is executed as a Layer-1 fixture test for its mechanical portion, and its judgement portion is **cross-referenced into, not duplicated from,** the owning sub-project's own Layer-2 scenario set | A fifth, standalone `release-e2e.json` scenario set re-grading judgement SP3/4/5 already grade |
| D4 | The deterministic-checker fixture corpus (pass/fail/unbound/unreadable-config/unavailable/error across every bound tool) and E2E-1 share one fixture family | A second, synthetic corpus built only to exercise checker result states in isolation |
| D5 | SP6 adds **no new `runtime/` code.** It adds `test/` fixtures and suites, and `docs/` | A dedicated `runtime/release/` CLI subsystem, which would need its own zero-dependency implementation and tests for a one-release-per-year use case |
| D6 | The pre-release checklist becomes a committed artifact, `docs/release-checklist-0.4.0.md`, carrying the per-line audit table | Leave the checklist external/tribal and only gesture at it from the release notes |
| D7 | Package-content secrets scanning is a documented `gitleaks` invocation over `build/`, run as a release-gate command | A bespoke secret-pattern grep inside arch-crew, which is exactly the reimplementation rule 6 (`docs/superpowers/specs/2026-09-09-upgrade-decisions-sp2-sp6.md`, "the rules applied throughout") forbids |
| D8 | Clean-install verification stays a **documented, by-hand-per-release** procedure; the existing in-repo proxy test (`build.test.mjs`, "the shipped generator runs from each target package") is extended to cover every new runtime tree | Build a CI harness that actually drives the Claude and Codex CLIs, which requires host state this repository does not control |
| D9 | Approval-gate tests assert exactly what SP4's `promote` verb guarantees — the constitution is byte-unchanged absent a promotion — and explicitly **do not** claim a hand-edited `status: active` is mechanically blocked | Overstate the guarantee to make §5/§10 look more closed than the shipped code is |

Two of these (D3, D4) are the same move applied twice: **never let a validation layer re-prove what
another layer already proves** — the inversion rule C4 states for SP2–SP5 individually applies with
equal force across them.

---

## The checklist, closed

Each subsection states the item as it will read after SP6, what SP6 built or audited to satisfy it,
and where the proof lives. This is the spine of the sub-project; the sections below it (end-to-end
scenarios, regression coverage, clean install, approval gates, the release package) are the mechanics
behind these ten items.

### §1 — Repository and compatibility

**Confirms:** the four original skills' triggering is unchanged; the package still installs and
builds the same way for both targets; nothing about plugin identity, namespace, or the Claude
marketplace façade moved.

**Built by SP6:** the frontmatter-freeze test (a byte-identical fixture of the four original
`SKILL.md` frontmatter blocks, checked every run) and the body-hash manifest (Q6.2 body-change
visibility). Both are new to SP6 — 0.3.1 relied on prose review of the diff.

**Proof:** `test/skill-freeze.test.mjs`, `test/fixtures/skill-freeze/frontmatter-0.3.1.json`,
`test/fixtures/skill-freeze/body-manifest.json`.

### §2 — Decision representation *(rewritten — see below)*

**Confirms:** there is one mechanism for recording and rolling up architectural decisions, and a
repository that already keeps prose ADRs is not forced to convert them.

**Built by SP6:** nothing new — SP1 already built the mechanism (D3 in the baseline spec) and SP4
already built prose-ADR coexistence at migration time. SP6's job here is purely the checklist
wording, so the item stops asking about a mode that does not exist.

**Proof:** the replacement wording below, plus the existing tests it now correctly describes:
`test/baseline.test.mjs` (generator behaviour), the 0.3.1 "Coexisting with existing prose ADRs"
section (unchanged, still accurate), and SP4's migration traceability test (E2E-3, below).

#### Replacement wording for §2

> **§2 — Decision representation** *(rewritten from "traditional ADRs vs. living architectural
> documents").* There is no mode to select and nothing to persist. Confirm:
>
> - Decision files under the repository's decisions directory are the **sole source of record** for
>   every rule and decision the crew produces.
> - `constitution.md` is a **generated, read-only rollup** of the `active` decision files — never a
>   second authority, never hand-edited. Its absence or staleness loses no decision: `--check` catches
>   staleness, and deleting it and regenerating reproduces it exactly.
> - A repository that already keeps prose ADRs (Nygard/MADR-style, in `docs/adr/`, `doc/adr/`, or
>   `adr/`) keeps them untouched beside the schema decisions. Migration links them in via a
>   traceability report; it never converts or edits their prose.
> - A team that prefers to work from decision files alone, without a rendered rollup, may simply not
>   run the generator. That is a usage choice, not a configured mode, and needs no config file to
>   express it.

This is Path A of the decisions doc's Part 6, with the "presentational choice" framing folded into
the fourth bullet rather than left as an open question — one artifact, one code path, and a repo that
wants an ADR-shaped read of it can just not run the generator. Cost, per the decisions doc: a promise
withdrawn (no selectable mode), mitigated because nothing technical is lost — every property teams
actually asked a mode for is already true of the shipped mechanism.

### §3 — Authoritative sources and baseline

**Confirms:** decision files remain the only thing anything treats as authoritative — no cache, no
second store, no config file quietly became a second source of truth while SP2–SP5 were built.

**Built by SP6:** an audit, not new code. The property is already enforced piecemeal (the drift
queue is explicitly discardable and never a source of record, per Q3.3; the constitution's
`status === "active"` filter is the only path to authority, per Q4.5) — SP6 checks that none of
SP2–SP5 quietly added a second one (e.g., a cached resolution result the checker treats as ground
truth instead of re-reading the tool config each run).

**Proof:** a checklist line item in `docs/release-checklist-0.4.0.md`, backed by re-reading
`runtime/checkers/*`, `runtime/migration/*`, and the security skill's rule handling for any
persisted state that is not a decision file, the constitution, or the (explicitly non-authoritative)
drift queue.

### §4 — Migration and bootstrap

**Confirms:** an existing, undocumented repository can reach a first baseline without losing anything
it already had, and every input's fate is traceable.

**Built by SP6:** E2E-3 (below) and the approval-gate tests, which prove promotion is the only path
from `proposed` to `active` and that the constitution is byte-unchanged until it happens.

**Proof:** `test/e2e/bootstrap-migration.test.mjs`, `test/approval-gate.test.mjs`.

### §5 — Compliance and architectural drift

**Confirms:** drift is observed and classified honestly — a violation is never asserted on weak
evidence, an unavailable tool is never given a model judgement in its place, and "nothing to report"
is a normal outcome.

**Built by SP6:** E2E-2 (below), which is the only place in the whole upgrade that exercises SP3's
full loop (queue → drain → classification) against a fixture repository rather than SP3's own unit
tests over the classifier in isolation.

**Proof:** `test/e2e/drift-observed.test.mjs`, cross-referenced against SP3's
`test/scenarios/drift-drain.json`.

### §6 — Hooks/commands/CI

**Confirms:** the hook set (`SessionStart`, `PostToolUse`, `Stop`) is non-fatal by construction, CI
runs the deterministic lane (`check-rules --run --require-tools`) and never reads the drift queue, and
every CLI entry point SP2–SP5 added is reachable from both packaged targets.

**Built by SP6:** the extended target-inventory test (every new `runtime/<subsystem>/` tree is
asserted present in both `build/claude` and `build/codex`, matching the pattern
`build.test.mjs` already sets for `runtime/baseline/`), and the CI command list in
`docs/building-packages.md`, extended with SP2's `--require-tools` invocation.

**Proof:** `test/build.test.mjs` (extended inventory + "shipped X runs from each target package" for
every new CLI), `docs/building-packages.md`.

### §7 — Security extension

**Confirms:** the fifth skill exists, is packaged and advertised like the other four, never
enumerates vulnerabilities itself, and its findings carry no score.

**Built by SP6:** E2E-4 (below), plus the skill-count audit from §1/D2 applied specifically to the
security skill's advertised terms and description.

**Proof:** `test/e2e/security-without-theatre.test.mjs`, `test/build.test.mjs`'s existing
`advertisedTerms` / "documentation claims the same number of skills" tests (unchanged mechanism,
re-run against the five-skill state).

### §8 — Tests and end-to-end scenarios

**Confirms:** all five scenario sets (`test-patterns.json`, `baseline-capture.json`,
`drift-drain.json`, `migration.json`, `security.json`) still integrity-check under `npm test`, and
have been re-run agent-driven, fresh session per scenario, since the last change to any skill body.

**Built by SP6:** the regression-coverage procedure (below) and its record under
`test-runs/0.4.0/`.

**Proof:** `docs/validating-skills.md` (extended), `test-runs/0.4.0/<set>/<scenario-id>/` (gitignored,
local — the finding is what's committed, per the existing convention).

### §9 — Documentation and release package

**Confirms:** README, the upgrade path, and the release notes are accurate and complete, and the
package contains nothing unintended.

**Built by SP6:** the release package itself (below) — README additions, `docs/release-0.4.0.md`,
the package-content audit.

**Proof:** `docs/release-0.4.0.md`, `README.md` diff, `docs/building-packages.md`'s extended host
validation section.

### §10 — Final release decision

**Confirms:** the release gate — no silent authority change, no workflow regression, no untraceable
migration, no unverified deterministic claim — is actually satisfied, in writing, before the tag is
cut.

**Built by SP6:** `docs/release-checklist-0.4.0.md`'s closing section, which restates the four gate
conditions against the evidence gathered in §1–§9 and records the go decision plus every remaining
documented limitation (below).

**Proof:** `docs/release-checklist-0.4.0.md`, final section.

---

## The four end-to-end scenarios

Per Q6.1 of the decisions doc, one per SP2–SP5, each against a small fixture repository under
`test/fixtures/e2e/<scenario>/`, each asserting its own characteristic failure mode and not only the
happy path.

Grading discipline, since this repository grades skills through force-driven scenario sets with no
model running in CI (`docs/validating-skills.md`): **each E2E test is split at exactly the line
between what a tool can decide and what needs judgement** (rule 6, the inversion rule in C4).

- The **mechanical** half of each scenario — file states, exit codes, byte-for-byte artifact
  comparisons, "the queue is empty after drain," "the constitution did not change" — is a Layer-1
  `node:test` suite. It runs in `npm test`, in CI, with no model.
- The **judgement** half — "is this a genuine `review-finding`," "did the model correctly infer
  ADR-0007 supersedes ADR-0003," "is the threat review's control genuinely the cheapest one" — is
  **not re-graded by SP6.** It already has a home: SP3's `drift-drain.json`, SP4's `migration.json`,
  SP5's `security.json`. SP6 asserts those scenario ids exist and cross-references them from the E2E
  test's comment block, so a reviewer reading `test/e2e/drift-observed.test.mjs` is pointed at the
  scenario that grades the part the fixture test cannot.

### E2E-1 — Bind and prove (SP2)

Fixture: `test/fixtures/e2e/bind-and-prove/` — a tiny Python-shaped repo with a real
`.importlinter` contract (`svc-db-isolation`) and one decision file naming a `deterministic` rule
bound to it.

```js
// test/e2e/bind-and-prove.test.mjs
test("a deterministic rule resolves, evaluates, and reacts to a real violation", async () => {
  const fixture = join(repositoryRoot, "test/fixtures/e2e/bind-and-prove");
  const checker = join(repositoryRoot, "runtime/checkers/check-rules.mjs");

  // Bound, tool present, contract holds.
  const clean = await run(checker, ["--dir", fixture, "--run", "--json"]);
  assert.equal(clean.code, 0);
  assert.equal(clean.rows.find((r) => r.rule === "svc-db-isolation").status, "pass");

  // Deliberately violate the contract in the fixture's working copy, then check again.
  await withPatch(join(fixture, "src/billing/repo.py"), patchThatImportsCatalogDb, async () => {
    const violated = await run(checker, ["--dir", fixture, "--run", "--json"]);
    assert.equal(violated.code, 2);
    assert.equal(violated.rows.find((r) => r.rule === "svc-db-isolation").status, "fail");
  });
});

test("a rule naming a nonexistent contract is unbound, never pass, and blocks", async () => {
  const fixture = join(repositoryRoot, "test/fixtures/e2e/bind-and-prove-unbound");
  const result = await run(checkerCli, ["--dir", fixture, "--json"]);
  assert.equal(result.rows.find((r) => r.rule === "no-such-contract").status, "unbound");
  assert.equal(result.code, 2);
});

test("with the tool uninstalled, the rule is unavailable and does not block by default", async () => {
  const fixture = join(repositoryRoot, "test/fixtures/e2e/bind-and-prove");
  const result = await run(checkerCli, ["--dir", fixture, "--json"], { env: pathWithoutImportLinter });
  assert.equal(result.rows.find((r) => r.rule === "svc-db-isolation").status, "unavailable");
  assert.equal(result.code, 0);
  const strict = await run(checkerCli, ["--dir", fixture, "--require-tools", "--json"], {
    env: pathWithoutImportLinter,
  });
  assert.equal(strict.code, 2);
});
```

*Failure modes asserted:* `unbound` and `fail` both exit `2` and are never confused with `pass`;
`unavailable` is silent (exit `0`) unless `--require-tools`; a fixed violation returns to `pass`
without any state left over from the failing run (checker adapters are stateless per invocation).

This test family is also the release's **deterministic-checker corpus** (§8, "passing and failing
fixtures") — see D4. Additional fixtures under `test/fixtures/checkers/<tool>/{pass,fail,unbound,
unreadable-config,unavailable}/` extend the same harness across every bound tool
(`dependency-cruiser`, `semgrep`, `gitleaks`, `pytest-archon`, `oasdiff`, `osv-scanner`) rather than
only `import-linter`, so every result state in Q2.3's table is exercised for every tool at least once,
not only demonstrated once and assumed to generalize.

### E2E-2 — Drift observed, not asserted (SP3)

Fixture: `test/fixtures/e2e/drift-observed/` — a repo with an active `review` rule scoped to
`services/billing/**` and one `deterministic` rule bound to a tool the fixture deliberately does not
install.

```js
test("editing a scoped file queues an observation the drain classifies", async () => {
  const fixture = await cloneFixture("drift-observed");
  await appendQueueLine(fixture, "services/billing/discount.py", "Edit"); // simulates PostToolUse
  const report = await runDrain(fixture, { json: true });

  assert.equal(report.counts.reviewFinding, 1);
  assert.equal(report.counts.unclear, 1);
  assert.equal(report.counts.narrativeSkipped > 0, true); // narrative rules never classified
  const finding = report.findings.find((f) => f.category === "review-finding");
  assert.ok(finding.ruleId && finding.file && finding.line, "a review-finding must cite all three");
});

test("the deterministic rule with no installed tool reports unavailable, never a judgement", async () => {
  const fixture = await cloneFixture("drift-observed");
  const report = await runDrain(fixture, { json: true, env: withoutTheTool });
  const row = report.findings.find((f) => f.ruleId === "the-deterministic-rule");
  assert.equal(row.category, "unavailable");
  assert.notEqual(row.category, "review-finding"); // never a stand-in judgement — rule 6
});

test("deleting the queue loses nothing: git diff still drives the drain", async () => {
  const fixture = await cloneFixture("drift-observed");
  await commitAllChanges(fixture); // no queue entries, only a git diff against base
  const report = await runDrain(fixture, { json: true });
  assert.ok(report.counts.reviewFinding >= 1, "git diff alone still surfaces the committed change");
});

test("CI never reads the drift queue", async () => {
  const ciCommands = await readFile(join(repositoryRoot, "docs/building-packages.md"), "utf8");
  assert.doesNotMatch(ciCommands, /drift-queue\.jsonl/);
});
```

*Failure modes asserted:* the word "violation" never appears for anything but a `deterministic`
`fail`; a `review-finding` missing rule id, file, or line is downgraded to `unclear`, not accepted;
`narrative` rules are counted, never classified; the queue is disposable.

### E2E-3 — Bootstrap an undocumented repo (SP4)

Fixture: `test/fixtures/e2e/bootstrap-migration/` — three prose ADRs in `docs/adr/`, no schema
decisions anywhere.

```js
test("migration proposes, changes nothing active, and traces every input", async () => {
  const fixture = await cloneFixture("bootstrap-migration");
  const before = await sha256(join(fixture, "docs/adr")); // untouched-directory guard

  const migration = await runMigration(fixture, {
    inputs: ["docs/adr/0001-x.md", "docs/adr/0002-y.md", "docs/adr/0003-z.md"],
  });
  assert.equal(await sha256(join(fixture, "docs/adr")), before, "the prose ADR directory changed");

  const constitutionBefore = await tryReadConstitution(fixture);
  assert.equal(constitutionBefore, null); // no active decisions exist yet — nothing to render

  const report = await readFile(migration.reportPath, "utf8");
  for (const input of ["0001-x.md", "0002-y.md", "0003-z.md"]) {
    assert.match(report, new RegExp(escapeForRegExp(input)));
  }
  assert.doesNotMatch(report, /%|score|coverage/i);

  const proposed = await listDecisions(fixture, { status: "proposed" });
  assert.ok(proposed.every((d) => d.rules.every((r) => r.verification === "narrative")));

  await runPromote(fixture, [proposed[0].id, proposed[1].id]);
  const rendered = await readFile(join(fixture, "docs/architecture/constitution.md"), "utf8");
  for (const rule of proposed[0].rules) assert.match(rendered, new RegExp(escapeForRegExp(rule.id)));
  for (const rule of proposed[2].rules) assert.doesNotMatch(rendered, new RegExp(escapeForRegExp(rule.id)));
});
```

*Failure modes asserted:* `git diff` on `docs/adr/` is empty throughout; no existing file's prose
changes; every reverse-discovered rule starts `narrative`; the traceability report is exhaustive over
its inputs and carries no score; the constitution reflects exactly the promoted subset, nothing more.

### E2E-4 — Security decision without theatre (SP5)

Fixture: `test/fixtures/e2e/security-without-theatre/` — a small service with one trust boundary and
one committed secret, plus a `.gitleaks.toml` naming a real rule.

```js
test("the secret is found by gitleaks, not asserted by the model", async () => {
  const fixture = join(repositoryRoot, "test/fixtures/e2e/security-without-theatre");
  const result = await run(checkerCli, ["--dir", fixture, "--run", "--json"]);
  const secretRule = result.rows.find((r) => r.tool === "gitleaks");
  assert.equal(secretRule.status, "fail");
  assert.match(secretRule.evidence, /gitleaks/i); // the tool's own output is the evidence
});

test("a captured decision carries no score and a plausible-but-unbound control stays narrative", async () => {
  const decision = await readCapturedDecision(fixture, "0001-service-boundary-security.md");
  const byVerification = Object.groupBy(decision.rules, (r) => r.verification);
  assert.equal(byVerification.deterministic.length, 1);
  assert.equal(byVerification.deterministic[0].verifiedBy, "gitleaks#generic-api-key");
  assert.ok(byVerification.review.length >= 1);
  assert.ok(byVerification.narrative.length >= 1);
  assert.doesNotMatch(decision.body, /%|\bscore\b|\bmaturity\b|\/10\b/i);
});
```

*Failure modes asserted:* the finding cites the tool, not a model guess; a control with no real
binding is `narrative`, never promoted to `deterministic` to look more finished; the output shape
carries no ranking, percentage, or maturity level anywhere.

---

## Regression coverage for the original four skills, plus the fifth

0.3.1 named "a triggering regression, discovered silently" as its top risk. By 0.4.0 that risk
applies to five skills, not four, and it compounds across four intervening releases (0.3.2–0.3.5)
each of which touched at least one `SKILL.md` body. Three layers, mechanism unchanged from Q6.2:

1. **Frontmatter freeze, mechanically — extended to a fixture, not a rule of thumb.**
   `test/fixtures/skill-freeze/frontmatter-0.3.1.json` snapshots the four *original* skills' `name`
   and `description` byte-for-byte as they shipped in 0.3.1. `test/skill-freeze.test.mjs` asserts the
   live `SKILL.md` frontmatter is still byte-identical to that snapshot. This applies only to the four
   originals — the security skill is new at SP5 and has no 0.3.1 snapshot to be frozen against.

2. **Body-change visibility.** `test/fixtures/skill-freeze/body-manifest.json` holds a SHA-256 of
   each of the five `SKILL.md` bodies (post-frontmatter). A body edit must update the manifest
   deliberately — the same trick `scenarios.test.mjs` already uses for hardcoded scenario ids, applied
   to prose. The manifest's own diff is what tells a reviewer a body changed at all across five
   patch releases without re-diffing four files by hand.

3. **Behavioural re-run — the layer that actually catches a triggering regression.** Every scenario
   set that exists at 0.4.0 is re-run agent-driven, fresh session per scenario, prompt pasted verbatim
   without naming the skill, per `docs/validating-skills.md`:

   | Set | Owner | Scenarios |
   |---|---|---|
   | `test/scenarios/test-patterns.json` | SP1 (0.3.1) | 12 |
   | `test/scenarios/baseline-capture.json` | SP1 (0.3.1) | 6 |
   | `test/scenarios/drift-drain.json` | SP3 (0.3.5) | per its own spec |
   | `test/scenarios/migration.json` | SP4 (0.3.3) | per its own spec |
   | `test/scenarios/security.json` | SP5 (0.3.4) | per its own spec |

   Graded pass/fail with reasons into `test-runs/0.4.0/<set>/<scenario-id>/`, exactly the existing
   convention. **This is the one layer of the three that must not be skipped for schedule** — it is
   the only one that would have caught the exact risk 0.3.1 named.

One more check the topic-reference rule in `CLAUDE.md` implies, restated for SP6: **the references
SP2–SP5 added must not have pushed any `SKILL.md` past the point where selective retrieval
degrades.** SP6's audit reads each skill's reference list and states, per skill, whether a topic
reference is now warranted where none existed before — a finding, not a nit, and recorded in
`docs/release-checklist-0.4.0.md` even if the answer is "no change needed" for all five.

---

## Clean-install tests

Per Q6.3, unchanged in substance, restated for the state at 0.4.0:

**Both targets, from a clean clone at the release tag:**

```sh
npm ci
npm run build -- --target all
git status --short          # empty
npm test
npm run sync:check
grep -rn "0\.4\.0" package.json build/ .claude-plugin/ .agents/ docs/   # now expected to match, not empty
```

The last line inverts 0.3.1's release check: at 0.4.0 the string is supposed to appear (in
`package.json`'s version, the manifests, and this release's docs) — the release doc states exactly
which files it must appear in, so a reviewer can tell an expected match from a leftover placeholder.

**Claude**, in a scratch project outside this repository: `/plugin marketplace add …`, then
`/plugin install arch-crew`. Assert: all five skills appear under the `arch-crew:` namespace; every
new `runtime/<subsystem>/` entry point (checkers, migration, drift hooks) runs from
`$CLAUDE_PLUGIN_ROOT`; the hook registration (SessionStart, PostToolUse, Stop) is picked up and a
`PostToolUse` append actually lands in `.arch-crew/drift-queue.jsonl`.

**Codex**: `codex plugin marketplace add …`, `codex plugin add arch-crew@arch-crew`, new session.
Assert the same five-skill inventory; every runtime script runs from the installed plugin directory;
and — the point of the test — the absence of hooks changes no correctness outcome: the git-based
drain path on Codex produces the same classification E2E-2 produced on Claude, minus the
uncommitted-edit lane.

This stays **manual, by hand, once per release** (D8) — the in-repo proxy
(`test/build.test.mjs`, "the shipped generator runs from each target package," extended to every new
subsystem) is the automated stand-in, and `docs/building-packages.md`'s "Host validation before
release" section is extended with the exact commands above so the manual pass has a script to follow
rather than tribal memory.

---

## Approval-gate and deterministic-checker tests

**Approval gates.** SP4's `promote` verb is the only mechanism SP6 tests against, and SP6 tests
exactly what it guarantees — no more (D9):

- A migration or a captured decision producing only `proposed` files changes `constitution.md` by
  **zero bytes.** (Already true mechanically via `renderConstitution`'s `status === "active"` filter;
  SP6's test is the regression guard, not new behaviour.)
- `promote 0007 0009` flips exactly those two files' `status` to `active` and regenerates; a third
  `proposed` file is untouched.
- Promoting a nonexistent id, or an id that is not currently `proposed`, fails loudly and writes
  nothing (mirrors `build-constitution.mjs`'s existing exit-code discipline).
- Promoting the same id twice is a no-op on the second call, not an error and not a duplicate rule.

**What SP6 explicitly does not claim**, and states as a documented limitation in
`docs/release-checklist-0.4.0.md` and `docs/release-0.4.0.md`: nothing mechanically stops a model (or
a human) writing `status: active` directly into a decision file, bypassing `promote` entirely. A diff
showing `status: active` outside a `promote` invocation is a **reviewable smell**, not a blocked
action. This is unchanged from 0.3.1's own "Known limitations," and SP6's job is to keep saying so
accurately rather than let the existence of a `promote` verb imply a guarantee it does not provide.

**Deterministic-checker tests over passing and failing fixtures.** Covered above under E2E-1/D4: one
fixture family, `test/fixtures/checkers/<tool>/{pass,fail,unbound,unreadable-config,unavailable}/`,
exercised through `check-rules.mjs` for every tool in `KNOWN_TOOLS`, asserting every one of Q2.3's
seven result rows occurs for every tool at least once and that the CLI's exit codes (`0`/`1`/`2`/`3`)
match Q2.5's table in every combination the corpus produces.

---

## The release package

1. **README.** Update the skill table and the opening paragraph to five skills (audited per §7/D2).
   Extend "The baseline" section with three short additions: bootstrap/migration (point at the
   traceability report), verification (`check-rules.mjs`), and baseline evolution (promote + drift
   drain, in one sentence each — full detail stays in the referenced docs, not duplicated into
   README).
2. **Upgrade instructions for existing arch-crew users.** A "Upgrading from 0.3.x" section in
   `docs/release-0.4.0.md`: nothing is a breaking change to the four original skills' triggering or
   output contract; a repository already using the 0.3.1 baseline gains the new commands opt-in
   (checkers, migration, drift hooks, the security skill) with no action required to keep the
   existing behaviour; the one required step for anyone who wants the new deterministic-checker lane
   is binding real `verified_by` values, which SP2's shipped reference already tells the model to do
   during capture.
3. **Release notes**, `docs/release-0.4.0.md`, structured like `docs/release-0.3.1.md`: "What
   shipped" (rolling up SP2–SP6 in one place, since this is the first release a user actually sees the
   whole upgrade in), "New capabilities," "Breaking changes" (expected to be empty or near-empty —
   state so explicitly rather than omitting the heading), "Known limitations" (the carried-forward and
   newly-identified ones, listed below), "Compatibility," "Verification" (the clean-install commands
   above).
4. **Package-content audit — no unintended generated files or secrets.** Two checks, both documented
   commands rather than new code (D5, D7):
   - The existing `test/build.test.mjs` inventory test ("target inventories contain only their
     manifest, canonical skills, and the runtime"), extended to enumerate every `runtime/<subsystem>/`
     tree SP2–SP5 added. This already catches an unintended generated file — it is an equality
     assertion against the full file list, not an allowlist with gaps.
   - `gitleaks detect --source build/ --no-git` (or the equivalent already-bound `check-rules`
     invocation against arch-crew's own repository, dogfooding SP5) as a release-gate command in
     `docs/building-packages.md`'s host-validation section, run before tagging.

---

## Validation

**Layer 1 additions**, all new to SP6: `test/skill-freeze.test.mjs`, `test/e2e/*.test.mjs` (four
files plus their fixture corpora), `test/approval-gate.test.mjs`, and the extended `checker-corpus`
fixtures reused from E2E-1. `test/build.test.mjs` gains the extended runtime-tree inventory
assertion and re-runs its existing skill-count/advertised-terms tests against the now-five-skill
state (no new assertions needed there — those tests were already written generically over
`canonicalSkillNames()`, which is exactly why SP1 built them that way).

**Layer 2**: no new scenario set. SP6 cross-references the four sets SP2–SP5 already own, and adds
the 0.4.0 re-run of all five under `test-runs/0.4.0/`.

**What must all pass before the tag:**

```sh
npm test
npm run sync:check
npm run build -- --target all
git status --short
```

plus the clean-install pass (manual, both targets) and the `gitleaks` package audit, all recorded in
`docs/release-checklist-0.4.0.md`'s final section before `0.4.0` is tagged.

---

## Out of scope

New product capability of any kind — that is SP2–SP5's job, already done by the time SP6 starts. A
staleness sweep for accumulated `proposed` files (0.3.1 and Q4.4 both defer it explicitly). CI
automation of the clean-install test. A bespoke secrets scanner. A sixth skill. Any change to the
four original skills' frontmatter.

## Risks

- **Consolidating E2E-1 and the generic deterministic-checker corpus into one fixture family (D4).**
  If SP2's actual adapters diverge from the shapes assumed here, both the demonstration and the
  corpus break together instead of independently — mitigated by building the corpus as data
  (`test/fixtures/checkers/`) the harness iterates over, so adding a tool or a state is a fixture
  addition, not a new test file.
- **Zero new runtime code (D5) is a bet that SP2–SP5's shipped CLIs are stable enough by the time SP6
  starts that E2E fixtures can drive them directly.** If any interface named in this spec
  (`check-rules.mjs`'s flags, `promote`'s argument order, the migration CLI's shape) differs from
  what actually shipped, the plan's illustrative code needs a mechanical update, not a redesign — the
  fixtures and assertions describe behaviour, not the exact CLI surface.
- **The §2 rewrite is a genuine product-framing call, not a mechanical derivation.** It follows Path A
  of the decisions doc's Part 6 and folds in the "presentational choice" framing that document flagged
  as possibly dissolving the question rather than picking a side. If the user's original checklist
  intent was closer to Path B (a real mode switch), this spec's §2 does not deliver that — it makes
  the checklist honest about what shipped, not what a different roadmap would have shipped.
