"""Backup and delete all invoices script.

This script:
- Exports `invoices`, `invoice_items`, and `payments` to CSV files
- Deletes all `Invoice` records using the SQLAlchemy ORM (to trigger cascades)

Run from repository root with the same Python environment used by the project:
    py -3 backend\scripts\delete_all_invoices.py

Use with caution — this is destructive. A CSV backup is created in `backend/scripts/backups/`.
"""
from __future__ import annotations
import os
import csv
import datetime
from typing import Iterable

from database import SessionLocal
import models


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def dump_model_to_csv(session, model, out_path: str) -> int:
    cols = [c.name for c in model.__table__.columns]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(cols)
        q = session.query(model)
        count = 0
        for row in q.yield_per(200):
            writer.writerow([str(getattr(row, c)) if getattr(row, c) is not None else "" for c in cols])
            count += 1
    return count


def main() -> None:
    now = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    here = os.path.dirname(__file__)
    backups = os.path.join(here, "backups")
    ensure_dir(backups)

    session = SessionLocal()
    try:
        print("Starting export of invoices, invoice_items, and payments...")

        invoices_file = os.path.join(backups, f"invoices_{now}.csv")
        items_file = os.path.join(backups, f"invoice_items_{now}.csv")
        payments_file = os.path.join(backups, f"payments_{now}.csv")

        inv_count = dump_model_to_csv(session, models.Invoice, invoices_file)
        item_count = dump_model_to_csv(session, models.InvoiceItem, items_file)
        pay_count = dump_model_to_csv(session, models.Payment, payments_file)

        print(f"Exported {inv_count} invoices -> {invoices_file}")
        print(f"Exported {item_count} invoice_items -> {items_file}")
        print(f"Exported {pay_count} payments -> {payments_file}")

        if inv_count == 0:
            print("No invoices found — nothing to delete.")
            return

        # Proceed to delete invoices via ORM so relationship cascades run
        print("Deleting invoices (this will also remove related items/payments via ORM cascades)...")
        deleted = 0
        # iterate to ensure ORM delete cascades apply
        for inv in session.query(models.Invoice).yield_per(100):
            session.delete(inv)
            deleted += 1
            if deleted % 200 == 0:
                session.flush()

        session.commit()
        print(f"Deleted {deleted} invoices (and cascaded related records).")

        remaining = session.query(models.Invoice).count()
        print(f"Remaining invoices in DB: {remaining}")

    except Exception as exc:
        session.rollback()
        print("Error occurred:", exc)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
