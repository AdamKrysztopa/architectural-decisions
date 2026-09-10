"""EXCEPTION 1 of 4. Reads the invoice rows straight out of the database.

Written during the month-end incident, when the export had to bypass the
repository layer to finish inside the batch window. Never moved back.
"""

from src.infra.db import session

from .invoice import Invoice


def export_unpaid(period: str) -> list[Invoice]:
    rows = session().execute(
        "select id from invoices where period = :period and status = 'open'",
        period=period,
    )
    return [Invoice(id=row["id"]) for row in rows]
