import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { cleanup, cloneFixture, repositoryRoot } from "./support.mjs";
import { parseDecision } from "../../runtime/baseline/decisions.mjs";

const execFileAsync = promisify(execFile);

// NOTE on a deviation from this task's plan text: the plan was written against an
// imagined single `runtime/migration/migrate.mjs --json --inputs <path>` CLI that
// classifies raw prose inputs and returns `{reportPath, proposed}` on stdout. SP4
// never shipped that -- it ships a purpose-split, human-in-the-loop pair instead:
// `discover-candidates.mjs` (lists ADR-shaped files, reads nothing) and
// `build-migration-report.mjs --manifest <path> --dir <decisions-dir>` (validates an
// already-authored decisions directory against a manifest and renders a
// traceability report; it has no --json and resolves to an exit code, not a JSON
// payload). Authoring the actual `status: proposed` decision files from prose is
// `shared/migrating-decisions.md`'s model-facing procedure, not something either CLI
// does. This mismatch is independently documented in
// `docs/superpowers/specs/2026-09-09-roadmap-consistency-audit.md` (Conflict 1b /
// I-1), whose prioritised fix #1 is exactly this rewrite: drive the real two-step
// flow, drop --inputs/--json, assert on the exit code and on migration-report.md's
// contents, and ship the fixture's decisions pre-written since the CLI does not
// author them. This suite follows that fix precisely.
const discoverCandidatesCli = join(repositoryRoot, "runtime/migration/discover-candidates.mjs");
const buildMigrationReportCli = join(repositoryRoot, "runtime/migration/build-migration-report.mjs");
const constitutionCli = join(repositoryRoot, "runtime/baseline/build-constitution.mjs");
const clones = [];
after(async () => {
  await Promise.all(clones.map(cleanup));
});

async function sha256Tree(dir) {
  const hash = createHash("sha256");
  const files = (await readdir(dir)).sort();
  for (const file of files) hash.update(await readFile(join(dir, file)));
  return hash.digest("hex");
}

// Copies the fixture's pre-written `status: proposed` decision files -- the
// output a human/agent following shared/migrating-decisions.md's consolidation
// procedure would have produced from the prose ADRs -- into place. This is the
// one step the runtime genuinely does not automate (SP4 D6: only a human, or the
// model acting on the human's behalf, authors a decision file); everything after
// this point in each test is a real, unmocked CLI invocation.
async function stageDecisions(dir, names) {
  const decisionsDir = join(dir, "docs/architecture/decisions");
  await mkdir(decisionsDir, { recursive: true });
  for (const name of names) {
    await cp(join(dir, "_staged-decisions", name), join(decisionsDir, name));
  }
  return decisionsDir;
}

