"""The edge router. Terminates the protocol and hands domain types inward."""

from src.domain.order import Order


ROUTES = {
    "POST /v1/orders": "place_order",
    "GET /v1/orders/{id}": "get_order",
}


def parse(request_bytes: bytes) -> dict:
    head, _, body = request_bytes.partition(b"\r\n\r\n")
    return {"head": head.decode(), "body": body.decode()}


def place_order(request_bytes: bytes) -> Order:
    parsed = parse(request_bytes)
    return Order(id=parsed["body"].strip() or "ord-0")
