"""consent -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Consent:
    id: str

    def describe(self) -> str:
        return f"consent:{self.id}"
