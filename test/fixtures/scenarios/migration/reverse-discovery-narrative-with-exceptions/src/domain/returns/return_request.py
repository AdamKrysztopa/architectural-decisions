"""return_request -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ReturnRequest:
    id: str

    def describe(self) -> str:
        return f"return_request:{self.id}"
