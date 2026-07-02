"""
routers/invoices.py — Invoice API endpoints
=============================================
This file handles all HTTP requests about invoices:

  GET  /invoices          → list invoices (with filters)
  GET  /invoices/{id}     → one invoice with full detail + payments
  POST /invoices          → create a new invoice
  POST /invoices/{id}/pay → add a payment to an invoice

Calculation chain (applied server-side on every create):

  Staff enter raw cost per line item. Margin (and taxes for ALL_INC) are rolled
  into the customer-facing line rate/amount before save.

  ALL_INC (per line):
    display_amount = raw + margin + SSCL + VAT  (each applied in sequence)
    grand_total    = Σ display_amount

  VAT (per line + invoice-level taxes):
    display_amount = raw + margin
    subtotal       = Σ display_amount
    sscl_amount    = subtotal × sscl_pct
    vat_amount     = (subtotal + sscl_amount) × vat_pct
    grand_total    = subtotal + sscl_amount + vat_amount

  Internal audit fields (base_subtotal, profit_margin_amount, etc.) are always
  stored on the invoice row regardless of category.
"""
from models import Invoice, Customer, Rep, Route, Payment, InvoiceItem, Settings
from decimal import Decimal, ROUND_HALF_UP
import re
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError, DataError
from typing import Optional, List
from datetime import date

from database import get_db
from schemas import (
    InvoiceCreate, InvoiceDetail, InvoiceListItem,
    PaymentCreate, PaymentOut, InvoiceItemOut
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])

TWO_PLACES = Decimal("0.01")
SIX_PLACES = Decimal("0.000001")


# ── Calculation helpers ───────────────────────────────────────────────────────

def _get_settings_defaults(db: Session) -> tuple[Decimal, Decimal, Decimal]:
    """
    Return (sscl_pct, vat_pct, profit_margin) from the Settings table.
    Falls back to hardcoded defaults if the row doesn't exist yet.
    """
    row = db.query(Settings).filter(Settings.id == 1).first()
    if row:
        return Decimal(str(row.sscl_pct)), Decimal(str(row.vat_pct)), Decimal(str(row.profit_margin))
    # Safe fallback — should not normally happen after migration
    return Decimal("0.025"), Decimal("0.18"), Decimal("0.20")


def calculate_line_item(
    raw_amount:        Decimal,
    invoice_category:  str,
    profit_margin_pct: Decimal,
    sscl_pct:          Decimal,
    vat_pct:           Decimal,
) -> dict:
    """
    Compute customer-facing display amount and per-line internal breakdown.

    ALL_INC: margin, SSCL, and VAT are baked into display_amount.
    VAT:     only margin is baked in; taxes are applied at invoice level.
    """
    profit_margin_amount = (raw_amount * profit_margin_pct).quantize(TWO_PLACES, ROUND_HALF_UP)
    after_margin         = raw_amount + profit_margin_amount

    if invoice_category == "ALL_INC":
        sscl_amount    = (after_margin * sscl_pct).quantize(TWO_PLACES, ROUND_HALF_UP)
        after_sscl     = after_margin + sscl_amount
        vat_amount     = (after_sscl * vat_pct).quantize(TWO_PLACES, ROUND_HALF_UP)
        display_amount = after_sscl + vat_amount
    else:
        sscl_amount    = Decimal("0.00")
        vat_amount     = Decimal("0.00")
        display_amount = after_margin

    return {
        "raw_amount":           raw_amount,
        "profit_margin_amount": profit_margin_amount,
        "sscl_amount":          sscl_amount,
        "vat_amount":           vat_amount,
        "display_amount":       display_amount.quantize(TWO_PLACES, ROUND_HALF_UP),
    }


