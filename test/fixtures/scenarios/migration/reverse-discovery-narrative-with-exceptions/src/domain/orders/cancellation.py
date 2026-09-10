"""cancellation -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Cancellation:
    id: str

    def describe(self) -> str:
        return f"cancellation:{self.id}"
