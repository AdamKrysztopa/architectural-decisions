"""product -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Product:
    id: str

    def describe(self) -> str:
        return f"product:{self.id}"
