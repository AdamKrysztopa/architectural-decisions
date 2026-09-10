---
name: design-patterns
description: "Use when choosing or assessing object-level design patterns (GoF and Python-idiomatic) — 'which pattern fits here', 'how should I structure this class', 'is this the right use of a factory/strategy/observer', 'how do I make these algorithms swappable', or any design-pattern code review. Branches automatically: greenfield → a short interview that returns one recommended pattern (with its Pythonic form); existing code → a review that maps smells to the patterns that fix them. Strongly prefers the language feature over the ceremony — reach for this whenever pattern/class-design questions come up, even if no pattern is named, and especially in Python."
---

# design-patterns : pick the pattern that fits — usually the language feature

Design patterns are **answers to recurring problems, not goals**. The two failure modes are
opposite and equally common: writing tangled code that *needed* a pattern, and bolting a GoF
pattern onto a problem the language already solves. This skill exists to land between them — and in
Python specifically, the idiomatic answer is frequently "you don't need the pattern, you need a
function / a module / a decorator / a dataclass / `with` / `singledispatch` / `asyncio`." Name the
pattern so the concept is clear; steer to the idiom.

Unlike architecture, patterns don't compose one-per-axis — so the recommendation is **one primary
pattern** (plus an optional alternative), not a stack.

Knowledge lives in two references you read on demand:
- `references/decision-tree.md` — the "what are you trying to do?" router → one pattern + its
  Pythonic caveat. Ends with a **"telling look-alikes apart"** cheat-sheet for the confusion pairs.
- `references/catalog.md` — the refactoring lens: code smells mapped to the pattern (and the
  language feature) that resolves them. Also carries the **disambiguation** ("patterns people
  confuse") and **principles** (SOLID / GRASP — *why* a smell is a smell) sections.

## Step 0 — Establish where the user is

Branch on **greenfield or refactoring?** Are we shaping new code, or assessing code that exists?

The request usually tells you: "how should I design X?" / "what's the cleanest way to…" =
greenfield; "is this the right pattern?" / a file to look at / "review this class" = refactoring.
Ask only if genuinely ambiguous.

**The system under discussion may not be this repository.** A third branch sits beside greenfield and
refactoring: the user describes a system that is not the code you can read — another team's service,
a product they are evaluating, an architecture on a whiteboard, or a repository you have no access
to. Reason about the system they describe, and say plainly which claims rest on their description
rather than on something you read. Do not substitute this repository for the one they meant, and do
not refuse the question because the code is absent — an absent codebase makes conclusions
provisional, not impossible. Where a step here calls for reading code, say what you would look for
and what it would change.

## What "finding" means in this skill's output

**A finding is a specific, actionable conclusion — what's wrong, where, why it matters, and the
fix — never a bare impression, and never a substitute for a tool's own verified result (a
violation, reported on its own).**

## Mode A — Greenfield: which-pattern interview

Read `references/decision-tree.md` and route.

1. Start at the top: **what are you trying to do?** → create · structure · vary behavior ·
   resource/idiom · application/concurrency. Then ask the one follow-up that pins the leaf.
2. Keep it to one or two questions — this tree is shallow by design; the goal is a fast, confident
   single answer, not an interrogation.
3. **Apply the cardinal rule before answering:** check whether plain Python already solves it. If
   it does, recommend the language feature *as* the pattern.

Output:

```
**Recommended: <Pattern>** — <why it fits, one or two lines>.
**In Python:** <the idiomatic form — the actual code shape to write>.
**Skip the pattern if:** <the simpler thing that's enough, when applicable>.
_Alternative:_ <other pattern> if <condition>.   ← only when a real fork exists
```

Show a tight idiomatic snippet when it makes the recommendation concrete — patterns are easier to
judge as five lines of real code than as a noun.

## Mode B — Refactoring: pattern review

The deliverable favours the **smallest change that improves clarity** — and a real possibility that
the best change is *removing* a hand-rolled pattern.

