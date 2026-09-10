"""Billing reads order data through the orders service's read-only view."""

from .db import shared


def orders_for(account_id: str) -> list[dict]:
    return shared().execute(
        "select id, total_cents, placed_at from orders_public where account_id = %s",
        (account_id,),
    )