async function runMigrationReport(dir, manifest) {
  const manifestPath = join(dir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [buildMigrationReportCli, "--manifest", "manifest.json", "--dir", "docs/architecture/decisions"],
      { cwd: dir },
    );
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("E2E-3: discovery lists exactly the undocumented repo's prose ADRs, reading nothing", async () => {
  const dir = await cloneFixture("e2e/bootstrap-migration");
  clones.push(dir);
  const { stdout } = await execFileAsync(process.execPath, [discoverCandidatesCli], { cwd: dir });
  assert.equal(
    stdout,
    "docs/adr/0001-rest-over-graphql.md\ndocs/adr/0002-postgres-for-orders.md\ndocs/adr/0003-events-for-billing.md\n",
  );
});

test("E2E-3: migration proposes, changes no prose, and traces every input", async () => {
  const dir = await cloneFixture("e2e/bootstrap-migration");
  clones.push(dir);
  const adrDir = join(dir, "docs/adr");
  const before = await sha256Tree(adrDir);

  const names = [
    "0001-rest-over-graphql.md",
    "0002-postgres-for-orders.md",
    "0003-events-for-billing.md",
  ];
  await stageDecisions(dir, names);

  const result = await runMigrationReport(dir, {
    inputs: names.map((name) => ({ path: `docs/adr/${name}` })),
    dispositions: [
      { path: "docs/adr/0001-rest-over-graphql.md", kind: "migrated", decisionId: 1 },
      { path: "docs/adr/0002-postgres-for-orders.md", kind: "migrated", decisionId: 2 },
      { path: "docs/adr/0003-events-for-billing.md", kind: "migrated", decisionId: 3 },
    ],
  });
  assert.equal(result.code, 0, `build-migration-report failed: ${result.stdout}${result.stderr ?? ""}`);

  // The prose ADR directory this migration read from is never touched.
  assert.equal(await sha256Tree(adrDir), before, "the prose ADR directory changed");

  const report = await readFile(join(dir, "docs/architecture/migration-report.md"), "utf8");
  for (const name of names) {
    assert.match(report, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(report, /%|\bscore\b|\bcoverage\b/i);

  // Fixture-integrity guard: pins the shape the rest of this test depends on,
  // via parseDecision so a frontmatter-schema regression is caught -- but this
  // alone is copy-then-read-back (stageDecisions wrote these files verbatim a
  // few lines up) and proves nothing about what the runtime produced.
  const parsedDecisions = [];
  for (const name of names) {
    const text = await readFile(join(dir, "docs/architecture/decisions", name), "utf8");
    const decision = parseDecision(text, name);
    assert.equal(decision.status, "proposed");
    for (const rule of decision.rules) assert.equal(rule.verification, "narrative");
    parsedDecisions.push(decision);
  }

  // The real claim, observed on product output: the rendered
  // migration-report.md lists each decision's rules with their verification,
  // per traceability.mjs's renderer.
  for (const decision of parsedDecisions) {
    for (const rule of decision.rules) {
      assert.match(report, new RegExp(`Rule \`${rule.id}\`: narrative`));
    }
  }

  // None of this migration's rules are live: generate (not --check) the
  // constitution from a decisions directory holding only `proposed`
  // decisions, and confirm none of their rule ids reach the rendered rollup.
  // --check against a directory with no constitution.md yet cannot observe
  // this -- it only reports a missing file, the same result it would give if
  // promotion gating were broken and every rule leaked through. Generating
  // for real is the version that fails the moment a proposed decision leaks
  // into the rendered authority.
  await execFileAsync(
    process.execPath,
    [constitutionCli, "--dir", "docs/architecture/decisions"],
    { cwd: dir },
  );
  const constitution = await readFile(join(dir, "docs/architecture/constitution.md"), "utf8");
  for (const ruleId of ["public-api-is-rest", "orders-use-postgres", "billing-reads-events-not-orders-db"]) {
    assert.doesNotMatch(constitution, new RegExp(ruleId));
  }
});

test("E2E-3: promoting a subset changes the constitution by exactly that subset", async () => {
  const dir = await cloneFixture("e2e/bootstrap-migration");
  clones.push(dir);
  const names = ["0001-rest-over-graphql.md", "0002-postgres-for-orders.md"];
  await stageDecisions(dir, names);
  await rm(join(dir, "_staged-decisions"), { recursive: true, force: true });

  const result = await runMigrationReport(dir, {
    inputs: names.map((name) => ({ path: `docs/adr/${name}` })),
    dispositions: [
      { path: "docs/adr/0001-rest-over-graphql.md", kind: "migrated", decisionId: 1 },
      { path: "docs/adr/0002-postgres-for-orders.md", kind: "migrated", decisionId: 2 },
    ],
  });
  assert.equal(result.code, 0, `build-migration-report failed: ${result.stdout}${result.stderr ?? ""}`);

  await execFileAsync(
    process.execPath,
    [constitutionCli, "promote", "1", "--dir", "docs/architecture/decisions"],
    { cwd: dir },
  );

  const rendered = await readFile(join(dir, "docs/architecture/constitution.md"), "utf8");
  assert.match(rendered, /public-api-is-rest/);
  assert.doesNotMatch(rendered, /orders-use-postgres/);

  // The unpromoted decision is untouched -- still proposed, not silently activated.
  const stillProposed = await readFile(
    join(dir, "docs/architecture/decisions/0002-postgres-for-orders.md"),
    "utf8",
  );
  assert.equal(parseDecision(stillProposed, "0002-postgres-for-orders.md").status, "proposed");
});
