"""order -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Order:
    id: str

    def describe(self) -> str:
        return f"order:{self.id}"