def calculate_invoice_totals(
    line_results:      list[dict],
    invoice_category:  str,
    profit_margin_pct: Decimal,
    sscl_pct:          Decimal,
    vat_pct:           Decimal,
) -> dict:
    """
    Aggregate line-item results into invoice-level totals.

    For ALL_INC, taxes are summed per line (already in display_amount).
    For VAT, SSCL and VAT are computed on the margin-inclusive subtotal.
    """
    base_subtotal        = sum(r["raw_amount"]           for r in line_results)
    profit_margin_amount = sum(r["profit_margin_amount"] for r in line_results)

    if invoice_category == "ALL_INC":
        sscl_amount  = sum(r["sscl_amount"]  for r in line_results)
        vat_amount   = sum(r["vat_amount"]   for r in line_results)
        grand_total  = sum(r["display_amount"] for r in line_results)
    else:
        display_subtotal = sum(r["display_amount"] for r in line_results)
        sscl_amount      = (display_subtotal * sscl_pct).quantize(TWO_PLACES, ROUND_HALF_UP)
        after_sscl       = display_subtotal + sscl_amount
        vat_amount       = (after_sscl * vat_pct).quantize(TWO_PLACES, ROUND_HALF_UP)
        grand_total      = after_sscl + vat_amount

    return {
        "base_subtotal":        base_subtotal,
        "profit_margin_amount": profit_margin_amount,
        "sscl_amount":          sscl_amount,
        "vat_amount":           vat_amount,
        "grand_total":          grand_total,
    }


# ── Helper: build InvoiceListItem from ORM object ────────────────────────────

def _build_list_item(inv: Invoice) -> InvoiceListItem:
    return InvoiceListItem(
        id                   = inv.id,
        invoice_number       = inv.invoice_number,
        invoice_category     = inv.invoice_category,
        service_type         = inv.service_type,
        invoice_date         = inv.invoice_date,
        amount               = inv.amount,
        base_subtotal        = inv.base_subtotal,
        profit_margin_pct    = inv.profit_margin_pct,
        profit_margin_amount = inv.profit_margin_amount,
        sscl_pct             = inv.sscl_pct,
        sscl_amount          = inv.sscl_amount,
        vat_pct              = inv.vat_pct,
        vat_amount           = inv.vat_amount,
        grand_total          = inv.grand_total,
        credit_balance       = inv.credit_balance,
        is_vat_posted        = inv.is_vat_posted,
        warranty             = inv.warranty,
        customer_name        = inv.customer.name if inv.customer else None,
        rep_name             = inv.rep.name      if inv.rep      else None,
        route_name           = (inv.route.name if inv.route else None) or (
                       inv.customer.route.name
                       if inv.customer and inv.customer.route else None),
    )


def generate_next_invoice_number(db: Session, category: str, service_type: str) -> str:
    """
    Generate the next invoice number based on the category (ALL_INC vs VAT) and
    service type (SALE vs REPAIR). Matches the formatting patterns found in the DB.
    """
    type_letter = "S" if service_type == "SALE" else "R"
    
    if category == "ALL_INC":
        prefix = f"CCFR-{type_letter}"
        # Look for existing ALL_INC invoices with this type prefix and service_type
        last_invoice = (
            db.query(Invoice.invoice_number)
            .filter(Invoice.invoice_category == "ALL_INC")
            .filter(Invoice.service_type == service_type)
            .filter(Invoice.invoice_number.like(f"{prefix}%"))
            .order_by(desc(Invoice.invoice_number), desc(Invoice.id))
            .first()
        )
        
        max_num = 0
        if last_invoice:
            match = re.search(r'CCFR-[SR](\d+)', last_invoice[0])
            if match:
                max_num = int(match.group(1))
                
        # Fallback: scan all of this type if like query missed
        if max_num == 0:
            all_invs = db.query(Invoice.invoice_number).filter(
                Invoice.invoice_category == "ALL_INC",
                Invoice.service_type == service_type
            ).all()
            for inv in all_invs:
                match = re.search(r'CCFR-[SR](\d+)', inv[0])
                if match:
                    max_num = max(max_num, int(match.group(1)))
                    
        next_num = max_num + 1
        return f"{prefix}{next_num:05d}"
        
    else:  # VAT
        today = datetime.date.today()
        year_month = today.strftime("%Y-%m")
        prefix = f"{year_month}-{type_letter}"
        
        # VAT numbers use a global counter across months
        vat_invs = (
            db.query(Invoice.invoice_number)
            .filter(Invoice.invoice_category == "VAT")
            .filter(Invoice.service_type == service_type)
            .all()
        )
        
        max_num = 0
        for inv in vat_invs:
            match = re.search(r'\d{4}-\d{2}-[SR](\d+)', inv[0])
            if match:
                max_num = max(max_num, int(match.group(1)))
                
        if max_num == 0:
            next_num = 1
        else:
            next_num = max_num + 1
            
        return f"{prefix}{next_num:05d}"


