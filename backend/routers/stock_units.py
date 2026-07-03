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

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import StockUnit, StockItem, StockReceiptItem
from schemas import StockUnitLookupOut, StockUnitOut

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
        created_at           = unit.created_at,
        updated_at           = unit.updated_at,
    )


# ── GET /stock-units/lookup/{serial_number}  (lookup_router — any rep) ────────

@lookup_router.get("/lookup/{serial_number}", response_model=StockUnitLookupOut)
def lookup_serial(serial_number: str, db: Session = Depends(get_db)):
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
            joinedload(StockUnit.receipt_item),
        )
        .filter(StockUnit.serial_number == clean)
        .first()
    )

    if not unit:
        raise HTTPException(
            status_code=404,
            detail=f"Serial number '{clean}' not found in inventory",
        )

    # ── Status guard ─────────────────────────────────────────────────────────
    if unit.status != "in_stock":
        status_messages = {
            "sold": (
                "This unit was already sold"
                + (
                    f" (invoice_item id={unit.sold_invoice_item_id})"
                    if unit.sold_invoice_item_id else ""
                )
            ),
            "returned":          "This unit has been returned and is pending inspection",
            "warranty_replaced": "This unit was replaced under warranty and is no longer in stock",
            "defective":         "This unit is marked defective and cannot be sold",
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

    return StockUnitLookupOut(
        serial_number    = unit.serial_number,
        stock_item_id    = unit.stock_item_id,
        brand            = si.brand       if si else None,
        model            = si.model       if si else None,
        description      = si.description if si else None,
        final_unit_price = final_unit_price,
        status           = unit.status,
    )


# ── GET /stock-units  (router — admin only) ───────────────────────────────────

@router.get("", response_model=List[StockUnitOut])
def list_stock_units(
    stock_item_id: Optional[int] = Query(None, description="Filter by catalog item"),
    status:        Optional[str] = Query(
        None,
        description="Filter by status: in_stock | sold | returned | warranty_replaced | defective",
    ),
    db: Session = Depends(get_db),
):
    """
    List individual serialized units, filterable by catalog item and status.
    Used by the inventory browsing page (admin screen).
    """
    valid_statuses = {"in_stock", "sold", "returned", "warranty_replaced", "defective"}

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
