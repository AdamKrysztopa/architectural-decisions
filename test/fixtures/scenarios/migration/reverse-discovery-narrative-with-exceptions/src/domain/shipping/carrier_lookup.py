"""EXCEPTION 4 of 4. Asks the carrier's API for a service level, inline."""

from src.infra.http import client

from .service_level import ServiceLevel


def lookup(postcode: str) -> ServiceLevel:
    body = client.get(f"https://carrier.example/service-levels/{postcode}")["body"]
    return ServiceLevel(id=body.get("code", "standard"))
