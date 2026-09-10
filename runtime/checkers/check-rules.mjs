#!/usr/bin/env node

import { isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { KNOWN_TOOLS } from "../baseline/decisions.mjs";
import { resolveRecord } from "../baseline/record.mjs";
import { CHECK_STATUSES, assertRegistryAgreesWithKnownTools, getAdapter, registerAdapter } from "./registry.mjs";

import astGrep from "./ast-grep.mjs";
import dependencyCruiser from "./dependency-cruiser.mjs";
import gitleaks from "./gitleaks.mjs";
import importLinter from "./import-linter.mjs";
import oasdiff from "./oasdiff.mjs";
import pytestArchon from "./pytest-archon.mjs";
import semgrep from "./semgrep.mjs";

for (const adapter of [astGrep, dependencyCruiser, gitleaks, importLinter, oasdiff, pytestArchon, semgrep]) {
  registerAdapter(adapter);
}
assertRegistryAgreesWithKnownTools(KNOWN_TOOLS);

function parseArgs(argv) {
  const options = { dir: null, run: false, requireTools: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--dir") {
      options.dir = argv[index + 1];
      if (!options.dir) throw new Error("--dir needs a path");
      index += 1;
    } else if (flag === "--run") {
      options.run = true;
    } else if (flag === "--require-tools") {
      options.requireTools = true;
    } else if (flag === "--json") {
      options.json = true;
    } else {
      throw new Error(
        `Unknown argument '${flag}'. Usage: check-rules.mjs [--dir <path>] [--run] [--require-tools] [--json]`,
      );
    }
  }
  return options;
}

function bindingOf(rule) {
  const [, tool, contract] = /^([a-z0-9-]+)#([\w./-]+)$/.exec(rule.verifiedBy);
  return { tool, contract };
}

// Whether this row's status can be trusted as confined to the rule's own
// `scope`, or is a repository-wide verdict a consumer must not attribute to
// this rule's scope specifically. A rule with no declared `scope` is always
// repository-wide (there is nothing to confine to); otherwise it depends on
// whether the bound adapter declares itself `scopeAware` (gitleaks, semgrep,
// and — once its --run ships — ast-grep filter their own findings against
// `scope`; every other adapter cannot be confined at all, per
// shared/recording-decisions.md). This is the JSON-native answer to "was an
// out-of-scope finding just attributed to a scoped rule?" — see
// runtime/checkers/gitleaks.mjs and semgrep.mjs's run() for the filtering
// itself, and runtime/drift/packet.mjs's checkerFor(), which copies this
// same field into the drift packet's `checker` object.
function scopeCoverageFor(rule, adapter) {
  if (!Array.isArray(rule.scope) || rule.scope.length === 0) return "repository-wide";
  return adapter?.scopeAware ? "scope-matched" : "repository-wide";
}

// One row per deterministic rule. Never a model judgement, never a bare
// "resolved" with no evidence.
async function checkRule(root, rule, options) {
  const { tool, contract } = bindingOf(rule);
  const adapter = getAdapter(tool);
  const scopeCoverage = scopeCoverageFor(rule, adapter);
  if (!adapter) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `no checker adapter registered for '${tool}'`, scopeCoverage };
  }

  let resolution;
  try {
    resolution = await adapter.resolve(root, contract);
  } catch (error) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `${tool} adapter threw while resolving: ${error.message}`, scopeCoverage };
  }

  if (!resolution.resolved) {
    return { rule: rule.id, tool, contract, status: resolution.reason, evidence: resolution.evidence, scopeCoverage };
  }

  if (!options.run) {
    return {
      rule: rule.id,
      tool,
      contract,
      status: "unavailable",
      evidence: `${resolution.evidence} — run with --run to evaluate`,
      scopeCoverage,
    };
  }

  try {
    const outcome = await adapter.run(root, contract, resolution, { scope: rule.scope });
    return { rule: rule.id, tool, contract, status: outcome.status, evidence: outcome.evidence, scopeCoverage };
  } catch (error) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `${tool} adapter threw while running: ${error.message}`, scopeCoverage };
  }
}

// Every status CHECK_STATUSES names is an outright gate failure here except
// "pass" (never a failure), "unavailable" (a failure only conditionally —
// under --require-tools --run, handled separately below), and "not-run"
// (packet-only; a check-rules.mjs row never carries it). Derived from
// CHECK_STATUSES, the single source for the status vocabulary, instead of
// re-typing the failing statuses as a second literal list that could drift
// from it.
const OUTRIGHT_FAILURE_STATUSES = CHECK_STATUSES.filter(
  (status) => status !== "pass" && status !== "unavailable" && status !== "not-run",
);

function isBlockingFailure(row, rule, options) {
  if (rule.severity !== "blocking") return false;
  if (OUTRIGHT_FAILURE_STATUSES.includes(row.status)) return true;
  if (row.status === "unavailable" && options.requireTools && options.run) return true;
  return false;
}

function isWarningFailure(row, rule, options) {
  if (rule.severity !== "warning") return false;
  if (OUTRIGHT_FAILURE_STATUSES.includes(row.status)) return true;
  if (row.status === "unavailable" && options.requireTools && options.run) return true;
  return false;
}

function printHuman(rows, skippedNonDeterministic) {
  for (const row of rows) {
    process.stdout.write(`${row.rule}  ${row.status}  ${row.tool}#${row.contract}  (${row.evidence})\n`);
  }
  process.stdout.write(`${skippedNonDeterministic} non-deterministic rule(s) counted, not graded.\n`);
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  // Reads the machine enforcement layer through the one mode-aware seam, so a
  // repository documenting itself in living documents is checked by exactly the
  // same code, against exactly the same rules, as one keeping ADR files.
  const { decisions, errors } = await resolveRecord(cwd, { dir: options.dir });
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }

  const active = decisions.filter((decision) => decision.status === "active");
  const rules = active.flatMap((decision) => decision.rules);
  const deterministic = rules.filter((rule) => rule.verification === "deterministic");
  const skippedNonDeterministic = rules.length - deterministic.length;

  // Tool configs (.importlinter, .gitleaks.toml, ...) live at the repository
  // root, not necessarily beside the decisions directory, so every adapter
  // resolves against cwd.
  const rows = [];
  for (const rule of [...deterministic].sort((left, right) => left.id.localeCompare(right.id))) {
    rows.push(await checkRule(cwd, rule, options));
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ rows, skippedNonDeterministic }, null, 2)}\n`);
  } else {
    printHuman(rows, skippedNonDeterministic);
  }

  const byRuleId = new Map(deterministic.map((rule) => [rule.id, rule]));
  if (rows.some((row) => isBlockingFailure(row, byRuleId.get(row.rule), options))) return 2;
  if (rows.some((row) => isWarningFailure(row, byRuleId.get(row.rule), options))) return 3;
  return 0;
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
