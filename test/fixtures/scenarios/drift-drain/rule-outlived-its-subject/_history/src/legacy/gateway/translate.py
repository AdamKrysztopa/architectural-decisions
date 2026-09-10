"""Protocol translation. Superseded by src/edge/router.py and deleted."""


def parse(request_bytes: bytes) -> dict:
    head, _, body = request_bytes.partition(b"\r\n\r\n")
    return {"head": head.decode(), "body": body.decode()}
