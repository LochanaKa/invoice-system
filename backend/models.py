"""
models.py — SQLAlchemy ORM Models
===================================
Each class here is a Python mirror of one table in PostgreSQL.

Analogy: your DB table is the actual filing cabinet drawer.
The model class is the label on the drawer that tells Python
"this drawer holds invoices, each with these specific fields."

The `relationship()` calls let you navigate between tables in Python:
    invoice.customer.name   ← no JOIN needed, SQLAlchemy handles it
    customer.invoices       ← all invoices for this customer
"""

from decimal import Decimal
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean,
    Date, DateTime, Numeric, Text, ForeignKey, func, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Session
from database import Base


class Settings(Base):
    """
    Single-row table (id=1 always) that stores the system-wide default
    tax rates and profit margin. The settings router ensures the row
    is created on first access if it doesn't exist.
    """
    __tablename__ = "settings"

    id            = Column(Integer, primary_key=True, default=1)
    sscl_pct      = Column(Numeric(8, 6), nullable=False, default=Decimal("0.025"))
    vat_pct       = Column(Numeric(8, 6), nullable=False, default=Decimal("0.18"))
    profit_margin = Column(Numeric(8, 6), nullable=False, default=Decimal("0.20"))
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


class CompanySettings(Base):
    """
    Single-row table (id=1) for company identity and invoice defaults used by
    the UI and PDF renderer.
    """
    __tablename__ = "company_settings"

    id                    = Column(Integer, primary_key=True, default=1)
    company_name          = Column(String(200), nullable=False, default="Creative Computers")
    address               = Column(Text)
    tin                   = Column(String(50))
    phone_numbers         = Column(Text)
    default_warranty_text = Column(Text)
    updated_at            = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RateSetting(Base):
    """
    Flexible tax/margin configuration. The three legacy rates are mirrored here
    with keys: sscl_pct, vat_pct, profit_margin.
    """
    __tablename__ = "rate_settings"

    id          = Column(Integer, primary_key=True)
    key         = Column(String(80), nullable=False, unique=True)
    label       = Column(String(120), nullable=False)
    rate        = Column(Numeric(8, 6), nullable=False, default=0)
    rate_type   = Column(String(30), nullable=False, default="tax")
    description = Column(Text)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())


class UserPreference(Base):
    """
    Stores JSON preferences for the dashboard. There is no auth layer yet, so
    system_id identifies the shared layout for this installation.
    """
    __tablename__ = "user_preferences"

    id               = Column(Integer, primary_key=True)
    system_id        = Column(String(80), nullable=False, unique=True, default="default")
    dashboard_layout = Column(JSONB, nullable=False, default=list)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


class User(Base):
    """
    A login account. Optionally linked to a Rep (rep_id) so that when
    'Asanka' logs in, invoices they create can be attributed to the
    Asanka rep record automatically — no separate "who created this"
    field needed elsewhere.

    is_admin distinguishes staff who can manage Settings/Staff/Backups
    from ordinary reps who should only see invoices/customers/dashboard.
    """
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    username      = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(100), nullable=False)
    rep_id        = Column(Integer, ForeignKey("reps.id"), nullable=True)
    is_admin      = Column(Boolean, default=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, server_default=func.now())
    last_login    = Column(DateTime, nullable=True)

    rep = relationship("Rep")


