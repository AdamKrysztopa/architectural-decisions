"""Token verification against the identity provider's published keys."""

from .secrets import vault


def verify_bearer_token(token):
    key = vault.short_lived("identity/jwks")
    principal = _decode(token, key)
    if principal is None:
        raise ValueError("token did not verify")
    return principal


def _decode(token, key):  # pragma: no cover - stand-in for the JWT library
    return {"subject": token.split(".")[0], "key_id": key["kid"]}
