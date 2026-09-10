"""Session authentication. Applied per route, by hand, at registration time.

This is the shape the review has to notice: nothing forces a route through
`requires_session`, so a route registered without it is simply open.
"""

from functools import wraps


class Unauthenticated(Exception):
    pass


def requires_session(handler):
    @wraps(handler)
    def wrapper(request, *args, **kwargs):
        if not request.cookies.get("session"):
            raise Unauthenticated("no session cookie")
        return handler(request, *args, **kwargs)

    return wrapper
