"""One ephemeral Postgres container per session, torn down afterwards.

Nothing is shared with a developer's local database and nothing survives the
run, which is why the integration tier is deterministic without retries.
"""

import pytest
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as container:
        yield container


@pytest.fixture
def connection(postgres):
    conn = postgres.get_connection_client()
    conn.execute("create table if not exists orders (id text primary key, state text not null)")
    yield conn
    conn.execute("truncate orders")
