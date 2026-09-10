// The authoritative-source registry, and the drift loop's use of it.
//
// Three properties matter more than the rest and are tested hardest:
//   1. nothing is ever auto-designated;
//   2. a conflict is reported, never resolved;
//   3. the evidence gate survives the new layer -- a designated source can
//      produce a finding, and can never produce a violation.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_PRECEDENCE,
  SOURCE_KINDS,
  SourceError,
  addSource,
  changeSource,
  digestOf,
  findConflicts,
  loadSources,
  markChecked,
  normalizeSources,
  removeSource,
} from "../runtime/baseline/sources.mjs";
import { buildPacket } from "../runtime/drift/packet.mjs";
import { run as sourcesCli } from "../runtime/baseline/sources-cli.mjs";

async function project() {
  const root = await mkdtemp(join(tmpdir(), "arch-sources-"));
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "api"), { recursive: true });
  await mkdir(join(root, "src/payments"), { recursive: true });
  await writeFile(join(root, "docs/prd.md"), "# Payments PRD\n", "utf8");
  await writeFile(join(root, "docs/security.md"), "# Security requirements\n", "utf8");
  await writeFile(join(root, "api/payments.yaml"), "openapi: 3.0.0\n", "utf8");
  return root;
}

const PRD = { id: "payments-prd", kind: "prd", path: "docs/prd.md", covers: ["payments"] };
const API = {
  id: "payments-api",
  kind: "api-contract",
  path: "api/payments.yaml",
  covers: ["payments"],
  scope: ["src/payments/**"],
};
const SEC = { id: "sec-reqs", kind: "security-requirement", path: "docs/security.md", covers: ["pii"] };

// --- nothing is authoritative until a human says so ------------------------

test("a project with no registry designates nothing, and says so", async () => {
  const root = await project();
  const { sources } = await loadSources(root);
  assert.deepEqual(sources, []);
  // The empty listing is a success, not an error: having designated nothing is
  // a valid state, and the exit code must not imply otherwise.
  assert.equal(await sourcesCli(["list"], root), 0);
});

test("there is no way to designate a source without naming it", async () => {
  const root = await project();
  // No `discover`, no `--auto`, no scan. If one is ever added, this fails.
  for (const attempt of [["discover"], ["scan"], ["add", "--auto"], ["auto"]]) {
    assert.equal(await sourcesCli(attempt, root), 1, `'${attempt.join(" ")}' must not be a way in`);
  }
  assert.deepEqual((await loadSources(root)).sources, []);
});

test("a document sitting in docs/ is not authoritative merely by existing", async () => {
  const root = await project();
  await writeFile(join(root, "docs/some-old-draft.md"), "# Draft\n", "utf8");
  await addSource(root, PRD);
  const { sources } = await loadSources(root);
  assert.deepEqual(sources.map((source) => source.path), ["docs/prd.md"]);
});

// --- add / remove / change, provenance, identity ---------------------------

test("add, change and remove round-trip through the config file", async () => {
  const root = await project();

  await addSource(root, { ...PRD, designated_by: "product", designated_on: "2026-09-01", provenance: "Q3 review" });
  let { sources } = await loadSources(root);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].designated_by, "product");
  assert.equal(sources[0].provenance, "Q3 review");
  assert.equal(sources[0].precedence, DEFAULT_PRECEDENCE.prd);

  await changeSource(root, "payments-prd", { path: "docs/prd-v2.md", precedence: 99 });
  ({ sources } = await loadSources(root));
  // Identity is the id: the path changed, the source did not become a new one.
  assert.equal(sources[0].id, "payments-prd");
  assert.equal(sources[0].path, "docs/prd-v2.md");
  assert.equal(sources[0].precedence, 99);

  await removeSource(root, "payments-prd");
  assert.deepEqual((await loadSources(root)).sources, []);
});

test("the registry lives in the one committed config file and nowhere else", async () => {
  const root = await project();
  await addSource(root, PRD);
  const raw = JSON.parse(await readFile(join(root, "arch-crew.json"), "utf8"));
  assert.equal(raw.sources.length, 1);
  // No derived filesystem state is persisted: `present` and `currentDigest`
  // are computed on read, never written back as a cache that can go stale.
  assert.equal(raw.sources[0].present, undefined);
  assert.equal(raw.sources[0].currentDigest, undefined);
});

test("duplicate ids and two designations of one artifact are refused", () => {
  assert.throws(() => normalizeSources([PRD, PRD]), SourceError);
  assert.throws(
    () => normalizeSources([PRD, { ...PRD, id: "other-name" }]),
    /both designate docs\/prd\.md/,
  );
});

test("an unknown kind is refused rather than accepted as 'other'", () => {
  assert.throws(() => normalizeSources([{ ...PRD, kind: "vibes" }]), SourceError);
  for (const kind of SOURCE_KINDS) {
    assert.doesNotThrow(() => normalizeSources([{ ...PRD, kind }]));
  }
});

