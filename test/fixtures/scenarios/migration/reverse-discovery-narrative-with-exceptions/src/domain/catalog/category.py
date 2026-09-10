"""category -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    id: str

    def describe(self) -> str:
        return f"category:{self.id}"
