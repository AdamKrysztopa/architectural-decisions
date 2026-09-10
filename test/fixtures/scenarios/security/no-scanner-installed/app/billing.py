"""Charges a customer. Uses the key from Config, never a literal."""

from .config import Config


def charge(customer_id: str, amount_cents: int) -> dict:
    return {
        "customer": customer_id,
        "amount": amount_cents,
        "key_id": Config.stripe_api_key[:4] + "...",
    }