class Supplier(Base):
    """
    A goods supplier — the company we purchase stock from.
    One supplier can appear on many StockReceipts.
    """
    __tablename__ = "suppliers"

    id             = Column(Integer,     primary_key=True)
    name           = Column(String(200), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone          = Column(String(30),  nullable=True)
    email          = Column(String(100), nullable=True)
    address        = Column(Text,        nullable=True)
    notes          = Column(Text,        nullable=True)
    is_active      = Column(Boolean,     default=True)
    created_at     = Column(DateTime,    server_default=func.now())


class StockCategory(Base):
    """
    A product category (e.g. "Laptops", "Toners", "Cables").
    Mirrors the Route model exactly — same minimal shape.
    """
    __tablename__ = "stock_categories"

    id         = Column(Integer,     primary_key=True)
    name       = Column(String(100), nullable=False, unique=True)
    is_active  = Column(Boolean,     default=True)
    created_at = Column(DateTime,    server_default=func.now())


class StockItem(Base):
    """
    The product catalog — one row per distinct product SKU.

    qty_on_hand is a cached running total:
      - Incremented when stock is received (StockReceiptItem saved).
      - Decremented when sold (InvoiceItem saved) or on manual adjustment.
    For requires_serial=True items it should always equal the count of
    StockUnits with status='in_stock' for this item.
    """
    __tablename__ = "stock_items"
    __table_args__ = (
        CheckConstraint("qty_on_hand >= 0", name="ck_stock_items_qty_on_hand_nonnegative"),
    )

    id              = Column(Integer,     primary_key=True)
    category_id     = Column(Integer,     ForeignKey("stock_categories.id"), nullable=False)
    brand           = Column(String(150), nullable=True)
    model           = Column(String(150), nullable=False)
    description     = Column(String(300), nullable=True)   # if blank, frontend shows "{brand} {model}"
    requires_serial = Column(Boolean,     default=False)   # True for laptops/monitors/printers
    qty_on_hand     = Column(Integer,     nullable=False, default=0)
    reorder_level   = Column(Integer,     nullable=True)   # optional low-stock threshold
    is_active       = Column(Boolean,     default=True)
    created_at      = Column(DateTime,    server_default=func.now())

    category = relationship("StockCategory")


class StockReceipt(Base):
    """
    One row per delivery from a supplier — a "Goods Received Note" (GRN).
    The header; line items live in StockReceiptItem.
    """
    __tablename__ = "stock_receipts"

    id                  = Column(BigInteger, primary_key=True)
    supplier_id         = Column(Integer,    ForeignKey("suppliers.id"),  nullable=False)
    received_date       = Column(Date,       nullable=False)
    reference_no        = Column(String(80), nullable=True)   # supplier's own delivery note / invoice number
    received_by_rep_id  = Column(Integer,    ForeignKey("reps.id"),       nullable=True)
    notes               = Column(Text,       nullable=True)
    created_at          = Column(DateTime,   server_default=func.now())

    supplier         = relationship("Supplier")
    received_by_rep  = relationship("Rep")
    items            = relationship(
        "StockReceiptItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
    )


class StockReceiptItem(Base):
    """
    Pricing chain for one product line on a GRN.

    Every rate and computed amount is stored permanently here (rate-snapshot
    pattern — identical to InvoiceItem) so historical costs never change even
    if global rates change later.

    Calculation order per unit:
      1. unit_cost                              (supplier charge)
      2. + operation_cost_amount                (resolved from type+value)
         = subtotal_after_opcost
      3. + sscl_amount  (subtotal_after_opcost × sscl_pct)
      4. + vat_amount   (subtotal_after_opcost × vat_pct)
         = final_unit_price                     (customer-facing price)
    """
    __tablename__ = "stock_receipt_items"

    id                      = Column(BigInteger,    primary_key=True)
    receipt_id              = Column(BigInteger,    ForeignKey("stock_receipts.id"), nullable=False)
    stock_item_id           = Column(Integer,       ForeignKey("stock_items.id"),   nullable=False)
    qty                     = Column(Integer,       nullable=False, default=1)

    # ── Cost chain (all snapshotted at save time) ──────────────────────────
    unit_cost               = Column(Numeric(12, 2), nullable=False, default=0)   # supplier charge per unit

    operation_cost_type     = Column(String(10),    nullable=False, default="percentage")  # 'percentage' or 'fixed'
    operation_cost_value    = Column(Numeric(12, 4), nullable=False, default=0)   # raw number entered
    operation_cost_amount   = Column(Numeric(12, 2), nullable=False, default=0)   # resolved Rs. per unit

    subtotal_after_opcost   = Column(Numeric(12, 2), nullable=False, default=0)   # unit_cost + operation_cost_amount

    sscl_pct                = Column(Numeric(8,  6), nullable=False, default=Decimal("0.025"))
    sscl_amount             = Column(Numeric(12, 2), nullable=False, default=0)

    vat_pct                 = Column(Numeric(8,  6), nullable=False, default=Decimal("0.18"))
    vat_amount              = Column(Numeric(12, 2), nullable=False, default=0)

    final_unit_price        = Column(Numeric(12, 2), nullable=False, default=0)   # customer-facing price per unit
    warranty_months         = Column(Integer,       nullable=True)
    has_manufacturer_warranty = Column(Boolean,     nullable=False, default=False)
    manufacturer_warranty_months = Column(Integer, nullable=True)

    created_at              = Column(DateTime,       server_default=func.now())

    receipt    = relationship("StockReceipt", back_populates="items")
    stock_item = relationship("StockItem")


class StockUnit(Base):
    """
    One row per physical, individually-trackable unit.
    Only created when the parent StockItem has requires_serial=True.

    status values: 'in_stock' | 'sold' | 'returned' | 'returned_pending_check' | 'with_manufacturer' | 'with_internal_team_warranty' | 'with_internal_team_paid' | 'with_third_party_warranty' | 'with_third_party_paid' | 'repaired_awaiting_pickup' | 'warranty_replaced' | 'returned_unrepaired' | 'defective' | 'scrapped'
    """
    __tablename__ = "stock_units"

    id                  = Column(BigInteger,    primary_key=True)
    receipt_item_id     = Column(BigInteger,    ForeignKey("stock_receipt_items.id"), nullable=False)
    stock_item_id       = Column(Integer,       ForeignKey("stock_items.id"),         nullable=False, index=True)
    serial_number              = Column(String(200),   nullable=False, unique=True, index=True)
    status                     = Column(String(30),    nullable=False, default="in_stock")
    sold_invoice_item_id       = Column(BigInteger,   ForeignKey("invoice_items.id"),       nullable=True)
    warranty_months            = Column(Integer,       nullable=True)
    has_manufacturer_warranty  = Column(Boolean,       nullable=False, default=False)
    manufacturer_warranty_months = Column(Integer,     nullable=True)
    created_at                 = Column(DateTime,      server_default=func.now())
    updated_at                 = Column(DateTime,      server_default=func.now(), onupdate=func.now())
    replacement_for_unit_id    = Column(BigInteger,    ForeignKey("stock_units.id"), nullable=True)

    receipt_item = relationship("StockReceiptItem")
    stock_item   = relationship("StockItem")
    status_history = relationship("StockUnitStatusHistory", back_populates="stock_unit", cascade="all, delete-orphan")

    def record_status_change(self, db: Session, new_status: str, note: str | None = None, changed_by_rep_id: int | None = None):
        """Log a status transition and update this unit's current status."""
        old_status = self.status
        if new_status == old_status:
            return None
        self.status = new_status
        history = StockUnitStatusHistory(
            stock_unit_id=self.id,
            old_status=old_status,
            new_status=new_status,
            note=note,
            changed_by_rep_id=changed_by_rep_id,
        )
        db.add(history)
        return history


class StockUnitStatusHistory(Base):
    __tablename__ = "stock_unit_status_history"

    id                 = Column(BigInteger, primary_key=True)
    stock_unit_id      = Column(BigInteger, ForeignKey("stock_units.id"), nullable=False)
    old_status         = Column(String(30), nullable=False)
    new_status         = Column(String(30), nullable=False)
    changed_at         = Column(DateTime, server_default=func.now())
    note               = Column(Text, nullable=True)
    changed_by_rep_id  = Column(Integer, ForeignKey("reps.id"), nullable=True)

    stock_unit         = relationship("StockUnit", back_populates="status_history")
    changed_by_rep     = relationship("Rep")


class Technician(Base):
    __tablename__ = "technicians"

    id              = Column(Integer, primary_key=True)
    name            = Column(String(200), nullable=False)
    contact_phone   = Column(String(30), nullable=False)
    contact_email   = Column(String(100), nullable=True)
    specialty       = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())