test("a malformed governing glob is refused at designation time, not during a drain", async () => {
  const root = await project();
  // Validated by the SAME matcher a rule's scope goes through, so a source
  // cannot express a scope a rule could not -- and the failure lands at
  // designation, where the user is looking, rather than mid-drain.
  await assert.rejects(addSource(root, { ...API, scope: ["src/a**b"] }), SourceError);
  await assert.rejects(addSource(root, { ...API, scope: ["/absolute/**"] }), SourceError);
  assert.deepEqual((await loadSources(root)).sources, []);
});

test("changing a source cannot smuggle in an invalid one", async () => {
  const root = await project();
  await addSource(root, PRD);
  await assert.rejects(changeSource(root, "payments-prd", { kind: "not-a-kind" }), SourceError);
  assert.equal((await loadSources(root)).sources[0].kind, "prd");
});

// --- traceability to the baseline being checked ----------------------------

test("a source records which baseline it was checked against, and notices when it moves", async () => {
  const root = await project();
  await addSource(root, API);

  let { sources } = await loadSources(root);
  assert.equal(sources[0].checked_at, null);
  // Never checked is distinguishable from checked-and-unchanged.
  assert.equal(sources[0].changedSinceChecked, null);

  await markChecked(root, "payments-api", "4a91c02");
  ({ sources } = await loadSources(root));
  assert.equal(sources[0].checked_at, "4a91c02");
  assert.equal(sources[0].changedSinceChecked, false);
  assert.equal(sources[0].digest, digestOf("openapi: 3.0.0\n"));

  await writeFile(join(root, "api/payments.yaml"), "openapi: 3.0.0\npaths: {}\n", "utf8");
  ({ sources } = await loadSources(root));
  assert.equal(sources[0].changedSinceChecked, true);
  // The pinned digest is what it was checked at, not what is on disk now.
  assert.equal(sources[0].digest, digestOf("openapi: 3.0.0\n"));
});

test("checking a source that is not present is refused", async () => {
  const root = await project();
  await addSource(root, { ...PRD, path: "docs/nope.md" });
  await assert.rejects(markChecked(root, "payments-prd", "HEAD"), /not present/);
});

// --- conflicts are reported, never resolved --------------------------------

test("two sources claiming one subject are reported, and the loser is still listed", async () => {
  const root = await project();
  await addSource(root, PRD);
  await addSource(root, API);

  const { sources } = await loadSources(root);
  const conflicts = findConflicts(sources);
  const subject = conflicts.find((conflict) => conflict.subject === "payments");

  assert.ok(subject, "a shared subject must be reported");
  assert.equal(subject.kind, "precedence-ordered");
  // Both are named. Precedence ordered the report; it did not delete the PRD.
  assert.deepEqual(subject.sources.map((source) => source.id), ["payments-api", "payments-prd"]);
  assert.match(subject.note, /not resolved by that/);
});

test("equal precedence is reported as unresolvable rather than broken arbitrarily", async () => {
  const root = await project();
  await addSource(root, PRD);
  await addSource(root, { ...API, precedence: DEFAULT_PRECEDENCE.prd });

  const conflict = findConflicts((await loadSources(root)).sources).find((entry) => entry.subject === "payments");
  assert.equal(conflict.kind, "unresolvable-by-precedence");
  assert.match(conflict.note, /a human must decide/);
});

test("a source that disappeared, and one that moved since it was checked, are both reported", async () => {
  const root = await project();
  await addSource(root, SEC);
  await addSource(root, API);
  await markChecked(root, "payments-api", "HEAD");
  await writeFile(join(root, "api/payments.yaml"), "changed\n", "utf8");
  await changeSource(root, "sec-reqs", { path: "docs/gone.md" });

  const conflicts = findConflicts((await loadSources(root)).sources);
  assert.ok(conflicts.some((conflict) => conflict.kind === "missing"));
  const stale = conflicts.find((conflict) => conflict.kind === "stale-baseline");
  assert.ok(stale);
  // The wording must not overclaim: a moved source makes claims unverified.
  assert.match(stale.note, /unverified, not wrong/);
});

// Captures what a CLI wrote to stdout, so output volume can be asserted on
// rather than eyeballed. Restores the real write even if the run throws.
async function capture(work) {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    const code = await work();
    return { code, out: written.join("") };
  } finally {
    process.stdout.write = original;
  }
}

test("add confirms in one line and does not reprint the whole registry", async () => {
  // Designating four sources used to print the registry four times, growing
  // each time: ten entry blocks where four confirmation lines were wanted.
  const root = await project();
  const added = [
    ["add", "--id", "payments-prd", "--kind", "prd", "--path", "docs/prd.md"],
    ["add", "--id", "sec-reqs", "--kind", "security-requirement", "--path", "docs/security.md"],
    ["add", "--id", "payments-api", "--kind", "api-contract", "--path", "api/payments.yaml"],
  ];
  const { out } = await capture(async () => {
    for (const argv of added) assert.equal(await sourcesCli(argv, root), 0);
    return 0;
  });

  assert.equal(out.split("\n").filter((line) => line.startsWith("Designated ")).length, 3);
  // One line per add, and nothing from the entry renderer.
  assert.equal(out.trim().split("\n").length, 3);
  assert.doesNotMatch(out, /^ {2}path: {8}/m);
  assert.doesNotMatch(out, /^ {2}designated: {2}/m);
  // The registry itself is unaffected: this is an output change, not a write change.
  assert.deepEqual((await loadSources(root)).sources.map((source) => source.id).sort(), [
    "payments-api",
    "payments-prd",
    "sec-reqs",
  ]);
});

