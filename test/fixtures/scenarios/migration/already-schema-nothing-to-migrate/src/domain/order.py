"""A domain aggregate. Imports nothing outside src/domain."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Order:
    id: str
    total_cents: int