class RepairJob(Base):
    __tablename__ = "repair_jobs"

    id                           = Column(BigInteger, primary_key=True)
    stock_unit_id                = Column(BigInteger, ForeignKey("stock_units.id"), nullable=False)
    technician_id                = Column(Integer, ForeignKey("technicians.id"), nullable=False)
    date_sent                    = Column(Date, nullable=False)
    date_returned                = Column(Date, nullable=True)
    amount_charged_by_technician = Column(Numeric(12, 2), nullable=True)
    outcome                      = Column(String(50), nullable=False, default="pending")
    linked_job_card_id           = Column(Integer, ForeignKey("job_cards.id"), nullable=True)
    created_at                   = Column(DateTime, server_default=func.now())

    stock_unit   = relationship("StockUnit")
    technician   = relationship("Technician")
    linked_job_card = relationship("JobCard", back_populates="repair_jobs")


class ManufacturerWarrantyClaim(Base):
    __tablename__ = "manufacturer_warranty_claims"

    id                   = Column(BigInteger, primary_key=True)
    stock_unit_id        = Column(BigInteger, ForeignKey("stock_units.id"), nullable=False)
    supplier_id          = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    linked_job_card_id   = Column(Integer, ForeignKey("job_cards.id"), nullable=True, index=True)
    date_sent            = Column(Date, nullable=False)
    expected_return_date = Column(Date, nullable=True)
    date_returned        = Column(Date, nullable=True)
    outcome              = Column(String(30), nullable=False, default="pending")
    # outcome values: 'pending' | 'repaired' | 'replaced_by_manufacturer' | 'rejected'
    tracking_reference   = Column(String(100), nullable=True)
    notes                = Column(Text, nullable=True)
    created_at           = Column(DateTime, server_default=func.now())
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())

    stock_unit      = relationship("StockUnit")
    supplier        = relationship("Supplier")
    linked_job_card = relationship("JobCard")
    histories = relationship("ManufacturerWarrantyClaimHistory", back_populates="claim", order_by="desc(ManufacturerWarrantyClaimHistory.id)")

    @property
    def changed_by_rep_name(self):
        if not self.histories:
            return None
        latest = self.histories[0]
        if latest.changed_by_rep:
            return latest.changed_by_rep.name
        if latest.changed_by_user and latest.changed_by_user.rep:
            return latest.changed_by_user.rep.name
        if latest.changed_by_user:
            return latest.changed_by_user.username
        return None


