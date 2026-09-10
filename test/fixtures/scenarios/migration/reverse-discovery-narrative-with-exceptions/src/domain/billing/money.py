"""money -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    id: str

    def describe(self) -> str:
        return f"money:{self.id}"
