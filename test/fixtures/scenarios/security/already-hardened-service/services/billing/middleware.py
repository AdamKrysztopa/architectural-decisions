"""Authentication for every route on the billing blueprint.

Registered once, on the blueprint, so a new route cannot be added outside it:
`billing.before_request` runs ahead of every handler in this package.
"""

from .identity import verify_bearer_token


class Unauthenticated(Exception):
    pass


def authenticate(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise Unauthenticated("no bearer token on the request")
    return verify_bearer_token(header[len("Bearer ") :])
