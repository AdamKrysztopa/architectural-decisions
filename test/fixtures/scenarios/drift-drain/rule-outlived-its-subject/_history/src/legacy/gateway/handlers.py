"""The gateway's handlers, moved to src/edge/router.py and deleted."""

from .translate import parse


def place_order(request_bytes: bytes):
    return parse(request_bytes)["body"].strip()
