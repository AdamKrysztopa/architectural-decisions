"""Postgres repository for orders, injected into the domain's callers."""

from src.domain.order import Order


class OrderRepository:
    def __init__(self, connection):
        self.connection = connection

    def get(self, order_id: str) -> Order:
        rows = self.connection.execute("select id, total_cents from orders where id = %s", (order_id,))
        return Order(id=rows[0]["id"], total_cents=rows[0]["total_cents"])
