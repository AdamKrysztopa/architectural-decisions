"""Order state machine. The other half of the unit tests."""

TRANSITIONS = {
    "draft": {"placed", "abandoned"},
    "placed": {"paid", "cancelled"},
    "paid": {"shipped", "refunded"},
    "shipped": {"delivered", "returned"},
}


class IllegalTransition(Exception):
    pass


def advance(state: str, to: str) -> str:
    if to not in TRANSITIONS.get(state, set()):
        raise IllegalTransition(f"{state} -> {to}")
    return to
