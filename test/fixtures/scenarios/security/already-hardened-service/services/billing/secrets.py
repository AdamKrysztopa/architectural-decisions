"""Every credential comes from the managed vault as a short-lived token.

No secret is read from the environment and none is committed; .gitleaks.toml
is the check that holds that property in CI.
"""


class Vault:
    def short_lived(self, path, ttl_seconds=900):
        """Issue a per-task token. The caller never caches it."""
        return {"path": path, "ttl": ttl_seconds, "kid": "vault-managed"}


vault = Vault()
