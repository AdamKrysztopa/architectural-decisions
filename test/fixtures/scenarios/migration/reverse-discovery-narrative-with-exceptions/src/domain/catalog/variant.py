"""variant -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Variant:
    id: str

    def describe(self) -> str:
        return f"variant:{self.id}"
