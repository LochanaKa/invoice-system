"""routers/stock_items.py — CRUD for the stock item catalog

Provides list / get / create / update / soft-delete endpoints.
list_stock_items includes qty_on_hand and category_name (joined in),
mirroring the way list_customers joins route_name.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

from database import get_db
from models import StockItem, StockCategory
from schemas import StockItemCreate, StockItemUpdate, StockItemOut

router = APIRouter(prefix="/stock-items", tags=["Stock Items"])


# ── helper ───────────────────────────────────────────────────────────────────

def _to_out(item: StockItem) -> StockItemOut:
    """Convert a StockItem ORM row (with category eagerly loaded) to StockItemOut."""
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
    )


def _fetch_with_category(db: Session, item_id: int) -> StockItem | None:
    """Fetch one StockItem with its category eagerly loaded."""
    return (
        db.query(StockItem)
        .options(joinedload(StockItem.category))
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

    Response includes qty_on_hand and category_name (joined from stock_categories),
    mirroring the pattern used in list_customers() which joins route_name.
    """
    q = db.query(StockItem).options(joinedload(StockItem.category))

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
    return [_to_out(i) for i in items]


# ── get one ──────────────────────────────────────────────────────────────────

@router.get("/{item_id}", response_model=StockItemOut)
def get_stock_item(item_id: int, db: Session = Depends(get_db)):
    """Return a single catalog item by ID."""
    item = _fetch_with_category(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    return _to_out(item)


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
    # Re-fetch with category join so category_name is populated in the response
    item = _fetch_with_category(db, item.id)
    return _to_out(item)


# ── update ───────────────────────────────────────────────────────────────────

@router.patch("/{item_id}", response_model=StockItemOut)
def update_stock_item(
    item_id: int,
    payload: StockItemUpdate,
    db: Session = Depends(get_db),
):
    """Partial update of a catalog item (e.g. adjust reorder_level, rename model)."""
    item = _fetch_with_category(db, item_id)
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

    # Re-fetch so the joined category reflects any category_id change
    item = _fetch_with_category(db, item_id)
    return _to_out(item)


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
