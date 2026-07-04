from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from auth import require_admin
from database import get_db
from models import RepairJob, StockUnit, StockUnitStatusHistory, User
from schemas import RepairJobHistoryOut, RepairJobUpdate

router = APIRouter(prefix="/repair-jobs", tags=["Repair Jobs"])


def _is_fixed_outcome(outcome: Optional[str]) -> bool:
    if outcome is None:
        return False
    outcome_text = str(outcome).strip().lower()
    return "fixed" in outcome_text or "repaired" in outcome_text


@router.patch("/{repair_job_id}", response_model=RepairJobHistoryOut)
def update_repair_job(
    repair_job_id: int,
    payload: RepairJobUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    job = (
        db.query(RepairJob)
        .options(joinedload(RepairJob.stock_unit))
        .filter(RepairJob.id == repair_job_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return RepairJobHistoryOut(
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

    if "outcome" in updates and (updates["outcome"] is None or str(updates["outcome"]).strip() == ""):
        raise HTTPException(status_code=400, detail="Please select a repair outcome.")
    if "date_returned" in updates and updates["date_returned"] is not None and job.date_sent is not None:
        if updates["date_returned"] < job.date_sent:
            raise HTTPException(status_code=400, detail="Date returned cannot be before date sent.")

    if "outcome" in updates:
        job.outcome = updates["outcome"]
    if "date_returned" in updates:
        job.date_returned = updates["date_returned"]
    if "amount_charged_by_technician" in updates:
        job.amount_charged_by_technician = updates["amount_charged_by_technician"]

    handled_by_rep_id = current_user.rep_id if current_user and getattr(current_user, "rep_id", None) else None

    if "outcome" in updates and job.stock_unit_id:
        unit = db.query(StockUnit).filter(StockUnit.id == job.stock_unit_id).first()
        if unit:
            if _is_fixed_outcome(updates.get("outcome")):
                unit.record_status_change(
                    db,
                    "in_stock",
                    note=f"Repair job #{job.id} marked as {updates.get('outcome')}",
                    changed_by_rep_id=handled_by_rep_id,
                )
            else:
                hist = StockUnitStatusHistory(
                    stock_unit_id=unit.id,
                    old_status=unit.status,
                    new_status=unit.status,
                    note=f"Repair job #{job.id} outcome updated to {updates.get('outcome')}",
                    changed_by_rep_id=handled_by_rep_id,
                )
                db.add(hist)

    try:
        db.commit()
        db.refresh(job)
        return RepairJobHistoryOut(
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
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{repair_job_id}")
def delete_repair_job(
    repair_job_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    job = db.query(RepairJob).filter(RepairJob.id == repair_job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found.")

    try:
        handled_by_rep_id = current_user.rep_id if current_user and getattr(current_user, "rep_id", None) else None
        if job.stock_unit_id:
            unit = db.query(StockUnit).filter(StockUnit.id == job.stock_unit_id).first()
            if unit and unit.status and str(unit.status).startswith("with_third_party_"):
                prior = (
                    db.query(StockUnitStatusHistory)
                    .filter(
                        StockUnitStatusHistory.stock_unit_id == unit.id,
                        StockUnitStatusHistory.new_status == unit.status,
                    )
                    .order_by(StockUnitStatusHistory.changed_at.desc())
                    .first()
                )
                revert_status = prior.old_status if prior and prior.old_status else "returned_pending_check"
                unit.record_status_change(
                    db,
                    revert_status,
                    note=f"Repair job #{job.id} deleted",
                    changed_by_rep_id=handled_by_rep_id,
                )

        db.delete(job)
        db.commit()
        return {"ok": True}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
