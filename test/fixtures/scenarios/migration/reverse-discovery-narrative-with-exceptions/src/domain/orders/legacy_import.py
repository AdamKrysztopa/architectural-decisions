"""EXCEPTION 3 of 4. The importer from the pre-migration order system.

It writes through the session directly because the old rows do not satisfy
the Order aggregate's invariants and cannot be built through it.
"""

from src.infra.db import session

from .order import Order


def import_batch(batch_id: str) -> list[Order]:
    rows = session().execute("select id from legacy_orders where batch = :b", b=batch_id)
    return [Order(id=row["id"]) for row in rows]
