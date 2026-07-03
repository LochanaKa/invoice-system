from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import StockUnit
from auth import require_admin

router = APIRouter(tags=["Debug"], dependencies=[Depends(require_admin)])


@router.get("/debug/stock-units/serial/{serial}")
def debug_lookup_serial(serial: str, db: Session = Depends(get_db)):
    """Return any stock_unit rows that match the given serial (case-insensitive, partial).

    Admin-only helper for troubleshooting lookup failures.
    """
    clean = (serial or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="serial cannot be empty")

    rows = (
        db.query(StockUnit.id, StockUnit.serial_number, StockUnit.status, StockUnit.stock_item_id)
        .filter(StockUnit.serial_number.ilike(f"%{clean}%"))
        .order_by(StockUnit.serial_number)
        .limit(50)
        .all()
    )

    return {"count": len(rows), "matches": [dict(id=r[0], serial_number=r[1], status=r[2], stock_item_id=r[3]) for r in rows]}
