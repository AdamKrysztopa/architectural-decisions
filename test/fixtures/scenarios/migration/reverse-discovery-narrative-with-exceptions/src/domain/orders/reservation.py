"""reservation -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Reservation:
    id: str

    def describe(self) -> str:
        return f"reservation:{self.id}"
