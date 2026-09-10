"""The orders service owns the orders base table."""

from services.billing.db import shared


def place(account_id: str, total_cents: int) -> dict:
    shared().execute(
        "insert into orders (account_id, total_cents, state) values (%s, %s, 'placed')",
        (account_id, total_cents),
    )
    return {"account_id": account_id, "total_cents": total_cents, "state": "placed"}
