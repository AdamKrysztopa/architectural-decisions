"""stock_move -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class StockMove:
    id: str

    def describe(self) -> str:
        return f"stock_move:{self.id}"
