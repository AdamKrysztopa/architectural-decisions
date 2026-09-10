"""The route table. One row differs from the other four."""

from .handlers import (
    export_report,
    get_account,
    list_accounts,
    update_account,
    usage_summary,
)
from .middleware import requires_session


def register(app):
    app.add_url_rule("/v1/accounts", view_func=requires_session(list_accounts), methods=["GET"])
    app.add_url_rule("/v1/accounts/<account_id>", view_func=requires_session(get_account), methods=["GET"])
    app.add_url_rule("/v1/accounts/<account_id>", view_func=requires_session(update_account), methods=["PUT"])
    app.add_url_rule("/v1/reports/<report_id>/export", view_func=requires_session(export_report), methods=["GET"])

    # Added for the ops dashboard. It returns every account id and their call
    # counts, and it is registered without requires_session.
    app.add_url_rule("/v1/usage", view_func=usage_summary, methods=["GET"])
