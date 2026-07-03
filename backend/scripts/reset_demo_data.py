#!/usr/bin/env python3
"""Remove demo invoice and service data before go-live.

This script is intentionally destructive. It should only be run manually
from the command line by someone who understands the consequences.

Usage:
    python backend/scripts/reset_demo_data.py --i-am-sure

The script performs these phases:
  1. Dry-run count report.
  2. Exact SELECT output for test reps to delete.
  3. Require the exact confirmation phrase: DELETE DEMO DATA
  4. Run a full database backup using the existing backend/backup.py tool.
  5. Delete demo tables in dependency-safe order inside one transaction.
  6. Reset serial sequence counters where applicable.
  7. Print a final summary with backup location.

IMPORTANT: This script does NOT touch customers.
"""

from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection

# Ensure we can import backend modules when running from backend/scripts
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv()

from database import SessionLocal, engine
from models import Rep, User
from backup import run_backup

TEST_REP_NAMES = ["rep one", "rep two"]
REAL_STAFF_NAMES = ["asanka", "joseph", "hasitha", "pramod", "shen"]
CONFIRM_PHRASE = "DELETE DEMO DATA"

DELETE_ORDER_SQL = [
    "DELETE FROM repair_jobs",
    "DELETE FROM stock_unit_status_history",
    "DELETE FROM job_cards",
    "DELETE FROM stock_units",
    "DELETE FROM payments",
    "DELETE FROM invoice_items",
    "DELETE FROM invoices",
    "DELETE FROM appointments",
    "DELETE FROM stock_receipt_items",
    "DELETE FROM stock_receipts",
    "DELETE FROM stock_items",
    "DELETE FROM suppliers",
    "DELETE FROM technicians",
]

SEQUENCE_RESET_TABLES = [
    "repair_jobs",
    "stock_unit_status_history",
    "job_cards",
    "stock_units",
    "payments",
    "invoice_items",
    "invoices",
    "stock_receipt_items",
    "stock_receipts",
    "stock_items",
    "suppliers",
    "technicians",
    "users",
    "reps",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset demo invoice/service data before go-live."
    )
    parser.add_argument(
        "--i-am-sure",
        action="store_true",
        help="Required explicit flag to allow destructive execution.",
    )
    return parser.parse_args()


def is_production_like_environment() -> bool:
    markers = []
    for key in ["APP_ENV", "ENV", "FLASK_ENV", "DJANGO_SETTINGS_MODULE"]:
        value = os.getenv(key, "").strip().lower()
        if value:
            markers.append((key, value))
    db_name = os.getenv("DB_NAME", "").lower()
    if db_name:
        markers.append(("DB_NAME", db_name))

    for _, value in markers:
        if any(token in value for token in ["prod", "production", "live", "stage", "staging", "main"]):
            return True
    return False


def select_query_text() -> str:
    return (
        "SELECT id, name, code FROM reps "
        "WHERE lower(name) IN ('rep one','rep two') "
        "ORDER BY id;"
    )


def fetch_test_reps(conn: Connection) -> list[tuple[Any, ...]]:
    sql = select_query_text()
    return conn.execute(text(sql)).fetchall()


def fetch_real_staff(conn: Connection) -> list[tuple[Any, ...]]:
    sql = (
        "SELECT id, name, code FROM reps "
        "WHERE lower(name) IN ('asanka','joseph','hasitha','pramod','shen') "
        "ORDER BY id;"
    )
    return conn.execute(text(sql)).fetchall()


def fetch_counts(conn: Connection) -> dict[str, int]:
    queries = {
        "Invoices": "SELECT COUNT(*) FROM invoices",
        "Invoice Items": "SELECT COUNT(*) FROM invoice_items",
        "Payments": "SELECT COUNT(*) FROM payments",
        "Stock Units": "SELECT COUNT(*) FROM stock_units",
        "Stock Unit Status History": "SELECT COUNT(*) FROM stock_unit_status_history",
        "Repair Jobs": "SELECT COUNT(*) FROM repair_jobs",
        "Job Cards": "SELECT COUNT(*) FROM job_cards",
        "Technicians": "SELECT COUNT(*) FROM technicians",
        "Stock Receipt Items": "SELECT COUNT(*) FROM stock_receipt_items",
        "Stock Receipts": "SELECT COUNT(*) FROM stock_receipts",
        "Stock Items": "SELECT COUNT(*) FROM stock_items",
        "Suppliers": "SELECT COUNT(*) FROM suppliers",
        "Customers (NOT TOUCHED)": "SELECT COUNT(*) FROM customers",
    }
    return {label: conn.execute(text(sql)).scalar_one() for label, sql in queries.items()}


def count_appointments_for_test_reps(conn: Connection, rep_ids: list[int]) -> int:
    if not rep_ids:
        return 0
    sql = text(
        "SELECT COUNT(*) FROM appointments WHERE rep_id IN :rep_ids"
    ).bindparams(bindparam("rep_ids", expanding=True))
    return conn.execute(sql, {"rep_ids": rep_ids}).scalar_one()


