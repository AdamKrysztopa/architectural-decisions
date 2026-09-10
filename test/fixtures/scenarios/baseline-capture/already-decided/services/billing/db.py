"""Connection to the shared database. One instance, several schemas."""


class Connection:
    def execute(self, sql, params=()):
        return []


def shared() -> Connection:
    return Connection()
