"""catalog HTTP surface. Blueprint per service, /v1 prefix, health endpoint."""

from flask import Blueprint, request

from libs.platform.errors import NotFound
from .service import handle, health_state

bp = Blueprint("catalog", __name__, url_prefix="/v1/catalog")


@bp.get("")
def index():
    """Paginated with cursor + limit, as every list endpoint here is."""
    cursor = request.args.get("cursor")
    limit = min(int(request.args.get("limit", 50)), 200)
    return {"items": handle("list", cursor=cursor, limit=limit), "next_cursor": None}


@bp.get("/<item_id>")
def show(item_id):
    item = handle("get", item_id=item_id)
    if item is None:
        raise NotFound("catalog item not found")
    return item


@bp.post("")
def create():
    """Writes require an Idempotency-Key header."""
    key = request.headers["Idempotency-Key"]
    return handle("create", body=request.json, idempotency_key=key), 201


@bp.get("/health")
def health():
    return health_state()
