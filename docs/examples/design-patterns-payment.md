# Example — `arch-crew:design-patterns`, greenfield: the pattern *and* its Pythonic form

The skill names the GoF pattern so you know the concept, then steers you to the idiomatic Python —
which is usually lighter than the textbook version.

**Prompt:** "In my Python checkout code I have a growing if/elif that picks how to charge based on
the payment provider (stripe, paypal, adyen, …). Each branch builds the request differently. It's
getting messy. What's the right design here?"

**What the skill did:** routed to **Strategy** — then explicitly rejected the `PaymentStrategy` ABC
in favour of a dict of callables. Output:

---

**Recommended: Strategy** — interchangeable algorithms (each provider charges differently) selected
at runtime by a key. Strategy pulls each branch out of the `if/elif` into a self-contained handler,
selected by lookup instead of a growing conditional.

**In Python:** don't reach for a `PaymentStrategy` ABC with one subclass per provider — that's GoF
ceremony Python doesn't need. A strategy here is **just a callable**, and the selector is **a dict of
them**.

```python
from typing import Callable

def charge_stripe(amount: int, ctx: PaymentContext) -> ChargeResult: ...
def charge_paypal(amount: int, ctx: PaymentContext) -> ChargeResult: ...
def charge_adyen(amount: int, ctx: PaymentContext) -> ChargeResult: ...

PROVIDERS: dict[str, Callable[[int, PaymentContext], ChargeResult]] = {
    "stripe": charge_stripe, "paypal": charge_paypal, "adyen": charge_adyen,
}

def charge(provider: str, amount: int, ctx: PaymentContext) -> ChargeResult:
    try:
        handler = PROVIDERS[provider]
    except KeyError:
        raise UnsupportedProvider(provider)
    return handler(amount, ctx)
```

Adding a provider is one function + one dict entry — no edits to the dispatch site. To self-register
across modules, add a small **Registry** (`@register("stripe")`).

**Skip the pattern if:** only two providers, unlikely to grow — a two-line `if/else` is clearer.

**Alternative:** if each provider is a stateful integration with a *family* of operations
(charge/refund/capture/webhook), promote each callable to a small object behind a `Protocol`, still
selected via the same dict. Only when there's more than one operation per provider.
