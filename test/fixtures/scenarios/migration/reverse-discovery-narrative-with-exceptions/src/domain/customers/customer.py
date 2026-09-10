"""customer -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Customer:
    id: str

    def describe(self) -> str:
        return f"customer:{self.id}"
