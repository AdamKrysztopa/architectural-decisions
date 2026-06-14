# Python design patterns — sibling catalog + "which pattern?" wizard

Date: 2026-06-11
New file: `python-design-patterns.html` (single-file, zero-dependency; reuses the
architecture doc's visual system / CSS tokens).

## Goal
A sibling to `architecture-patterns.html` covering GoF + Python-idiomatic + app/concurrency
design patterns: when to reach for each, with explanations, an SVG diagram, and an idiomatic
Python snippet — plus an interactive selector, like the architecture wizard but problem-oriented.

## Visual treatment (approved)
Full entries get an SVG structure diagram (same soft box-and-arrow style as architecture)
**and** a tight idiomatic Python snippet. Add CSS: `pre.code` blocks + `.card` compact cards.

## Depth — 3 tiers, everything present & wizard-reachable (approved)
- **Tier 1 — Full (~15):** oneline + prose + SVG + snippet + Use-when / Pythonic rows.
  Factory Method, Builder, Adapter, Decorator, Facade, Composite, Proxy, Strategy, Observer,
  State, Command, Context Manager, Repository, Duck Typing/Protocols, Registry.
- **Tier 2 — Compact card (~16):** intent + Pythonic note + 4–6 line snippet, no diagram.
  Abstract Factory, Singleton (→ "use a module"), Bridge, Template Method, Chain of
  Responsibility, Mediator, Iterator, Visitor (→ singledispatch), Properties, Mixin,
  Unit of Work, Dependency Injection, Service Layer, Producer–Consumer, Thread/Process Pool,
  Event Loop.
- **Tier 3 — One-liner (~8):** name + intent + Pythonic verdict.
  Prototype, Flyweight, Interpreter, Memento, Borg, Monkey Patching, Descriptor, Null Object,
  Message Bus, MVC (cross-link to the architecture doc).

Extensions beyond the user's list: Mixin, Descriptor, Service Layer, Null Object, Message Bus;
singledispatch as the Pythonic Visitor; "just use a module" as the Pythonic Singleton.

## Structure
Header → intro ("half of GoF is already in the language") → Part I Creational ·
II Structural · III Behavioral · IV Python idioms · V App & concurrency → Part VI wizard →
"How to choose" closer → footer.

## Wizard — problem-oriented recommender (not a stack)
GoF patterns don't compose one-per-axis, so the wizard is a branching decision *tree* that
returns ONE primary recommendation (+ optional alternative): pattern name (links to its
entry), why it fits, and its Pythonic caveat. Top question "What are you trying to do?" →
{create · structure · behavior · resource/idiom · app/concurrency} → one follow-up → result.
Every Tier 1–3 pattern is a reachable leaf. Same vanilla-JS engine style, Back/Start-over,
keyboard accessible. Each pattern entry carries an `id="dp-..."` anchor.

## Out of scope
Object Pool (route "reuse workers" → Thread/Process Pool). No external libs; single file.
