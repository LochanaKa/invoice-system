"""routers/suppliers.py — CRUD for stock suppliers

Provides list / get / create / update / soft-delete endpoints.
Style mirrors routers/customers.py exactly.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

from database import get_db
from models import Supplier
from schemas import SupplierCreate, SupplierUpdate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _to_out(s: Supplier) -> SupplierOut:
    """Convert a Supplier ORM row to its Pydantic out schema."""
    return SupplierOut(
        id             = s.id,
        name           = s.name,
        contact_person = s.contact_person,
        phone          = s.phone,
        email          = s.email,
        address        = s.address,
        notes          = s.notes,
        is_active      = s.is_active,
        created_at     = s.created_at,
    )


# ── list ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SupplierOut])
def list_suppliers(
    search:        Optional[str] = Query(None, description="Search by supplier name"),
    show_inactive: bool          = Query(False, description="Include inactive suppliers"),
    db: Session = Depends(get_db),
):
    """Return all suppliers, optionally filtered by name and active status."""
    q = db.query(Supplier)

    if not show_inactive:
        q = q.filter(Supplier.is_active == True)

    if search:
        q = q.filter(Supplier.name.ilike(f"%{search}%"))

    return [_to_out(s) for s in q.order_by(Supplier.name).all()]


# ── get one ──────────────────────────────────────────────────────────────────

@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Return a single supplier by ID."""
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _to_out(s)


# ── create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=SupplierOut, status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    """Create a new supplier."""
    name = payload.name.strip()

    existing = db.query(Supplier).filter(Supplier.name == name).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Supplier '{name}' already exists (id={existing.id})",
        )

    supplier = Supplier(**{**payload.model_dump(), "name": name})
    db.add(supplier)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A supplier named '{name}' already exists.")

    db.refresh(supplier)
    return _to_out(supplier)


# ── update ───────────────────────────────────────────────────────────────────

@router.patch("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
):
    """Partial update of a supplier record."""
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        new_name = payload.model_dump(exclude_unset=True).get("name", "")
        raise HTTPException(
            status_code=409,
            detail=f"A supplier named '{new_name}' already exists. Please use a different name.",
        )

    db.refresh(s)
    return _to_out(s)


# ── soft-delete ──────────────────────────────────────────────────────────────

@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Soft-delete a supplier by setting is_active = False."""
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    s.is_active = False
    db.commit()
    return None
