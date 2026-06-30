"""Create sample invoices (Jan–Jun) for testing.

Run this script from the repository root with the project's Python environment.
It will create sample customers and reps if missing, then insert invoices for
both `ALL_INC` and `VAT` categories and both `SALE` and `REPAIR` service types.
Some invoices will be marked outstanding after creation.
"""
from decimal import Decimal
import datetime
from database import SessionLocal
import models

from routers.invoices import create_invoice, generate_next_invoice_number
from schemas import InvoiceCreate, InvoiceItemIn


def ensure_customers_and_reps(db):
    # Minimal sample customers
    sample_customers = [
        {"name": "Sample Customer A", "tin": "TIN-A", "is_vat_registered": True},
        {"name": "Sample Customer B", "tin": "TIN-B", "is_vat_registered": False},
        {"name": "Sample Customer C", "tin": "TIN-C", "is_vat_registered": True},
    ]

    created_customers = []
    for c in sample_customers:
        existing = db.query(models.Customer).filter(models.Customer.name == c["name"]).first()
        if not existing:
            cust = models.Customer(**c)
            db.add(cust)
            db.commit()
            db.refresh(cust)
            created_customers.append(cust)
        else:
            created_customers.append(existing)

    # Minimal sample reps
    sample_reps = [
        {"name": "Rep One", "code": "R1", "phone": "0710000001", "role": "Sales"},
        {"name": "Rep Two", "code": "R2", "phone": "0710000002", "role": "Sales"},
    ]

    created_reps = []
    for r in sample_reps:
        existing = db.query(models.Rep).filter(models.Rep.code == r["code"]).first()
        if not existing:
            rep = models.Rep(**r)
            db.add(rep)
            db.commit()
            db.refresh(rep)
            created_reps.append(rep)
        else:
            created_reps.append(existing)

    return created_customers, created_reps


def make_items_for(month_idx):
    # Deterministic items per month for reproducibility
    base = 1000 + month_idx * 50
    items = [
        {"description": f"Item A (month {month_idx})", "qty": 1, "rate": Decimal(base)},
        {"description": f"Item B (month {month_idx})", "qty": 2, "rate": Decimal(base // 2)},
    ]
    return items


def main():
    db = SessionLocal()
    try:
        customers, reps = ensure_customers_and_reps(db)

        created = []
        year = datetime.date.today().year

        for month in range(1, 7):  # January (1) to June (6)
            invoice_date = datetime.date(year, month, 5)
            for category in ("ALL_INC", "VAT"):
                for service_type in ("SALE", "REPAIR"):
                    # pick a customer and rep round-robin
                    cust = customers[(month - 1) % len(customers)]
                    rep = reps[(month - 1) % len(reps)]

                    inv_number = generate_next_invoice_number(db, category, service_type)

                    items = make_items_for(month)

                    payload = InvoiceCreate(
                        invoice_number=inv_number,
                        invoice_category=category,
                        service_type=service_type,
                        invoice_date=invoice_date,
                        customer_id=cust.id,
                        rep_id=rep.id,
                        credit_balance=Decimal("0.00"),
                        items=[InvoiceItemIn(**it) for it in items],
                    )

                    result = create_invoice(payload, db)
                    created.append(result)
                    print(f"Created invoice {result.invoice_number} dated {result.invoice_date}")

        # Mark every 3rd created invoice as outstanding (credit_balance = grand_total)
        for i, inv_detail in enumerate(created):
            if i % 3 == 0:
                orm_inv = db.query(models.Invoice).filter(models.Invoice.id == inv_detail.id).first()
                if orm_inv:
                    orm_inv.credit_balance = orm_inv.grand_total
                    db.commit()
                    print(f"Marked outstanding: {orm_inv.invoice_number} amount={orm_inv.grand_total}")

        print("Sample invoice creation complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
