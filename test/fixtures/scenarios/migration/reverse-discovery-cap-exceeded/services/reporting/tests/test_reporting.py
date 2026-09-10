"""Tests live beside the service they cover, never in a repository-wide tests/."""

from services.reporting.service import health_state


def test_health_names_the_service():
    assert health_state()["service"] == "reporting"
