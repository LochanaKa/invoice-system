from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from decimal import Decimal
from datetime import date
from typing import List, Optional

from database import get_db
from models import Supplier, ProductCatalog, GRNReceipt, InventoryItem, InventoryItemStatus, RateSetting
from schemas import GRNCreate, GRNResponse, SupplierOut, ProductCatalogOut
from auth import get_current_user
from models import User

router = APIRouter(prefix="/inventory", tags=["Inventory & GRN"])


# ── Defaults (safety net only — real values come from rate_settings table) ─────
FALLBACK_SSCL_RATE = Decimal("0.025")  # 2.5%
FALLBACK_VAT_RATE  = Decimal("0.18")   # 18%


def _fetch_tax_rates(db: Session) -> tuple[Decimal, Decimal]:
    """
    Query the rate_settings table for 'sscl_pct' and 'vat_pct'.
    Falls back to hardcoded defaults only if a rate row is completely missing,
    so the system cannot accidentally use wrong rates after an admin update.
    """
    rows = (
        db.query(RateSetting)
        .filter(RateSetting.key.in_(["sscl_pct", "vat_pct"]))
        .all()
    )
    rate_map = {r.key: Decimal(str(r.rate)) for r in rows}

    sscl_rate = rate_map.get("sscl_pct", FALLBACK_SSCL_RATE)
    vat_rate  = rate_map.get("vat_pct",  FALLBACK_VAT_RATE)
    return sscl_rate, vat_rate


def calculate_final_price(
    purchase_cost: Decimal,
    operation_cost: Decimal,
    profit_margin_pct: Decimal,
    is_custom_override: bool,
    custom_price: Optional[Decimal],
    sscl_rate: Decimal,
    vat_rate: Decimal,
) -> dict:
    """
    Compute the final selling price using Sri Lankan tax math.
    Rates are injected as parameters — never hardcoded — so government
    policy changes only need a single DB update, not a code deployment.

    Formula:
        Base Value       = purchase_cost + operation_cost
        Profit Value     = Base Value * (profit_margin_pct / 100)
        After Margin     = Base Value + Profit Value
        SSCL             = After Margin * sscl_rate
        VAT              = (After Margin + SSCL) * vat_rate
        Final Price      = After Margin + SSCL + VAT

    Returns a dict with all breakdown components for per-unit DB snapshot.
    If is_custom_override is True, bypass the math and return custom_price
    with zero tax breakdown (packaged deal — operator sets final price).
    """
    TWO = Decimal("0.01")

    if is_custom_override:
        return {
            "profit_margin_value": Decimal("0.00"),
            "sscl_amount":         Decimal("0.00"),
            "vat_amount":          Decimal("0.00"),
            "final_selling_price": (custom_price or Decimal("0.00")).quantize(TWO),
        }

    base_value        = purchase_cost + operation_cost
    profit_value      = (base_value * (profit_margin_pct / Decimal("100.0"))).quantize(TWO)
    value_after_margin = base_value + profit_value
    sscl_amount       = (value_after_margin * sscl_rate).quantize(TWO)
    vat_amount        = ((value_after_margin + sscl_amount) * vat_rate).quantize(TWO)
    final_price       = (value_after_margin + sscl_amount + vat_amount).quantize(TWO)

    return {
        "profit_margin_value": profit_value,
        "sscl_amount":         sscl_amount,
        "vat_amount":          vat_amount,
        "final_selling_price": final_price,
    }


@router.post("/grn", response_model=GRNResponse, status_code=status.HTTP_201_CREATED)
def create_grn(payload: GRNCreate, db: Session = Depends(get_db)):
    """
    Process an incoming Goods Receipt Note (GRN) and insert physical inventory items.
    Tax rates (SSCL, VAT) are fetched fresh from the `rate_settings` table at request
    time, so admin changes take effect on the very next GRN without a restart.
    The entire operation runs in one transaction — a single failure rolls everything back.
    """
    # ── Step 0: fetch current live tax rates ─────────────────────────────────
    sscl_rate, vat_rate = _fetch_tax_rates(db)

    # ── Step 1: verify supplier ───────────────────────────────────────────────
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {payload.supplier_id} not found."
        )

    # ── Step 2: duplicate GRN number guard ────────────────────────────────────
    if db.query(GRNReceipt).filter(GRNReceipt.grn_number == payload.grn_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GRN number '{payload.grn_number}' already exists."
        )

    total_grn_cost = Decimal("0.00")
    items_to_insert: list[InventoryItem] = []

    # ── Step 3: validate & price each line item ───────────────────────────────
    for item in payload.received_items:
        product = db.query(ProductCatalog).filter(ProductCatalog.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} not found in catalog."
            )

        if not item.serial_numbers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product ID {item.product_id}: serial_numbers list cannot be empty "
                       f"(use null entries for bulk unserialized stock)."
            )

        if product.is_serialized:
            for s_num in item.serial_numbers:
                if not s_num or not s_num.strip():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Product '{product.brand} {product.model}' is serialized — "
                               f"every entry in serial_numbers must be a non-empty string."
                    )

        # Calculate all price components using live rates
        pricing = calculate_final_price(
            purchase_cost=item.purchase_cost,
            operation_cost=item.ops_cost,
            profit_margin_pct=item.margin,
            is_custom_override=item.is_custom_override,
            custom_price=item.custom_price_override,
            sscl_rate=sscl_rate,
            vat_rate=vat_rate,
        )

        for raw_serial in item.serial_numbers:
            serial = raw_serial.strip() if raw_serial else None

            # Pre-flight uniqueness check (DB unique constraint is the final guard)
            if serial and db.query(InventoryItem).filter(
                InventoryItem.serial_number == serial
            ).first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Serial number '{serial}' already exists in inventory."
                )

            items_to_insert.append(InventoryItem(
                product_id=item.product_id,
                serial_number=serial,
                purchase_cost=item.purchase_cost,
                operation_cost=item.ops_cost,
                profit_margin_value=pricing["profit_margin_value"],
                sscl_amount=pricing["sscl_amount"],
                vat_amount=pricing["vat_amount"],
                final_selling_price=pricing["final_selling_price"],
                status=InventoryItemStatus.IN_STOCK,
            ))
            total_grn_cost += item.purchase_cost

    # ── Step 4: persist atomically ────────────────────────────────────────────
    try:
        received_date = payload.received_date or date.today()
        grn = GRNReceipt(
            grn_number=payload.grn_number.strip(),
            supplier_id=payload.supplier_id,
            received_date=received_date,
            total_cost=total_grn_cost,
        )
        db.add(grn)
        db.flush()  # generates grn.id needed for FK

        for inv_item in items_to_insert:
            inv_item.grn_id = grn.id
            db.add(inv_item)

        db.commit()
        db.refresh(grn)
        return grn

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database integrity error — check for duplicate serial numbers. "
                   f"Detail: {str(e.orig)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during GRN intake: {str(e)}"
        )


# ── Lookup endpoints ──────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    """List all active suppliers."""
    return (
        db.query(Supplier)
        .filter(Supplier.is_active == True)
        .order_by(Supplier.name)
        .all()
    )


@router.get("/products", response_model=List[ProductCatalogOut])
def list_products(db: Session = Depends(get_db)):
    """List all products in the catalog."""
    return (
        db.query(ProductCatalog)
        .order_by(ProductCatalog.category, ProductCatalog.brand, ProductCatalog.model)
        .all()
    )
