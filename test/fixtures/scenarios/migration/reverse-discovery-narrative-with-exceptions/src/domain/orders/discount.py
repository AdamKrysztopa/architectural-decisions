"""discount -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Discount:
    id: str

    def describe(self) -> str:
        return f"discount:{self.id}"
