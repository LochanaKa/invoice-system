import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.invoices import resolve_invoice_customer_details
from schemas import InvoiceCreate, InvoiceDetail
from decimal import Decimal
from datetime import date


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


def test_invoice_create_allows_warranty_field():
    invoice = InvoiceCreate(
        invoice_number="T-00001",
        invoice_category="ALL_INC",
        service_type="SALE",
        invoice_date=date.today(),
        customer_id=1,
        warranty="1 Year",
        items=[],
    )

    assert invoice.warranty == "1 Year"


def test_invoice_detail_includes_warranty_in_response():
    detail = InvoiceDetail(
        id=1,
        invoice_number="T-00001",
        invoice_category="ALL_INC",
        service_type="SALE",
        invoice_date=date.today(),
        amount=Decimal("100.00"),
        base_subtotal=Decimal("100.00"),
        profit_margin_pct=Decimal("0.00"),
        profit_margin_amount=Decimal("0.00"),
        sscl_pct=Decimal("0.00"),
        sscl_amount=Decimal("0.00"),
        vat_pct=Decimal("0.00"),
        vat_amount=Decimal("0.00"),
        grand_total=Decimal("100.00"),
        credit_balance=Decimal("0.00"),
        is_vat_posted=False,
        warranty="1 Year",
        items=[],
        payments=[],
    )

    assert detail.warranty == "1 Year"
