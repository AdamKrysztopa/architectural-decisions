---
id: 0003
status: active
skill: threat-model
date: 2026-09-09
commit: ac6bea1
rules:
  - id: security-claims-are-bound
    statement: A security claim that a tool could decide is bound to a checker the repository already runs, or it is recorded as narrative. arch-crew never scans, and never writes into a tool's config.
    scope: ["skills/threat-model/**"]
    severity: blocking
    verification: review
  - id: no-security-scoring
    statement: No security output carries a maturity score, rating, grade, percentage, or control count. Findings are grouped by evidence class, never ranked into one list.
    scope: ["skills/threat-model/**", "test/scenarios/security.json"]
    severity: blocking
    verification: review
---
# Security ships as a fifth skill, and it never scans

## Context
Trust boundaries, authorization placement, secrets, data protection, supply chain, and agent/tool
permissions had no owner. The last of these spans agentic-patterns and decide-architecture and fits
in neither. A shared reference would have carried material most runs never need and would have had no
decision procedure; a topic reference on decide-architecture could not advertise itself, because the
four skills' frontmatter is frozen.

## Decision
The package grows to five skills. threat-model owns the architecture-level security decision and
records it in the existing baseline schema. It reuses gitleaks, semgrep, oasdiff and the boundary
checkers through verified_by bindings and reimplements none of them. Its output has three evidence
classes and no score.

## Consequences (cost)
The marketplace copy, both adapters, the two hardcoded inventories in build.test.mjs, and every
document that counts the skills changed in one release — a coordinated edit that will recur if a
sixth skill is ever added. Decision 0002's skill-frontmatter-is-frozen rule still names four skills;
it is left as written, because it is true of those four and an active decision's rules are not edited
in place.
