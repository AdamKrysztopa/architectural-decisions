# Design patterns — the refactoring lens (smell → pattern)

For review mode: read code, spot the smell, name the pattern that resolves it — and the Pythonic
form to actually reach for. The governing idea: **patterns are answers to recurring problems, not
goals.** A codebase with too many patterns is as sick as one with none. The best refactor often
*removes* a hand-rolled pattern in favour of a language feature.

## Creational smells
- **A sprawling `if kind == "a": A() elif ...` construction block** → centralise behind a
  **Factory Method** — in Python, usually a dict `{kind: constructor}` or a function.
- **A constructor with 8+ parameters / telescoping overloads** → **Builder**, or more often a
  `@dataclass` with defaults / a classmethod constructor.
- **A hand-rolled singleton (`_instance` class attr, `__new__` tricks, metaclass)** → delete it;
  use a **module-level object**. A module is already a singleton, thread-safe at import.
- **Re-creating expensive objects (connections, processes) per call** → a **Pool**
  (`concurrent.futures`), or `functools.lru_cache` for pure ones.

## Structural smells
- **Calling-code littered with `try/except`/conversions to bridge two libraries' interfaces** →
  **Adapter** (a thin wrapper; duck typing keeps it small).
- **Subclass explosion to add optional behaviors (LoggedEncryptedCompressedStream)** → **Decorator**
  (compose wrappers; `@decorator` for functions).
- **Clients reaching deep into a subsystem's internals** → a **Facade** (one module of top-level
  functions) hiding the moving parts.
- **Type-checking to handle "one vs. many" (`if isinstance(x, list)`)** for tree-shaped data →
  **Composite** (a shared protocol with a recursive method).
- **Domain code importing ORM/HTTP/SDK types directly** → wrap access behind a **Proxy** or, at the
  app layer, a **Repository**.
- **Memory blowup from millions of near-identical instances** → **Flyweight** (`__slots__`,
  interning, shared `lru_cache`).

## Behavioral smells
- **A big conditional choosing an algorithm (pricing, sorting, shipping)** → **Strategy** — pass a
  callable or look one up in a dict.
- **State-dependent `if self.status == ...` scattered across methods** → **State** (a dict dispatch
  or `transitions`); the flag living in many places is the tell.
- **Manual list of "things to notify" updated by hand on each change** → **Observer** (callbacks /
  `blinker`).
- **A nest of validation/processing steps you keep reordering** → **Chain of Responsibility** (a
  list of callables / middleware).
- **Adding a new operation forces edits across a whole class hierarchy** → **Visitor**, which in
  Python is `functools.singledispatch`.
- **Many objects each talking to many others (a knot of references)** → **Mediator** / a small
  event bus / **Message Bus**.
- **Actions you need to queue, log, retry, or undo** → **Command** (often just a callable /
  `partial`); pair with a **Message Bus**.

## Resource & idiom smells
- **`open()`/lock/connection acquired with manual cleanup that leaks on exceptions** →
  **Context Manager** (`with`, `@contextmanager`). Missing `with` is the #1 Python resource smell.
- **Getter/setter method pairs (`get_x()`/`set_x()`)** → **Properties** (`@property`); start with a
  plain attribute and only add the property when logic appears.
- **`if obj is not None:` guards everywhere** → a **Null Object** that safely absorbs the calls.
- **Manually maintaining a list/dict of plugins or handlers** → a **Registry**
  (decorator / `__init_subclass__`).

## Application & concurrency smells
- **SQL / ORM queries inlined in business logic** → **Repository** + **Unit of Work** (a context
  manager around commit/rollback); makes the domain testable with a dict fake.
- **Modules hard-importing their collaborators (global singletons, hidden coupling)** →
  **Dependency Injection** — plain constructor/function args, no framework.
- **Business use-cases tangled into controllers/views** → a **Service Layer** (one function per use
  case) wiring domain + repositories.
- **Threads sharing data through locks and flags** → **Producer–Consumer** (`queue.Queue` /
  `asyncio.Queue`) to decouple rates.
- **A thread per I/O-bound connection, hitting limits** → an **Event Loop** (`asyncio`).

## Domain modelling, rules & resilience smells
*The modern-Python band GoF-era catalogs miss — where most 2020s app code actually lives.*
- **Primitive obsession — money as `float`, email as `str`, a point as a bare tuple, with
  validation re-checked everywhere** → a **Value Object**: an immutable `@dataclass(frozen=True)`
  that validates in `__post_init__` and compares by value. Make illegal values unrepresentable
  once, instead of guarding at every call site.
