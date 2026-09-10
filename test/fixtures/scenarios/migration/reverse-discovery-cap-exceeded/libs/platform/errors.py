"""One error envelope for every service's HTTP surface."""


class ApiError(Exception):
    status = 500
    code = "internal_error"

    def envelope(self):
        return {"error": {"code": self.code, "message": str(self)}}


class NotFound(ApiError):
    status = 404
    code = "not_found"


class Conflict(ApiError):
    status = 409
    code = "conflict"
