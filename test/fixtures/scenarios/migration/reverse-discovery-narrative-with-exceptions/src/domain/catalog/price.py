"""price -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Price:
    id: str

    def describe(self) -> str:
        return f"price:{self.id}"
