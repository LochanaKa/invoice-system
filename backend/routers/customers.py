"""
routers/customers.py — Customer API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

from database import get_db
from models import Customer, Invoice, Route
from schemas import CustomerCreate, CustomerOut, CustomerSummary, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=List[CustomerOut])
def list_customers(
    search:           Optional[str]  = Query(None, description="Search by name"),
    is_vat_registered:Optional[bool] = Query(None),
    route_id:         Optional[int]  = Query(None),
    show_inactive:    bool           = Query(False, description="Include inactive accounts"),
    db: Session = Depends(get_db)
):
    q = db.query(Customer).options(joinedload(Customer.route))

    if not show_inactive:
        q = q.filter(Customer.is_active == True)

    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%"))
    if is_vat_registered is not None:
        q = q.filter(Customer.is_vat_registered == is_vat_registered)
    if route_id:
        q = q.filter(Customer.route_id == route_id)

    customers = q.order_by(Customer.name).all()

    return [
        CustomerOut(
            id                = c.id,
            name              = c.name,
            tin               = c.tin,
            is_vat_registered = c.is_vat_registered,
            is_active         = c.is_active,
            route_id          = c.route_id,
            route_name        = c.route.name if c.route else None,
            phone             = c.phone,
            address           = c.address,
        )
        for c in customers
    ]


@router.get("/{customer_id}", response_model=CustomerSummary)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get one customer with aggregated invoice stats."""
    c = (db.query(Customer)
           .options(joinedload(Customer.route))
           .filter(Customer.id == customer_id)
           .first())

    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Aggregate invoice stats in one query
    stats = (db.query(
                 func.count(Invoice.id).label("total_invoices"),
                 func.coalesce(func.sum(Invoice.amount), 0).label("total_sales"),
                 func.coalesce(func.sum(Invoice.credit_balance), 0).label("outstanding")
             )
             .filter(Invoice.customer_id == customer_id,
                     Invoice.service_type == "SALE")
             .first())

    return CustomerSummary(
        id                  = c.id,
        name                = c.name,
        tin                 = c.tin,
        is_vat_registered   = c.is_vat_registered,
        is_active           = c.is_active,
        route_id            = c.route_id,
        route_name          = c.route.name if c.route else None,
        phone               = c.phone,
        address             = c.address,
        total_invoices      = stats.total_invoices or 0,
        total_sales         = stats.total_sales or 0,
        outstanding_credit  = stats.outstanding or 0,
    )


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer."""
    existing = db.query(Customer).filter(Customer.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Customer '{payload.name}' already exists (id={existing.id})"
        )

    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A customer named '{payload.name}' already exists.")
    db.refresh(customer)
    # Build CustomerOut directly to avoid session issues
    customer = (db.query(Customer)
                  .options(joinedload(Customer.route))
                  .filter(Customer.id == customer.id)
                  .first())
    return CustomerOut(
        id                = customer.id,
        name              = customer.name,
        tin               = customer.tin,
        is_vat_registered = customer.is_vat_registered,
        is_active         = customer.is_active,
        route_id          = customer.route_id,
        route_name        = customer.route.name if customer.route else None,
        phone             = customer.phone,
        address           = customer.address,
    )


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db)
):
    """Update customer details (e.g. add TIN after IRD registration)."""
    c = (db.query(Customer)
           .options(joinedload(Customer.route))
           .filter(Customer.id == customer_id)
           .first())
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        new_name = payload.model_dump(exclude_unset=True).get("name", "")
        raise HTTPException(
            status_code=409,
            detail=f"A customer named '{new_name}' already exists. Please use a different name."
        )

    db.refresh(c)

    # Re-fetch with route join so route_name is populated
    c = (db.query(Customer)
           .options(joinedload(Customer.route))
           .filter(Customer.id == customer_id)
           .first())

    return CustomerOut(
        id                = c.id,
        name              = c.name,
        tin               = c.tin,
        is_vat_registered = c.is_vat_registered,
        is_active         = c.is_active,
        route_id          = c.route_id,
        route_name        = c.route.name if c.route else None,
        phone             = c.phone,
        address           = c.address,
    )


@router.patch("/{customer_id}/reactivate", response_model=CustomerOut)
def reactivate_customer(customer_id: int, db: Session = Depends(get_db)):
    """Reactivate a soft-deleted customer."""
    c = (db.query(Customer)
           .options(joinedload(Customer.route))
           .filter(Customer.id == customer_id)
           .first())
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    c.is_active = True
    db.commit()
    db.refresh(c)

    c = (db.query(Customer)
           .options(joinedload(Customer.route))
           .filter(Customer.id == customer_id)
           .first())

    return CustomerOut(
        id                = c.id,
        name              = c.name,
        tin               = c.tin,
        is_vat_registered = c.is_vat_registered,
        is_active         = c.is_active,
        route_id          = c.route_id,
        route_name        = c.route.name if c.route else None,
        phone             = c.phone,
        address           = c.address,
    )


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """Soft-delete a customer by setting is_active = False."""
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    c.is_active = False
    db.commit()
    return None
