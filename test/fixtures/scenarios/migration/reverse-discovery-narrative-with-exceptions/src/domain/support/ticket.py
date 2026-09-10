"""ticket -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Ticket:
    id: str

    def describe(self) -> str:
        return f"ticket:{self.id}"
