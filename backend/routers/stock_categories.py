"""routers/stock_categories.py — CRUD for stock product categories

Mirrors routers/routes.py exactly in style (same minimal shape).
If a category with the same name already exists, the create endpoint
reactivates it instead of 409-ing — identical to create_route().
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import StockCategory
from schemas import StockCategoryCreate, StockCategoryOut

router = APIRouter(prefix="/stock-categories", tags=["Stock Categories"])


@router.get("", response_model=List[StockCategoryOut])
def list_stock_categories(db: Session = Depends(get_db)):
    """Return all active stock categories ordered by name."""
    rows = (
        db.query(StockCategory)
        .filter(StockCategory.is_active == True)
        .order_by(StockCategory.name)
        .all()
    )
    return [StockCategoryOut.model_validate(r) for r in rows]


@router.post("", response_model=StockCategoryOut, status_code=201)
def create_stock_category(payload: StockCategoryCreate, db: Session = Depends(get_db)):
    """Create a stock category, or reactivate it if the name already exists."""
    name = payload.name.strip()
    existing = db.query(StockCategory).filter(StockCategory.name == name).first()

    if existing:
        # Reactivate soft-deleted category — same pattern as create_route()
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return StockCategoryOut.model_validate(existing)

    category = StockCategory(name=name, is_active=True)
    db.add(category)
    db.commit()
    db.refresh(category)
    return StockCategoryOut.model_validate(category)
