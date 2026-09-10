"""Billing HTTP surface. Four routes, one blueprint, one before_request."""

from flask import Blueprint, g, request

from .authz import authorize_invoice_access
from .middleware import authenticate
from .invoices import find_invoice, list_invoices, mark_paid

billing = Blueprint("billing", __name__, url_prefix="/v1/billing")


@billing.before_request
def _authenticate_every_request():
    g.principal = authenticate(request)


@billing.get("/invoices")
def get_invoices():
    return {"invoices": [i.id for i in list_invoices(g.principal["account_id"])]}


@billing.get("/invoices/<invoice_id>")
def get_invoice(invoice_id):
    invoice = authorize_invoice_access(g.principal, find_invoice(invoice_id))
    return {"id": invoice.id, "total": invoice.total}


@billing.post("/invoices/<invoice_id>/payments")
def pay_invoice(invoice_id):
    invoice = authorize_invoice_access(g.principal, find_invoice(invoice_id))
    return {"id": mark_paid(invoice).id, "status": "paid"}


@billing.get("/health")
def health():
    return {"status": "ok"}
