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
  + Unit of Work") → an ADR at `docs/adr/NNNN-short-title.md` (lowercase words joined by hyphens;
  4-digit number, one past the highest in `docs/adr/`, else `0001`), with **Context / Decision /
  Consequences** — and record the *Pythonic
  form chosen* in the Decision, since that's the part future readers will second-guess.
- **A pattern review of existing code** → on request, write `docs/design-pattern-review-<YYYY-MM-DD>.md`
  (the Findings + Leave-as-is / Simplify-away sections).

Otherwise present the recommendation in chat and let the code be the record.

## Why this shape

The Pythonic caveat is attached to every recommendation on purpose: the most valuable thing this
skill can do is stop someone from building a metaclass singleton or a visitor hierarchy when a
module or `singledispatch` would do. A pattern earns its ceremony only when the plain-language
version genuinely falls short — so the recommendation always carries the cheaper alternative next to
it, and review mode is as willing to delete structure as to add it.
