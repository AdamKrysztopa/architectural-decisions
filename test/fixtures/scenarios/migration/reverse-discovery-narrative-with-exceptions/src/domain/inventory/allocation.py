"""allocation -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Allocation:
    id: str

    def describe(self) -> str:
        return f"allocation:{self.id}"
