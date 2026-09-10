"""availability -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Availability:
    id: str

    def describe(self) -> str:
        return f"availability:{self.id}"
