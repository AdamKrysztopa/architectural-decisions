// The six dispositions a migration must be able to report -- migrated,
// merged, superseded, omitted, conflicting, unresolved -- plus the two
// original names kept as accepted aliases so existing manifests, fixtures and
// the committed expected report keep parsing.
//
// `omitted` and `unresolved` are the honest names for what `left-as-prose` and
// `unmapped` were already doing; the older names are narrower descriptions of
// the same outcome and stay valid. `conflicting` is genuinely new: before it,
// an input that could not be migrated *because it contradicted another input*
// had to be filed as unmapped, which lost the one fact a reader most needed.
export const DISPOSITIONS = [
  "migrated",
  "merged",
  "superseded",
  "omitted",
  "conflicting",
  "unresolved",
  // Accepted aliases, retained so nothing already written stops parsing.
  "left-as-prose",
  "unmapped",
];

// The six the reviewer's traceability requirement names, in report order. The
// renderer walks this so a category with no members is still shown as empty
// rather than silently missing -- "nothing was omitted" and "omission was
// never considered" must not look the same.
export const REPORTED_DISPOSITIONS = [
  "migrated",
  "merged",
  "superseded",
  "omitted",
  "conflicting",
  "unresolved",
];

// The older names fold into the category they always meant, so a report has
// six sections whichever vocabulary the manifest used.
export const DISPOSITION_ALIASES = { "left-as-prose": "omitted", unmapped: "unresolved" };

export function canonicalDisposition(kind) {
  return DISPOSITION_ALIASES[kind] ?? kind;
}

// Exported so every caller that needs to know which disposition kinds name a
// decision (the report's "Decisions generated" section, the CLI's proposal
// cap) reads from one place and can never drift apart from this module.
export const NAMES_A_DECISION = new Set(["migrated", "merged", "superseded"]);

// Every disposition that does NOT produce a decision must say why. An input
// that vanished from the record without a reason is exactly the silent loss
// the traceability report exists to prevent -- and `conflicting` needs one
// most of all, since "what did it conflict with" is the whole content of the
// finding.
const NEEDS_A_REASON = new Set(["omitted", "conflicting", "unresolved", "left-as-prose", "unmapped"]);

