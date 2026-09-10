import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { FrontmatterError, parseFrontmatter } from "./frontmatter.mjs";
import { GlobError, compileGlob } from "../drift/globs.mjs";

export const STATUSES = ["proposed", "active", "superseded"];
export const VERIFICATIONS = ["deterministic", "review", "narrative"];
export const SEVERITIES = ["blocking", "warning"];

// The one definition of "which files in a decisions directory are decision
// files", shared by every loader (build-constitution, check-rules, drift,
// build-migration-report). A looser test -- "ends in .md and isn't
// constitution.md" -- treats a README.md or template.md left beside real
// decisions (the standard adr-tools layout) as a decision file, and
// parseDecision then fails it loudly instead of the directory being usable
// at all. discover-candidates.mjs deliberately uses a wider ADR_SHAPED test
// of its own (it is only building a menu of candidates to migrate, not
// loading decision files), so it is not a caller of this helper.
export const DECISION_FILENAME = /^\d{4}-[a-z0-9][a-z0-9-]*\.md$/;

export async function decisionFilenames(directory) {
  const entries = await readdir(directory);
  return entries.filter((name) => DECISION_FILENAME.test(name)).sort();
}

// v1 resolves a binding's shape and its tool, never the contract name inside the
// tool's config. That resolution belongs to the checker sub-project.
export const KNOWN_TOOLS = [
  "ast-grep",
  "dependency-cruiser",
  "gitleaks",
  "import-linter",
  "oasdiff",
  "pytest-archon",
  "semgrep",
];

const FILENAME = /^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$/;
const RULE_ID = /^[a-z0-9][a-z0-9-]*$/;
const BINDING = /^([a-z0-9-]+)#([\w./-]+)$/;
const REQUIRED = ["id", "status", "skill", "date", "commit"];

function fail(filename, message) {
  throw new Error(`${filename}: ${message}`);
}

