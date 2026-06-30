"""
routers/reps.py — Staff / Sales Representative management
"""

from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, desc, case
from typing import List

from database import get_db
from models import Rep, Invoice
from rep_codes import generate_next_rep_code
from schemas import (
    RepCreate, RepDetailOut, RepUpdate,
    RepPortfolioOut, RepPortfolioInvoiceOut, RepPortfolioInvoicePage,
)

router = APIRouter(prefix="/reps", tags=["Staff"])

TWO_PLACES = Decimal("0.01")


def _get_rep_or_404(rep_id: int, db: Session) -> Rep:
    rep = db.query(Rep).filter(Rep.id == rep_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    return rep


def _payment_status(grand_total: Decimal, credit_balance: Decimal) -> str:
    gt = Decimal(str(grand_total))
    cb = Decimal(str(credit_balance))
    if cb <= 0:
        return "Fully Paid"
    if cb >= gt:
        return "Unpaid"
    return "Partially Paid"


def _portfolio_metrics(rep_id: int, db: Session) -> dict:
    row = (
        db.query(
            func.count(Invoice.id).label("total_invoices"),
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total_sales"),
            func.coalesce(
                func.sum(
                    case((Invoice.credit_balance > 0, Invoice.credit_balance), else_=0)
                ),
                0,
            ).label("total_outstanding"),
        )
        .filter(Invoice.rep_id == rep_id)
        .one()
    )

    total_sales       = Decimal(str(row.total_sales))
    total_outstanding = Decimal(str(row.total_outstanding))
    collected         = (total_sales - total_outstanding).quantize(TWO_PLACES, ROUND_HALF_UP)

    if total_sales > 0:
        progress = (collected / total_sales * 100).quantize(TWO_PLACES, ROUND_HALF_UP)
    else:
        progress = Decimal("0.00")

    return {
        "total_invoices":          int(row.total_invoices or 0),
        "total_sales_generated":   total_sales,
        "total_outstanding":       total_outstanding,
        "collected_amount":        collected,
        "collection_progress_pct": progress,
    }


@router.get("", response_model=List[RepDetailOut])
def list_reps(db: Session = Depends(get_db)):
    """List all staff members (active and inactive) for Staff Management."""
    return db.query(Rep).order_by(Rep.code).all()


@router.get("/next-code")
def get_next_rep_code(db: Session = Depends(get_db)):
    """Preview the next auto-generated employee number for the Add Staff form."""
    return {"code": generate_next_rep_code(db)}


@router.get("/{rep_id}/portfolio", response_model=RepPortfolioOut)
def get_rep_portfolio(rep_id: int, db: Session = Depends(get_db)):
    """Aggregate portfolio KPIs for a single sales representative."""
    rep = _get_rep_or_404(rep_id, db)
    metrics = _portfolio_metrics(rep_id, db)
    return RepPortfolioOut(rep=rep, **metrics)


@router.get("/{rep_id}/invoices", response_model=RepPortfolioInvoicePage)
def list_rep_invoices(
    rep_id: int,
    limit:  int = Query(25, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Paginated list of invoices assigned to a specific representative."""
    _get_rep_or_404(rep_id, db)

    base_filter = Invoice.rep_id == rep_id

    total = (
        db.query(func.count(Invoice.id))
        .filter(base_filter)
        .scalar()
    ) or 0

    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(base_filter)
        .order_by(desc(Invoice.invoice_date), desc(Invoice.id))
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        RepPortfolioInvoiceOut(
            id             = inv.id,
            invoice_number = inv.invoice_number,
            invoice_date   = inv.invoice_date,
            customer_name  = inv.customer.name if inv.customer else None,
            grand_total    = inv.grand_total,
            credit_balance = inv.credit_balance,
            payment_status = _payment_status(inv.grand_total, inv.credit_balance),
        )
        for inv in invoices
    ]

    return RepPortfolioInvoicePage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=RepDetailOut, status_code=201)
def create_rep(payload: RepCreate, db: Session = Depends(get_db)):
    """Create a new staff member with an auto-generated CC-0000 employee number."""
    name = payload.name.strip()
    phone = payload.phone.strip()
    role = payload.role.strip() if payload.role else None

    if not name:
        raise HTTPException(status_code=422, detail="Name is required.")
    if not phone:
        raise HTTPException(status_code=422, detail="Phone number is required.")

    existing = db.query(Rep).filter(Rep.name.ilike(name)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Staff member '{name}' already exists (code={existing.code}).",
        )

    rep = Rep(
        name=name,
        phone=phone,
        role=role,
        code=generate_next_rep_code(db),
        is_active=True,
    )
    db.add(rep)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to create staff member — code conflict.")
    db.refresh(rep)
    return rep


@router.patch("/{rep_id}", response_model=RepDetailOut)
def update_rep(rep_id: int, payload: RepUpdate, db: Session = Depends(get_db)):
    """Update staff name, phone, or role (employee number is fixed)."""
    rep = _get_rep_or_404(rep_id, db)

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return rep

    if "name" in updates and updates["name"] is not None:
        name = updates["name"].strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be empty.")
        clash = (
            db.query(Rep)
            .filter(Rep.name.ilike(name), Rep.id != rep_id)
            .first()
        )
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f"Staff member '{name}' already exists (code={clash.code}).",
            )
        rep.name = name

    if "phone" in updates:
        rep.phone = updates["phone"].strip() if updates["phone"] else None

    if "role" in updates:
        rep.role = updates["role"].strip() if updates["role"] else None

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Failed to update staff member.")
    db.refresh(rep)
    return rep


@router.patch("/{rep_id}/deactivate", response_model=RepDetailOut)
def deactivate_rep(rep_id: int, db: Session = Depends(get_db)):
    """Soft-deactivate staff (preserves invoice history linked via rep_id)."""
    rep = _get_rep_or_404(rep_id, db)
    rep.is_active = False
    db.commit()
    db.refresh(rep)
    return rep


@router.patch("/{rep_id}/reactivate", response_model=RepDetailOut)
def reactivate_rep(rep_id: int, db: Session = Depends(get_db)):
    """Reactivate a previously deactivated staff member."""
    rep = _get_rep_or_404(rep_id, db)
    rep.is_active = True
    db.commit()
    db.refresh(rep)
    return rep
