"""invoice -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Invoice:
    id: str

    def describe(self) -> str:
        return f"invoice:{self.id}"
