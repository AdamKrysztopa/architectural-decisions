"""The application layer: where the other 47 domain types get their data.

Repositories are constructed here and handed to the domain, which is why the
domain files themselves import nothing from src.infra.
"""

from src.domain.orders.order import Order
from src.infra.db import session


class OrderRepository:
    def get(self, order_id: str) -> Order:
        rows = session().execute("select id from orders where id = :id", id=order_id)
        return Order(id=rows[0]["id"]) if rows else Order(id=order_id)


def place(order_id: str) -> Order:
    return OrderRepository().get(order_id)
