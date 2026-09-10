"""address -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Address:
    id: str

    def describe(self) -> str:
        return f"address:{self.id}"
