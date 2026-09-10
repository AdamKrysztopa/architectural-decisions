"""Representative of the order-state half of the unit suite (about 380 tests)."""

import pytest

from src.shop.orders import IllegalTransition, advance


@pytest.mark.parametrize("state,to", [("draft", "placed"), ("placed", "paid"), ("paid", "shipped")])
def test_legal_transitions(state, to):
    assert advance(state, to) == to


@pytest.mark.parametrize("state,to", [("draft", "paid"), ("shipped", "placed"), ("delivered", "paid")])
def test_illegal_transitions_raise(state, to):
    with pytest.raises(IllegalTransition):
        advance(state, to)
