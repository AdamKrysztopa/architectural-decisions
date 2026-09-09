# The evidence guardrail for security findings (cross-cutting)

The decision tree decides **which security properties matter**. This file decides **whether a claim
about them may be made at all**. It is not a step and it has no gates — it applies to every finding,
in both modes.

> **A security finding nobody can trace to evidence is a security finding nobody should buy.**

## The one-sentence rule

**Name what the evidence actually supports, and never more.** A model that read some source files has
not scanned the repository. A model that recognises a library name has not checked an advisory feed.
If the claim needs a tool, the claim belongs to the tool.

This is the same rule `skills/test-patterns/references/oracles.md` applies to generated tests,
transplanted: there, the implementation must not be its own oracle; here, the model must not be its
own scanner.

## Every finding names four things

1. **The asset or boundary at risk** — a named thing with an owner and a loss.
2. **The actor** — specific and reachable. "An attacker" is not an actor.
3. **The impact** — what is lost, and whether it is reversible.
4. **The cheapest control that closes it, with that control's cost** — runtime, latency, key
   management, operational ownership, developer friction, on-call burden.

**A finding missing any one of the four is downgraded to an observation** and reported in a separate,
clearly labelled list. It is not a finding, and nobody should buy a control for it.

A control without a stated cost is how security theatre gets bought. Cost-per-pick is this crew's
signature move in every skill; it is not optional here because the topic is serious.

## Three evidence classes, never merged

| Class | Means | The word for it |
|---|---|---|
| Tool-proven | A checker with a **resolved** binding actually failed. | **violation** |
| Review | The design contradicts a stated property, and the finding cites the file, the boundary, and the specific structure that contradicts it. | **finding** |
| Narrative | An assumption or intent no tool and no review can grade. | **assumption** |

Report them as three sections with their evidentiary weight stated in words. **Never sort them into
one ranked list, and never publish a headline count that spans them.** "7 issues" covering one
`gitleaks` hit and six impressions is the theatre the whole `verification` vocabulary exists to
prevent.

**The word "violation" is reserved** for the first row. Everything else is a finding or an assumption.

## What binds to which tool

A `deterministic` rule requires `verified_by: <tool>#<contract>` naming a contract that **already
exists** in this repository's config. Read the config file and name what you found — `resolved
(gitleaks rule generic-api-key in .gitleaks.toml)` is evidence; `resolved` alone is an assertion.

| Concern | Tool | Config to read |
|---|---|---|
| Secrets in the tree or history | `gitleaks` | `.gitleaks.toml`, `gitleaks.toml` |
| Dangerous sinks, missing authorization patterns | `semgrep` | `.semgrep.yml`, `semgrep.yml`, `.semgrep/**.yml` |
| A new unauthenticated operation in the API contract | `oasdiff` | `.oasdiff.yaml`, or the CI invocation |
| Boundary and dependency-direction integrity | `import-linter`, `pytest-archon`, `dependency-cruiser` | `.importlinter`, test files, `.dependency-cruiser.json` |
| Known-vulnerable dependencies | **no bound tool in this package** | — |

Dependency advisories are not checkable through a binding here. A supply-chain rule stays `review` or
`narrative`, and the finding says: binding it requires a supply-chain scanner the repository runs in
CI. arch-crew will not run one and will not guess.

Then resolve and evaluate with the checker that ships in this package:

    node <plugin-root>/runtime/checkers/check-rules.mjs --dir <decisions dir> --run

`<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` in Claude Code and the installed plugin's directory in Codex.
Without `--run` the checker only resolves the binding against the repository's tool config — it never
invokes the adapter, so a resolved-but-unevaluated binding reports `unavailable`, not a pass and not a
violation. `unbound`, `unreadable-config` and `unavailable` are **not** passes — report the status the
checker reported, never a judgement in its place.

## What this skill never does

- **Enumerate CVEs or advisory IDs.** Advisory matching is a database lookup with a freshness
  property. Reciting one is reciting training data at an unknown date.
- **Grade dependency versions.** Age is not a vulnerability.
- **Report that it looked for secrets and found none.** A model that read some files has not searched
  history. Absence of evidence is not evidence of absence — the claim is simply not made.
- **Trace taint or reachable sinks in prose.** That produces confident, unfalsifiable claims.
- **Compute entropy over strings to find credentials.**
- **Write into a tool's config, or author the contract it then resolves.** Offer the snippet as
  something the user adds. A binding arch-crew wrote and arch-crew checked proves nothing about the
  repository.

## What is never the output

- A maturity score, a rating out of ten, a letter grade, a percentage, or "8 of 12 controls present".
- An OWASP Top-10 / ASVS / CIS tick sheet **as the deliverable**. Such a list is legitimate as a
  *coverage prompt for the interview* — a way to notice a question you did not ask — and illegitimate
  as the output, for the same reason `test-patterns` refuses to hand back a pyramid.
- A ranked risk register whose ranking is not derived from a stated impact and a named actor.
- A control recommended because a list has a row for it.

**When a user asks for a score, decline it in one sentence and give them the findings instead.** The
sentence: *"A number would hide which of these rests on a tool and which rests on my reading — here
are the three classes instead."* Then deliver. Do not lecture, and do not refuse the work.

## "Insufficient evidence" and "no change needed"

Both are correct outcomes and both must survive to the output.

- **Insufficient evidence.** The property matters, no tool is bound, and no design detail confirms or
  contradicts it. Say which tool would decide it, leave the rule `narrative`, and stop. This is the
  most commonly lost outcome in this skill.
- **No change needed.** The design is proportionate to its threat model. Say it plainly, keep the
  report short, and name the signal that would reopen it.
