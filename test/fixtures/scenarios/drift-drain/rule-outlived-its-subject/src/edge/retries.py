"""Retry policy for outbound calls made from the edge."""

BACKOFF_SECONDS = [0.1, 0.4, 1.6]


def attempts() -> int:
    return len(BACKOFF_SECONDS) + 1
