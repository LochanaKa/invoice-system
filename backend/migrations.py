"""
migrations.py — Lightweight startup schema patches
===================================================
SQLAlchemy create_all() only creates missing tables; it does not add columns
to existing tables. These patches run on startup and are idempotent.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

from rep_codes import is_valid_rep_code
from staff_assignments import STAFF_ASSIGNMENTS, assignment_for_name


def _needs_code_reassignment(rows) -> bool:
    if any(not is_valid_rep_code(row.code) for row in rows):
        return True
    for row in rows:
        match = assignment_for_name(row.name)
        if match and row.code != match[0]:
            return True
    return False


def _assign_staff_codes_and_roles(conn) -> None:
    """
    Safe assignment of CC-0000 codes and roles for existing staff.
    Runs when legacy codes exist or named staff have the wrong employee number.
    """
    rows = conn.execute(text("SELECT id, name, code, role FROM reps ORDER BY id")).fetchall()
    if not rows:
        return

    if not _needs_code_reassignment(rows):
        # Back-fill known roles when missing
        for staff_name, _code, role in STAFF_ASSIGNMENTS:
            if role:
                conn.execute(
                    text(
                        "UPDATE reps SET role = :role "
                        "WHERE LOWER(name) = LOWER(:name) AND (role IS NULL OR role = '')"
                    ),
                    {"name": staff_name, "role": role},
                )
        return

    # Phase 1: temporary unique codes
    for row in rows:
        conn.execute(
            text("UPDATE reps SET code = :temp WHERE id = :id"),
            {"temp": f"CC-TEMP-{row.id:06d}", "id": row.id},
        )

    # Phase 2: canonical codes + roles by name
    assigned_codes: set[str] = set()
    for staff_name, code, role in STAFF_ASSIGNMENTS:
        params = {"name": staff_name, "code": code}
        if role:
            conn.execute(
                text(
                    "UPDATE reps SET code = :code, role = :role "
                    "WHERE LOWER(name) = LOWER(:name)"
                ),
                {**params, "role": role},
            )
        else:
            conn.execute(
                text("UPDATE reps SET code = :code WHERE LOWER(name) = LOWER(:name)"),
                params,
            )
        assigned_codes.add(code)

    # Phase 3: any other reps get the next available CC-#### numbers
    remaining = conn.execute(
        text("SELECT id FROM reps WHERE code LIKE 'CC-TEMP-%' ORDER BY id")
    ).fetchall()
    next_num = len(assigned_codes) + 1
    for row in remaining:
        while f"CC-{next_num:04d}" in assigned_codes:
            next_num += 1
        code = f"CC-{next_num:04d}"
        conn.execute(
            text("UPDATE reps SET code = :code WHERE id = :id"),
            {"code": code, "id": row.id},
        )
        assigned_codes.add(code)
        next_num += 1


def _repair_serial_sequences(conn) -> None:
    """Repair any serial sequences whose last_value is behind the table's max(id)."""
    sequence_map = {
        'invoice_items': 'invoice_items_id_seq',
        'invoices': 'invoices_id_seq',
        'payments': 'payments_id_seq',
        'customers': 'customers_id_seq',
        'routes': 'routes_id_seq',
        'reps': 'reps_id_seq',
    }

    for table_name, seq_name in sequence_map.items():
        try:
            max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name};")).scalar()
            seq_row = conn.execute(text(f"SELECT last_value, is_called FROM {seq_name};")).one()
        except Exception:
            continue

        if seq_row[0] <= max_id:
            next_value = max_id + 1
            conn.execute(text(
                "SELECT setval(:seq_name, :next_value, false);"
            ), {"seq_name": seq_name, "next_value": next_value})


def run_startup_migrations(engine: Engine) -> None:
    """Apply safe, idempotent schema patches."""
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS company_settings ("
            "id INTEGER PRIMARY KEY DEFAULT 1, "
            "company_name VARCHAR(200) NOT NULL DEFAULT 'Creative Computers', "
            "address TEXT, "
            "tin VARCHAR(50), "
            "phone_numbers TEXT, "
            "default_warranty_text TEXT, "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "INSERT INTO company_settings "
            "(id, company_name, address, tin, phone_numbers, default_warranty_text) "
            "VALUES (1, 'Creative Computers', "
            "'No. 95, Colombo Road, Kurunegala', "
            "'783634953-7000', "
            "'+94 37 22 29 181\n+94 77 57 67 070', "
            "'Please submit the Original Invoice for warranty claims.\n"
            "Warranty period is one year less than 14 working days.\n"
            "Goods once sold are not refundable.\n"
            "Warranty covers only manufacturer defects.') "
            "ON CONFLICT (id) DO NOTHING"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS rate_settings ("
            "id SERIAL PRIMARY KEY, "
            "key VARCHAR(80) NOT NULL UNIQUE, "
            "label VARCHAR(120) NOT NULL, "
            "rate NUMERIC(8, 6) NOT NULL DEFAULT 0, "
            "rate_type VARCHAR(30) NOT NULL DEFAULT 'tax', "
            "description TEXT, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "INSERT INTO rate_settings (key, label, rate, rate_type, description) VALUES "
            "('sscl_pct', 'SSCL', 0.025, 'tax', 'Social Security Contribution Levy'), "
            "('vat_pct', 'VAT', 0.18, 'tax', 'Value Added Tax'), "
            "('profit_margin', 'Profit Margin', 0.20, 'margin', 'Default item markup') "
            "ON CONFLICT (key) DO NOTHING"
        ))
        conn.execute(text(
            "UPDATE rate_settings SET is_active = TRUE WHERE is_active IS NULL"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS user_preferences ("
            "id SERIAL PRIMARY KEY, "
            "system_id VARCHAR(80) NOT NULL UNIQUE DEFAULT 'default', "
            "dashboard_layout JSONB NOT NULL DEFAULT '[]'::jsonb, "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))

        conn.execute(text(
            "ALTER TABLE invoice_items "
            "ADD COLUMN IF NOT EXISTS raw_rate NUMERIC(12, 2) NOT NULL DEFAULT 0"
        ))
        conn.execute(text(
            "UPDATE invoice_items SET raw_rate = rate WHERE raw_rate = 0"
        ))

        conn.execute(text(
            "ALTER TABLE reps ADD COLUMN IF NOT EXISTS role VARCHAR(100)"
        ))

        conn.execute(text(
            "ALTER TABLE routes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))

        conn.execute(text(
            "ALTER TABLE invoices "
            "ADD COLUMN IF NOT EXISTS route_id INTEGER REFERENCES routes(id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_invoices_route ON invoices(route_id)"
        ))
        conn.execute(text(
            "ALTER TABLE invoices "
            "ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(50)"
        ))
        conn.execute(text(
            "ALTER TABLE invoices "
            "ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)"
        ))
        conn.execute(text(
            "ALTER TABLE payments "
            "ADD COLUMN IF NOT EXISTS recorded_by_rep_id INTEGER REFERENCES reps(id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_payments_recorded_by_rep "
            "ON payments(recorded_by_rep_id)"
        ))

        _assign_staff_codes_and_roles(conn)
        _repair_serial_sequences(conn)
