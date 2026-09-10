"""delivery_window -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeliveryWindow:
    id: str

    def describe(self) -> str:
        return f"delivery_window:{self.id}"
