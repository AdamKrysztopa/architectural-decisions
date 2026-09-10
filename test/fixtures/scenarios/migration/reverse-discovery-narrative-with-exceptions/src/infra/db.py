"""SQLAlchemy session factory. Infrastructure, not domain."""


class Session:
    def execute(self, sql, **params):
        return []


def session():
    return Session()
