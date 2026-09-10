"""Request handlers. None of them checks identity itself."""

from .store import accounts, reports


def list_accounts(request):
    return {"accounts": accounts.all_ids()}


def get_account(request, account_id):
    return accounts.get(account_id)


def update_account(request, account_id):
    return accounts.update(account_id, request.json)


def export_report(request, report_id):
    return reports.render(report_id)


def usage_summary(request):
    """Aggregate usage across every account, by account id."""
    return {"accounts": accounts.all_ids(), "calls": reports.usage_counts()}
