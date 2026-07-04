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
            "ALTER TABLE invoice_items "
            "ADD COLUMN IF NOT EXISTS warranty_months INTEGER"
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
            "ALTER TABLE invoices "
            "ADD COLUMN IF NOT EXISTS warranty VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE payments "
            "ADD COLUMN IF NOT EXISTS recorded_by_rep_id INTEGER REFERENCES reps(id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_payments_recorded_by_rep "
            "ON payments(recorded_by_rep_id)"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS job_cards ("
            "id SERIAL PRIMARY KEY, "
            "customer_name VARCHAR(200) NOT NULL, "
            "customer_phone VARCHAR(30), "
            "device_name VARCHAR(200) NOT NULL, "
            "issue_description TEXT NOT NULL, "
            "received_by_staff_id INTEGER REFERENCES reps(id), "
            "assigned_to_staff_id INTEGER REFERENCES reps(id), "
            "serial_number VARCHAR(100), "
            "stock_unit_id BIGINT REFERENCES stock_units(id), "
            "job_type VARCHAR(20), "
            "device_source VARCHAR(20), "
            "paper_grn_reference VARCHAR(100), "
            "intake_method VARCHAR(20) NOT NULL DEFAULT 'WALK_IN', "
            "status VARCHAR(20) NOT NULL DEFAULT 'NEW', "
            "notes TEXT, "
            "priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', "
            "due_date DATE, "
            "linked_sales_invoice_id BIGINT REFERENCES invoices(id), "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS device_name VARCHAR(200)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS issue_description TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS received_by_staff_id INTEGER REFERENCES reps(id)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS paper_grn_reference VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS intake_method VARCHAR(20) DEFAULT 'WALK_IN'"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS assigned_to_staff_id INTEGER REFERENCES reps(id)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'NEW'"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS notes TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL'"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS due_date DATE"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS stock_unit_id BIGINT REFERENCES stock_units(id)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS job_type VARCHAR(20)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS device_source VARCHAR(20)"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()"
        ))
        conn.execute(text(
            "ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS linked_sales_invoice_id BIGINT REFERENCES invoices(id)"
        ))

        # ── Stock Management tables (v2) ─────────────────────────────────────
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS suppliers ("
            "id SERIAL PRIMARY KEY, "
            "name VARCHAR(200) NOT NULL, "
            "contact_person VARCHAR(100), "
            "phone VARCHAR(30), "
            "email VARCHAR(100), "
            "address TEXT, "
            "notes TEXT, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        # Back-fill columns that may be missing from a pre-notes suppliers table
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(100)"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))
        conn.execute(text(
            "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"
        ))


        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_categories ("
            "id SERIAL PRIMARY KEY, "
            "name VARCHAR(100) NOT NULL UNIQUE, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_items ("
            "id SERIAL PRIMARY KEY, "
            "category_id INTEGER NOT NULL REFERENCES stock_categories(id), "
            "brand VARCHAR(150), "
            "model VARCHAR(150) NOT NULL, "
            "description VARCHAR(300), "
            "requires_serial BOOLEAN DEFAULT FALSE, "
            "qty_on_hand INTEGER NOT NULL DEFAULT 0, "
            "reorder_level INTEGER, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "CONSTRAINT ck_stock_items_qty_on_hand_nonnegative CHECK (qty_on_hand >= 0)"
            ")"
        ))
        # Manufacturer warranty claim history table (audit trail for changes)
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS manufacturer_warranty_claim_histories ("
            "id BIGSERIAL PRIMARY KEY, "
            "claim_id BIGINT NOT NULL REFERENCES manufacturer_warranty_claims(id), "
            "old_outcome VARCHAR(30), "
            "new_outcome VARCHAR(30), "
            "note TEXT, "
            "changed_by_user_id INTEGER REFERENCES users(id), "
            "changed_by_rep_id INTEGER REFERENCES reps(id), "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_receipts ("
            "id BIGSERIAL PRIMARY KEY, "
            "supplier_id INTEGER NOT NULL REFERENCES suppliers(id), "
            "received_date DATE NOT NULL, "
            "reference_no VARCHAR(80), "
            "received_by_rep_id INTEGER REFERENCES reps(id), "
            "notes TEXT, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_receipt_items ("
            "id BIGSERIAL PRIMARY KEY, "
            "receipt_id BIGINT NOT NULL REFERENCES stock_receipts(id), "
            "stock_item_id INTEGER NOT NULL REFERENCES stock_items(id), "
            "qty INTEGER NOT NULL DEFAULT 1, "
            "unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "operation_cost_type VARCHAR(10) NOT NULL DEFAULT 'percentage', "
            "operation_cost_value NUMERIC(12, 4) NOT NULL DEFAULT 0, "
            "operation_cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "subtotal_after_opcost NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "sscl_pct NUMERIC(8, 6) NOT NULL DEFAULT 0.025, "
            "sscl_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "vat_pct NUMERIC(8, 6) NOT NULL DEFAULT 0.18, "
            "vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "final_unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0, "
            "warranty_months INTEGER, "
            "has_manufacturer_warranty BOOLEAN NOT NULL DEFAULT FALSE, "
            "manufacturer_warranty_months INTEGER, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))

        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_units ("
            "id BIGSERIAL PRIMARY KEY, "
            "receipt_item_id BIGINT NOT NULL REFERENCES stock_receipt_items(id), "
            "stock_item_id INTEGER NOT NULL REFERENCES stock_items(id), "
            "serial_number VARCHAR(200) NOT NULL UNIQUE, "
            "status VARCHAR(30) NOT NULL DEFAULT 'in_stock', "
            "sold_invoice_item_id BIGINT REFERENCES invoice_items(id), "
            "warranty_months INTEGER, "
            "has_manufacturer_warranty BOOLEAN NOT NULL DEFAULT FALSE, "
            "manufacturer_warranty_months INTEGER, "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_stock_units_stock_item_id "
            "ON stock_units(stock_item_id)"
        ))
        # Back-fill warranty-related columns for older DBs that may lack them
        conn.execute(text(
            "ALTER TABLE stock_receipt_items ADD COLUMN IF NOT EXISTS warranty_months INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE stock_receipt_items ADD COLUMN IF NOT EXISTS has_manufacturer_warranty BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE stock_receipt_items ADD COLUMN IF NOT EXISTS manufacturer_warranty_months INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS warranty_months INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS has_manufacturer_warranty BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS manufacturer_warranty_months INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()"
        ))
        conn.execute(text(
            "ALTER TABLE stock_units ADD COLUMN IF NOT EXISTS replacement_for_unit_id BIGINT REFERENCES stock_units(id)"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS stock_unit_status_history ("
            "id BIGSERIAL PRIMARY KEY, "
            "stock_unit_id BIGINT NOT NULL REFERENCES stock_units(id), "
            "old_status VARCHAR(30) NOT NULL, "
            "new_status VARCHAR(30) NOT NULL, "
            "changed_at TIMESTAMP DEFAULT NOW(), "
            "note TEXT, "
            "changed_by_rep_id INTEGER REFERENCES reps(id)"
            ")"
        ))
        # Ensure existing databases with narrower column sizes are widened
        # to accept status values like 'with_internal_team_paid' (length > 20).
        try:
            conn.execute(text("ALTER TABLE stock_units ALTER COLUMN status TYPE VARCHAR(30)"))
        except Exception:
            # If ALTER fails (rare), continue — startup should not hard-fail here.
            pass
        try:
            conn.execute(text("ALTER TABLE stock_unit_status_history ALTER COLUMN old_status TYPE VARCHAR(30)"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE stock_unit_status_history ALTER COLUMN new_status TYPE VARCHAR(30)"))
        except Exception:
            pass
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS technicians ("
            "id SERIAL PRIMARY KEY, "
            "name VARCHAR(200) NOT NULL, "
            "contact_phone VARCHAR(30) NOT NULL, "
            "contact_email VARCHAR(100), "
            "specialty TEXT, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS repair_jobs ("
            "id BIGSERIAL PRIMARY KEY, "
            "stock_unit_id BIGINT NOT NULL REFERENCES stock_units(id), "
            "technician_id INTEGER NOT NULL REFERENCES technicians(id), "
            "date_sent DATE NOT NULL, "
            "date_returned DATE, "
            "amount_charged_by_technician NUMERIC(12, 2), "
            "outcome VARCHAR(20) NOT NULL DEFAULT 'pending', "
            "linked_job_card_id INTEGER REFERENCES job_cards(id), "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS manufacturer_warranty_claims ("
            "id BIGSERIAL PRIMARY KEY, "
            "stock_unit_id BIGINT NOT NULL REFERENCES stock_units(id), "
            "supplier_id INTEGER NOT NULL REFERENCES suppliers(id), "
            "linked_job_card_id INTEGER REFERENCES job_cards(id), "
            "date_sent DATE NOT NULL, "
            "expected_return_date DATE, "
            "date_returned DATE, "
            "outcome VARCHAR(30) NOT NULL DEFAULT 'pending', "
            "tracking_reference VARCHAR(100), "
            "notes TEXT, "
            "created_at TIMESTAMP DEFAULT NOW(), "
            "updated_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_manufacturer_warranty_claims_linked_job_card_id "
            "ON manufacturer_warranty_claims(linked_job_card_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_stock_units_serial "
            "ON stock_units(serial_number)"
        ))

        # Link invoice line items back to the catalog for stock decrement
        conn.execute(text(
            "ALTER TABLE invoice_items "
            "ADD COLUMN IF NOT EXISTS stock_item_id INTEGER REFERENCES stock_items(id)"
        ))

        _assign_staff_codes_and_roles(conn)
        _repair_serial_sequences(conn)
