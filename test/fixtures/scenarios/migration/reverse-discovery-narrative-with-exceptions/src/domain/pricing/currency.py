"""currency -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Currency:
    id: str

    def describe(self) -> str:
        return f"currency:{self.id}"
