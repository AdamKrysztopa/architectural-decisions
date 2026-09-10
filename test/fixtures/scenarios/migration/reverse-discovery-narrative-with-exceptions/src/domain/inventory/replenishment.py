"""replenishment -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Replenishment:
    id: str

    def describe(self) -> str:
        return f"replenishment:{self.id}"
