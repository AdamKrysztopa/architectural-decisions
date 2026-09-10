"""Orders, stored in Postgres, as ADR 1 describes."""


def place(connection, account_id: str, total_cents: int) -> str:
    row = connection.execute(
        "insert into orders (account_id, total_cents) values (%s, %s) returning id",
        (account_id, total_cents),
    )
    return row[0]["id"]
