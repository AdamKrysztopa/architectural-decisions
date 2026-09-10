"""service_level -- a domain type. Pure: it imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceLevel:
    id: str

    def describe(self) -> str:
        return f"service_level:{self.id}"
