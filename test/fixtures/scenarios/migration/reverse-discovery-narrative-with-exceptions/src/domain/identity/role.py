"""role -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Role:
    id: str

    def describe(self) -> str:
        return f"role:{self.id}"
