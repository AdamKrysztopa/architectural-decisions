"""margin -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Margin:
    id: str

    def describe(self) -> str:
        return f"margin:{self.id}"
