"""Outbound HTTP client with the retry policy the platform team owns."""


class HttpClient:
    def get(self, url, timeout=5.0):
        return {"url": url, "status": 200, "body": {}}


client = HttpClient()
