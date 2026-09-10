"""reporting storage: Postgres, one schema owned by this service alone.

No other service's tables are referenced here, and nothing in this file
imports another service.
"""

SCHEMA = "reporting"


class Store:
    def __init__(self, connection):
        self.connection = connection

    def get(self, item_id):
        rows = self.connection.execute(f"select * from {SCHEMA}.items where id = %s", (item_id,))
        return rows[0] if rows else None

    def page(self, cursor, limit):
        return self.connection.execute(
            f"select * from {SCHEMA}.items where (%s is null or id > %s) order by id limit %s",
            (cursor, cursor, limit),
        )
