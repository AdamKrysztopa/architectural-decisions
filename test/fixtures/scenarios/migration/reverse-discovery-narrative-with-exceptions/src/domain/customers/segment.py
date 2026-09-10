"""segment -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Segment:
    id: str

    def describe(self) -> str:
        return f"segment:{self.id}"
