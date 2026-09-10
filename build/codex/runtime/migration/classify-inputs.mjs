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

// A candidate, never an assertion: two rules in different confirmed decisions
// whose scopes cannot be proven disjoint. A human reads the traceability
// report and decides whether it is a real conflict.
export function candidateScopeConflicts(classified) {
  const decisions = schemaDecisions(classified);
  const conflicts = [];
  for (let i = 0; i < decisions.length; i += 1) {
    for (let j = i + 1; j < decisions.length; j += 1) {
      for (const ruleA of decisions[i].rules) {
        for (const ruleB of decisions[j].rules) {
          if (scopesOverlap(ruleA.scope, ruleB.scope)) {
            conflicts.push({
              decisionA: decisions[i].id,
              decisionB: decisions[j].id,
              ruleA: ruleA.id,
              ruleB: ruleB.id,
            });
          }
        }
      }
    }
  }
  return conflicts;
}
