import { parseDecision, validateDecisions } from "../baseline/decisions.mjs";
import { scopesOverlap } from "./glob.mjs";

// Never reads anything but what the caller already read from the confirmed
// list. No filesystem access here on purpose — a unit test can prove nothing
// outside `confirmed` was consulted.
export function classifyInputs(confirmed) {
  return confirmed.map(({ path, text }) => {
    const filename = path.split("/").pop();
    try {
      return { path, kind: "schema-decision", decision: parseDecision(text, filename) };
    } catch (error) {
      return { path, kind: "prose", reason: error.message };
    }
  });
}

function schemaDecisions(classified) {
  return classified.filter((entry) => entry.kind === "schema-decision").map((entry) => entry.decision);
}

// Structural facts only — the same checks a real decisions directory gets,
// run across whatever schema decisions happen to be among the confirmed
// inputs. No judgement, no model.
export function structuralConflicts(classified) {
  return validateDecisions(schemaDecisions(classified));
}

// Two scopes are the SAME scope when they name the same set of globs, order
// and repetition aside. Rules that carry the same scope are shared ground by
// construction -- "both of these govern informant/**" is the design, not a
// finding -- so pairing them produces noise that is quadratic in the number
// of broadly scoped rules and drowns the overlaps worth reading.
function sameScope(scopeA, scopeB) {
  const key = (scope) => [...new Set(scope)].sort().join("\u0000");
  return key(scopeA) === key(scopeB);
}

// A candidate, never an assertion: two rules in different confirmed decisions
// whose scopes cannot be proven disjoint AND are not identical. A human reads
// the traceability report and decides whether it is a real conflict.
//
// The identical-scope suppression is what keeps this readable at scale: a
// twelve-decision consolidation carrying 127 rules produced 2,394 pairs, all
// of them from two decisions and nearly all of them "these two rules are both
// scoped informant/**". A section that long is skipped whole, which is exactly
// where a genuine conflict would hide.
export function candidateScopeConflicts(classified) {
  const decisions = schemaDecisions(classified);
  const conflicts = [];
  for (let i = 0; i < decisions.length; i += 1) {
    for (let j = i + 1; j < decisions.length; j += 1) {
      for (const ruleA of decisions[i].rules) {
        for (const ruleB of decisions[j].rules) {
          if (sameScope(ruleA.scope, ruleB.scope)) continue;
          if (scopesOverlap(ruleA.scope, ruleB.scope)) {
            conflicts.push({
              decisionA: decisions[i].id,
              decisionB: decisions[j].id,
              ruleA: ruleA.id,
              ruleB: ruleB.id,
              scopeA: ruleA.scope,
              scopeB: ruleB.scope,
            });
          }
        }
      }
    }
  }
  return conflicts;
}
