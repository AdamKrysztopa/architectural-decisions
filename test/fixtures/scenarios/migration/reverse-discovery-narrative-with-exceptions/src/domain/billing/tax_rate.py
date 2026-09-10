"""tax_rate -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class TaxRate:
    id: str

    def describe(self) -> str:
        return f"tax_rate:{self.id}"
