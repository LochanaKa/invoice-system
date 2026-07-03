"""Check a serial number in the configured application database.

Usage:
    python backend/scripts/check_serial.py 123456

This script uses the same environment variables as the app (.env)
and prints the `stock_units` row for the given serial (if present).
"""
import sys
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.engine import URL
from sqlalchemy import create_engine

load_dotenv()

def make_engine():
    return create_engine(URL.create(
        drivername="postgresql+psycopg2",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME"),
    ))

def main():
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/check_serial.py <serial>")
        sys.exit(1)

    serial = sys.argv[1].strip()
    if not serial:
        print("Empty serial")
        sys.exit(1)

    eng = make_engine()
    q = text("SELECT id, receipt_item_id, stock_item_id, serial_number, status, sold_invoice_item_id, created_at, updated_at FROM stock_units WHERE serial_number = :s")
    with eng.connect() as conn:
        rows = conn.execute(q, {"s": serial}).fetchall()
        if not rows:
            print(f"Serial '{serial}' not found in stock_units.")
            # Try fuzzy search
            fq = text("SELECT id, serial_number, status FROM stock_units WHERE serial_number ILIKE :p ORDER BY serial_number LIMIT 20")
            candidates = conn.execute(fq, {"p": f"%{serial}%"}).fetchall()
            if candidates:
                print("Fuzzy matches:")
                for r in candidates:
                    print(r)
            else:
                print("No fuzzy matches either.")
            return

        for r in rows:
            print("Found:")
            print(dict(r._mapping))

if __name__ == "__main__":
    main()