1. **Read the code and name the smells.** Use `references/catalog.md` (smell → pattern). Common
   tells: big construction/algorithm conditionals, subclass explosions, manual resource cleanup,
   getter/setter pairs, hand-rolled singletons, `if obj is not None` guards, SQL inlined in logic.
   The catalog's smells lean OOP/web-flavored; in library, scientific, or script code the highest-value
   finding is often **plain duplication or an import-time side effect that maps to no pattern at
   all** — the fix is "extract a shared function / helper, move the imports," and that is a perfectly
   legitimate review item. Never skip a real problem just because no catalog row names it; the goal
   is clearer code, not pattern coverage.
2. **Map each smell to its pattern — and its Pythonic form.** Crucially, decide per finding whether
   the fix is the pattern or a language feature that *replaces* it (a module instead of a singleton,
   `with` instead of try/finally, a dataclass instead of a builder, `singledispatch` instead of a
   visitor).
3. **Recommend conservatively.** Patterns that already fit and read well: leave them and say so.
   Don't pattern-ize code that's fine.
4. **When a smell maps to two patterns, disambiguate — don't guess.** Use the "patterns people
   confuse" section (Strategy vs State vs Command, Adapter vs Facade vs Proxy vs Decorator, …); the
   distinguishing question usually settles it. And where it sharpens the finding, name the
   **principle** being violated (SRP, OCP, DIP…) — "this class has three reasons to change" is often
   more persuasive than the pattern label.

Output:

```
## Pattern review

### Findings
1. **<smell>** — <where, file ref> · Fix: **<Pattern>** → in Python, <idiom> · Why: <the pain it
   removes> · Effort: <small/medium>
2. ...

**Leave as-is:** <patterns/classes that are already appropriate.>
**Consider simplifying away:** <hand-rolled patterns a language feature could replace.>
```

**"Already idiomatic — no pattern needed" is a valid, even ideal, verdict.** If the code reads well
and reaches for patterns only where they earn it, say so and stop. Don't manufacture findings; the
most Pythonic review is often a short one.

## Recording the outcome (usually chat; a file on request)

Most pattern picks are tactical — the right home for them is the code and its comments, not a
standing record — so this skill is **chat-first**. Don't create files by default.

Write a file when the decision is consequential enough to outlive the conversation, or when the
user asks:
- **A pattern choice that shapes a module's design** (e.g. "everything goes through a Service Layer
  + Unit of Work") → one decision file, following `references/recording-decisions.md` — no separate
  ADR file. Record the *Pythonic form chosen* in its `## Decision`, since that's the part future
  readers will second-guess.
- **A pattern review of existing code** → on request, write `docs/design-pattern-review-<YYYY-MM-DD>.md`
  (the Findings + Leave-as-is / Simplify-away sections).

Asked instead to consolidate existing ADRs into this schema, or to propose a baseline for a codebase
that has none? Read `references/migrating-decisions.md` and follow it.

Otherwise present the recommendation in chat and let the code be the record.

## Why this shape

The Pythonic caveat is attached to every recommendation on purpose: the most valuable thing this
skill can do is stop someone from building a metaclass singleton or a visitor hierarchy when a
module or `singledispatch` would do. A pattern earns its ceremony only when the plain-language
version genuinely falls short — so the recommendation always carries the cheaper alternative next to
it, and review mode is as willing to delete structure as to add it.

## Read-only mode

**Present the complete recommendation without creating or modifying repository files whenever
writing is off the table.** Two different things put it off the table, and both count:

- **The user asks for it.** "Review only", "don't change anything", "dry run", "just tell me", or an
  explicitly read-only target.
- **The environment imposes it.** You have no write access, the repository is not checked out, the
  session is sandboxed or read-only, the system under discussion is not this repository, or a tool
  call to write has already been refused. An environment-imposed constraint is not a reason to ask
  the user for permission you already know you do not have, and it is not a reason to skip the
  recommendation — produce the whole thing, and say once at the end that the artifact was not
  written and where it would have gone.

Otherwise persist the outcome. **Do not ask for confirmation when repository context is sufficient to
proceed.**

## Record the decision

Covered above: every recommendation this skill makes — **including an explicit refusal** — is
persisted, when a file is written at all, as the one decision file described above. Do not record
when the run only answered a question without recommending anything.

## Notice drift later

At a checkpoint — before a commit, or when a session start notice says edits are queued — drain the
observations and classify them: `references/observing-drift.md`. Report a violation only where a
tool actually failed.
