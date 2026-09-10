import { matchesScope } from "./globs.mjs";

// The honesty rule as data rather than prose. `forbidden` means the tool speaks
// and the model reports its status verbatim -- including when that status is
// `unavailable`, which is the single most likely place for this feature to go
// wrong. `skipped` means a narrative rule: counted, never graded.
export const JUDGEMENT = {
  deterministic: "forbidden",
  review: "required",
  narrative: "skipped",
};

// scopeCoverage rides along verbatim from check-rules.mjs's own row — see
// runtime/checkers/check-rules.mjs's scopeCoverageFor() for what the two
// values mean. When there is no real row to copy it from (check-rules never
// ran, or reported nothing for this rule), default to "repository-wide": the
// conservative answer, since nothing here confirms the verdict was ever
// confined to this rule's scope.
function checkerFor(rule, checkerRows) {
  if (rule.verification !== "deterministic") return null;
  if (!Array.isArray(checkerRows)) {
    return { status: "not-run", evidence: "check-rules did not run", scopeCoverage: "repository-wide" };
  }
  const row = checkerRows.find((candidate) => candidate.rule === rule.id);
  if (!row) return { status: "not-run", evidence: "check-rules reported no row for this rule", scopeCoverage: "repository-wide" };
  return { status: row.status, evidence: row.evidence ?? "", scopeCoverage: row.scopeCoverage ?? "repository-wide" };
}

export function buildPacket({ root, base, decisions, paths, queue, checkerRows }) {
  const active = decisions.filter((decision) => decision.status === "active");
  const rules = active
    .flatMap((decision) => decision.rules)
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  const sortedPaths = [...paths].sort((left, right) => (left.path < right.path ? -1 : 1));
  const matchedPaths = new Set();
  const reported = [];
  let narrativeSkipped = 0;
  let scopeless = 0;

  for (const rule of rules) {
    if (rule.verification === "narrative") {
      narrativeSkipped += 1;
      continue;
    }
    // A deterministic or review rule recorded with no `scope` can never be
    // matched, no matter what changes -- distinct from a rule whose scope
    // simply was not touched this run. Counting it separately keeps that
    // permanent, silent blind spot visible instead of indistinguishable from
    // an honest "nothing changed here".
    if (!Array.isArray(rule.scope) || rule.scope.length === 0) {
      scopeless += 1;
      continue;
    }
    const matched = sortedPaths
      .filter((entry) => matchesScope(entry.path, rule.scope, `rule ${rule.id}`))
      .map((entry) => entry.path);
    for (const path of matched) matchedPaths.add(path);
    if (matched.length === 0) continue;

    reported.push({
      id: rule.id,
      decision: rule.decision,
      statement: rule.statement,
      severity: rule.severity,
      verification: rule.verification,
      verifiedBy: rule.verifiedBy,
      scope: rule.scope,
      matched,
      checker: checkerFor(rule, checkerRows),
      judgement: JUDGEMENT[rule.verification],
    });
  }

  return {
    root,
    base,
    queue,
    paths: sortedPaths,
    rules: reported,
    narrativeSkipped,
    scopeless,
    outOfScope: sortedPaths.filter((entry) => !matchedPaths.has(entry.path)).length,
  };
}
