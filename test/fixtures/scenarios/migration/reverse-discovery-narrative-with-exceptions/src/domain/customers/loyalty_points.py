"""loyalty_points -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class LoyaltyPoints:
    id: str

    def describe(self) -> str:
        return f"loyalty_points:{self.id}"
