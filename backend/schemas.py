"""
schemas.py — Pydantic Schemas (Request & Response shapes)
==========================================================
Models.py describes what's IN the database.
Schemas.py describes what JSON goes IN and OUT of the API.

They are different on purpose:
  - The DB stores customer_id (a number).
  - The API response includes customer_name (a string) — more useful.
  - The API never exposes internal fields like created_at to the frontend
    unless needed.

Analogy: models.py is the raw ingredients in the kitchen.
schemas.py is the plated dish the customer sees.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from typing import Any, Optional, List
from datetime import date, datetime
from decimal import Decimal


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id:        int
    username:  str
    is_admin:  bool
    rep_id:    Optional[int] = None
    rep_name:  Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    user:         UserOut


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    rep_id:   Optional[int] = None
    is_admin: bool = False


class PasswordChange(BaseModel):
    current_password: str
    new_password:      str = Field(..., min_length=6)


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    """Response shape for GET /settings."""
    sscl_pct:      Decimal
    vat_pct:       Decimal
    profit_margin: Decimal
    updated_at:    Optional[datetime] = None
    rates:         List["RateSettingOut"] = []
    company_info:  Optional["CompanyInfoOut"] = None
    warranty:      Optional["WarrantyOut"] = None

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    """Request body for PATCH /settings — all fields optional (partial update)."""
    sscl_pct:      Optional[Decimal] = None
    vat_pct:       Optional[Decimal] = None
    profit_margin: Optional[Decimal] = None


class RateSettingBase(BaseModel):
    key:         str = Field(..., min_length=1, max_length=80)
    label:       str = Field(..., min_length=1, max_length=120)
    rate:        Decimal = Decimal("0")
    rate_type:   str = Field("tax", max_length=30)
    description: Optional[str] = None
    is_active:   bool = True


class RateSettingCreate(RateSettingBase):
    pass


class RateSettingUpdate(BaseModel):
    label:       Optional[str] = Field(None, min_length=1, max_length=120)
    rate:        Optional[Decimal] = None
    rate_type:   Optional[str] = Field(None, max_length=30)
    description: Optional[str] = None
    is_active:   Optional[bool] = None


class RateSettingOut(RateSettingBase):
    id:          int
    updated_at:  Optional[datetime] = None
    model_config = {"from_attributes": True}


class DashboardLayoutOut(BaseModel):
    dashboard_layout: List[dict[str, Any]] = []
    updated_at: Optional[datetime] = None


class DashboardLayoutUpdate(BaseModel):
    dashboard_layout: List[dict[str, Any]] = Field(default_factory=list)


class CompanyInfoBase(BaseModel):
    company_name:  str = Field(..., min_length=1, max_length=200)
    address:       Optional[str] = None
    tin:           Optional[str] = Field(None, max_length=50)
    phone_numbers: List[str] = []


class CompanyInfoOut(CompanyInfoBase):
    updated_at: Optional[datetime] = None


class CompanyInfoUpdate(CompanyInfoBase):
    pass


class WarrantyOut(BaseModel):
    default_warranty_text: str = ""
    updated_at: Optional[datetime] = None


class WarrantyUpdate(BaseModel):
    default_warranty_text: str = ""


class RouteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class RouteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


# ── Payments ─────────────────────────────────────────────────────────────────

class PaymentOut(BaseModel):
    id:              int
    invoice_id:      int
    payment_method:  str
    amount:          Decimal
    cheque_number:   Optional[str] = None
    bank:            Optional[str] = None
    date_of_payment: Optional[date] = None
    recorded_by_rep_id:   Optional[int] = None
    recorded_by_rep_name: Optional[str] = None
    created_at:           Optional[datetime] = None

    # from_attributes = True lets Pydantic read from a SQLAlchemy object
    # (which uses attribute access) instead of a plain dict.
    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    payment_method:  str
    amount:          Decimal = Field(gt=0, description="Must be greater than 0")
    cheque_number:   Optional[str] = None
    bank:            Optional[str] = None
    date_of_payment: Optional[date] = None
    recorded_by_rep_id: Optional[int] = None


# ── Invoices ──────────────────────────────────────────────────────────────────
# ── Invoice Items ─────────────────────────────────────────────

class InvoiceItemIn(BaseModel):
    description:   str
    serial_no:     Optional[str] = None
    qty:           int = 1
    rate:          Decimal = Decimal("0.00")   # raw cost per unit (staff-entered)
    stock_item_id: Optional[int] = None        # links this line to the stock catalog
    pricing_override: Optional[bool] = False


class InvoiceItemOut(BaseModel):
    id:            int
    invoice_id:    int
    line_number:   int
    description:   str
    serial_no:     Optional[str] = None
    qty:           int
    raw_rate:      Decimal       # internal raw cost per unit
    rate:          Decimal       # customer-facing unit price
    amount:        Decimal       # customer-facing line total
    stock_item_id: Optional[int] = None
    model_config = {"from_attributes": True}

class InvoiceCreate(BaseModel):
    invoice_number:   str
    invoice_category: str    # 'ALL_INC' or 'VAT'
    service_type:     str    # 'SALE' or 'REPAIR'
    invoice_date:     date
    customer_id:      int
    rep_id:           Optional[int] = None
    appointment_id:   Optional[int] = None
    credit_balance:   Decimal = Decimal("0.00")
    remarks:          Optional[str] = None
    contact_name:     Optional[str] = None
    customer_tin:     Optional[str] = None
    customer_phone:   Optional[str] = None
    due_date:         Optional[date] = None
    po_number:        Optional[str] = None
    warranty:         Optional[str] = Field(None, max_length=100)
    items:            List[InvoiceItemIn] = []
    route_id:         Optional[int] = None

    # ── Per-invoice rate overrides ──────────────────────────────────────────
    # If None, the backend reads the current global default from the Settings
    # table. Storing these per-invoice means historical invoices always reflect
    # the exact rates that were applied, even if globals change later.
    profit_margin_pct: Optional[Decimal] = None   # e.g. 0.20 for 20%
    sscl_pct:          Optional[Decimal] = None   # e.g. 0.025 for 2.5%
    vat_pct:           Optional[Decimal] = None   # e.g. 0.18 for 18%


class JobCardCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_phone: Optional[str] = Field(default=None, max_length=30)
    device_name: str = Field(..., min_length=1, max_length=200)
    issue_description: str = Field(..., min_length=1)
    received_by_staff_id: int = Field(..., gt=0)
    assigned_to_staff_id: Optional[int] = None
    priority: Optional[str] = Field(default="NORMAL", max_length=20)
    due_date: Optional[date] = None
    serial_number: Optional[str] = Field(default=None, max_length=100)
    stock_unit_id: Optional[int] = None
    job_type: Optional[str] = None
    device_source: Optional[str] = None
    paper_grn_reference: Optional[str] = None
    intake_method: str = Field(default="WALK_IN", max_length=20)
    linked_sales_invoice_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_intake_details(self):
        if self.intake_method == "FIELD_GRN":
            grn_ref = (self.paper_grn_reference or "").strip()
            if not grn_ref:
                raise ValueError("paper_grn_reference is required when intake_method is FIELD_GRN")
        return self


class JobCardResponse(BaseModel):
    id: int
    customer_name: str
    customer_phone: Optional[str] = None
    device_name: str
    issue_description: str
    received_by_staff_id: int
    received_by_staff_name: Optional[str] = None
    assigned_to_staff_id: Optional[int] = None
    assigned_to_staff_name: Optional[str] = None
    priority: Optional[str] = "NORMAL"
    due_date: Optional[date] = None
    serial_number: Optional[str] = None
    stock_unit_id: Optional[int] = None
    job_type: Optional[str] = None
    device_source: Optional[str] = None
    paper_grn_reference: Optional[str] = None
    intake_method: str
    status: str = "NEW"
    notes: Optional[str] = None
    linked_sales_invoice_id: Optional[int] = None
    linked_sales_invoice_number: Optional[str] = None
    latest_repair_job_amount_charged_by_technician: Optional[Decimal] = None
    latest_repair_job_outcome: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobCardUpdate(BaseModel):
    customer_phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_staff_id: Optional[int] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    serial_number: Optional[str] = None
    stock_unit_id: Optional[int] = None
    job_type: Optional[str] = None
    device_source: Optional[str] = None
    linked_sales_invoice_id: Optional[int] = None


class JobActionIn(BaseModel):
    action: str = Field(..., min_length=1)
    technician_id: Optional[int] = None
    date_sent: Optional[date] = None
    amount_charged_by_technician: Optional[Decimal] = None
    outcome: Optional[str] = None


class InvoiceListItem(BaseModel):
    """Lightweight schema for list views — no payments detail."""
    id:               int
    invoice_number:   str
    invoice_category: str
    service_type:     str
    invoice_date:     date

    # ── Financial breakdown (all stored at creation time) ──────────────────
    amount:               Decimal   # = base_subtotal (raw line items total)
    base_subtotal:        Decimal
    profit_margin_pct:    Decimal
    profit_margin_amount: Decimal
    sscl_pct:             Decimal
    sscl_amount:          Decimal
    vat_pct:              Decimal
    vat_amount:           Decimal
    grand_total:          Decimal
    credit_balance:       Decimal

    is_vat_posted:    bool
    warranty:         Optional[str] = None
    customer_name:    Optional[str] = None   # joined from customers table
    customer_tin:     Optional[str] = None
    customer_phone:   Optional[str] = None
    rep_name:         Optional[str] = None   # joined via reps table
    route_name:       Optional[str] = None   # joined via customer → route

    model_config = {"from_attributes": True}


class InvoiceDetail(InvoiceListItem):
    """Full detail schema — includes payments, items, and remarks."""
    model_config = {"from_attributes": True}

    customer_id:   Optional[int]  = None
    rep_id:        Optional[int]  = None
    appointment_id:Optional[int]  = None
    contact_name:  Optional[str]  = None
    customer_tin:  Optional[str]  = None
    customer_phone:Optional[str]  = None
    due_date:      Optional[date] = None
    po_number:     Optional[str]  = None
    remarks:       Optional[str]  = None
    created_at:    Optional[datetime] = None
    items:         List[InvoiceItemOut] = []
    payments:      List[PaymentOut] = []
    model_config = {"from_attributes": True}


# ── Customers ─────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name:              str
    tin:               Optional[str] = None
    is_vat_registered: bool = False
    route_id:          Optional[int] = None
    phone:             Optional[str] = None
    address:           Optional[str] = None
    notes:             Optional[str] = None


class CustomerOut(BaseModel):
    id:                int
    name:              str
    tin:               Optional[str] = None
    is_vat_registered: bool
    is_active:         bool = True
    route_id:          Optional[int] = None
    route_name:        Optional[str] = None   # joined from routes table
    phone:             Optional[str] = None
    address:           Optional[str] = None

    model_config = {"from_attributes": True}


class CustomerUpdate(BaseModel):
    """All fields optional — for PATCH (partial update) requests."""
    name:              Optional[str]  = None
    tin:               Optional[str]  = None
    is_vat_registered: Optional[bool] = None
    route_id:          Optional[int]  = None
    phone:             Optional[str]  = None
    address:           Optional[str]  = None
    notes:             Optional[str]  = None


class CustomerSummary(CustomerOut):
    """Customer with aggregated invoice stats."""
    total_invoices:    int = 0
    total_sales:       Decimal = Decimal("0.00")
    outstanding_credit: Decimal = Decimal("0.00")


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_sales_amount:    Decimal
    sales_revenue:         Decimal
    repair_revenue:        Decimal
    total_vat_collected:   Decimal
    total_outstanding:     Decimal   # sum of all credit_balance > 0
    sales_invoice_count:   int
    repair_invoice_count:  int
    invoice_count:         int
    customer_count:        int
    sales_this_month:      Decimal
    repairs_this_month:    Decimal


class RevenueTrendPoint(BaseModel):
    year:        int
    month:       int
    month_label: str
    sales:       float
    repairs:     float
    outstanding: float


class TopCustomer(BaseModel):
    customer_id:    int
    customer_name:  str
    service_count:  int
    total_revenue:  Decimal

    # Recent paid invoices for this customer (useful for drill-down)
    paid_invoices:  List["TopCustomerInvoiceOut"] = []


class OutstandingDebtor(BaseModel):
    customer_id:         int
    customer_name:       str
    route_name:          Optional[str] = None
    phone:               Optional[str] = None
    unpaid_invoice_count: int
    total_outstanding:   Decimal


class RoutePerformanceOut(BaseModel):
    route_name:      str
    total_revenue:   Decimal
    total_outstanding: Decimal


class YoYComparison(BaseModel):
    current_period_revenue: Decimal
    prior_period_revenue:   Decimal
    change_pct:             Decimal
    trend:                  str


class AgingBucket(BaseModel):
    bucket:     str
    total_amount: Decimal
    percentage: Decimal


class RepPerformance(BaseModel):
    rep_name:     str
    invoice_count: int
    total_sales:   Decimal
    total_repairs: Decimal


class LeaderboardRep(BaseModel):
    rank:              int
    rep_id:            int
    rep_name:          str
    employee_number:   Optional[str] = None
    invoice_count:     int
    sale_count:        int
    repair_count:      int
    total_collected:   Decimal


class CreditAging(BaseModel):
    customer_name:   str
    invoice_number:  str
    invoice_date:    date
    amount:          Decimal
    credit_balance:  Decimal
    days_overdue:    int


# ── Lookup tables (for dropdowns in the frontend) ─────────────────────────────

class RouteOut(BaseModel):
    id:        int
    name:      str
    is_active: bool = True
    model_config = {"from_attributes": True}


class RepOut(BaseModel):
    id:   int
    name: str
    code: str
    model_config = {"from_attributes": True}


class RepCreate(BaseModel):
    name:  str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=30)
    role:  Optional[str] = Field(None, max_length=100)


class RepUpdate(BaseModel):
    name:  Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    role:  Optional[str] = Field(None, max_length=100)


class RepDetailOut(BaseModel):
    id:        int
    name:      str
    code:      str
    phone:     Optional[str] = None
    role:      Optional[str] = None
    is_active: bool = True
    model_config = {"from_attributes": True}


class RepPortfolioOut(BaseModel):
    rep: RepDetailOut
    total_invoices:          int
    total_sales_generated:   Decimal
    total_outstanding:       Decimal
    collected_amount:        Decimal
    collection_progress_pct: Decimal


class RepPortfolioInvoiceOut(BaseModel):
    id:             int
    invoice_number: str
    invoice_date:   date
    customer_name:  Optional[str] = None
    grand_total:    Decimal
    credit_balance: Decimal
    payment_status: str


class RepPortfolioInvoicePage(BaseModel):
    items:  List[RepPortfolioInvoiceOut]
    total:  int
    limit:  int
    offset: int


class RepairJobHistoryOut(BaseModel):
    id:                     int
    stock_unit_id:          Optional[int] = None
    stock_unit_serial_number: Optional[str] = None
    date_sent:              date
    date_returned:          Optional[date] = None
    amount_charged_by_technician: Optional[Decimal] = None
    outcome:                str
    linked_job_card_id:     Optional[int] = None
    created_at:             Optional[datetime] = None

    model_config = {"from_attributes": True}


class TechnicianCreate(BaseModel):
    name:          str = Field(..., min_length=1, max_length=200)
    contact_phone: str = Field(..., min_length=1, max_length=30)
    contact_email: Optional[str] = Field(None, max_length=100)
    specialty:     Optional[str] = Field(None, max_length=200)
    is_active:     Optional[bool] = True


class TechnicianUpdate(BaseModel):
    name:          Optional[str] = Field(None, min_length=1, max_length=200)
    contact_phone: Optional[str] = Field(None, max_length=30)
    contact_email: Optional[str] = Field(None, max_length=100)
    specialty:     Optional[str] = Field(None, max_length=200)
    is_active:     Optional[bool] = None


class TechnicianOut(BaseModel):
    id:            int
    name:          str
    contact_phone: str
    contact_email: Optional[str] = None
    specialty:     Optional[str] = None
    is_active:     bool = True
    created_at:    Optional[datetime] = None

    model_config = {"from_attributes": True}


class TopCustomerInvoiceOut(BaseModel):
    id:             int
    invoice_number: str
    invoice_date:   date
    service_type:   str
    grand_total:    Decimal
    credit_balance: Decimal

    model_config = {"from_attributes": True}


# ── Stock Management ──────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name:           str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone:          Optional[str] = Field(None, max_length=30)
    email:          Optional[str] = Field(None, max_length=100)
    address:        Optional[str] = None
    notes:          Optional[str] = None


class SupplierUpdate(BaseModel):
    """All fields optional — for PATCH (partial update) requests."""
    name:           Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone:          Optional[str] = Field(None, max_length=30)
    email:          Optional[str] = Field(None, max_length=100)
    address:        Optional[str] = None
    notes:          Optional[str] = None
    is_active:      Optional[bool] = None


class SupplierOut(BaseModel):
    id:             int
    name:           str
    contact_person: Optional[str] = None
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    notes:          Optional[str] = None
    is_active:      bool
    created_at:     Optional[datetime] = None
    model_config = {"from_attributes": True}


# StockCategory mirrors RouteCreate/RouteOut exactly — same minimal shape.

class StockCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class StockCategoryOut(BaseModel):
    id:        int
    name:      str
    is_active: bool = True
    model_config = {"from_attributes": True}


class StockItemCreate(BaseModel):
    category_id:     int
    brand:           Optional[str] = Field(None, max_length=150)
    model:           str = Field(..., min_length=1, max_length=150)
    description:     Optional[str] = Field(None, max_length=300)
    requires_serial: bool = False
    reorder_level:   Optional[int] = None


class StockItemUpdate(BaseModel):
    """All fields optional — for PATCH (partial update) requests."""
    category_id:     Optional[int] = None
    brand:           Optional[str] = Field(None, max_length=150)
    model:           Optional[str] = Field(None, min_length=1, max_length=150)
    description:     Optional[str] = Field(None, max_length=300)
    requires_serial: Optional[bool] = None
    qty_on_hand:     Optional[int] = None
    reorder_level:   Optional[int] = None
    is_active:       Optional[bool] = None


# StockReceiptItem — input carries only the user-entered fields;
# all computed amounts (operation_cost_amount, subtotal_after_opcost, sscl_amount,
# vat_amount, final_unit_price) are derived server-side at save time.

class StockReceiptItemIn(BaseModel):
    stock_item_id:        int
    qty:                  int = Field(1, ge=1)
    unit_cost:            Decimal = Decimal("0.00")       # supplier charge per unit
    operation_cost_type:  str = "percentage"              # 'percentage' or 'fixed'
    operation_cost_value: Decimal = Decimal("0.0000")     # raw number entered


class StockReceiptItemOut(BaseModel):
    id:                     int
    receipt_id:             int
    stock_item_id:          int
    qty:                    int

    # Cost chain — all snapshotted at save time
    unit_cost:              Decimal
    operation_cost_type:    str
    operation_cost_value:   Decimal
    operation_cost_amount:  Decimal
    subtotal_after_opcost:  Decimal
    sscl_pct:               Decimal
    sscl_amount:            Decimal
    vat_pct:                Decimal
    vat_amount:             Decimal
    final_unit_price:       Decimal

    created_at:             Optional[datetime] = None
    model_config = {"from_attributes": True}


class StockItemOut(BaseModel):
    id:              int
    category_id:     int
    category_name:   Optional[str] = None   # joined from stock_categories — same pattern as CustomerOut.route_name
    brand:           Optional[str] = None
    model:           str
    description:     Optional[str] = None
    requires_serial: bool
    qty_on_hand:     int
    reorder_level:   Optional[int] = None
    is_active:       bool
    created_at:      Optional[datetime] = None
    latest_price:    Optional[StockReceiptItemOut] = None
    model_config = {"from_attributes": True}



class StockReceiptCreate(BaseModel):
    supplier_id:        int
    received_date:      date
    reference_no:       Optional[str] = Field(None, max_length=80)
    received_by_rep_id: Optional[int] = None
    notes:              Optional[str] = None
    items:              List[StockReceiptItemIn] = []


class StockReceiptDetail(BaseModel):
    """Full GRN output — header fields plus all line items."""
    id:                 int
    supplier_id:        int
    supplier_name:      Optional[str] = None   # joined from suppliers
    received_date:      date
    reference_no:       Optional[str] = None
    received_by_rep_id: Optional[int] = None
    received_by_rep_name: Optional[str] = None  # joined from reps
    notes:              Optional[str] = None
    created_at:         Optional[datetime] = None
    items:              List[StockReceiptItemOut] = []
    model_config = {"from_attributes": True}


class StockUnitOut(BaseModel):
    """Full unit record — used in stock management detail views."""
    id:                        int
    receipt_item_id:           int
    stock_item_id:             int
    brand:                     Optional[str] = None   # joined from stock_items
    model:                     Optional[str] = None   # joined from stock_items
    description:               Optional[str] = None   # joined from stock_items
    serial_number:             str
    status:                    str
    sold_invoice_item_id:      Optional[int] = None
    warranty_months:           Optional[int] = None
    has_manufacturer_warranty: bool
    manufacturer_warranty_months: Optional[int] = None
    created_at:                Optional[datetime] = None
    updated_at:                Optional[datetime] = None
    model_config = {"from_attributes": True}


class StockUnitLookupOut(BaseModel):
    """Lightweight schema for barcode-scan lookup — enough for the frontend
    to auto-fill an invoice line without loading the full unit record."""
    id:             int
    serial_number:  str
    stock_item_id:  int
    brand:          Optional[str] = None
    model:          Optional[str] = None
    description:    Optional[str] = None
    final_unit_price: Decimal
    status:         str
    latest_price:   Optional[StockReceiptItemOut] = None
    sold_invoice_item_id: Optional[int] = None
    sold_invoice_id: Optional[int] = None
    sold_invoice_number: Optional[str] = None
    sold_invoice_date: Optional[date] = None
    warranty_months: Optional[int] = None
    has_manufacturer_warranty: bool
    manufacturer_warranty_months: Optional[int] = None
    model_config = {"from_attributes": True}


class SerialHistoryOriginOut(BaseModel):
    source: str
    receipt_date: Optional[date] = None
    grn_reference: Optional[str] = None
    supplier_name: Optional[str] = None
    job_card_created_at: Optional[datetime] = None
    no_stock_history: bool = False


class SerialHistorySaleInfoOut(BaseModel):
    sold: bool = False
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    sale_date: Optional[date] = None


class SerialHistoryWarrantyOut(BaseModel):
    warranty_months: Optional[int] = None
    has_manufacturer_warranty: bool = False
    manufacturer_warranty_months: Optional[int] = None
    sale_date: Optional[date] = None
    expiry_date: Optional[date] = None
    within_warranty: Optional[bool] = None
    note: Optional[str] = None


class SerialHistoryEventOut(BaseModel):
    id: int
    type: str
    date: datetime
    title: str
    subtitle: Optional[str] = None
    detail: Optional[str] = None
    note: Optional[str] = None
    changed_by: Optional[str] = None
    technician_name: Optional[str] = None
    amount_charged_by_technician: Optional[Decimal] = None
    outcome: Optional[str] = None
    job_card_id: Optional[int] = None
    stock_unit_id: Optional[int] = None


class SerialHistoryOut(BaseModel):
    serial_number: str
    brand: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    device_name: Optional[str] = None
    origin: SerialHistoryOriginOut
    sale_info: SerialHistorySaleInfoOut
    warranty: SerialHistoryWarrantyOut
    current_status: Optional[str] = None
    current_status_label: str
    timeline: List[SerialHistoryEventOut] = []
    model_config = {"from_attributes": True}
