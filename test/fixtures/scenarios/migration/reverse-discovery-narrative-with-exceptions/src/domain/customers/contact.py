"""contact -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Contact:
    id: str

    def describe(self) -> str:
        return f"contact:{self.id}"
