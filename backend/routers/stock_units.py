"""
routers/stock_units.py — Individual serialized stock unit endpoints
====================================================================
This module exposes TWO routers with different protection levels:

  lookup_router  — prefix /stock-units  (any logged-in user)
    GET /stock-units/lookup/{serial_number}
      Barcode-scan endpoint used by reps during invoice creation.
      Every rep must be able to reach this; it does not expose bulk data.

  router         — prefix /stock-units  (admin only)
    GET /stock-units
      Full unit listing with filters — used by the inventory browsing
      page, which is an admin screen.

main.py registers them with different dependency sets:
  app.include_router(stock_units.lookup_router, prefix="/api", **protected)
  app.include_router(stock_units.router,        prefix="/api", **admin_only)

PRICE CHOICE — historical receipt price (final_unit_price from the
StockReceiptItem that received this unit):
  The receipt's final_unit_price was deliberately computed at receive
  time using the cost chain (unit_cost → op_cost → SSCL → VAT) and
  stored permanently on the StockReceiptItem row using the same
  rate-snapshot pattern as invoices. Recalculating today using current
  Settings margins would produce inconsistent prices for the same physical
  unit depending on when it is scanned — a staff member scanning the same
  barcode today vs. next month after a rate change would see a different
  price for the identical box on the shelf. The receipt price is the
  stable, intentional landed cost–inclusive selling price.
"""

from typing import Optional, List
from decimal import Decimal
import calendar
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from database import get_db
from models import (
    Invoice,
    InvoiceItem,
    JobCard,
    RepairJob,
    StockItem,
    StockReceipt,
    StockReceiptItem,
    StockUnit,
    StockUnitStatusHistory,
    Supplier,
    Technician,
)
from schemas import StockUnitLookupOut, StockUnitOut, SerialHistoryOut
from warranty_utils import get_warranty_summary

# ── Two routers, registered separately in main.py ─────────────────────────────

# Any logged-in rep can reach this (barcode scan during invoicing)
lookup_router = APIRouter(prefix="/stock-units", tags=["Stock Units — Lookup"])

