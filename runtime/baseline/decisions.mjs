import { FrontmatterError, parseFrontmatter } from "./frontmatter.mjs";

export const STATUSES = ["proposed", "active", "superseded"];
export const VERIFICATIONS = ["deterministic", "review", "narrative"];
export const SEVERITIES = ["blocking", "warning"];

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

  return {
    id: raw.id,
    statement: raw.statement,
    scope: asList(raw.scope),
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