function asList(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseRule(raw, decisionId, filename) {
  for (const field of ["id", "statement", "severity", "verification"]) {
    if (typeof raw[field] !== "string") fail(filename, `rule is missing '${field}'`);
  }
  if (!RULE_ID.test(raw.id)) fail(filename, `rule id '${raw.id}' must be a lowercase slug`);
  if (!SEVERITIES.includes(raw.severity)) {
    fail(filename, `rule '${raw.id}' has severity '${raw.severity}'; expected one of ${SEVERITIES.join(", ")}`);
  }
  if (!VERIFICATIONS.includes(raw.verification)) {
    fail(filename, `rule '${raw.id}' has verification '${raw.verification}'; expected one of ${VERIFICATIONS.join(", ")}`);
  }

  const verifiedBy = raw.verified_by ?? null;
  if (raw.verification === "deterministic" && !verifiedBy) {
    fail(filename, `rule '${raw.id}' claims deterministic verification but has no verified_by binding`);
  }
  if (raw.verification !== "deterministic" && verifiedBy) {
    fail(filename, `rule '${raw.id}' carries verified_by, but only a deterministic rule may bind to a checker`);
  }
  if (verifiedBy) {
    const binding = BINDING.exec(verifiedBy);
    if (!binding) fail(filename, `rule '${raw.id}' has a malformed verified_by: '${verifiedBy}' (expected tool#contract)`);
    if (!KNOWN_TOOLS.includes(binding[1])) {
      fail(filename, `rule '${raw.id}' binds to unknown tool '${binding[1]}'; known tools: ${KNOWN_TOOLS.join(", ")}`);
    }
  }

  const scope = asList(raw.scope);
  // Validated here, at parse time, against the one scope-glob matcher
  // (runtime/drift/globs.mjs) rather than left for the drift drain to
  // discover later: a bad pattern in one decision must fail loading that one
  // file with a clear message, not abort every rule's drift review the next
  // time anyone runs the drain. See shared/recording-decisions.md's scope
  // section for the supported subset.
  for (const pattern of scope) {
    try {
      compileGlob(pattern, `rule '${raw.id}'`);
    } catch (error) {
      if (error instanceof GlobError) fail(filename, error.message);
      throw error;
    }
  }

  return {
    id: raw.id,
    statement: raw.statement,
    scope,
    severity: raw.severity,
    verification: raw.verification,
    verifiedBy,
    decision: decisionId,
  };
}

export function parseDecision(text, filename) {
  const name = FILENAME.exec(filename);
  if (!name) fail(filename, "filename must be NNNN-slug.md");

  let parsed;
  try {
    parsed = parseFrontmatter(text);
  } catch (error) {
    if (error instanceof FrontmatterError) fail(filename, error.message);
    throw error;
  }
  const { values, body } = parsed;

  for (const field of REQUIRED) {
    if (typeof values[field] !== "string") fail(filename, `frontmatter is missing '${field}'`);
  }
  const id = Number(values.id);
  if (!Number.isInteger(id)) fail(filename, `id '${values.id}' is not an integer`);
  if (id !== Number(name[1])) fail(filename, `id ${values.id} does not match the filename`);
  if (!STATUSES.includes(values.status)) {
    fail(filename, `status '${values.status}' is not one of ${STATUSES.join(", ")}`);
  }

  const heading = /^# (.+)$/m.exec(body);
  if (!heading) fail(filename, "body has no '# Title' heading");

  const rules = asList(values.rules).map((raw) => {
    if (typeof raw !== "object") fail(filename, "rules must be a list of maps");
    return parseRule(raw, id, filename);
  });

  let supersededBy = null;
  if (values.superseded_by !== undefined) {
    supersededBy = Number(values.superseded_by);
    if (!Number.isInteger(supersededBy)) {
      fail(filename, `superseded_by '${values.superseded_by}' is not an integer`);
    }
  }

  return {
    id,
    slug: name[2],
    status: values.status,
    skill: values.skill,
    date: values.date,
    commit: values.commit,
    supersededBy,
    title: heading[1].trim(),
    body,
    rules,
    filename,
  };
}

export function validateDecisions(decisions) {
  const errors = [];
  const ids = new Map();
  const ruleIds = new Map();

  for (const decision of decisions) {
    if (ids.has(decision.id)) {
      errors.push(`decision ${decision.id} is declared by both ${ids.get(decision.id)} and ${decision.filename}`);
    }
    ids.set(decision.id, decision.filename);

    for (const rule of decision.rules) {
      if (ruleIds.has(rule.id)) {
        errors.push(`rule id '${rule.id}' is declared by both ${ruleIds.get(rule.id)} and ${decision.filename}`);
      }
      ruleIds.set(rule.id, decision.filename);
    }
  }

  for (const decision of decisions) {
    if (decision.status === "superseded") {
      if (decision.supersededBy === null) {
        errors.push(`${decision.filename} is superseded but has no superseded_by`);
      } else if (!ids.has(decision.supersededBy)) {
        errors.push(`${decision.filename} points at superseded_by ${String(decision.supersededBy).padStart(4, "0")}, which does not exist`);
      }
    } else if (decision.supersededBy !== null) {
      errors.push(`${decision.filename} carries superseded_by but its status is '${decision.status}'`);
    }
  }

  return errors.sort();
}

// The read-and-parse loop shared by every loader that needs decision files
// off disk: list the directory's decision filenames, parse each one, and
// collect a parse error per file that fails rather than aborting the whole
// directory on the first bad one. Returns raw parse errors only -- no
// cross-decision validation -- so a caller with its own notion of "what
// counts as an error for this loader" (build-migration-report.mjs's
// structural conflicts instead of validateDecisions' duplicate-id/rule
// checks) can build on this without inheriting checks it does not want.
export async function loadDecisionFiles(directory) {
  const names = await decisionFilenames(directory);
  const decisions = [];
  const parseErrors = [];
  for (const name of names) {
    try {
      decisions.push(parseDecision(await readFile(join(directory, name), "utf8"), name));
    } catch (error) {
      parseErrors.push(error.message);
    }
  }
  return { decisions, parseErrors };
}

// The composed loader used identically by check-rules.mjs, drift.mjs, and
// build-constitution.mjs: parse every decision file, then run the
// cross-decision checks (duplicate ids, duplicate rule ids, dangling
// superseded_by) over whatever parsed. build-migration-report.mjs is the one
// caller that does NOT want validateDecisions' checks -- it uses
// loadDecisionFiles directly and layers its own migration-specific
// structural conflicts on top instead.
export async function loadDecisions(directory) {
  const { decisions, parseErrors } = await loadDecisionFiles(directory);
  return { decisions, errors: [...parseErrors, ...validateDecisions(decisions)] };
}
