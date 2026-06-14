# Which pattern? — the decision tree

Unlike architecture (where patterns compose one-per-axis), GoF / design patterns don't stack — so
this tree returns **one primary recommendation** (plus an optional alternative), not a bundle. Each
leaf carries *why it fits* and its **Pythonic caveat** — because in Python, half of GoF is already
in the language, and the idiomatic answer is often "you don't need the pattern, you need this
language feature." Always deliver the caveat with the pattern.

Top question: **What are you trying to do?** → pick the closest goal, then one follow-up.

## A. Create an object — *what's the hard part of creating it?*
- **Decide which concrete class to instantiate** → **Factory Method** `#dp-factory-method` —
  centralise the "which class" decision behind one call. *Pythonic:* a function or a dict of
  constructors usually beats a class hierarchy.
- **Produce matching families of objects that must stay consistent** → **Abstract Factory**
  `#dp-abstract-factory`. *Pythonic:* a module/class returning a set of builders; rarely the full
  GoF tree.
- **Assemble a complex object step by step** → **Builder** `#dp-builder`. *Pythonic:* often a
  `@dataclass` with defaults or a classmethod is enough.
- **Copying a configured object beats rebuilding it** → **Prototype** `#dp-prototype`. *Pythonic:*
  just `copy.copy` / `copy.deepcopy`.
- **One instance, globally reachable** → **Singleton** `#dp-singleton`. *Pythonic:* **don't** —
  use a module-level object; a Python module is already a singleton.
- **Recycle costly workers across many tasks** → **Thread / Process Pool** `#dp-pool`. *Pythonic:*
  `concurrent.futures.ThreadPoolExecutor` / `ProcessPoolExecutor`.

## B. Structure / compose objects — *what structural problem do you have?*
- **An incompatible interface** → **Adapter** `#dp-adapter`. *Pythonic:* a small wrapper; duck
  typing keeps it thin.
- **Add behavior without changing the object** → **Decorator** `#dp-decorator`. *Pythonic:* for
  *objects*, a thin wrapper class sharing the interface (often with `__getattr__` delegation) that
  stacks in any order; for *functions*, the language's own `@decorator` + `functools.wraps`. Don't
  reach for `@decorator` when the thing being wrapped is an object.
- **One simple interface over a complex subsystem** → **Facade** `#dp-facade`. *Pythonic:* often
  just a module with a few top-level functions.
- **Treat a single object and a tree the same way** → **Composite** `#dp-composite`. *Pythonic:* a
  shared protocol/ABC with a recursive method.
- **Control access to a real object (lazy, remote, guarded)** → **Proxy** `#dp-proxy`. *Pythonic:*
  `__getattr__` forwarding, or `functools.cached_property` for lazy.
- **Abstraction and implementation must vary independently** → **Bridge** `#dp-bridge`. *Pythonic:*
  inject the implementation object — composition over inheritance.
- **Too many near-identical objects exhaust memory** → **Flyweight** `#dp-flyweight`. *Pythonic:*
  interning, `__slots__`, or a shared cache via `lru_cache`.

## C. Vary or coordinate behavior — *what behavior do you need to vary or coordinate?*
- **Swap interchangeable algorithms at runtime** → **Strategy** `#dp-strategy`. *Pythonic:* pass a
  function — strategies are just callables, or a dict of them.
- **Notify many objects when something happens** → **Observer** `#dp-observer`. *Pythonic:* a list
  of callbacks, or `blinker` / asyncio events.
- **Behave differently per internal state** → **State** `#dp-state`. *Pythonic:* a dict dispatch,
  or the `enum` / `transitions` library.
- **Capture a request as an object (queue/log/undo it)** → **Command** `#dp-command`. *Pythonic:*
  often just a callable or `functools.partial`.
- **Pass a request through optional handlers** → **Chain of Responsibility** `#dp-chain`.
  *Pythonic:* a list of callables, or nested middleware closures.
- **Fixed algorithm skeleton, overridable steps** → **Template Method** `#dp-template-method`.
  *Pythonic:* an ABC with abstract steps — or pass the varying step as a callable.
- **Add operations to a class hierarchy you can't edit** → **Visitor** `#dp-visitor`. *Pythonic:*
  `functools.singledispatch` is the Pythonic Visitor.
- **Traverse a collection without exposing internals** → **Iterator** `#dp-iterator`. *Pythonic:*
  native `__iter__`/`__next__` and generators (`yield`).
- **Untangle many-to-many communication via a hub** → **Mediator** `#dp-mediator`. *Pythonic:* a
  small hub object or an event bus.
- **Snapshot state and roll it back later** → **Memento** `#dp-memento`. *Pythonic:* `deepcopy`, or
  capture `__dict__` / a dataclass snapshot.
- **Evaluate a small grammar / expression language** → **Interpreter** `#dp-interpreter`.
  *Pythonic:* reach for `lark` / `pyparsing` / `ast`; hand-rolled interpreters are rare.

## D. Resource / language idiom — *which lifecycle or access concern is it?*
- **Guarantee setup and teardown around a block** → **Context Manager** `#dp-context-manager`.
  *Pythonic:* `with` — `__enter__`/`__exit__` or `@contextmanager`.
- **Expose methods as attributes without breaking callers** → **Properties** `#dp-properties`.
  *Pythonic:* the `@property` decorator.
- **A neutral object that absorbs calls safely** → **Null Object** `#dp-null-object`. *Pythonic:* a
  small no-op class, or a module-level sentinel.
- **Auto-collect implementations in one place** → **Registry** `#dp-registry`. *Pythonic:* a
  decorator or `__init_subclass__` filling a dict.
- **Many instances sharing one state** → **Borg / Singleton** `#dp-borg`. *Pythonic:* Borg shares
  `__dict__` — but a module is usually simpler.
- **Alter behavior dynamically / typed attribute logic** → **Monkey Patching / Descriptor**
  `#dp-monkey`. *Pythonic:* monkey-patch sparingly; descriptors power `property` and ORM fields.

## E. Application / concurrency layer — *which layer or concern is it?*
- **Hide data access behind a collection-like API** → **Repository** `#dp-repository`. *Pythonic:*
  a class wrapping the SQLAlchemy session; fake it with a dict in tests.
- **Commit changes across repositories atomically** → **Unit of Work** `#dp-unit-of-work`.
  *Pythonic:* a context manager around the session commit/rollback.
- **Pass dependencies in, don't hard-wire them** → **Dependency Injection** `#dp-di`. *Pythonic:*
  plain function/constructor arguments — no framework needed.
- **One function per use case, wiring domain + repos** → **Service Layer** `#dp-service-layer`.
  *Pythonic:* plain functions taking a Unit of Work and inputs.
- **Dispatch messages to registered handlers** → **Message Bus** `#dp-message-bus`. *Pythonic:* a
  dict of `{type: [handlers]}` — pairs with Command / Observer.
- **Decouple producer and consumer rates** → **Producer–Consumer** `#dp-producer-consumer`.
  *Pythonic:* `queue.Queue` for threads, `asyncio.Queue` for async.
- **Multiplex I/O without a thread each** → **Event Loop** `#dp-event-loop`. *Pythonic:* `asyncio`
  — `async def` / `await`.

## The cardinal Pythonic rule
Before recommending any pattern, ask whether the language already solves it (a function, a module,
a decorator, a dataclass, `with`, `singledispatch`, `asyncio`). If it does, recommend the language
feature *as* the pattern — name the GoF pattern so the user knows the concept, but steer them to the
idiom. A pattern earns its ceremony only when the plain-Python version genuinely falls short.
