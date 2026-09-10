"""rule -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Rule:
    id: str

    def describe(self) -> str:
        return f"rule:{self.id}"