def print_dry_run_report(conn: Connection) -> list[int]:
    print("\n=== DRY RUN REPORT ===")
    counts = fetch_counts(conn)
    for label, count in counts.items():
        print(f"  {label}: {count}")

    print("\nTest rep SELECT query:")
    print(select_query_text())
    test_reps = fetch_test_reps(conn)
    if test_reps:
        print("\nTest reps matched:")
        for row in test_reps:
            print(f"  id={row.id}, name={row.name}, code={row.code}")
    else:
        print("\nNo test reps found matching Rep One / Rep Two.")

    print("\nReal staff reps preserved:")
    real_staff = fetch_real_staff(conn)
    if real_staff:
        for row in real_staff:
            print(f"  id={row.id}, name={row.name}, code={row.code}")
    else:
        print("  No real staff reps found in the expected list.")

    rep_ids = [row.id for row in test_reps]
    if rep_ids:
        appointments_count = count_appointments_for_test_reps(conn, rep_ids)
        print(f"\nAppointments belonging to matched test reps: {appointments_count}")
        if appointments_count > 0:
            print("  WARNING: test reps have appointment records that may block rep deletion.")
    return rep_ids


def ensure_safe_execution(args: argparse.Namespace) -> None:
    if not args.i_am_sure:
        raise RuntimeError("The --i-am-sure flag is required to run this destructive script.")

    if is_production_like_environment():
        print("\n=== PRODUCTION-LIKE ENVIRONMENT DETECTED ===")
        print("Your DB configuration contains values that look like production or staging.")
        print("This script requires the --i-am-sure flag and exact phrase confirmation.")

    print("\nTo proceed, type exactly:\n  DELETE DEMO DATA")
    response = input("Confirmation: ").strip()
    if response != CONFIRM_PHRASE:
        raise RuntimeError("Confirmation phrase did not match. Aborting without changes.")


def backup_database() -> dict[str, Any]:
    print("\n=== BACKUP STEP ===")
    result = run_backup(quiet=False)
    print(f"Backup complete: {result['filename']} ({result['size_human']})")
    return result


def delete_demo_data(rep_ids: list[int]) -> dict[str, int]:
    counts: dict[str, int] = {}
    session = SessionLocal()
    try:
        with session.begin():
            for sql in DELETE_ORDER_SQL:
                result = session.execute(text(sql))
                counts[sql] = result.rowcount if result.rowcount is not None else 0

            if rep_ids:
                user_delete = session.execute(
                    text("DELETE FROM users WHERE rep_id IN :rep_ids").bindparams(bindparam("rep_ids", expanding=True)),
                    {"rep_ids": rep_ids},
                )
                counts["DELETE FROM users"] = user_delete.rowcount or 0
                rep_delete = session.execute(
                    text("DELETE FROM reps WHERE id IN :rep_ids").bindparams(bindparam("rep_ids", expanding=True)),
                    {"rep_ids": rep_ids},
                )
                counts["DELETE FROM reps"] = rep_delete.rowcount or 0
            else:
                counts["DELETE FROM users"] = 0
                counts["DELETE FROM reps"] = 0
        return counts
    finally:
        session.close()


def reset_sequences() -> dict[str, str]:
    results: dict[str, str] = {}
    with engine.connect() as conn:
        for table_name in SEQUENCE_RESET_TABLES:
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(:table, 'id')"),
                {"table": table_name},
            ).scalar_one()
            if seq:
                conn.execute(text(f"SELECT setval('{seq}', 1, false)"))
                results[table_name] = seq
            else:
                results[table_name] = "<no serial sequence found>"
    return results


def main() -> None:
    args = parse_args()
    print("=== RESET DEMO DATA SCRIPT ===")
    print(f"Database: {os.getenv('DB_NAME', '<unknown>')}@{os.getenv('DB_HOST', '<unknown>')}:{os.getenv('DB_PORT', '<unknown>')}")

    with engine.connect() as conn:
        rep_ids = print_dry_run_report(conn)

    try:
        ensure_safe_execution(args)
    except Exception as exc:
        print(f"\nABORTED: {exc}")
        sys.exit(1)

    try:
        backup_info = backup_database()
    except Exception as exc:
        print(f"\nBackup failed: {exc}")
        print("Aborting without making any changes.")
        sys.exit(1)

    if rep_ids:
        with engine.connect() as conn:
            appointment_count = count_appointments_for_test_reps(conn, rep_ids)
            if appointment_count > 0:
                print("\nABORTED: test reps own appointment records. Remove or reassign them before retrying.")
                sys.exit(1)

    print("\n=== DELETION STEP ===")
    deletion_counts = delete_demo_data(rep_ids)
    print("\nDeleted rows summary:")
    for sql, count in deletion_counts.items():
        print(f"  {sql}: {count}")

    sequence_results = reset_sequences()
    print("\nSequence reset summary:")
    for table_name, seq in sequence_results.items():
        print(f"  {table_name}: {seq}")

    with engine.connect() as conn:
        customers_after = conn.execute(text("SELECT COUNT(*) FROM customers")).scalar_one()
        real_staff_after = conn.execute(
            text(
                "SELECT COUNT(*) FROM reps WHERE lower(name) IN ('asanka','joseph','hasitha','pramod','shen')"
            )
        ).scalar_one()
        test_reps_after = conn.execute(text(select_query_text())).fetchall()

    print("\n=== FINAL REPORT ===")
    print(f"Customers still present: {customers_after}")
    print(f"Real staff reps still present: {real_staff_after}")
    print(f"Test reps remaining: {len(test_reps_after)}")
    if test_reps_after:
        print("  Unexpected test reps still found:")
        for row in test_reps_after:
            print(f"    id={row.id}, name={row.name}, code={row.code}")

    print(f"Backup retained at: {Path(__file__).resolve().parents[1] / 'backups' / backup_info['filename']}")
    print("\nRESET COMPLETE.")


if __name__ == "__main__":
    main()
