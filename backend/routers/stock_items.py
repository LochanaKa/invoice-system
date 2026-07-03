"""routers/stock_items.py — CRUD for the stock item catalog

Provides list / get / create / update / soft-delete endpoints.
list_stock_items includes qty_on_hand and category_name (joined in),
mirroring the way list_customers joins route_name.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

from sqlalchemy import desc
from database import get_db
from models import StockItem, StockCategory, StockReceiptItem, StockReceipt
from schemas import StockItemCreate, StockItemUpdate, StockItemOut, StockReceiptItemOut

router = APIRouter(prefix="/stock-items", tags=["Stock Items"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _to_out(item: StockItem, latest_price: Optional[StockReceiptItem] = None) -> StockItemOut:
    """Convert a StockItem ORM row (with category eagerly loaded) to StockItemOut, including latest_price."""
    return StockItemOut(
        id              = item.id,
        category_id     = item.category_id,
        category_name   = item.category.name if item.category else None,
        brand           = item.brand,
        model           = item.model,
        description     = item.description,
        requires_serial = item.requires_serial,
        qty_on_hand     = item.qty_on_hand,
        reorder_level   = item.reorder_level,
        is_active       = item.is_active,
        created_at      = item.created_at,
        latest_price    = StockReceiptItemOut.model_validate(latest_price) if latest_price else None
    )


def _fetch_with_latest_price(db: Session, item_id: int):
    """Fetch one StockItem with its category and latest receipt price."""
    latest_receipt_items_sub = (
        db.query(
            StockReceiptItem.stock_item_id,
            StockReceiptItem.id.label("receipt_item_id")
        )
        .join(StockReceipt, StockReceipt.id == StockReceiptItem.receipt_id)
        .distinct(StockReceiptItem.stock_item_id)
        .order_by(
            StockReceiptItem.stock_item_id,
            desc(StockReceipt.received_date),
            desc(StockReceiptItem.id)
        )
        .subquery()
    )
    return (
        db.query(StockItem, StockReceiptItem)
        .options(joinedload(StockItem.category))
        .outerjoin(latest_receipt_items_sub, latest_receipt_items_sub.c.stock_item_id == StockItem.id)
        .outerjoin(StockReceiptItem, StockReceiptItem.id == latest_receipt_items_sub.c.receipt_item_id)
        .filter(StockItem.id == item_id)
        .first()
    )


# ── list ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[StockItemOut])
def list_stock_items(
    category_id:   Optional[int] = Query(None, description="Filter by category"),
    search:        Optional[str] = Query(None, description="Search by brand or model"),
    show_inactive: bool          = Query(False, description="Include inactive items"),
    db: Session = Depends(get_db),
):
    """Return catalog items, optionally filtered by category, search term, and active status.

    Response includes qty_on_hand, category_name, and latest_price.
    """
    latest_receipt_items_sub = (
        db.query(
            StockReceiptItem.stock_item_id,
            StockReceiptItem.id.label("receipt_item_id")
        )
        .join(StockReceipt, StockReceipt.id == StockReceiptItem.receipt_id)
        .distinct(StockReceiptItem.stock_item_id)
        .order_by(
            StockReceiptItem.stock_item_id,
            desc(StockReceipt.received_date),
            desc(StockReceiptItem.id)
        )
        .subquery()
    )

    q = (
        db.query(StockItem, StockReceiptItem)
        .options(joinedload(StockItem.category))
        .outerjoin(latest_receipt_items_sub, latest_receipt_items_sub.c.stock_item_id == StockItem.id)
        .outerjoin(StockReceiptItem, StockReceiptItem.id == latest_receipt_items_sub.c.receipt_item_id)
    )

    if not show_inactive:
        q = q.filter(StockItem.is_active == True)

    if category_id is not None:
        q = q.filter(StockItem.category_id == category_id)

    if search:
        term = f"%{search}%"
        q = q.filter(
            StockItem.brand.ilike(term) | StockItem.model.ilike(term)
        )

    items = q.order_by(StockItem.model).all()
    return [_to_out(item, receipt_item) for item, receipt_item in items]


# ── get one ──────────────────────────────────────────────────────────────────

@router.get("/{item_id}", response_model=StockItemOut)
def get_stock_item(item_id: int, db: Session = Depends(get_db)):
    """Return a single catalog item by ID."""
    res = _fetch_with_latest_price(db, item_id)
    if not res:
        raise HTTPException(status_code=404, detail="Stock item not found")
    item, latest_price = res
    return _to_out(item, latest_price)


# ── create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=StockItemOut, status_code=201)
def create_stock_item(payload: StockItemCreate, db: Session = Depends(get_db)):
    """Add a new product to the catalog."""
    # Verify the category exists
    category = db.query(StockCategory).filter(StockCategory.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Stock category id={payload.category_id} not found")

    item = StockItem(**payload.model_dump(), qty_on_hand=0)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A stock item with these details already exists.")

    db.refresh(item)
    res = _fetch_with_latest_price(db, item.id)
    if not res:
        raise HTTPException(status_code=404, detail="Stock item not found after creation")
    item, latest_price = res
    return _to_out(item, latest_price)


# ── update ───────────────────────────────────────────────────────────────────

@router.patch("/{item_id}", response_model=StockItemOut)
def update_stock_item(
    item_id: int,
    payload: StockItemUpdate,
    db: Session = Depends(get_db),
):
    """Partial update of a catalog item (e.g. adjust reorder_level, rename model)."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")

    updates = payload.model_dump(exclude_unset=True)

    # If category_id is being changed, verify the new category exists
    if "category_id" in updates:
        category = db.query(StockCategory).filter(StockCategory.id == updates["category_id"]).first()
        if not category:
            raise HTTPException(
                status_code=404,
                detail=f"Stock category id={updates['category_id']} not found",
            )

    for field, value in updates.items():
        setattr(item, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Update would create a duplicate stock item.")

    res = _fetch_with_latest_price(db, item_id)
    if not res:
        raise HTTPException(status_code=404, detail="Stock item not found after update")
    item, latest_price = res
    return _to_out(item, latest_price)


# ── soft-delete ──────────────────────────────────────────────────────────────

@router.delete("/{item_id}", status_code=204)
def delete_stock_item(item_id: int, db: Session = Depends(get_db)):
    """Soft-delete a catalog item by setting is_active = False."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")

    item.is_active = False
    db.commit()
    return None