// Only the '## Sources' section counts as a citation -- a mention anywhere
// else in the body (e.g. explaining why a path was deliberately NOT used)
// must not satisfy the guarantee. The match must also land on a whole path
// token: a lookbehind/lookahead boundary keeps 'adr/x.md' from being
// satisfied by a cited 'docs/adr/x.md', and keeps 'x.md' from matching inside
// 'x.md.bak'.
function sourcesSection(body) {
  if (typeof body !== "string") return "";
  const start = /^## Sources\s*$/m.exec(body);
  if (!start) return "";
  const rest = body.slice(start.index + start[0].length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function citesSource(decision, path) {
  const section = sourcesSection(decision.body);
  if (!section) return false;
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`(?<![\\w./-])${escaped}(?![\\w./-])`);
  return boundary.test(section);
}

// Throws, naming the offending path, unless every confirmed input has exactly
// one disposition, every disposition's shape matches its kind, and every
// migrated/merged/superseded disposition's target decision actually cites the
// input it claims to be sourced from. This function is the traceability
// guarantee; the renderer below trusts it completely.
export function buildTraceability({ inputs, dispositions, decisions, generatedAt, conflicts = [] }) {
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
  const seen = new Map();

  for (const disposition of dispositions) {
    if (seen.has(disposition.path)) {
      throw new Error(`duplicate disposition recorded for input: ${disposition.path}`);
    }
    seen.set(disposition.path, disposition);

    if (!DISPOSITIONS.includes(disposition.kind)) {
      throw new Error(`${disposition.path}: unknown disposition '${disposition.kind}'`);
    }
    if (NAMES_A_DECISION.has(disposition.kind)) {
      if (!Number.isInteger(disposition.decisionId)) {
        throw new Error(`${disposition.path}: disposition '${disposition.kind}' must name a decision id`);
      }
      const target = decisionsById.get(disposition.decisionId);
      if (!target) {
        throw new Error(
          `${disposition.path}: names decision ${disposition.decisionId}, which was not generated in this run`,
        );
      }
      if (!citesSource(target, disposition.path)) {
        throw new Error(`${disposition.path}: decision ${disposition.decisionId} does not cite it in its Sources`);
      }
    }
    if (NEEDS_A_REASON.has(disposition.kind) && !disposition.reason) {
      throw new Error(`${disposition.path}: disposition '${disposition.kind}' must state a reason`);
    }
  }

  for (const input of inputs) {
    if (!seen.has(input.path)) throw new Error(`no disposition recorded for input: ${input.path}`);
  }
  for (const path of seen.keys()) {
    if (!inputs.some((input) => input.path === path)) {
      throw new Error(`disposition recorded for an input that was never confirmed: ${path}`);
    }
  }

  return { inputs, dispositions, decisions, generatedAt, conflicts };
}

function describeDisposition(disposition) {
  if (disposition.kind === "migrated") return `migrated → ${String(disposition.decisionId).padStart(4, "0")}`;
  if (disposition.kind === "merged") return `merged into ${String(disposition.decisionId).padStart(4, "0")}`;
  if (disposition.kind === "superseded") return `superseded by ${String(disposition.decisionId).padStart(4, "0")}`;
  return `${disposition.kind} (${disposition.reason})`;
}

export function renderTraceabilityReport(model) {
  const byPath = new Map(model.dispositions.map((disposition) => [disposition.path, disposition]));
  const sortedInputs = [...model.inputs].sort((a, b) => a.path.localeCompare(b.path));
  const sortedDecisions = [...model.decisions].sort((a, b) => a.id - b.id);

  const lines = [
    "<!-- Generated by arch-crew: runtime/migration/build-migration-report.mjs. Do not edit by hand. -->",
    "<!-- A point-in-time record of one migration run. Not regenerated automatically; not --checked. -->",
    "",
    "# Migration Report",
    "",
    `Generated ${model.generatedAt}.`,
    "",
    "## Inputs and their disposition",
    "",
  ];
  for (const input of sortedInputs) {
    lines.push(`- \`${input.path}\` — ${describeDisposition(byPath.get(input.path))}`);
  }

  // The same dispositions again, grouped into the six categories the
  // traceability requirement names. A category with no members is printed as
  // empty rather than omitted: "nothing was omitted" and "omission was never
  // considered" are different claims, and a reader checking that a 30-ADR
  // migration lost nothing needs to see all six accounted for.
  lines.push("", "## Traceability summary", "");
  for (const category of REPORTED_DISPOSITIONS) {
    const members = sortedInputs.filter(
      (input) => canonicalDisposition(byPath.get(input.path).kind) === category,
    );
    lines.push(`### ${category} (${members.length})`, "");
    if (members.length === 0) {
      lines.push("_None._", "");
      continue;
    }
    for (const input of members) {
      lines.push(`- \`${input.path}\` — ${describeDisposition(byPath.get(input.path))}`);
    }
    lines.push("");
  }
  lines.push(
    `Every one of the ${sortedInputs.length} confirmed input(s) appears in exactly one category above.`,
    "",
  );

  lines.push("", "## Decisions generated", "");
  const generatedDecisions = sortedDecisions.filter((decision) =>
    model.dispositions.some(
      (disposition) => NAMES_A_DECISION.has(disposition.kind) && disposition.decisionId === decision.id,
    ),
  );
  if (generatedDecisions.length === 0) {
    lines.push("_None. Nothing among the confirmed inputs warranted a new decision file._", "");
  }
  for (const decision of generatedDecisions) {
    const sources = model.dispositions.filter(
      (disposition) => NAMES_A_DECISION.has(disposition.kind) && disposition.decisionId === decision.id,
    );
    lines.push(`### ${String(decision.id).padStart(4, "0")} ${decision.title}`, "");
    lines.push(`- Sources: ${sources.map((source) => `\`${source.path}\``).join(", ")}`);
    if (decision.rules.length === 0) {
      lines.push("- Rules: none");
    } else {
      for (const rule of decision.rules) {
        lines.push(`- Rule \`${rule.id}\`: ${rule.verification}`);
      }
    }
    lines.push("");
  }

  lines.push("## Candidate conflicts", "");
  const sortedConflicts = [...(model.conflicts ?? [])].sort(
    (a, b) =>
      a.decisionA - b.decisionA ||
      a.decisionB - b.decisionB ||
      a.ruleA.localeCompare(b.ruleA) ||
      a.ruleB.localeCompare(b.ruleB),
  );
  if (sortedConflicts.length === 0) {
    lines.push(
      "_None detected. This is not a guarantee the decisions are compatible — only that no rule scopes were found to overlap._",
      "",
    );
  } else {
    lines.push(
      "Overlapping rule scopes across different decisions. These are candidates for a human to read, never an" +
        " assertion that the rules actually conflict — confirm, narrow the scope, or leave them as intentionally" +
        " shared ground.",
      "",
    );
    for (const conflict of sortedConflicts) {
      lines.push(
        `- Decision ${String(conflict.decisionA).padStart(4, "0")} rule \`${conflict.ruleA}\` and decision ` +
          `${String(conflict.decisionB).padStart(4, "0")} rule \`${conflict.ruleB}\` have overlapping scope.`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
