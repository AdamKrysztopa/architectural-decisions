"""rounding -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Rounding:
    id: str

    def describe(self) -> str:
        return f"rounding:{self.id}"
