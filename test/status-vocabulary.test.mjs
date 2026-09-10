import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CHECK_STATUSES } from "../runtime/checkers/registry.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Every file that can produce a checker status: the seven adapters
// (resolve()'s `reason` and run()'s `status`), check-rules.mjs (its own
// `status: "error"` / `"unavailable"` rows), and runtime/drift/packet.mjs
// (the packet-only `"not-run"`).
const SOURCE_FILES = [
  "runtime/checkers/ast-grep.mjs",
  "runtime/checkers/dependency-cruiser.mjs",
  "runtime/checkers/gitleaks.mjs",
  "runtime/checkers/import-linter.mjs",
  "runtime/checkers/oasdiff.mjs",
  "runtime/checkers/pytest-archon.mjs",
  "runtime/checkers/semgrep.mjs",
  "runtime/checkers/check-rules.mjs",
  "runtime/drift/packet.mjs",
];

// registry.mjs's CHECK_STATUSES is documented as the single source for the
// checker-status vocabulary, but nothing previously checked that claim
// mechanically — a new status could be introduced in one adapter (or in
// check-rules.mjs's gates, or in the drift packet) and never added to the
// array shared/observing-drift.md's judgement list is generated from. This
// scans every literal `status: "..."` / `reason: "..."` in the files that
// can emit one and asserts each is a member of CHECK_STATUSES.
test("every status literal emitted by a checker adapter, check-rules.mjs, or the drift packet is a member of CHECK_STATUSES", async () => {
  const pattern = /\b(?:status|reason)\s*:\s*"([a-z-]+)"/g;
  const found = new Set();
  for (const relativePath of SOURCE_FILES) {
    const text = await readFile(join(repositoryRoot, relativePath), "utf8");
    for (const match of text.matchAll(pattern)) {
      found.add(match[1]);
    }
  }
  // A sanity floor: if the scan finds nothing, the regex or file list broke,
  // not that the codebase stopped emitting statuses.
  assert.ok(found.size >= CHECK_STATUSES.length - 1, `expected to find close to CHECK_STATUSES.length distinct statuses, found: ${[...found].sort().join(", ")}`);
  const unknown = [...found].filter((status) => !CHECK_STATUSES.includes(status));
  assert.deepEqual(unknown, [], `status literal(s) not in CHECK_STATUSES: ${unknown.join(", ")}`);
});
