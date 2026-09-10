"""The invoice store. Nothing here reads a caller's identity -- authz.py does."""


class Invoice:
    def __init__(self, id, account_id, total, status="open"):
        self.id = id
        self.account_id = account_id
        self.total = total
        self.status = status


_INVOICES = {
    "inv-1001": Invoice("inv-1001", "acct-1", 4200),
    "inv-1002": Invoice("inv-1002", "acct-1", 1150),
    "inv-2001": Invoice("inv-2001", "acct-2", 9900),
}


def find_invoice(invoice_id):
    return _INVOICES[invoice_id]


def list_invoices(account_id):
    return [i for i in _INVOICES.values() if i.account_id == account_id]


def mark_paid(invoice):
    invoice.status = "paid"
    return invoice
