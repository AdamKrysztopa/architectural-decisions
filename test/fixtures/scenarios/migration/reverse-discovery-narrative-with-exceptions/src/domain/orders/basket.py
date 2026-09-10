"""basket -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Basket:
    id: str

    def describe(self) -> str:
        return f"basket:{self.id}"
