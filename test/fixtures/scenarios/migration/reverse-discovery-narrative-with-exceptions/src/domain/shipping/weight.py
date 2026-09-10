"""weight -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Weight:
    id: str

    def describe(self) -> str:
        return f"weight:{self.id}"
