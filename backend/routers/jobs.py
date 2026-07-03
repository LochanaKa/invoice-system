from datetime import date
import calendar

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
from models import InvoiceItem, JobCard, Rep, StockUnit, RepairJob
from schemas import JobCardCreate, JobCardResponse, JobCardUpdate
from schemas import JobActionIn
from warranty_utils import evaluate_job_card_warranty

router = APIRouter(prefix="/jobs", tags=["Job Cards"])


@router.get("", response_model=List[JobCardResponse])
def list_job_cards(db: Session = Depends(get_db)):
    cards = db.query(JobCard).order_by(JobCard.created_at.desc()).all()
    return cards


@router.get("/{job_card_id}", response_model=JobCardResponse)
def get_job_card(job_card_id: int, db: Session = Depends(get_db)):
    card = db.query(JobCard).options(joinedload(JobCard.repair_jobs)).filter(JobCard.id == job_card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found.")
    return card


def _add_months(start_date: date, months: int) -> date:
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


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
        linked_sales_invoice_id=payload.linked_sales_invoice_id,
        device_source=payload.device_source,
    )

    if payload.device_source in {"CUSTOMER_OWNED", "NEW_CUSTOMER"}:
        card.job_type = "PAID_REPAIR"

    if payload.device_source == "OLD_CUSTOMER":
        if payload.stock_unit_id is None:
            raise HTTPException(status_code=400, detail="stock_unit_id is required when device_source is OLD_CUSTOMER.")

        unit = db.query(StockUnit).filter(StockUnit.id == payload.stock_unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Selected stock unit was not found.")

        # Accept units regardless of current `status` for job-card creation.
        # The frontend will call the lookup with `allow_any_status=true` so
        # the UI can select sold/returned units. Do not block here by status.

        if payload.serial_number and payload.serial_number.strip() and payload.serial_number.strip() != unit.serial_number:
            raise HTTPException(status_code=400, detail="Serial number does not match the selected stock unit.")

        sold_item = None
        if unit.sold_invoice_item_id is not None:
            sold_item = db.query(InvoiceItem).filter(InvoiceItem.id == unit.sold_invoice_item_id).first()

        warranty_result = evaluate_job_card_warranty(unit, sold_item, today=date.today())
        card.job_type = warranty_result["job_type"]
        new_status = warranty_result["new_status"]

        card.stock_unit_id = unit.id
        card.serial_number = unit.serial_number
        unit.record_status_change(
            db,
            new_status,
            note="Moved to internal repair workflow from job card creation",
            changed_by_rep_id=payload.received_by_staff_id,
        )

    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.post("/{job_card_id}/action", response_model=JobCardResponse)
def job_card_action(job_card_id: int, payload: JobActionIn, db: Session = Depends(get_db)):
    card = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found.")

    action = (payload.action or "").lower()

    # helper to load the associated stock unit when needed
    unit = None
    if action in ("send_manufacturer", "send_internal_warranty", "send_third_party_warranty", "replace_under_warranty", "send_internal_paid", "send_third_party_paid"):
        if not card.stock_unit_id:
            raise HTTPException(status_code=400, detail="This action requires a linked stock unit.")
        unit = db.query(StockUnit).filter(StockUnit.id == card.stock_unit_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Associated stock unit not found.")

    # Map actions to new stock unit statuses and behaviors
    try:
        if action == "send_manufacturer":
            # Manufacturer path — no RepairJob record required here
            unit.record_status_change(db, "with_manufacturer", note=f"Sent to manufacturer (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            card.status = "IN_PROGRESS"

        elif action == "send_internal_warranty":
            unit.record_status_change(db, "with_internal_team_warranty", note=f"Sent to internal warranty team (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            # create a RepairJob entry if technician provided
            if payload.technician_id:
                rj = RepairJob(stock_unit_id=unit.id, technician_id=payload.technician_id, date_sent=payload.date_sent or date.today(), amount_charged_by_technician=payload.amount_charged_by_technician, outcome="pending", linked_job_card_id=card.id)
                db.add(rj)
            card.status = "IN_PROGRESS"

        elif action == "send_third_party_warranty":
            unit.record_status_change(db, "with_third_party_warranty", note=f"Sent to third-party warranty (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            if payload.technician_id:
                rj = RepairJob(stock_unit_id=unit.id, technician_id=payload.technician_id, date_sent=payload.date_sent or date.today(), amount_charged_by_technician=payload.amount_charged_by_technician, outcome="pending", linked_job_card_id=card.id)
                db.add(rj)
            card.status = "IN_PROGRESS"

        elif action == "replace_under_warranty":
            unit.record_status_change(db, "warranty_replaced", note=f"Replaced under warranty (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            card.status = "COMPLETED"

        elif action == "send_internal_paid":
            unit.record_status_change(db, "with_internal_team_paid", note=f"Sent to internal paid repair (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            if not payload.technician_id:
                raise HTTPException(status_code=422, detail="technician_id is required for internal paid repair assignments")
            rj = RepairJob(stock_unit_id=unit.id, technician_id=payload.technician_id, date_sent=payload.date_sent or date.today(), amount_charged_by_technician=payload.amount_charged_by_technician, outcome="pending", linked_job_card_id=card.id)
            db.add(rj)
            card.status = "IN_PROGRESS"

        elif action == "send_third_party_paid":
            unit.record_status_change(db, "with_third_party_paid", note=f"Sent to third-party paid repair (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            if not payload.technician_id:
                raise HTTPException(status_code=422, detail="technician_id is required for third-party paid repair assignments")
            rj = RepairJob(stock_unit_id=unit.id, technician_id=payload.technician_id, date_sent=payload.date_sent or date.today(), amount_charged_by_technician=payload.amount_charged_by_technician, outcome="pending", linked_job_card_id=card.id)
            db.add(rj)
            card.status = "IN_PROGRESS"

        elif action == "mark_fixed":
            # Enforce invoice rule: PAID_REPAIR requires an invoice before marking fixed
            if card.job_type == "PAID_REPAIR" and not card.linked_sales_invoice_id:
                raise HTTPException(status_code=409, detail="Paid repairs must be invoiced (link a repair invoice) before marking as fixed.")
            # Update stock unit status to repaired_awaiting_pickup if present
            if unit:
                unit.record_status_change(db, "repaired_awaiting_pickup", note=f"Marked fixed (job #{card.id})", changed_by_rep_id=card.assigned_to_staff_id or card.received_by_staff_id)
            card.status = "READY_FOR_PICKUP"

        else:
            raise HTTPException(status_code=400, detail="Unknown action")

        db.commit()
        db.refresh(card)
        return card

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


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
    if "linked_sales_invoice_id" in payload.model_fields_set:
        card.linked_sales_invoice_id = payload.linked_sales_invoice_id

    db.commit()
    db.refresh(card)
    return card


def _clear_linked_repair_jobs(db: Session, job_card_id: int) -> int:
    return db.query(RepairJob).filter(RepairJob.linked_job_card_id == job_card_id).update(
        {"linked_job_card_id": None}, synchronize_session=False
    )


@router.delete("/{job_card_id}", status_code=204)
def delete_job_card(job_card_id: int, db: Session = Depends(get_db)):
    card = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found.")

    _clear_linked_repair_jobs(db, job_card_id)
    db.delete(card)
    db.commit()
    return None
