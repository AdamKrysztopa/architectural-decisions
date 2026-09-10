"""The second caller path: a batch job, not an HTTP request.

It authenticates as its own service principal and then goes through the same
`authorize_invoice_access` the HTTP handlers use. There is no bypass branch.
"""

from services.billing.authz import Forbidden, authorize_invoice_access
from services.billing.invoices import find_invoice, list_invoices
from services.billing.secrets import vault


def service_principal():
    token = vault.short_lived("identity/nightly-close")
    return {"subject": "job:nightly-close", "account_id": "acct-1", "key_id": token["kid"]}


def close_open_invoices():
    principal = service_principal()
    closed = []
    for invoice in list_invoices(principal["account_id"]):
        try:
            authorize_invoice_access(principal, find_invoice(invoice.id))
        except Forbidden:
            continue
        closed.append(invoice.id)
    return closed
