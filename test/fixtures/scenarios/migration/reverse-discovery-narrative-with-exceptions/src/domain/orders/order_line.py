"""order_line -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class OrderLine:
    id: str

    def describe(self) -> str:
        return f"order_line:{self.id}"
