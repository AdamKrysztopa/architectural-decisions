#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadDecisionFiles } from "../baseline/decisions.mjs";
import { writeAtomically } from "../baseline/write-atomically.mjs";
import { candidateScopeConflicts, structuralConflicts } from "./classify-inputs.mjs";
import { buildTraceability, renderTraceabilityReport } from "./traceability.mjs";

const DEFAULT_CAP = 20;

function parseArgs(argv) {
  const options = { manifest: null, dir: null, cap: DEFAULT_CAP };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--manifest") {
      options.manifest = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--dir") {
      options.dir = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--cap") {
      options.cap = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument '${argv[index]}'`);
    }
  }
  if (!options.manifest) throw new Error("--manifest <path> is required");
  if (!options.dir) throw new Error("--dir <path> is required");
  if (!Number.isInteger(options.cap) || options.cap < 0) throw new Error("--cap must be a non-negative integer");
  return options;
}

// Wraps already-parsed decisions in classify-inputs.mjs's "classified" shape
// so its mechanical checks -- the same ones a confirmed migration input gets
// -- run over the decisions this report is about, instead of sitting unused.
function asClassified(decisions) {
  return decisions.map((decision) => ({ path: decision.filename, kind: "schema-decision", decision }));
}

// decisionFilenames' NNNN-slug.md test (applied inside loadDecisionFiles)
// already excludes constitution.md and migration-report.md (neither is
// shaped like a decision file), along with any README.md/template.md left in
// an adr-tools-style directory. Unlike runtime/baseline/decisions.mjs's own
// loadDecisions(), this does NOT run validateDecisions' cross-decision checks
// -- it substitutes its own migration-specific structural conflicts instead.
async function loadDecisions(directory) {
  const { decisions, parseErrors } = await loadDecisionFiles(directory);
  const classified = asClassified(decisions);
  return {
    decisions,
    errors: [...parseErrors, ...structuralConflicts(classified)],
    conflicts: candidateScopeConflicts(classified),
  };
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  const manifestPath = isAbsolute(options.manifest) ? options.manifest : resolve(cwd, options.manifest);
  const directory = isAbsolute(options.dir) ? options.dir : resolve(cwd, options.dir);

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    process.stderr.write(`Could not read manifest ${manifestPath}: ${error.message}\n`);
    return 1;
  }

  if (!(await stat(directory).then((s) => s.isDirectory()).catch(() => false))) {
    process.stderr.write(`No decisions directory at ${directory}\n`);
    return 1;
  }

  const { decisions, errors, conflicts } = await loadDecisions(directory);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }

  // Count every status: proposed decision file in the directory, not just the
  // ones a disposition happens to name. Reverse discovery has no inputs and no
  // dispositions to count (it proposes straight from code observation), and a
  // duplicate/superseded disposition still writes a brand-new proposed file --
  // either way, what the cap must bound is "how many unreviewed proposed
  // decisions will a human face," which is a fact about the directory, not
  // about which disposition kind happened to introduce each one, or how many
  // separate migration passes wrote them. shared/migrating-decisions.md
  // documents this as a directory-wide backlog cap, not a per-run one -- keep
  // the two in agreement if either changes.
  const proposedCount = decisions.filter((decision) => decision.status === "proposed").length;
  if (proposedCount > options.cap) {
    process.stderr.write(
      `This directory holds ${proposedCount} unreviewed proposed decisions (cap ${options.cap}); ` +
        "promote or discard some before proposing more. Rank what matters most.\n",
    );
    return 1;
  }

  let model;
  try {
    model = buildTraceability({
      inputs: manifest.inputs,
      dispositions: manifest.dispositions,
      decisions,
      conflicts,
      generatedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  const target = join(dirname(directory), "migration-report.md");
  await writeAtomically(target, renderTraceabilityReport(model));
  process.stdout.write(`Wrote ${target} (${model.inputs.length} input(s), ${decisions.length} decision(s))\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
