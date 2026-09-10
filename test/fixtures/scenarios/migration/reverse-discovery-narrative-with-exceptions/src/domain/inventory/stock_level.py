"""stock_level -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class StockLevel:
    id: str

    def describe(self) -> str:
        return f"stock_level:{self.id}"
