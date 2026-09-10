"""period -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Period:
    id: str

    def describe(self) -> str:
        return f"period:{self.id}"
