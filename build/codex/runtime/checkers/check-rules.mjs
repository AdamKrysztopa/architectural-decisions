#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { discoverDirectory } from "../baseline/build-constitution.mjs";
import { KNOWN_TOOLS, parseDecision, validateDecisions } from "../baseline/decisions.mjs";
import { assertRegistryAgreesWithKnownTools, getAdapter, registerAdapter } from "./registry.mjs";

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

async function loadDecisions(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".md") && name !== "constitution.md").sort();
  const decisions = [];
  const errors = [];
  for (const name of names) {
    try {
      decisions.push(parseDecision(await readFile(join(directory, name), "utf8"), name));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { decisions, errors: [...errors, ...validateDecisions(decisions)] };
}

function bindingOf(rule) {
  const [, tool, contract] = /^([a-z0-9-]+)#([\w./-]+)$/.exec(rule.verifiedBy);
  return { tool, contract };
}

// One row per deterministic rule. Never a model judgement, never a bare
// "resolved" with no evidence.
async function checkRule(root, rule, options) {
  const { tool, contract } = bindingOf(rule);
  const adapter = getAdapter(tool);
  if (!adapter) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `no checker adapter registered for '${tool}'` };
  }

  let resolution;
  try {
    resolution = await adapter.resolve(root, contract);
  } catch (error) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `${tool} adapter threw while resolving: ${error.message}` };
  }

  if (!resolution.resolved) {
    return { rule: rule.id, tool, contract, status: resolution.reason, evidence: resolution.evidence };
  }

  if (!options.run) {
    return {
      rule: rule.id,
      tool,
      contract,
      status: "unavailable",
      evidence: `${resolution.evidence} — run with --run to evaluate`,
    };
  }

  try {
    const outcome = await adapter.run(root, contract, resolution);
    return { rule: rule.id, tool, contract, status: outcome.status, evidence: outcome.evidence };
  } catch (error) {
    return { rule: rule.id, tool, contract, status: "error", evidence: `${tool} adapter threw while running: ${error.message}` };
  }
}

function isBlockingFailure(row, rule, options) {
  if (rule.severity !== "blocking") return false;
  if (["fail", "unbound", "unreadable-config", "error"].includes(row.status)) return true;
  if (row.status === "unavailable" && options.requireTools && options.run) return true;
  return false;
}

function isWarningFailure(row, rule, options) {
  if (rule.severity !== "warning") return false;
  if (["fail", "unbound", "unreadable-config", "error"].includes(row.status)) return true;
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
  const directory = options.dir
    ? (isAbsolute(options.dir) ? options.dir : resolvePath(cwd, options.dir))
    : await discoverDirectory(cwd);

  const { decisions, errors } = await loadDecisions(directory);
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
