"""Representative of the 60 integration tests (about 3 minutes in total).

They assert against the real schema and the real driver -- upserts, constraint
violations, transaction boundaries -- and nothing they touch is mocked.
"""

import pytest

from src.shop.repository import OrderRepository


def test_save_then_get_round_trips(connection):
    repo = OrderRepository(connection)
    repo.save("ord-1", "placed")
    assert repo.get("ord-1") == "placed"


def test_save_is_idempotent_on_conflict(connection):
    repo = OrderRepository(connection)
    repo.save("ord-1", "placed")
    repo.save("ord-1", "paid")
    assert repo.get("ord-1") == "paid"


def test_missing_order_is_none(connection):
    assert OrderRepository(connection).get("nope") is None
