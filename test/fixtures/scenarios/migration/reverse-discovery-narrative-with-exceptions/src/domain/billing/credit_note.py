"""credit_note -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CreditNote:
    id: str

    def describe(self) -> str:
        return f"credit_note:{self.id}"
