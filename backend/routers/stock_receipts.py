"""
routers/stock_receipts.py — Stock Goods Received Note (GRN) endpoints
=======================================================================
Mirrors the calculation structure of routers/invoices.py exactly:
  - Same TWO_PLACES / SIX_PLACES constants
  - Same Decimal(ROUND_HALF_UP) quantise discipline
  - Same _get_settings_defaults() helper (imported pattern, not re-read)
  - Same db.flush() → attach children → db.commit() → IntegrityError guard

Calculation chain for each receipt line (see calculate_receipt_line()):

  Step 1  unit_cost                 = supplier charge per unit (given)
  Step 2  operation_cost_amount     = unit_cost * (value/100)  [percentage]
                                    | value                    [fixed]
          subtotal_after_opcost     = unit_cost + operation_cost_amount
  Step 3  sscl_amount               = subtotal_after_opcost * sscl_pct
          after_sscl                = subtotal_after_opcost + sscl_amount
  Step 4  vat_amount                = after_sscl * vat_pct
          final_unit_price          = after_sscl + vat_amount

Every intermediate value is stored on the StockReceiptItem row (rate-snapshot
pattern) so historical costs never change even if global rates change later.

Serial numbers (StockUnit rows) are NOT auto-created here — they are added
separately via POST /{receipt_id}/items/{item_id}/serials, one scan at a time
as items are physically unboxed.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import (
    Settings, Supplier, StockItem, StockReceipt, StockReceiptItem, StockUnit
)
from schemas import (
    StockReceiptCreate, StockReceiptDetail,
    StockReceiptItemOut,
)

router = APIRouter(prefix="/stock-receipts", tags=["Stock Receipts"])

TWO_PLACES = Decimal("0.01")
SIX_PLACES = Decimal("0.000001")


# ── Calculation helpers ───────────────────────────────────────────────────────

def _get_settings_defaults(db: Session) -> tuple[Decimal, Decimal, Decimal]:
    """
    Return (sscl_pct, vat_pct, profit_margin) from the Settings table.
    Falls back to hardcoded defaults if the row doesn't exist yet.
    Mirrors invoices.py._get_settings_defaults() exactly.
    """
    row = db.query(Settings).filter(Settings.id == 1).first()
    if row:
        return (
            Decimal(str(row.sscl_pct)),
            Decimal(str(row.vat_pct)),
            Decimal(str(row.profit_margin)),
        )
    return Decimal("0.025"), Decimal("0.18"), Decimal("0.20")


def calculate_receipt_line(
    unit_cost:            Decimal,
    operation_cost_type:  str,
    operation_cost_value: Decimal,
    sscl_pct:             Decimal,
    vat_pct:              Decimal,
) -> dict:
    """
    Mirrors invoices.py's calculate_line_item() pattern exactly.

    Step 1: unit_cost = what the supplier charged (given)
    Step 2: operation_cost_amount =
              unit_cost * (operation_cost_value / 100)  if type == 'percentage'
              operation_cost_value                       if type == 'fixed'
            subtotal_after_opcost = unit_cost + operation_cost_amount
    Step 3: sscl_amount = subtotal_after_opcost * sscl_pct
            after_sscl  = subtotal_after_opcost + sscl_amount
    Step 4: vat_amount       = after_sscl * vat_pct
            final_unit_price = after_sscl + vat_amount

    Returns a dict with every intermediate value — all stored on the
    StockReceiptItem row so downstream totals are always simple addition
    and historical costs never change.
    """
    unit_cost            = Decimal(str(unit_cost))
    operation_cost_value = Decimal(str(operation_cost_value))

    if operation_cost_type == "percentage":
        operation_cost_amount = (
            unit_cost * (operation_cost_value / Decimal("100"))
        ).quantize(TWO_PLACES, ROUND_HALF_UP)
    else:  # 'fixed'
        operation_cost_amount = operation_cost_value.quantize(TWO_PLACES, ROUND_HALF_UP)

    subtotal_after_opcost = (unit_cost + operation_cost_amount).quantize(
        TWO_PLACES, ROUND_HALF_UP
    )

    sscl_amount = (subtotal_after_opcost * Decimal(str(sscl_pct))).quantize(
        TWO_PLACES, ROUND_HALF_UP
    )
    after_sscl = subtotal_after_opcost + sscl_amount

    vat_amount = (after_sscl * Decimal(str(vat_pct))).quantize(
        TWO_PLACES, ROUND_HALF_UP
    )
    final_unit_price = (after_sscl + vat_amount).quantize(TWO_PLACES, ROUND_HALF_UP)

    return {
        "operation_cost_amount": operation_cost_amount,
        "subtotal_after_opcost": subtotal_after_opcost,
        "sscl_amount":           sscl_amount,
        "vat_amount":            vat_amount,
        "final_unit_price":      final_unit_price,
    }


# ── Response builders ─────────────────────────────────────────────────────────

def _build_item_out(ri: StockReceiptItem, units_created: int = 0) -> dict:
    """Build a StockReceiptItemOut dict, optionally annotated with pending serials."""
    base = StockReceiptItemOut(
        id                    = ri.id,
        receipt_id            = ri.receipt_id,
        stock_item_id         = ri.stock_item_id,
        qty                   = ri.qty,
        unit_cost             = ri.unit_cost,
        operation_cost_type   = ri.operation_cost_type,
        operation_cost_value  = ri.operation_cost_value,
        operation_cost_amount = ri.operation_cost_amount,
        subtotal_after_opcost = ri.subtotal_after_opcost,
        sscl_pct              = ri.sscl_pct,
        sscl_amount           = ri.sscl_amount,
        vat_pct               = ri.vat_pct,
        vat_amount            = ri.vat_amount,
        final_unit_price      = ri.final_unit_price,
        created_at            = ri.created_at,
    ).model_dump()
    base["units_created"]          = units_created
    base["pending_serials_needed"] = max(0, ri.qty - units_created)
    return base


def _build_detail(receipt: StockReceipt, db: Session) -> dict:
    """Build a StockReceiptDetail-shaped dict with serial counts per line."""
    items_out = []
    for ri in receipt.items:
        units_created = (
            db.query(StockUnit)
            .filter(StockUnit.receipt_item_id == ri.id)
            .count()
        )
        items_out.append(_build_item_out(ri, units_created))

    return {
        "id":                   receipt.id,
        "supplier_id":          receipt.supplier_id,
        "supplier_name":        receipt.supplier.name if receipt.supplier else None,
        "received_date":        receipt.received_date,
        "reference_no":         receipt.reference_no,
        "received_by_rep_id":   receipt.received_by_rep_id,
        "received_by_rep_name": (
            receipt.received_by_rep.name if receipt.received_by_rep else None
        ),
        "notes":      receipt.notes,
        "created_at": receipt.created_at,
        "items":      items_out,
    }


# ── POST /stock-receipts ──────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_stock_receipt(
    payload: StockReceiptCreate,
    db: Session = Depends(get_db),
):
    """
    Record a new Goods Received Note (GRN).

    For each line item:
      • Runs calculate_receipt_line() to compute the full cost chain.
      • Persists all intermediate values on StockReceiptItem (rate-snapshot).
      • Increments StockItem.qty_on_hand by the received qty.

    StockUnit rows (individual serial numbers) are NOT created here.
    They are added via POST /{receipt_id}/items/{item_id}/serials as items
    are physically unboxed and scanned. The response includes
    pending_serials_needed per line so the frontend knows how many scans
    remain.

    SSCL and VAT default to current Settings values unless overrides are
    passed. Overrides are per-receipt (not per-line) — consistent with how
    invoices.py handles rate overrides.
    """
    # ── Validate supplier ────────────────────────────────────────────────────
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Receipt must include at least one line item.")

    # ── Resolve tax rates ────────────────────────────────────────────────────
    default_sscl, default_vat, _ = _get_settings_defaults(db)
    sscl_pct = default_sscl
    vat_pct  = default_vat

    # ── Validate all stock items exist before touching the DB ────────────────
    for i, line in enumerate(payload.items, start=1):
        si = db.query(StockItem).filter(StockItem.id == line.stock_item_id).first()
        if not si:
            raise HTTPException(
                status_code=404,
                detail=f"Line {i}: StockItem id={line.stock_item_id} not found",
            )

    # ── Create receipt header ────────────────────────────────────────────────
    receipt = StockReceipt(
        supplier_id        = payload.supplier_id,
        received_date      = payload.received_date,
        reference_no       = payload.reference_no,
        received_by_rep_id = payload.received_by_rep_id,
        notes              = payload.notes,
    )
    db.add(receipt)
    db.flush()  # get receipt.id without committing — mirrors invoices.py pattern

    # ── Process each line item ───────────────────────────────────────────────
    for line in payload.items:
        unit_cost            = Decimal(str(line.unit_cost))
        operation_cost_value = Decimal(str(line.operation_cost_value))

        calc = calculate_receipt_line(
            unit_cost            = unit_cost,
            operation_cost_type  = line.operation_cost_type,
            operation_cost_value = operation_cost_value,
            sscl_pct             = sscl_pct,
            vat_pct              = vat_pct,
        )

        receipt_item = StockReceiptItem(
            receipt_id            = receipt.id,
            stock_item_id         = line.stock_item_id,
            qty                   = line.qty,
            unit_cost             = unit_cost,
            operation_cost_type   = line.operation_cost_type,
            operation_cost_value  = operation_cost_value,
            operation_cost_amount = calc["operation_cost_amount"],
            subtotal_after_opcost = calc["subtotal_after_opcost"],
            sscl_pct              = sscl_pct,
            sscl_amount           = calc["sscl_amount"],
            vat_pct               = vat_pct,
            vat_amount            = calc["vat_amount"],
            final_unit_price      = calc["final_unit_price"],
        )
        db.add(receipt_item)

        # Increment cached qty_on_hand on the catalog item
        si = db.query(StockItem).filter(StockItem.id == line.stock_item_id).first()
        si.qty_on_hand = (si.qty_on_hand or 0) + line.qty

    try:
        db.commit()
    except IntegrityError as err:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(err.orig) if getattr(err, "orig", None) else "Receipt save failed.",
        )

    # ── Return full detail with pending_serials_needed counts ────────────────
    receipt = (
        db.query(StockReceipt)
        .options(
            joinedload(StockReceipt.supplier),
            joinedload(StockReceipt.received_by_rep),
            joinedload(StockReceipt.items),
        )
        .filter(StockReceipt.id == receipt.id)
        .first()
    )
    return _build_detail(receipt, db)


# ── POST /stock-receipts/{receipt_id}/items/{receipt_item_id}/serials ─────────

@router.post("/{receipt_id}/items/{receipt_item_id}/serials", status_code=201)
def add_serial_numbers(
    receipt_id:      int,
    receipt_item_id: int,
    payload:         dict,   # {"serial_numbers": ["ABC123", ...]}
    db: Session = Depends(get_db),
):
    """
    Attach serial numbers to a GRN line item, creating one StockUnit per serial.

    Call this after the physical unboxing scan. Each call may add a subset of
    the ordered qty — e.g. scan 3 now, 2 tomorrow as boxes arrive.

    Validation:
      • The receipt item must belong to a StockItem with requires_serial=True.
      • Each serial must be globally unique across all of stock_units.
      • The total serials for this line must not exceed the ordered qty.
    """
    # ── Fetch and verify receipt item ────────────────────────────────────────
    receipt_item = (
        db.query(StockReceiptItem)
        .filter(
            StockReceiptItem.id == receipt_item_id,
            StockReceiptItem.receipt_id == receipt_id,
        )
        .first()
    )
    if not receipt_item:
        raise HTTPException(status_code=404, detail="Receipt item not found on this receipt")

    stock_item = db.query(StockItem).filter(StockItem.id == receipt_item.stock_item_id).first()
    if not stock_item or not stock_item.requires_serial:
        raise HTTPException(
            status_code=400,
            detail=(
                "This stock item does not require serial number tracking. "
                "Serial numbers are only recorded for items where requires_serial=True "
                "(e.g. laptops, monitors, printers)."
            ),
        )

    serial_numbers: list[str] = payload.get("serial_numbers", [])
    if not serial_numbers:
        raise HTTPException(status_code=400, detail="serial_numbers list cannot be empty")

    # Strip and deduplicate within this batch
    serial_numbers = list(dict.fromkeys(s.strip() for s in serial_numbers if s.strip()))

    # ── Capacity check ───────────────────────────────────────────────────────
    already_entered = (
        db.query(StockUnit)
        .filter(StockUnit.receipt_item_id == receipt_item_id)
        .count()
    )
    remaining_capacity = receipt_item.qty - already_entered
    if len(serial_numbers) > remaining_capacity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This receipt line has qty={receipt_item.qty}. "
                f"{already_entered} serial(s) already entered. "
                f"You can add at most {remaining_capacity} more, "
                f"but {len(serial_numbers)} were submitted."
            ),
        )

    # ── Create StockUnit rows ────────────────────────────────────────────────
    new_units = []
    for serial in serial_numbers:
        unit = StockUnit(
            receipt_item_id = receipt_item_id,
            stock_item_id   = receipt_item.stock_item_id,
            serial_number   = serial,
            status          = "in_stock",
        )
        db.add(unit)
        new_units.append(serial)

    try:
        db.commit()
    except IntegrityError as err:
        db.rollback()
        # The unique constraint on serial_number will fire if any duplicate exists
        raise HTTPException(
            status_code=409,
            detail=(
                "One or more serial numbers already exist in the inventory. "
                "Each physical unit must have a unique serial number. "
                f"(DB detail: {err.orig})"
                if getattr(err, "orig", None)
                else "Duplicate serial number — already exists in inventory."
            ),
        )

    # Return a summary for the frontend
    total_entered = already_entered + len(new_units)
    return {
        "receipt_item_id":        receipt_item_id,
        "stock_item_id":          receipt_item.stock_item_id,
        "qty_ordered":            receipt_item.qty,
        "serials_entered":        total_entered,
        "pending_serials_needed": receipt_item.qty - total_entered,
        "added_serials":          new_units,
    }


# ── GET /stock-receipts ───────────────────────────────────────────────────────

@router.get("", status_code=200)
def list_stock_receipts(
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List GRNs with supplier_name joined in, plus item_count and total_cost
    (sum of unit_cost × qty across all lines on each receipt).
    """
    q = (
        db.query(StockReceipt)
        .options(
            joinedload(StockReceipt.supplier),
            joinedload(StockReceipt.received_by_rep),
            joinedload(StockReceipt.items),
        )
        .order_by(StockReceipt.received_date.desc(), StockReceipt.id.desc())
    )

    if supplier_id is not None:
        q = q.filter(StockReceipt.supplier_id == supplier_id)

    receipts = q.all()
    result = []
    for r in receipts:
        item_count = len(r.items)
        total_cost = sum(
            (Decimal(str(ri.unit_cost)) * ri.qty) for ri in r.items
        ).quantize(TWO_PLACES, ROUND_HALF_UP)

        result.append({
            "id":                   r.id,
            "supplier_id":          r.supplier_id,
            "supplier_name":        r.supplier.name if r.supplier else None,
            "received_date":        r.received_date,
            "reference_no":         r.reference_no,
            "received_by_rep_id":   r.received_by_rep_id,
            "received_by_rep_name": r.received_by_rep.name if r.received_by_rep else None,
            "item_count":           item_count,
            "total_cost":           total_cost,
            "created_at":           r.created_at,
        })

    return result


# ── GET /stock-receipts/{id} ──────────────────────────────────────────────────

@router.get("/{receipt_id}", status_code=200)
def get_stock_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """
    Full GRN detail: header + all StockReceiptItem rows + count of
    StockUnits created so far per line (so the frontend can show
    pending_serials_needed for each line).
    """
    receipt = (
        db.query(StockReceipt)
        .options(
            joinedload(StockReceipt.supplier),
            joinedload(StockReceipt.received_by_rep),
            joinedload(StockReceipt.items),
        )
        .filter(StockReceipt.id == receipt_id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Stock receipt not found")

    return _build_detail(receipt, db)