def resolve_invoice_customer_details(payload: InvoiceCreate, customer: Customer) -> tuple[Optional[str], Optional[str]]:
    """Resolve the customer TIN/phone to use for invoice rendering.

    If the invoice form provides a non-empty value, that takes precedence.
    Empty invoice values fall back to the saved customer record values.
    """
    tin = None
    phone = None

    if payload.customer_tin is not None:
        tin = payload.customer_tin.strip() or None
    if payload.customer_phone is not None:
        phone = payload.customer_phone.strip() or None

    if tin is None and getattr(customer, "tin", None):
        tin = str(customer.tin).strip() or None
    if phone is None and getattr(customer, "phone", None):
        phone = str(customer.phone).strip() or None

    return tin, phone


@router.get("/next-number")
def get_next_number(
    category: str = Query(..., description="'ALL_INC' or 'VAT'"),
    type:     str = Query(..., description="'SALE' or 'REPAIR'"),
    db: Session = Depends(get_db)
):
    """Fetch next sequence number based on category and type."""
    next_num = generate_next_invoice_number(db, category, type)
    return {"invoice_number": next_num}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[InvoiceListItem])
def list_invoices(
    # All filters are optional — send none to get all invoices
    category:   Optional[str]  = Query(None, description="'ALL_INC' or 'VAT'"),
    type:       Optional[str]  = Query(None, description="'SALE' or 'REPAIR'"),
    rep_id:     Optional[int]  = Query(None),
    customer_id:Optional[int]  = Query(None),
    date_from:  Optional[date] = Query(None),
    date_to:    Optional[date] = Query(None),
    search:     Optional[str]  = Query(None, description="Search invoice number"),
    limit:      int            = Query(50, le=500),
    offset:     int            = Query(0),
    db: Session = Depends(get_db)
):
    """
    List invoices with optional filters.
    Automatically JOINs customers, reps, and routes so the response
    includes names — not just foreign key numbers.
    """
    q = (db.query(Invoice)
           .options(
               joinedload(Invoice.customer).joinedload(Customer.route),
               joinedload(Invoice.rep)
           )
           .order_by(desc(Invoice.invoice_date), desc(Invoice.id)))

    if category:    q = q.filter(Invoice.invoice_category == category)
    if type:        q = q.filter(Invoice.service_type == type)
    if rep_id:      q = q.filter(Invoice.rep_id == rep_id)
    if customer_id: q = q.filter(Invoice.customer_id == customer_id)
    if date_from:   q = q.filter(Invoice.invoice_date >= date_from)
    if date_to:     q = q.filter(Invoice.invoice_date <= date_to)
    if search:      q = q.filter(Invoice.invoice_number.ilike(f"%{search}%"))

    invoices = q.offset(offset).limit(limit).all()
    return [_build_list_item(inv) for inv in invoices]


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Get one invoice by its database ID, with full detail including
    all payment records and line items.
    """
    inv = (db.query(Invoice)
          .options(
                 joinedload(Invoice.customer).joinedload(Customer.route),
                 joinedload(Invoice.rep),
                 joinedload(Invoice.payments).joinedload(Payment.recorded_by_rep),
                 joinedload(Invoice.items),
             )
             .filter(Invoice.id == invoice_id)
             .first())

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return InvoiceDetail(
        id                   = inv.id,
        invoice_number       = inv.invoice_number,
        invoice_category     = inv.invoice_category,
        service_type         = inv.service_type,
        invoice_date         = inv.invoice_date,
        customer_id          = inv.customer_id,
        customer_tin         = inv.customer_tin,
        customer_phone       = inv.customer_phone,
        rep_id               = inv.rep_id,
        appointment_id       = inv.appointment_id,
        amount               = inv.amount,
        base_subtotal        = inv.base_subtotal,
        profit_margin_pct    = inv.profit_margin_pct,
        profit_margin_amount = inv.profit_margin_amount,
        sscl_pct             = inv.sscl_pct,
        sscl_amount          = inv.sscl_amount,
        vat_pct              = inv.vat_pct,
        vat_amount           = inv.vat_amount,
        grand_total          = inv.grand_total,
        credit_balance       = inv.credit_balance,
        is_vat_posted        = inv.is_vat_posted,
        contact_name         = inv.contact_name,
        due_date             = inv.due_date,
        po_number            = inv.po_number,
        remarks              = inv.remarks,
        warranty             = inv.warranty,
        created_at           = inv.created_at,
        customer_name        = inv.customer.name if inv.customer else None,
        rep_name             = inv.rep.name      if inv.rep      else None,
        route_name           = inv.customer.route.name
                               if inv.customer and inv.customer.route else None,
        items    = [InvoiceItemOut.model_validate(it) for it in inv.items],
        payments = [PaymentOut.model_validate(p)  for p  in inv.payments],
    )


@router.post("", response_model=InvoiceDetail, status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    """
    Create a new invoice.

    The frontend sends JSON; Pydantic validates it before it touches the DB.
    Rate fields (profit_margin_pct, sscl_pct, vat_pct) are optional — if
    omitted the backend reads the current global defaults from Settings.

    All financial breakdown values are calculated here and stored on the
    invoice row so historical data never changes even if global rates do.
    """
    # ── Duplicate check ──────────────────────────────────────────────────────
    existing = db.query(Invoice).filter(
        Invoice.invoice_number == payload.invoice_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Invoice number '{payload.invoice_number}' already exists"
        )

    # ── Customer validation ──────────────────────────────────────────────────
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    resolved_tin, resolved_phone = resolve_invoice_customer_details(payload, customer)

    # ── Resolve rates: use per-invoice overrides or fall back to globals ─────
    default_sscl, default_vat, default_margin = _get_settings_defaults(db)

    sscl_pct          = Decimal(str(payload.sscl_pct))          if payload.sscl_pct          is not None else default_sscl
    vat_pct           = Decimal(str(payload.vat_pct))           if payload.vat_pct           is not None else default_vat
    profit_margin_pct = Decimal(str(payload.profit_margin_pct)) if payload.profit_margin_pct is not None else default_margin

    if not payload.items:
        raise HTTPException(status_code=400, detail="Invoice must include at least one line item.")

    # ── Build line items: raw cost → customer-facing rate/amount ────────────
    line_results  = []
    item_objects  = []

    for i, item_data in enumerate(payload.items, start=1):
        if not item_data.description or not item_data.description.strip():
            raise HTTPException(status_code=400, detail=f"Line item {i} must include a description.")
        if item_data.rate is None or Decimal(str(item_data.rate)) <= 0:
            raise HTTPException(status_code=400, detail=f"Line item {i} must include a rate greater than 0.")

        qty      = item_data.qty or 1
        raw_rate = Decimal(str(item_data.rate or 0))
        raw_amt  = (Decimal(str(qty)) * raw_rate).quantize(TWO_PLACES, ROUND_HALF_UP)

        line = calculate_line_item(
            raw_amount        = raw_amt,
            invoice_category  = payload.invoice_category,
            profit_margin_pct = profit_margin_pct,
            sscl_pct          = sscl_pct,
            vat_pct           = vat_pct,
        )
        line_results.append(line)

        display_rate = (line["display_amount"] / Decimal(str(qty))).quantize(TWO_PLACES, ROUND_HALF_UP)

        item_objects.append(
            InvoiceItem(
                line_number = i,
                description = item_data.description,
                serial_no   = item_data.serial_no,
                qty         = qty,
                raw_rate    = raw_rate,
                rate        = display_rate,
                amount      = line["display_amount"],
            )
        )

    # ── Full calculation chain ───────────────────────────────────────────────
    totals = calculate_invoice_totals(
        line_results      = line_results,
        invoice_category  = payload.invoice_category,
        profit_margin_pct = profit_margin_pct,
        sscl_pct          = sscl_pct,
        vat_pct           = vat_pct,
    )
    base_subtotal = totals["base_subtotal"]

    # ── Persist invoice ──────────────────────────────────────────────────────
    inv = Invoice(
        invoice_number   = payload.invoice_number,
        invoice_category = payload.invoice_category,
        service_type     = payload.service_type,
        invoice_date     = payload.invoice_date,
        customer_id      = payload.customer_id,
        rep_id           = payload.rep_id,
        appointment_id   = payload.appointment_id,
        contact_name     = payload.contact_name,
        customer_tin     = resolved_tin,
        customer_phone   = resolved_phone,
        due_date         = payload.due_date,
        po_number        = payload.po_number,
        warranty         = payload.warranty,
        remarks          = payload.remarks,
        route_id         = payload.route_id,

        # Financial breakdown — full audit trail
        amount               = base_subtotal,           # backward-compat alias
        base_subtotal        = base_subtotal,
        profit_margin_pct    = profit_margin_pct,
        profit_margin_amount = totals["profit_margin_amount"],
        sscl_pct             = sscl_pct,
        sscl_amount          = totals["sscl_amount"],
        vat_pct              = vat_pct,
        vat_amount           = totals["vat_amount"],
        grand_total          = totals["grand_total"],

        credit_balance = Decimal(str(payload.credit_balance)),
    )
    db.add(inv)
    db.flush()   # get inv.id without full commit so we can attach items

    # Attach line items
    for item_obj in item_objects:
        item_obj.invoice_id = inv.id
        db.add(item_obj)

    try:
        db.commit()
    except IntegrityError as err:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(err.orig) if getattr(err, 'orig', None) else "Invoice save failed due to invalid data.")
    except DataError as err:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(err.orig) if getattr(err, 'orig', None) else "Invoice save failed due to invalid numeric data.")

    return get_invoice(inv.id, db)


@router.post("/{invoice_id}/pay", response_model=PaymentOut, status_code=201)
def add_payment(
    invoice_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db)
):
    """
    Record a payment against an existing invoice.
    Also reduces the credit_balance on the invoice.

    Example: customer pays Rs.10,000 by cheque on an invoice with
    credit_balance of Rs.50,000 → credit_balance becomes Rs.40,000.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.recorded_by_rep_id is not None:
        recorder = (
            db.query(Rep)
              .filter(Rep.id == payload.recorded_by_rep_id, Rep.is_active == True)
              .first()
        )
        if not recorder:
            raise HTTPException(status_code=400, detail="Payment recorder must be an active staff member")

    payment = Payment(invoice_id=invoice_id, **payload.model_dump())
    db.add(payment)

    new_balance = Decimal(str(inv.credit_balance)) - Decimal(str(payload.amount))
    inv.credit_balance = max(new_balance, Decimal("0.00"))

    db.commit()
    db.refresh(payment)
    return payment


@router.patch("/{invoice_id}/mark-vat-posted", status_code=200)
def mark_vat_posted(invoice_id: int, db: Session = Depends(get_db)):
    """
    Mark a VAT invoice as posted to RAMIS.
    Called after the accountant submits it to the IRD system.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.invoice_category != "VAT":
        raise HTTPException(status_code=400, detail="Only VAT invoices can be posted to RAMIS")

    inv.is_vat_posted = True
    db.commit()
    return {"message": f"Invoice {inv.invoice_number} marked as VAT posted"}


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Hard-delete an invoice, cascading to its items and payments."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return None


@router.get("/search-by-serial/{serial_number}")
def search_by_serial(serial_number: str, db: Session = Depends(get_db)):
    """
    Search if a serial number was ever sold.
    Queries the invoice_items table and joins with invoices to return details.
    """
    clean_serial = serial_number.strip()
    if not clean_serial:
        raise HTTPException(status_code=400, detail="Serial number query cannot be empty")

    item = (
        db.query(InvoiceItem)
        .filter(InvoiceItem.serial_no.ilike(clean_serial))
        .order_by(InvoiceItem.created_at.desc())
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Serial number not found in sales history")

    inv = item.invoice
    return {
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date,
        "item_name": item.description,
    }

