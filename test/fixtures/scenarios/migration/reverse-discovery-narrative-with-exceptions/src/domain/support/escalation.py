"""escalation -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Escalation:
    id: str

    def describe(self) -> str:
        return f"escalation:{self.id}"
