"""Authorization lives here, at the service that owns the invoice rows.

Every caller -- the HTTP handlers in app.py and the nightly batch job in
jobs/nightly_close.py -- reaches invoices through `authorize_invoice_access`.
There is no second copy of this rule at a gateway or in a caller.
"""


class Forbidden(Exception):
    pass


def authorize_invoice_access(principal, invoice):
    if invoice.account_id != principal["account_id"]:
        raise Forbidden(f"{principal['subject']} does not own invoice {invoice.id}")
    return invoice
