"""promotion_code -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PromotionCode:
    id: str

    def describe(self) -> str:
        return f"promotion_code:{self.id}"
