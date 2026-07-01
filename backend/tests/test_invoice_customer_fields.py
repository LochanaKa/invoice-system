import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.invoices import resolve_invoice_customer_details


def test_prefers_invoice_values_and_falls_back_to_customer_data():
    customer = SimpleNamespace(tin="123456789", phone="0770000000")

    tin, phone = resolve_invoice_customer_details(
        SimpleNamespace(customer_tin="987654321", customer_phone=""),
        customer,
    )
    assert tin == "987654321"
    assert phone == "0770000000"


def test_uses_customer_values_when_invoice_fields_are_missing():
    customer = SimpleNamespace(tin="123456789", phone="0770000000")

    tin, phone = resolve_invoice_customer_details(
        SimpleNamespace(customer_tin="", customer_phone=""),
        customer,
    )
    assert tin == "123456789"
    assert phone == "0770000000"