# Admin-only: full listing / management view
router = APIRouter(prefix="/stock-units", tags=["Stock Units — Admin"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _to_unit_out(unit: StockUnit) -> StockUnitOut:
    """Convert a StockUnit ORM row (with stock_item loaded) to StockUnitOut."""
    si = unit.stock_item
    return StockUnitOut(
        id                   = unit.id,
        receipt_item_id      = unit.receipt_item_id,
        stock_item_id        = unit.stock_item_id,
        brand                = si.brand        if si else None,
        model                = si.model        if si else None,
        description          = si.description  if si else None,
        serial_number        = unit.serial_number,
        status               = unit.status,
        sold_invoice_item_id = unit.sold_invoice_item_id,
        warranty_months      = unit.warranty_months,
        has_manufacturer_warranty = unit.has_manufacturer_warranty,
        manufacturer_warranty_months = unit.manufacturer_warranty_months,
        created_at           = unit.created_at,
        updated_at           = unit.updated_at,
    )


def _to_lookup_out(unit: StockUnit, db: Session) -> StockUnitLookupOut:
    si = unit.stock_item
    sold_invoice = None
    sold_item = None

    if unit.sold_invoice_item_id is not None:
        sold_item = db.query(InvoiceItem).filter(InvoiceItem.id == unit.sold_invoice_item_id).first()
        if sold_item:
            sold_invoice = sold_item.invoice

    warranty_summary = get_warranty_summary(unit, sold_item, today=date.today())
    receipt = unit.receipt_item.receipt if unit.receipt_item else None

    return StockUnitLookupOut(
        id                      = unit.id,
        serial_number            = unit.serial_number,
        stock_item_id            = unit.stock_item_id,
        brand                    = si.brand       if si else None,
        model                    = si.model       if si else None,
        description              = si.description if si else None,
        final_unit_price         = Decimal(str(unit.receipt_item.final_unit_price)) if unit.receipt_item else Decimal("0.00"),
        status                   = unit.status,
        latest_price             = unit.receipt_item,
        sold_invoice_item_id     = unit.sold_invoice_item_id,
        sold_invoice_id          = sold_invoice.id if sold_invoice else None,
        sold_invoice_number      = sold_invoice.invoice_number if sold_invoice else None,
        sold_invoice_date        = sold_invoice.invoice_date if sold_invoice else None,
        receipt_date             = receipt.received_date if receipt else None,
        warranty_months          = unit.warranty_months,
        has_manufacturer_warranty = unit.has_manufacturer_warranty,
        manufacturer_warranty_months = unit.manufacturer_warranty_months,
        manufacturer_warranty_expiry = warranty_summary["manufacturer_expiry"],
        manufacturer_warranty_status = warranty_summary["manufacturer_status"],
        customer_warranty_expiry = warranty_summary["customer_expiry"],
        customer_warranty_status = warranty_summary["customer_status"],
    )


@lookup_router.get("/{unit_id}/available-replacements", response_model=List[StockUnitLookupOut])
def get_available_replacements(unit_id: int, db: Session = Depends(get_db)):
    unit = db.query(StockUnit).filter(StockUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Stock unit not found.")

    candidates = (
        db.query(StockUnit)
        .options(joinedload(StockUnit.receipt_item).joinedload(StockReceiptItem.receipt), joinedload(StockUnit.stock_item))
        .filter(StockUnit.stock_item_id == unit.stock_item_id, StockUnit.status == "in_stock", StockUnit.id != unit.id)
        .order_by(StockUnit.created_at)
        .all()
    )

    return [_to_lookup_out(c, db) for c in candidates]


# ── GET /stock-units/lookup/{serial_number}  (lookup_router — any rep) ────────

@lookup_router.get("/lookup/{serial_number}", response_model=StockUnitLookupOut)
def lookup_serial(
    serial_number: str,
    fuzzy: bool = Query(False, description="Allow partial/fuzzy serial search when an exact match is not found."),
    allow_any_status: bool = Query(False, description="When true, return units regardless of current status (used by job-card creation)."),
    db: Session = Depends(get_db),
):
    """
    Barcode-scan endpoint — used during invoice creation by any rep.

    Given a serial number, returns enough information to auto-fill one
    invoice line item without any further frontend lookups:
      • stock_item_id, brand, model, description
      • final_unit_price  ← historical receipt price (see module docstring)
      • status            ← tells the frontend whether the unit is available

    HTTP status codes:
      200  — unit found and available (status == 'in_stock')
      400  — empty serial string
      404  — serial number not found in inventory
      409  — unit found but not available (sold, defective, etc.)
    """
    clean = serial_number.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Serial number cannot be empty")

    unit = (
        db.query(StockUnit)
        .options(
            joinedload(StockUnit.stock_item),
            joinedload(StockUnit.receipt_item).joinedload(StockReceiptItem.receipt),
        )
        .filter(StockUnit.serial_number == clean)
        .first()
    )

    if not unit and fuzzy and len(clean) >= 3:
        candidates = (
            db.query(StockUnit)
            .options(
                joinedload(StockUnit.stock_item),
                joinedload(StockUnit.receipt_item).joinedload(StockReceiptItem.receipt),
            )
            .filter(
                StockUnit.serial_number.ilike(f"%{clean}%"),
                StockUnit.status == "in_stock",
            )
            .order_by(StockUnit.serial_number)
            .limit(10)
            .all()
        )
        if candidates:
            unit = candidates[0]

    if not unit:
        raise HTTPException(
            status_code=404,
            detail=f"Serial number '{clean}' not found in inventory",
        )

    # ── Status guard ─────────────────────────────────────────────────────────
    # By default we require 'in_stock' for lookups (used for invoice creation).
    # Callers that need to accept any existing unit (job-card creation) can set
    # `allow_any_status=true` and bypass this availability guard.
    if not allow_any_status and unit.status != "in_stock":
        status_messages = {
            "sold":                         "This unit was already sold"
            + (
                f" (invoice_item id={unit.sold_invoice_item_id})"
                if unit.sold_invoice_item_id else ""
            ),
            "returned":                     "This unit has been returned and is pending inspection",
            "returned_pending_check":      "This unit has been returned and is pending inspection",
            "with_manufacturer":            "This unit has been sent to the manufacturer for warranty claim",
            "with_internal_team_warranty":  "This unit has been sent to internal warranty service",
            "with_internal_team_paid":      "This unit has been sent to internal paid repair service",
            "with_third_party_warranty":    "This unit has been sent to third-party warranty service",
            "with_third_party_paid":        "This unit has been sent to third-party paid repair service",
            "repaired_awaiting_pickup":     "This unit is repaired and awaiting customer pickup",
            "warranty_replaced":            "This unit was replaced under warranty and is no longer in stock",
            "returned_unrepaired":         "This unit was returned to the customer unrepaired",
            "defective":                    "This unit is marked defective and cannot be sold",
            "scrapped":                     "This unit has been scrapped and cannot be sold",
        }
        detail = status_messages.get(
            unit.status,
            f"This unit has status '{unit.status}' and is not available",
        )
        raise HTTPException(status_code=409, detail=detail)

    # ── Build lookup response ─────────────────────────────────────────────────
    si = unit.stock_item
    ri = unit.receipt_item  # StockReceiptItem — snapshotted final_unit_price

    final_unit_price = Decimal(str(ri.final_unit_price)) if ri else Decimal("0.00")

    sold_invoice = None
    sold_item = None
    if unit.sold_invoice_item_id is not None:
        sold_item = db.query(InvoiceItem).filter(InvoiceItem.id == unit.sold_invoice_item_id).first()
        if sold_item:
            sold_invoice = sold_item.invoice

    warranty_summary = get_warranty_summary(unit, sold_item, today=date.today())
    receipt = unit.receipt_item.receipt if unit.receipt_item else None

    return StockUnitLookupOut(
        id                      = unit.id,
        serial_number            = unit.serial_number,
        stock_item_id            = unit.stock_item_id,
        brand                    = si.brand       if si else None,
        model                    = si.model       if si else None,
        description              = si.description if si else None,
        final_unit_price         = final_unit_price,
        status                   = unit.status,
        latest_price             = ri,
        sold_invoice_item_id     = unit.sold_invoice_item_id,
        sold_invoice_id          = sold_invoice.id if sold_invoice else None,
        sold_invoice_number      = sold_invoice.invoice_number if sold_invoice else None,
        sold_invoice_date        = sold_invoice.invoice_date if sold_invoice else None,
        receipt_date             = receipt.received_date if receipt else None,
        warranty_months          = unit.warranty_months,
        has_manufacturer_warranty = unit.has_manufacturer_warranty,
        manufacturer_warranty_months = unit.manufacturer_warranty_months,
        manufacturer_warranty_expiry = warranty_summary["manufacturer_expiry"],
        manufacturer_warranty_status = warranty_summary["manufacturer_status"],
        customer_warranty_expiry = warranty_summary["customer_expiry"],
        customer_warranty_status = warranty_summary["customer_status"],
    )


def _add_months(start_date: date, months: int) -> date:
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _status_label(status: Optional[str]) -> str:
    labels = {
        "in_stock": "In stock",
        "sold": "Sold",
        "returned": "Returned",
        "returned_pending_check": "Returned, pending inspection",
        "with_manufacturer": "With manufacturer",
        "with_internal_team_warranty": "With internal warranty team",
        "with_internal_team_paid": "With internal paid repair team",
        "with_third_party_warranty": "With third-party warranty technician",
        "with_third_party_paid": "With third-party paid repair technician",
        "repaired_awaiting_pickup": "Repaired, awaiting pickup",
        "warranty_replaced": "Warranty replaced",
        "returned_unrepaired": "Returned unrepaired",
        "defective": "Defective",
        "scrapped": "Scrapped",
    }
    return labels.get(status, status or "Unknown")


@lookup_router.get("/{serial_number}/full-history", response_model=SerialHistoryOut)
def get_serial_full_history(
    serial_number: str,
    db: Session = Depends(get_db),
):
    clean = serial_number.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Serial number cannot be empty")

    unit = (
        db.query(StockUnit)
        .options(
            joinedload(StockUnit.stock_item),
            joinedload(StockUnit.receipt_item).joinedload(StockReceiptItem.receipt).joinedload(StockReceipt.supplier),
            joinedload(StockUnit.status_history).joinedload(StockUnitStatusHistory.changed_by_rep),
        )
        .filter(StockUnit.serial_number == clean)
        .first()
    )

    job_card_query = db.query(JobCard).options(
        joinedload(JobCard.received_by_staff),
        joinedload(JobCard.assigned_to_staff),
    )
    job_card_filters = [JobCard.serial_number == clean]
    if unit:
        job_card_filters.append(JobCard.stock_unit_id == unit.id)
    job_cards = job_card_query.filter(or_(*job_card_filters)).order_by(JobCard.created_at).all()

    if not unit and not job_cards:
        raise HTTPException(
            status_code=404,
            detail=f"Serial number '{clean}' not found in inventory or job cards",
        )

    receipt = unit.receipt_item.receipt if unit and unit.receipt_item else None
    supplier = receipt.supplier if receipt else None
    stock_item = unit.stock_item if unit else None

    sold_invoice = None
    sale_customer_name = None
    sale_date = None
    if unit and unit.sold_invoice_item_id is not None:
        sold_item = (
            db.query(InvoiceItem)
            .options(joinedload(InvoiceItem.invoice).joinedload(Invoice.customer))
            .filter(InvoiceItem.id == unit.sold_invoice_item_id)
            .first()
        )
        if sold_item and sold_item.invoice:
            sold_invoice = sold_item.invoice
            sale_date = sold_invoice.invoice_date
            sale_customer_name = sold_invoice.customer.name if sold_invoice.customer else None

    warranty_note = None
    expiry_date = None
    within_warranty = None
    if unit and unit.warranty_months is not None and sale_date is not None:
        expiry_date = _add_months(sale_date, unit.warranty_months)
        within_warranty = date.today() <= expiry_date
        warranty_note = "Within warranty" if within_warranty else "Warranty expired"
    elif unit and unit.warranty_months is not None:
        warranty_note = "Awaiting sale to calculate warranty status"
    elif unit:
        warranty_note = "No warranty terms configured"

    origin = {
        "source": "stock" if unit else "job_card",
        "receipt_date": receipt.received_date if receipt else None,
        "grn_reference": receipt.reference_no if receipt else None,
        "supplier_name": supplier.name if supplier else None,
        "job_card_created_at": job_cards[0].created_at if job_cards else None,
        "no_stock_history": unit is None,
    }

    events = []
    if receipt:
        events.append({
            "id": receipt.id,
            "type": "receipt",
            "date": datetime.combine(receipt.received_date, datetime.min.time()),
            "title": "Stock received",
            "subtitle": f"Supplier: {supplier.name}" if supplier else None,
            "detail": f"GRN {receipt.reference_no}" if receipt.reference_no else "Received into inventory",
            "note": None,
            "stock_unit_id": unit.id if unit else None,
        })

    if unit:
        for history in unit.status_history:
            events.append({
                "id": history.id,
                "type": "status_change",
                "date": history.changed_at,
                "title": f"Status changed to {_status_label(history.new_status)}",
                "subtitle": f"Was {_status_label(history.old_status)}",
                "detail": history.note,
                "changed_by": history.changed_by_rep.name if history.changed_by_rep else None,
                "stock_unit_id": unit.id,
            })

    for card in job_cards:
        events.append({
            "id": card.id,
            "type": "job_card",
            "date": card.created_at,
            "title": "Job card created",
            "subtitle": f"Job Card #{card.id} · {card.device_name}",
            "detail": card.issue_description,
            "note": f"Status: {card.status}, Source: {card.device_source}" if card.device_source else f"Status: {card.status}",
            "stock_unit_id": card.stock_unit_id,
            "job_card_id": card.id,
        })

    if unit:
        repair_jobs = (
            db.query(RepairJob)
            .options(joinedload(RepairJob.technician), joinedload(RepairJob.linked_job_card))
            .filter(RepairJob.stock_unit_id == unit.id)
            .order_by(RepairJob.date_sent)
            .all()
        )
        for rj in repair_jobs:
            subtitle = rj.technician.name if rj.technician else "Technician"
            detail_parts = [f"Outcome: {rj.outcome}"]
            if rj.amount_charged_by_technician is not None:
                detail_parts.append(f"Cost: {rj.amount_charged_by_technician}")
            if rj.date_returned:
                detail_parts.append(f"Returned: {rj.date_returned.isoformat()}")
            detail = "; ".join(detail_parts)
            events.append({
                "id": rj.id,
                "type": "repair_job",
                "date": datetime.combine(rj.date_sent, datetime.min.time()),
                "title": "Repair job recorded",
                "subtitle": subtitle,
                "detail": detail,
                "technician_name": rj.technician.name if rj.technician else None,
                "amount_charged_by_technician": rj.amount_charged_by_technician,
                "outcome": rj.outcome,
                "job_card_id": rj.linked_job_card_id,
                "stock_unit_id": unit.id,
            })

    type_order = {"receipt": 0, "job_card": 1, "repair_job": 2, "status_change": 3}
    events.sort(key=lambda ev: (ev["date"], type_order.get(ev["type"], 99)))

    return SerialHistoryOut(
        serial_number=clean,
        brand=stock_item.brand if stock_item else None,
        model=stock_item.model if stock_item else None,
        description=stock_item.description if stock_item else None,
        device_name=job_cards[0].device_name if job_cards else None,
        origin=origin,
        sale_info={
            "sold": bool(sold_invoice),
            "invoice_number": sold_invoice.invoice_number if sold_invoice else None,
            "customer_name": sale_customer_name,
            "sale_date": sale_date,
        },
        warranty={
            "warranty_months": unit.warranty_months if unit else None,
            "has_manufacturer_warranty": bool(unit.has_manufacturer_warranty) if unit else False,
            "manufacturer_warranty_months": unit.manufacturer_warranty_months if unit else None,
            "sale_date": sale_date,
            "expiry_date": expiry_date,
            "within_warranty": within_warranty,
            "note": warranty_note,
        },
        current_status=unit.status if unit else None,
        current_status_label=_status_label(unit.status) if unit else "No stock record",
        timeline=events,
    )


# ── GET /stock-units  (router — admin only) ───────────────────────────────────

@router.get("", response_model=List[StockUnitOut])
def list_stock_units(
    stock_item_id: Optional[int] = Query(None, description="Filter by catalog item"),
    status:        Optional[str] = Query(
        None,
        description="Filter by status: in_stock | sold | returned_pending_check | with_manufacturer | with_internal_team_warranty | with_internal_team_paid | with_third_party_warranty | with_third_party_paid | repaired_awaiting_pickup | warranty_replaced | returned_unrepaired | defective | scrapped",
    ),
    db: Session = Depends(get_db),
):
    """
    List individual serialized units, filterable by catalog item and status.
    Used by the inventory browsing page (admin screen).
    """
    valid_statuses = {
        "in_stock",
        "sold",
        "returned_pending_check",
        "with_manufacturer",
        "with_internal_team_warranty",
        "with_internal_team_paid",
        "with_third_party_warranty",
        "with_third_party_paid",
        "repaired_awaiting_pickup",
        "warranty_replaced",
        "returned_unrepaired",
        "defective",
        "scrapped",
    }

    if status is not None and status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Must be one of: {', '.join(sorted(valid_statuses))}",
        )

    q = (
        db.query(StockUnit)
        .options(joinedload(StockUnit.stock_item))
        .order_by(StockUnit.stock_item_id, StockUnit.serial_number)
    )

    if stock_item_id is not None:
        q = q.filter(StockUnit.stock_item_id == stock_item_id)
    if status is not None:
        q = q.filter(StockUnit.status == status)

    return [_to_unit_out(u) for u in q.all()]
