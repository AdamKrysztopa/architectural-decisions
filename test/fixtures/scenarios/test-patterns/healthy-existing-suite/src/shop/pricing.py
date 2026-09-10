"""Price arithmetic. Pure, and where most of the unit tests point."""

from decimal import ROUND_HALF_UP, Decimal


def line_total(unit_price: Decimal, quantity: int, discount_pct: Decimal = Decimal(0)) -> Decimal:
    gross = unit_price * quantity
    net = gross - (gross * discount_pct / 100)
    return net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def basket_total(lines: list[tuple[Decimal, int, Decimal]]) -> Decimal:
    return sum((line_total(*line) for line in lines), Decimal("0.00"))
