"""Orders publishes to the event stream, as ADR 1 requires."""


def publish(bus, order_id: str, state: str) -> None:
    bus.publish("orders.state_changed", {"id": order_id, "state": state})