test("add still exits 3, in one line, when the write creates a conflict", async () => {
  // The volume goes, the signal does not: a CI gate keying on exit 3 keeps working.
  const root = await project();
  const { code, out } = await capture(async () => {
    await sourcesCli(["add", "--id", "payments-prd", "--kind", "prd", "--path", "docs/prd.md", "--covers", "payments"], root);
    return sourcesCli(
      ["add", "--id", "payments-api", "--kind", "api-contract", "--path", "api/payments.yaml", "--covers", "payments", "--precedence", "40"],
      root,
    );
  });
  assert.equal(code, 3);
  assert.match(out, /conflict\(s\) now reported between designated sources\. See: arch sources list/);
  assert.doesNotMatch(out, /^ {2}path: {8}/m);
});

test("the list command exits 3 on a conflict, distinct from a failed invocation", async () => {
  const root = await project();
  assert.equal(await sourcesCli(["list"], root), 0);
  await addSource(root, PRD);
  await addSource(root, API);
  assert.equal(await sourcesCli(["list"], root), 3);
  assert.equal(await sourcesCli(["list", "--nonsense"], root), 1);
});

// --- drift binds to the registry, and the evidence gate holds --------------

const RULE_DECISION = {
  id: 1,
  status: "active",
  filename: "0001-x.md",
  rules: [
    {
      id: "r",
      decision: 1,
      statement: "s",
      scope: ["src/**"],
      severity: "blocking",
      verification: "narrative",
      verifiedBy: null,
    },
  ],
};

function packetWith(sources, paths) {
  return buildPacket({
    root: "/r",
    base: null,
    decisions: [RULE_DECISION],
    paths: paths.map((path) => ({ path, sources: ["queue"], tools: ["Edit"] })),
    queue: { observed: paths.length, malformed: 0, atCap: false, truncated: false, since: null },
    checkerRows: [],
    sources,
  });
}

test("the drain names the designated source an edit falls under", async () => {
  const root = await project();
  await addSource(root, API);
  await addSource(root, SEC);
  const { sources } = await loadSources(root);

  const packet = packetWith(sources, ["src/payments/charge.py"]);
  assert.equal(packet.sources.length, 1);
  assert.equal(packet.sources[0].id, "payments-api");
  assert.deepEqual(packet.sources[0].governs, ["src/payments/charge.py"]);
  assert.match(packet.sources[0].note, /designated authoritative/);
  // The security requirement governs no code and was not edited, so it is not
  // dragged into a report it has nothing to do with.
  assert.equal(packet.sources.find((entry) => entry.id === "sec-reqs"), undefined);
});

test("editing the designated artifact itself is reported as such", async () => {
  const root = await project();
  await addSource(root, API);
  const { sources } = await loadSources(root);

  const packet = packetWith(sources, ["api/payments.yaml"]);
  assert.equal(packet.sources[0].edited, true);
  assert.match(packet.sources[0].note, /was edited this session/);
});

test("THE EVIDENCE GATE: no designated source can ever produce a violation", async () => {
  const root = await project();
  await addSource(root, API);
  await addSource(root, SEC);
  await addSource(root, PRD);
  const { sources } = await loadSources(root);

  const packet = packetWith(sources, ["src/payments/charge.py", "api/payments.yaml", "docs/prd.md"]);
  assert.ok(packet.sources.length > 0, "the fixture must actually exercise the layer");

  for (const entry of packet.sources) {
    // "review" is the only judgement available to this layer. A source is read
    // by a human; no checker speaks for one, so the deterministic lane -- the
    // only lane that can yield a violation -- is structurally out of reach.
    assert.equal(entry.judgement, "review", `${entry.id} must be advisory`);
    assert.equal(entry.verifiedBy, undefined, `${entry.id} must not carry a checker binding`);
    assert.equal(entry.checker, undefined, `${entry.id} must not carry a checker verdict`);
  }
  // And the rule lane is untouched by any of it.
  assert.equal(packet.rules.length, 0, "the narrative rule is still skipped, not upgraded");
  assert.equal(packet.narrativeSkipped, 1);
});

test("sources that nothing touched do not appear in the packet at all", async () => {
  const root = await project();
  await addSource(root, API);
  const { sources } = await loadSources(root);
  assert.deepEqual(packetWith(sources, ["README.md"]).sources, []);
});

test("a packet built with no registry is exactly the packet it was before", () => {
  const packet = packetWith([], ["src/a.py"]);
  assert.deepEqual(packet.sources, []);
  assert.deepEqual(packet.sourceConflicts, []);
});
