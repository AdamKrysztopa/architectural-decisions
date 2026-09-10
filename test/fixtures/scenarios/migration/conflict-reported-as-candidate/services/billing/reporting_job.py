"""The month-end job. Reads billing's own tables, as ADR 2 allows -- and as
ADR 1's rule, scoped to the same services/** paths, forbids."""


def month_end(connection, period: str):
    return connection.execute(
        "select account_id, sum(total_cents) from invoices where state = 'paid' group by account_id"
    )
