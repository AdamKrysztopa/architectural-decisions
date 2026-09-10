"""Representative of the pricing half of the unit suite (about 520 tests).

Fast, in-process, no I/O -- which is why the whole unit tier finishes in
about 20 seconds.
"""

from decimal import Decimal

import pytest

from src.shop.pricing import basket_total, line_total


@pytest.mark.parametrize(
    "unit,qty,discount,expected",
    [
        ("10.00", 1, "0", "10.00"),
        ("10.00", 3, "10", "27.00"),
        ("0.01", 7, "0", "0.07"),
        ("19.99", 2, "33.333", "26.65"),
    ],
)
def test_line_total_rounds_half_up(unit, qty, discount, expected):
    assert line_total(Decimal(unit), qty, Decimal(discount)) == Decimal(expected)


def test_basket_total_sums_rounded_lines():
    lines = [(Decimal("19.99"), 2, Decimal("33.333")), (Decimal("10.00"), 1, Decimal("0"))]
    assert basket_total(lines) == Decimal("36.65")
