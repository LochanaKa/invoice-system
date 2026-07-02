from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import JobCard, Rep
from schemas import JobCardCreate, JobCardResponse, JobCardUpdate

router = APIRouter(prefix="/jobs", tags=["Job Cards"])


@router.get("", response_model=List[JobCardResponse])
def list_job_cards(db: Session = Depends(get_db)):
    cards = db.query(JobCard).order_by(JobCard.created_at.desc()).all()
    return cards


@router.get("/{job_card_id}", response_model=JobCardResponse)
def get_job_card(job_card_id: int, db: Session = Depends(get_db)):
    card = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found.")

    staff = db.query(Rep).filter(Rep.id == card.received_by_staff_id).first()
    assigned_staff = db.query(Rep).filter(Rep.id == card.assigned_to_staff_id).first() if card.assigned_to_staff_id else None
    return JobCardResponse(
        id=card.id,
        customer_name=card.customer_name,
        customer_phone=card.customer_phone,
        device_name=card.device_name,
        issue_description=card.issue_description,
        received_by_staff_id=card.received_by_staff_id,
        received_by_staff_name=staff.name if staff else None,
        assigned_to_staff_id=card.assigned_to_staff_id,
        assigned_to_staff_name=assigned_staff.name if assigned_staff else None,
        priority=card.priority,
        due_date=card.due_date,
        paper_grn_reference=card.paper_grn_reference,
        intake_method=card.intake_method,
        status=card.status,
        notes=card.notes,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


@router.post("", response_model=JobCardResponse, status_code=201)
def create_job_card(payload: JobCardCreate, db: Session = Depends(get_db)):
    staff = db.query(Rep).filter(Rep.id == payload.received_by_staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Selected staff member was not found.")

    if payload.assigned_to_staff_id is not None:
        assigned_staff = db.query(Rep).filter(Rep.id == payload.assigned_to_staff_id).first()
        if not assigned_staff:
            raise HTTPException(status_code=404, detail="Assigned staff member was not found.")

    card = JobCard(
        customer_name=payload.customer_name.strip(),
        customer_phone=(payload.customer_phone or "").strip() or None,
        device_name=payload.device_name.strip(),
        issue_description=payload.issue_description.strip(),
        received_by_staff_id=payload.received_by_staff_id,
        assigned_to_staff_id=payload.assigned_to_staff_id,
        priority=payload.priority.upper() if payload.priority else "NORMAL",
        due_date=payload.due_date,
        serial_number=(payload.serial_number or "").strip() or None,
        paper_grn_reference=(payload.paper_grn_reference or "").strip() or None,
        intake_method=payload.intake_method,
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    assigned_staff = db.query(Rep).filter(Rep.id == card.assigned_to_staff_id).first() if card.assigned_to_staff_id else None
    return JobCardResponse(
        id=card.id,
        customer_name=card.customer_name,
        customer_phone=card.customer_phone,
        device_name=card.device_name,
        issue_description=card.issue_description,
        received_by_staff_id=card.received_by_staff_id,
        received_by_staff_name=staff.name,
        assigned_to_staff_id=card.assigned_to_staff_id,
        assigned_to_staff_name=assigned_staff.name if assigned_staff else None,
        priority=card.priority,
        due_date=card.due_date,
        paper_grn_reference=card.paper_grn_reference,
        intake_method=card.intake_method,
        status=card.status,
        notes=card.notes,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


@router.patch("/{job_card_id}", response_model=JobCardResponse)
def update_job_card(job_card_id: int, payload: JobCardUpdate, db: Session = Depends(get_db)):
    card = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found.")

    if "customer_phone" in payload.model_fields_set:
        card.customer_phone = (payload.customer_phone or "").strip() or None
    if payload.status is not None:
        card.status = payload.status.upper()
    if payload.notes is not None:
        card.notes = payload.notes.strip() or None
    if payload.assigned_to_staff_id is not None:
        card.assigned_to_staff_id = payload.assigned_to_staff_id
    if payload.priority is not None:
        card.priority = payload.priority.upper()
    if "due_date" in payload.model_fields_set:
        card.due_date = payload.due_date
    if "serial_number" in payload.model_fields_set:
        card.serial_number = (payload.serial_number or "").strip() or None

    db.commit()
    db.refresh(card)

    staff = db.query(Rep).filter(Rep.id == card.received_by_staff_id).first()
    assigned_staff = db.query(Rep).filter(Rep.id == card.assigned_to_staff_id).first() if card.assigned_to_staff_id else None
    return JobCardResponse(
        id=card.id,
        customer_name=card.customer_name,
        customer_phone=card.customer_phone,
        device_name=card.device_name,
        issue_description=card.issue_description,
        received_by_staff_id=card.received_by_staff_id,
        received_by_staff_name=staff.name if staff else None,
        assigned_to_staff_id=card.assigned_to_staff_id,
        assigned_to_staff_name=assigned_staff.name if assigned_staff else None,
        priority=card.priority,
        due_date=card.due_date,
        paper_grn_reference=card.paper_grn_reference,
        intake_method=card.intake_method,
        status=card.status,
        notes=card.notes,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )
