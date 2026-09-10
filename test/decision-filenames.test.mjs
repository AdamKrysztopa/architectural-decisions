import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run as buildConstitution } from "../runtime/baseline/build-constitution.mjs";
import { run as checkRules } from "../runtime/checkers/check-rules.mjs";
import { run as buildMigrationReport } from "../runtime/migration/build-migration-report.mjs";
import { run as driftRun } from "../runtime/drift/drift.mjs";

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-crew-decision-filenames-"));
}

// Three modules (build-constitution's DECISION_FILENAME, discover-candidates'
// looser ADR_SHAPED, and every loadDecisions' historical "*.md and not
// constitution.md") used to define "which files in a decisions directory are
// decision files" three different ways, and all four loaders (build-
// constitution, check-rules, drift, build-migration-report) used the loosest
// one -- so a standard adr-tools layout (README.md, template.md, one real
// decision) parsed for a menu of candidates but blew up every one of the four
// entry points that actually load decisions. runtime/baseline/decisions.mjs's
// shared `decisionFilenames()` (the strict NNNN-slug.md test) is now the one
// definition every loader uses.
test("a decisions directory holding README.md and template.md beside a real decision loads cleanly through every entry point", async () => {
  const root = await scratch();
  try {
    const decisionsDir = join(root, "docs/adr");
    await mkdir(decisionsDir, { recursive: true });
    await writeFile(join(decisionsDir, "README.md"), "# Architecture Decision Records\n\nSee template.md.\n");
    await writeFile(
      join(decisionsDir, "template.md"),
      "# Title\n\n## Context\n## Decision\n## Consequences (cost)\n",
    );
    await writeFile(
      join(decisionsDir, "0001-example.md"),
      [
        "---",
        "id: 0001",
        "status: active",
        "skill: decide-architecture",
        "date: 2026-09-09",
        "commit: aaaaaaa",
        "rules:",
        "  - id: example-rule",
        "    statement: An example rule used only to prove non-decision files are skipped.",
        "    severity: warning",
        "    verification: narrative",
        "---",
        "# Example decision",
        "",
        "## Context",
        "## Decision",
        "## Consequences (cost)",
        "",
      ].join("\n"),
    );

    assert.equal(
      await buildConstitution(["--dir", decisionsDir], root),
      0,
      "build-constitution.mjs must not choke on README.md/template.md",
    );
    assert.equal(
      await checkRules(["--dir", decisionsDir, "--json"], root),
      0,
      "check-rules.mjs must not choke on README.md/template.md",
    );
    assert.equal(
      await driftRun(["drain", "--root", root, "--dir", decisionsDir, "--json"], root),
      0,
      "drift.mjs must not choke on README.md/template.md",
    );

    const manifestPath = join(root, "manifest.json");
    await writeFile(manifestPath, JSON.stringify({ inputs: [], dispositions: [] }));
    assert.equal(
      await buildMigrationReport(["--manifest", manifestPath, "--dir", decisionsDir], root),
      0,
      "build-migration-report.mjs must not choke on README.md/template.md",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
