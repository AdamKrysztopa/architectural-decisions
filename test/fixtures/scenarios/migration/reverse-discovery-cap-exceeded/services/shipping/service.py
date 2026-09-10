"""shipping application logic. Talks to its own store and the event stream only."""

from libs.platform.events import publish
from libs.platform.logging import line


def handle(action, **kwargs):
    line("shipping", kwargs.get("correlation_id", "-"), f"shipping.{action}")
    if action == "list":
        return []
    if action == "get":
        return None
    return {"id": kwargs.get("idempotency_key", "new")}


def emit(bus, event, payload, correlation_id):
    return publish(bus, f"shipping.{event}", payload, correlation_id)


def health_state():
    return {"service": "shipping", "status": "ok"}
