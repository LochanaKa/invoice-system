"""
routers/technicians.py — Technician directory + repair job history
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, desc
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import RepairJob, Technician
from schemas import (
    RepairJobHistoryOut,
    TechnicianCreate,
    TechnicianOut,
    TechnicianUpdate,
)

router = APIRouter(prefix="/technicians", tags=["Technicians"])


def _get_technician_or_404(technician_id: int, db: Session) -> Technician:
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found.")
    return technician


@router.get("", response_model=List[TechnicianOut])
def list_technicians(
    search: Optional[str] = Query(
        None,
        description="Search technicians by name or specialty",
    ),
    db: Session = Depends(get_db),
):
    query = db.query(Technician)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Technician.name.ilike(term),
                Technician.specialty.ilike(term),
            )
        )
    return query.order_by(Technician.name).all()


@router.get("/{technician_id}", response_model=TechnicianOut)
def get_technician(technician_id: int, db: Session = Depends(get_db)):
    return _get_technician_or_404(technician_id, db)


@router.post("", response_model=TechnicianOut, status_code=201)
def create_technician(payload: TechnicianCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    phone = payload.contact_phone.strip()
    email = (payload.contact_email or "").strip() or None
    specialty = (payload.specialty or "").strip() or None

    if not name:
        raise HTTPException(status_code=422, detail="Name is required.")
    if not phone:
        raise HTTPException(status_code=422, detail="Phone number is required.")

    technician = Technician(
        name=name,
        contact_phone=phone,
        contact_email=email,
        specialty=specialty,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(technician)
    db.commit()
    db.refresh(technician)
    return technician


@router.patch("/{technician_id}", response_model=TechnicianOut)
def update_technician(
    technician_id: int,
    payload: TechnicianUpdate,
    db: Session = Depends(get_db),
):
    technician = _get_technician_or_404(technician_id, db)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return technician

    if "name" in updates:
        if updates["name"] is None or not updates["name"].strip():
            raise HTTPException(status_code=422, detail="Name cannot be empty.")
        technician.name = updates["name"].strip()

    if "contact_phone" in updates:
        if updates["contact_phone"] is None or not updates["contact_phone"].strip():
            raise HTTPException(status_code=422, detail="Phone number cannot be empty.")
        technician.contact_phone = updates["contact_phone"].strip()

    if "contact_email" in updates:
        technician.contact_email = updates["contact_email"].strip() if updates["contact_email"] else None

    if "specialty" in updates:
        technician.specialty = updates["specialty"].strip() if updates["specialty"] else None

    if "is_active" in updates:
        technician.is_active = updates["is_active"]

    db.commit()
    db.refresh(technician)
    return technician


@router.patch("/{technician_id}/deactivate", response_model=TechnicianOut)
def deactivate_technician(technician_id: int, db: Session = Depends(get_db)):
    technician = _get_technician_or_404(technician_id, db)
    technician.is_active = False
    db.commit()
    db.refresh(technician)
    return technician


@router.get("/{technician_id}/repair-jobs", response_model=List[RepairJobHistoryOut])
def get_technician_repair_history(technician_id: int, db: Session = Depends(get_db)):
    _get_technician_or_404(technician_id, db)

    jobs = (
        db.query(RepairJob)
        .options(joinedload(RepairJob.stock_unit))
        .filter(RepairJob.technician_id == technician_id)
        .order_by(desc(RepairJob.date_sent), desc(RepairJob.id))
        .all()
    )

    return [
        RepairJobHistoryOut(
            id=job.id,
            stock_unit_id=job.stock_unit_id,
            stock_unit_serial_number=job.stock_unit.serial_number if job.stock_unit else None,
            date_sent=job.date_sent,
            date_returned=job.date_returned,
            amount_charged_by_technician=job.amount_charged_by_technician,
            outcome=job.outcome,
            linked_job_card_id=job.linked_job_card_id,
            created_at=job.created_at,
        )
        for job in jobs
    ]
