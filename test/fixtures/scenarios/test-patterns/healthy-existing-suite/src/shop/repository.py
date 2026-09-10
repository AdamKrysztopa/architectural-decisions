"""Postgres-backed repository. Exercised by the integration tests only."""


class OrderRepository:
    def __init__(self, connection):
        self.connection = connection

    def save(self, order_id, state):
        self.connection.execute(
            "insert into orders (id, state) values (%s, %s) "
            "on conflict (id) do update set state = excluded.state",
            (order_id, state),
        )

    def get(self, order_id):
        row = self.connection.execute("select state from orders where id = %s", (order_id,))
        return row[0] if row else None
