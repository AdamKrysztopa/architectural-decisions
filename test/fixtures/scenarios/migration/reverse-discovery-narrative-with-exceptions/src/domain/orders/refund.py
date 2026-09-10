"""refund -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Refund:
    id: str

    def describe(self) -> str:
        return f"refund:{self.id}"
