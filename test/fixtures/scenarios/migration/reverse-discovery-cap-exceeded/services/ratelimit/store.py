"""ratelimit storage: Redis, deliberately -- this data is ephemeral and keyed.

The exception to the one-primary-store convention, and the reason a decision
about it is worth writing down.
"""

TTL_SECONDS = 3600


class Store:
    def __init__(self, redis):
        self.redis = redis

    def get(self, item_id):
        return self.redis.get(f"ratelimit:{item_id}")

    def put(self, item_id, value):
        return self.redis.setex(f"ratelimit:{item_id}", TTL_SECONDS, value)
