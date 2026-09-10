"""The four journeys, and only four. About 6 minutes against a deployed stack.

Each one crosses browser, API, database and payment sandbox together, which is
the only reason it exists at that level; everything narrower is tested below.
"""

import pytest

pytestmark = pytest.mark.e2e


def test_journey_browse_to_paid_order(browser, sandbox):
    """Journey 1: catalog -> basket -> checkout -> payment -> confirmation."""
    order = browser.checkout(sku="SKU-1", card=sandbox.card("visa"))
    assert order.state == "paid"


def test_journey_returning_customer_saved_card(browser, sandbox):
    """Journey 2: sign in -> reorder -> pay with the stored instrument."""
    order = browser.reorder(previous="ord-1", card=sandbox.stored_card())
    assert order.state == "paid"


def test_journey_refund_after_delivery(browser, sandbox):
    """Journey 3: delivered order -> refund request -> refunded."""
    order = browser.refund("ord-1")
    assert order.state == "refunded"


def test_journey_payment_declined(browser, sandbox):
    """Journey 4: decline at the gateway -> basket preserved, no order placed."""
    result = browser.checkout(sku="SKU-1", card=sandbox.card("declined"))
    assert result.state == "draft"
    assert result.basket_preserved is True
