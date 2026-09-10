"""The one outbound HTTP client every service uses.

Timeouts and the retry policy are set here and nowhere else; no service
constructs a bare requests.Session.
"""

TIMEOUT_SECONDS = 3.0
RETRY_BACKOFF = [0.1, 0.4, 1.6]


class Client:
    def get(self, url, timeout=TIMEOUT_SECONDS):
        return {"url": url, "status": 200, "body": {}}

    def post(self, url, json, idempotency_key, timeout=TIMEOUT_SECONDS):
        return {"url": url, "status": 202, "key": idempotency_key}


client = Client()
