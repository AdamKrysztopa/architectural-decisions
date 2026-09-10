"""Structured JSON logs, one line per request, correlation id required."""

FIELDS = ("ts", "level", "service", "correlation_id", "message")


def line(service, correlation_id, message, level="info"):
    return {"level": level, "service": service, "correlation_id": correlation_id, "message": message}
