"""bundle -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Bundle:
    id: str

    def describe(self) -> str:
        return f"bundle:{self.id}"
