"""The Postgres-backed job queue from ADR 3."""

CLAIM = """
select id, payload from jobs
where run_after <= now() and claimed_at is null
order by run_after
for update skip locked
limit 1
"""


def claim(connection):
    rows = connection.execute(CLAIM)
    return rows[0] if rows else None