class Route(Base):
    __tablename__ = "routes"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False, unique=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # One route → many customers
    customers = relationship("Customer", back_populates="route")


class ManufacturerWarrantyClaimHistory(Base):
    __tablename__ = "manufacturer_warranty_claim_histories"

    id = Column(BigInteger, primary_key=True)
    claim_id = Column(BigInteger, ForeignKey("manufacturer_warranty_claims.id"), nullable=False)
    old_outcome = Column(String(30), nullable=True)
    new_outcome = Column(String(30), nullable=True)
    note = Column(Text, nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_by_rep_id = Column(Integer, ForeignKey("reps.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    claim = relationship("ManufacturerWarrantyClaim", back_populates="histories")
    changed_by_user = relationship("User")
    changed_by_rep = relationship("Rep")


class Rep(Base):
    __tablename__ = "reps"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False)
    code       = Column(String(20),  nullable=False, unique=True)
    phone      = Column(String(30))
    role       = Column(String(100))
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    invoices     = relationship("Invoice",     back_populates="rep")
    appointments = relationship("Appointment", back_populates="rep")
    job_cards    = relationship("JobCard", back_populates="received_by_staff", foreign_keys="[JobCard.received_by_staff_id]")


class JobCard(Base):
    __tablename__ = "job_cards"

    id                      = Column(Integer, primary_key=True)
    customer_name           = Column(String(200), nullable=False)
    customer_phone          = Column(String(30), nullable=True)
    device_name             = Column(String(200), nullable=False)
    issue_description       = Column(Text, nullable=False)
    received_by_staff_id    = Column(Integer, ForeignKey("reps.id"), nullable=False)
    assigned_to_staff_id    = Column(Integer, ForeignKey("reps.id"), nullable=True)
    priority                = Column(String(20), nullable=False, default="MEDIUM")
    due_date                = Column(Date, nullable=True)
    serial_number           = Column(String(100), nullable=True)
    stock_unit_id           = Column(BigInteger, ForeignKey("stock_units.id"), nullable=True)
    job_type                = Column(String(20), nullable=True)
    device_source           = Column(String(20), nullable=True)
    paper_grn_reference     = Column(String(100), nullable=True)
    intake_method           = Column(String(20), nullable=False, default="WALK_IN")
    status                  = Column(String(20), nullable=False, default="NEW")
    notes                   = Column(Text, nullable=True)
    linked_sales_invoice_id = Column(BigInteger, ForeignKey("invoices.id"), nullable=True)
    created_at              = Column(DateTime, server_default=func.now())
    updated_at              = Column(DateTime, server_default=func.now(), onupdate=func.now())

    received_by_staff = relationship("Rep", foreign_keys=[received_by_staff_id], back_populates="job_cards")
    assigned_to_staff = relationship("Rep", foreign_keys=[assigned_to_staff_id])
    linked_sales_invoice = relationship("Invoice")
    stock_unit = relationship("StockUnit")
    repair_jobs = relationship("RepairJob", back_populates="linked_job_card", order_by="desc(RepairJob.id)")

    @property
    def received_by_staff_name(self):
        return self.received_by_staff.name if self.received_by_staff else None

    @property
    def assigned_to_staff_name(self):
        return self.assigned_to_staff.name if self.assigned_to_staff else None

    @property
    def linked_sales_invoice_number(self):
        return self.linked_sales_invoice.invoice_number if self.linked_sales_invoice else None

    @property
    def latest_repair_job(self):
        return self.repair_jobs[0] if self.repair_jobs else None

    @property
    def latest_repair_job_amount_charged_by_technician(self):
        return self.latest_repair_job.amount_charged_by_technician if self.latest_repair_job else None

    @property
    def latest_repair_job_outcome(self):
        return self.latest_repair_job.outcome if self.latest_repair_job else None


class Customer(Base):
    __tablename__ = "customers"

    id                = Column(Integer, primary_key=True)
    name              = Column(String(200), nullable=False)
    tin               = Column(String(20))
    is_vat_registered = Column(Boolean, default=False)
    is_active         = Column(Boolean, default=True)   # False = soft-deleted
    route_id          = Column(Integer, ForeignKey("routes.id"))
    phone             = Column(String(30))
    address           = Column(Text)
    notes             = Column(Text)
    created_at        = Column(DateTime, server_default=func.now())

    route    = relationship("Route",   back_populates="customers")
    invoices = relationship("Invoice", back_populates="customer")


class Appointment(Base):
    __tablename__ = "appointments"

    id               = Column(Integer, primary_key=True)
    apo_number       = Column(String(50), nullable=False, unique=True)
    rep_id           = Column(Integer, ForeignKey("reps.id"), nullable=False)
    appointment_date = Column(Date, nullable=False)
    delivery_method  = Column(String(30))
    notes            = Column(Text)
    created_at       = Column(DateTime, server_default=func.now())

    rep      = relationship("Rep",     back_populates="appointments")
    invoices = relationship("Invoice", back_populates="appointment")


class Invoice(Base):
    __tablename__ = "invoices"

    id               = Column(BigInteger, primary_key=True)
    invoice_number   = Column(String(50), nullable=False, unique=True)
    invoice_category = Column(String(10), nullable=False)   # 'ALL_INC' or 'VAT'
    service_type     = Column(String(20),  nullable=False)   # 'SALE' or 'REPAIR'
    invoice_date     = Column(Date, nullable=False)
    customer_id      = Column(Integer, ForeignKey("customers.id"), nullable=False)
    rep_id           = Column(Integer, ForeignKey("reps.id"))     # nullable — some had no rep
    appointment_id   = Column(Integer, ForeignKey("appointments.id"))
    route_id         = Column(Integer, ForeignKey("routes.id"))

    # ── Financial breakdown ─────────────────────────────────────────────────
    # 'amount' kept for backward compatibility = base_subtotal (raw line items total)
    amount                = Column(Numeric(12, 2), nullable=False, default=0)

    # Full audit trail of every calculation component:
    base_subtotal         = Column(Numeric(12, 2), nullable=False, default=0)

    # Profit margin — rate snapshot + derived amount (never shown to customer)
    profit_margin_pct     = Column(Numeric(8, 6),  nullable=False, default=0)
    profit_margin_amount  = Column(Numeric(12, 2), nullable=False, default=0)

    # SSCL (Social Security Contribution Levy) — rate snapshot + derived amount
    sscl_pct              = Column(Numeric(8, 6),  nullable=False, default=0)
    sscl_amount           = Column(Numeric(12, 2), nullable=False, default=0)

    # VAT — rate snapshot + derived amount
    vat_pct               = Column(Numeric(8, 6),  nullable=False, default=0)
    vat_amount            = Column(Numeric(12, 2), nullable=False, default=0)

    # Final customer-facing total
    grand_total           = Column(Numeric(12, 2), nullable=False, default=0)

    credit_balance   = Column(Numeric(12, 2), nullable=False, default=0)
    remarks          = Column(Text)
    is_vat_posted    = Column(Boolean, default=False)
    contact_name     = Column(String(100))
    customer_tin     = Column(String(50))
    customer_phone   = Column(String(30))
    due_date         = Column(Date)
    po_number        = Column(String(50))
    warranty         = Column(String(100))
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now())

    # Relationships — navigate to related records in Python
    customer    = relationship("Customer",    back_populates="invoices")
    rep         = relationship("Rep",         back_populates="invoices")
    appointment = relationship("Appointment", back_populates="invoices")
    payments    = relationship("Payment",     back_populates="invoice",
                               cascade="all, delete-orphan")
    items       = relationship("InvoiceItem", back_populates="invoice",
                                cascade="all, delete-orphan",
                                order_by="InvoiceItem.line_number")
    route       = relationship("Route")


class Payment(Base):
    __tablename__ = "payments"

    id              = Column(BigInteger, primary_key=True)
    invoice_id      = Column(BigInteger, ForeignKey("invoices.id"), nullable=False)
    payment_method  = Column(String(30), nullable=False)
    amount          = Column(Numeric(12, 2), nullable=False)
    cheque_number   = Column(String(50))
    bank            = Column(String(100))
    date_of_payment = Column(Date)
    recorded_by_rep_id = Column(Integer, ForeignKey("reps.id"))
    reference_notes = Column(Text)
    created_at      = Column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
    recorded_by_rep = relationship("Rep")

    @property
    def recorded_by_rep_name(self):
        return self.recorded_by_rep.name if self.recorded_by_rep else None

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id            = Column(BigInteger, primary_key=True)
    invoice_id    = Column(BigInteger, ForeignKey("invoices.id"),   nullable=False)
    line_number   = Column(Integer,    nullable=False, default=1)
    description   = Column(String(300), nullable=False)
    serial_no     = Column(String(200))
    qty           = Column(Integer,    nullable=False, default=1)
    raw_rate      = Column(Numeric(12, 2), nullable=False, default=0)  # staff-entered cost (internal)
    warranty_months = Column(Integer, nullable=True)
    rate          = Column(Numeric(12, 2), nullable=False, default=0)  # customer-facing unit price
    amount        = Column(Numeric(12, 2), nullable=False, default=0)  # customer-facing line total
    # Links this sold line back to the catalog item so stock can be decremented.
    # Nullable so all existing rows remain valid with no data migration needed.
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    invoice    = relationship("Invoice", back_populates="items")
    stock_item = relationship("StockItem")
