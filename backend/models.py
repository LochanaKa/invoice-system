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
    Date, DateTime, Numeric, Text, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
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


class Route(Base):
    __tablename__ = "routes"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False, unique=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # One route → many customers
    customers = relationship("Customer", back_populates="route")


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

    id          = Column(BigInteger, primary_key=True)
    invoice_id  = Column(BigInteger, ForeignKey("invoices.id"), nullable=False)
    line_number = Column(Integer, nullable=False, default=1)
    description = Column(String(300), nullable=False)
    serial_no   = Column(String(200))
    qty         = Column(Integer, nullable=False, default=1)
    raw_rate    = Column(Numeric(12, 2), nullable=False, default=0)  # staff-entered cost (internal)
    rate        = Column(Numeric(12, 2), nullable=False, default=0)   # customer-facing unit price
    amount      = Column(Numeric(12, 2), nullable=False, default=0)   # customer-facing line total
    created_at  = Column(DateTime, server_default=func.now())

    invoice = relationship("Invoice", back_populates="items")
