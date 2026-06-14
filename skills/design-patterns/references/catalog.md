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

## The review verdict
For each finding, state: the smell (with a file ref), the pattern it maps to, **and** whether the
Pythonic answer is the pattern or a language feature that replaces it. Recommend the smallest change
— frequently "replace this hand-rolled pattern with `with` / a dataclass / a module / a dict" rather
than adding more structure. Patterns that already fit and read well: leave them, and say so.
