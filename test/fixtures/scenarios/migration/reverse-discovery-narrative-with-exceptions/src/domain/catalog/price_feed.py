"""EXCEPTION 2 of 4. Calls the supplier price feed over HTTP from the domain."""

from src.infra.http import client

from .price import Price


def refresh(sku: str) -> Price:
    body = client.get(f"https://supplier.example/prices/{sku}")["body"]
    return Price(id=f"{sku}:{body.get('revision', '0')}")
