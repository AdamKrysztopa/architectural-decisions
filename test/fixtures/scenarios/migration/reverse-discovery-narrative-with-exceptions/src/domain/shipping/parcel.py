"""parcel -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Parcel:
    id: str

    def describe(self) -> str:
        return f"parcel:{self.id}"