- **The same business-rule conditional (`order.total > 100 and not user.is_blocked`) copy-pasted
  across queries, services and views** → a **Specification**: encapsulate each rule as a composable
  predicate and combine them with `&` / `|` (or plain callables). One place to change the rule.
- **Authorization or decision logic hard-coded inline and duplicated** → a **Policy** — a Strategy
  specialised for *rules*: externalise the decision behind a callable or a registry keyed by context,
  so the "can they?" logic lives in one swappable place. (If it's an *algorithm* you're swapping, not
  a rule, that's just **Strategy**.)
- **Deeply nested `None`-checks or `try/except` threading a failure up the call stack by hand** →
  a **Result / Maybe** (railway-oriented): make success-or-failure an explicit value you chain
  (`.map` / `.and_then`) instead of an exception you juggle — the `returns` library, or a small
  `Result` union / `T | None` with early returns.
- **Flaky network/DB calls wrapped in ad-hoc `for attempt in range(3)` loops with `sleep`** →
  a **Retry** policy: a decorator with configurable backoff (jitter, max attempts, which
  exceptions) — reach for `tenacity` before hand-rolling. Retry is the *code-level* companion to the
  architecture skill's stability patterns (circuit breaker, bulkhead) for cross-network calls.

## Patterns people confuse — the one question that separates them
Most wrong picks aren't ignorance; they're choosing the right-shaped neighbour. When a finding could
map to more than one pattern, disambiguate with the distinguishing question, don't guess:
- **Factory Method vs Abstract Factory vs Builder vs Prototype** — *what's hard about making it?*
  One class chosen at runtime → Factory Method · a consistent *family* of objects → Abstract Factory ·
  many optional steps/params → Builder · cloning a configured instance is cheaper → Prototype.
- **Adapter vs Facade vs Proxy vs Decorator vs Bridge** — *what is the wrapper for?* Make an
  incompatible interface fit → Adapter · simplify a complex subsystem → Facade · **same** interface,
  control access (lazy/remote/guard) → Proxy · **same** interface, add behaviour → Decorator · split
  an abstraction from its implementation so both vary → Bridge.
- **Strategy vs State vs Command** — *what varies?* An interchangeable algorithm chosen from outside
  → Strategy · behaviour that changes with the object's own internal state (and transitions between
  them) → State · an action reified so it can be queued/logged/undone → Command.
- **Observer vs Mediator vs Message Bus** — *what's the shape of the wiring?* One source fans out to
  many subscribers → Observer · many peers coordinate through one hub → Mediator · typed messages
  dispatched to registered handlers app-wide → Message Bus.
- **Chain of Responsibility vs Decorator** — both wrap in a chain, but: CoR lets a handler **stop**
  the chain (one handler owns the request); Decorator **always** passes through, each adding behaviour.
- **Strategy vs Policy** — same mechanism (a swappable callable); Strategy swaps an *algorithm*,
  Policy swaps a *business rule / decision*. The intent is the tell.

## Principles behind the smells (SOLID / GRASP)
Patterns are the moves; principles are why a smell is a smell. When you name a finding, it helps to
name the principle it violates — it's often more convincing than the pattern label:
- **SRP** (one reason to change) — the smell behind God classes, Service Layer, Value Object.
- **OCP** (open to extension, closed to modification) — the smell behind if/elif chains → Strategy,
  Registry, Factory.
- **LSP** (subtypes honour the base contract) — the smell behind isinstance checks and refused
  bequests.
- **ISP** (many small interfaces beat one fat one) — the smell behind Protocols/duck typing.
- **DIP** (depend on abstractions) — the smell behind Dependency Injection, Repository, Ports.
- **GRASP** (who *should* own this behaviour?) — Information Expert / Low Coupling / High Cohesion:
  use it to decide *where* a responsibility belongs before reaching for any pattern.
These are principles, not patterns — don't "add" them; use them to justify (or reject) a pattern.

## The review verdict
For each finding, state: the smell (with a file ref), the pattern it maps to, **and** whether the
Pythonic answer is the pattern or a language feature that replaces it. Recommend the smallest change
— frequently "replace this hand-rolled pattern with `with` / a dataclass / a module / a dict" rather
than adding more structure. Patterns that already fit and read well: leave them, and say so. And note the
case no row above covers: **plain duplication or import-time side effects that need no pattern** —
the fix is just "extract a shared function / helper, move the imports." Report it as a finding even
though it isn't a GoF pattern; clearer code is the goal, not pattern coverage.
