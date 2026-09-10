"""shipment -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Shipment:
    id: str

    def describe(self) -> str:
        return f"shipment:{self.id}"
