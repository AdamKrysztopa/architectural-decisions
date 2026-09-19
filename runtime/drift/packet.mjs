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

// The designated-authoritative-source layer of the packet.
//
// This is what lets the drain say "this contradicts the API contract and the
// security requirements you designated as authoritative" instead of only "this
// contradicts a decision file". It reports two establishable facts and nothing
// else:
//
//   - `governs`: an observed edit landed inside code a designated source's
//     `scope` governs;
//   - `edited`: the designated artifact itself was edited.
//
// **The evidence gate holds here without exception.** No tool ran, so nothing
// in this layer is ever a violation. Every entry carries `judgement: "review"`
// and states in its own words that it is a pointer to a document a human must
// read, not a verdict about the code. A source cannot be "failed": it can only
// be read, and the reading is the human's.
function sourceContext(sources, sortedPaths) {
  const reported = [];

  for (const source of sources) {
    const governed = Array.isArray(source.scope) && source.scope.length > 0
      ? sortedPaths
          .filter((entry) => matchesScope(entry.path, source.scope, `source ${source.id}`))
          .map((entry) => entry.path)
      : [];
    const edited = sortedPaths.filter((entry) => entry.path === source.path).map((entry) => entry.path);

    if (governed.length === 0 && edited.length === 0) continue;

    reported.push({
      id: source.id,
      kind: source.kind,
      path: source.path,
      precedence: source.precedence,
      covers: source.covers,
      scope: source.scope,
      governs: governed,
      edited: edited.length > 0,
      present: source.present,
      checkedAt: source.checked_at,
      changedSinceChecked: source.changedSinceChecked,
      // Never "forbidden": no checker speaks for a designated source, so the
      // deterministic lane is not available to it and must not be implied.
      judgement: "review",
      note:
        edited.length > 0
          ? `${source.path} is designated authoritative (${source.kind}) and was edited this session. Whatever it now says is what this repository is held to — re-read it before treating the change as settled.`
          : `${governed.length} edited path(s) fall inside code governed by ${source.path}, which this project designated authoritative (${source.kind}). Read it against the change; no tool checked this, so this is a finding, not a violation.`,
    });
  }

  return reported.sort((left, right) => right.precedence - left.precedence || (left.id < right.id ? -1 : 1));
}

// Architecture documents found in a repository with no decision record. Same
// authority as a designated source -- a pointer, never a verdict -- and less
// provenance: nobody has designated these, so each says so in its own note.
function documentContext(documents, sources, sortedPaths) {
  const designated = new Set(sources.map((source) => source.path));
  const edited = new Set(sortedPaths.map((entry) => entry.path));
  return documents
    .filter((path) => !designated.has(path))
    .map((path) => ({
      path,
      edited: edited.has(path),
      judgement: "review",
      note: edited.has(path)
        ? `${path} was edited this session. It is not designated authoritative, so it binds nothing yet; read it as context.`
        : `${path} is architecture documentation nobody has designated authoritative. Read the edits against it as context; it binds nothing yet.`,
    }));
}

export function buildPacket({
  root,
  base,
  baseStatus = base ? "explicit" : "unavailable",
  decisions,
  paths,
  queue,
  checkerRows,
  sources = [],
  sourceConflicts = [],
  record = "present",
  documents = [],
  nextStep = null,
}) {
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
    // "absent" means no decision record exists yet, so `rules` is empty by
    // construction rather than because nothing drifted; `nextStep` says what
    // would give this drain something to classify against.
    record,
    nextStep,
    base,
    // How much the comparison window is worth. "degenerate" means the base
    // resolved to HEAD itself, so `git diff base...HEAD` is empty by
    // construction and no committed change could have reached this packet --
    // report that before reporting anything the packet does or does not hold.
    baseStatus,
    queue,
    paths: sortedPaths,
    rules: reported,
    // Designated authoritative sources touched by this session's edits, and
    // any conflicts the registry reports between them. Both are advisory by
    // construction — see sourceContext above.
    sources: sourceContext(sources, sortedPaths),
    sourceConflicts,
    documents: documentContext(documents, sources, sortedPaths),
    narrativeSkipped,
    scopeless,
    outOfScope: sortedPaths.filter((entry) => !matchedPaths.has(entry.path)).length,
  };
}
