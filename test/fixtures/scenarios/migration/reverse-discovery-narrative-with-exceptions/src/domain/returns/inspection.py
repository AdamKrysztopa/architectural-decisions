"""inspection -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Inspection:
    id: str

    def describe(self) -> str:
        return f"inspection:{self.id}"
