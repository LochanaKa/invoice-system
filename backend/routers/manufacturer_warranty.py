from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_

from database import get_db
from auth import require_admin
from models import ManufacturerWarrantyClaim, StockUnit, StockItem, StockUnitStatusHistory, User, ManufacturerWarrantyClaimHistory, RepairJob
from models import Supplier
from schemas import ManufacturerWarrantyClaimOut, ManufacturerWarrantyClaimPage, ManufacturerWarrantyClaimUpdate
from schemas import ManufacturerWarrantyClaimHistoryOut

router = APIRouter(prefix="/manufacturer-warranty-claims", tags=["Manufacturer Warranty Claims"]) 


@router.get("", response_model=ManufacturerWarrantyClaimPage)
def list_manufacturer_claims(
    outcome: Optional[str] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    base_query = db.query(ManufacturerWarrantyClaim)
    if outcome:
        base_query = base_query.filter(ManufacturerWarrantyClaim.outcome == outcome)
    if search:
        term = f"%{search.strip()}%"
        base_query = base_query.filter(
            or_(
                ManufacturerWarrantyClaim.stock_unit.has(StockUnit.serial_number.ilike(term)),
                ManufacturerWarrantyClaim.stock_unit.has(StockUnit.stock_item.has(StockItem.brand.ilike(term))),
                ManufacturerWarrantyClaim.stock_unit.has(StockUnit.stock_item.has(StockItem.model.ilike(term))),
                ManufacturerWarrantyClaim.supplier.has(Supplier.name.ilike(term)),
            )
        )

    total = base_query.count()
    claims = (
        base_query
        .options(
            joinedload(ManufacturerWarrantyClaim.supplier),
            joinedload(ManufacturerWarrantyClaim.stock_unit).joinedload(StockUnit.stock_item),
            joinedload(ManufacturerWarrantyClaim.histories).joinedload(ManufacturerWarrantyClaimHistory.changed_by_rep),
            joinedload(ManufacturerWarrantyClaim.histories).joinedload(ManufacturerWarrantyClaimHistory.changed_by_user),
        )
        .order_by(desc(ManufacturerWarrantyClaim.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return ManufacturerWarrantyClaimPage(
        items=[
        ManufacturerWarrantyClaimOut(
            id=c.id,
            stock_unit_id=c.stock_unit_id,
            stock_unit_serial_number=c.stock_unit.serial_number if c.stock_unit else None,
            stock_item_brand=c.stock_unit.stock_item.brand if c.stock_unit and c.stock_unit.stock_item else None,
            stock_item_model=c.stock_unit.stock_item.model if c.stock_unit and c.stock_unit.stock_item else None,
            supplier_id=c.supplier_id,
            supplier_name=c.supplier.name if c.supplier else None,
            linked_job_card_id=c.linked_job_card_id,
            date_sent=c.date_sent,
            expected_return_date=c.expected_return_date,
            date_returned=c.date_returned,
            outcome=c.outcome,
            tracking_reference=c.tracking_reference,
            notes=c.notes,
            changed_by_rep_name=c.changed_by_rep_name,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in claims
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{claim_id}", response_model=ManufacturerWarrantyClaimOut)
def get_manufacturer_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = (
        db.query(ManufacturerWarrantyClaim)
        .options(
            joinedload(ManufacturerWarrantyClaim.supplier),
            joinedload(ManufacturerWarrantyClaim.stock_unit).joinedload(StockUnit.stock_item),
            joinedload(ManufacturerWarrantyClaim.histories).joinedload(ManufacturerWarrantyClaimHistory.changed_by_rep),
            joinedload(ManufacturerWarrantyClaim.histories).joinedload(ManufacturerWarrantyClaimHistory.changed_by_user),
        )
        .filter(ManufacturerWarrantyClaim.id == claim_id)
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Manufacturer warranty claim not found.")

    return ManufacturerWarrantyClaimOut(
        id=claim.id,
        stock_unit_id=claim.stock_unit_id,
        stock_unit_serial_number=claim.stock_unit.serial_number if claim.stock_unit else None,
        stock_item_brand=claim.stock_unit.stock_item.brand if claim.stock_unit and claim.stock_unit.stock_item else None,
        stock_item_model=claim.stock_unit.stock_item.model if claim.stock_unit and claim.stock_unit.stock_item else None,
        supplier_id=claim.supplier_id,
        supplier_name=claim.supplier.name if claim.supplier else None,
        linked_job_card_id=claim.linked_job_card_id,
        date_sent=claim.date_sent,
        expected_return_date=claim.expected_return_date,
        date_returned=claim.date_returned,
        outcome=claim.outcome,
        tracking_reference=claim.tracking_reference,
        notes=claim.notes,
        changed_by_rep_name=claim.changed_by_rep_name,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
    )


@router.get("/{claim_id}/history", response_model=List[ManufacturerWarrantyClaimHistoryOut])
def get_manufacturer_claim_history(claim_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(ManufacturerWarrantyClaimHistory)
        .filter(ManufacturerWarrantyClaimHistory.claim_id == claim_id)
        .order_by(ManufacturerWarrantyClaimHistory.created_at.desc())
        .all()
    )

    # Build response objects including user/rep names for convenience
    out = []
    for r in rows:
        out.append(
            ManufacturerWarrantyClaimHistoryOut(
                id=r.id,
                claim_id=r.claim_id,
                old_outcome=r.old_outcome,
                new_outcome=r.new_outcome,
                note=r.note,
                changed_by_user_id=r.changed_by_user_id,
                changed_by_rep_id=r.changed_by_rep_id,
                changed_by_username=r.changed_by_user.username if getattr(r, 'changed_by_user', None) else None,
                changed_by_rep_name=r.changed_by_rep.name if getattr(r, 'changed_by_rep', None) else None,
                created_at=r.created_at,
            )
        )
    return out


@router.patch("/{claim_id}", response_model=ManufacturerWarrantyClaimOut)
def update_manufacturer_claim(claim_id: int, payload: ManufacturerWarrantyClaimUpdate, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    claim = db.query(ManufacturerWarrantyClaim).filter(ManufacturerWarrantyClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Manufacturer warranty claim not found.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        # Nothing to change
        return claim

    if "outcome" in updates and (updates["outcome"] is None or str(updates["outcome"]).strip() == ""):
        raise HTTPException(status_code=400, detail="Please select a claim outcome.")
    if "date_returned" in updates and updates["date_returned"] is not None and claim.date_sent is not None:
        if updates["date_returned"] < claim.date_sent:
            raise HTTPException(status_code=400, detail="Date returned cannot be before date sent.")

    if "outcome" in updates:
        claim.outcome = updates["outcome"]
    if "date_returned" in updates:
        claim.date_returned = updates["date_returned"]
    if "tracking_reference" in updates:
        claim.tracking_reference = updates["tracking_reference"].strip() if updates["tracking_reference"] else None
    if "notes" in updates:
        claim.notes = updates["notes"].strip() if updates["notes"] else None
    # Optional: update unit status if requested
    if "unit_status" in updates and updates.get("unit_status") and claim.stock_unit_id:
        unit = db.query(StockUnit).filter(StockUnit.id == claim.stock_unit_id).first()
        if unit and unit.status != updates.get("unit_status"):
            unit.record_status_change(db, updates.get("unit_status"), note=f"Updated via manufacturer claim #{claim.id}")

    # Optional: update technician charge on linked repair job
    if "amount_charged_by_technician" in updates and updates.get("amount_charged_by_technician") is not None:
        try:
            rj = None
            if claim.linked_job_card_id and claim.stock_unit_id:
                rj = (
                    db.query(RepairJob)
                    .filter(RepairJob.linked_job_card_id == claim.linked_job_card_id, RepairJob.stock_unit_id == claim.stock_unit_id)
                    .order_by(RepairJob.id.desc())
                    .first()
                )
            if rj:
                rj.amount_charged_by_technician = updates.get("amount_charged_by_technician")
        except Exception:
            # best-effort, don't fail the whole update
            pass

    # If outcome is 'repaired', update the linked stock_unit's status back to 'in_stock'
    try:
        # Record stock unit history for outcome changes, including who updated the claim
        handled_by_rep_id = current_user.rep_id if current_user and getattr(current_user, "rep_id", None) else None
        handled_by_user_id = current_user.id if current_user and getattr(current_user, "id", None) else None

        old_outcome = claim.outcome

        if "outcome" in updates and updates.get("outcome") == "repaired":
            if claim.stock_unit_id:
                unit = db.query(StockUnit).filter(StockUnit.id == claim.stock_unit_id).first()
                if unit:
                    unit.record_status_change(db, "in_stock", note=f"Returned from manufacturer claim #{claim.id}", changed_by_rep_id=handled_by_rep_id)
        # If outcome == 'replaced_by_manufacturer', keep the stock_unit status as-is — handled elsewhere.
        elif "outcome" in updates:
            # For other outcome updates we still insert an explicit history note recording the change
            if claim.stock_unit_id:
                unit = db.query(StockUnit).filter(StockUnit.id == claim.stock_unit_id).first()
                if unit:
                    hist = StockUnitStatusHistory(
                        stock_unit_id=unit.id,
                        old_status=unit.status,
                        new_status=unit.status,
                        note=f"Manufacturer claim #{claim.id} outcome updated to {updates.get('outcome')}",
                        changed_by_rep_id=handled_by_rep_id,
                    )
                    db.add(hist)

        # Add audit row for claim change
        try:
            if updates:
                hist_claim = ManufacturerWarrantyClaimHistory(
                    claim_id=claim.id,
                    old_outcome=old_outcome,
                    new_outcome=updates.get("outcome") if "outcome" in updates else old_outcome,
                    note=updates.get("notes") if "notes" in updates else None,
                    changed_by_user_id=handled_by_user_id,
                    changed_by_rep_id=handled_by_rep_id,
                )
                db.add(hist_claim)
        except Exception:
            # Best-effort: don't fail the update if history insertion fails
            pass

        db.commit()
        db.refresh(claim)
        # refresh relationships
        db.refresh(claim)
        return ManufacturerWarrantyClaimOut(
            id=claim.id,
            stock_unit_id=claim.stock_unit_id,
            stock_unit_serial_number=claim.stock_unit.serial_number if claim.stock_unit else None,
            stock_item_brand=claim.stock_unit.stock_item.brand if claim.stock_unit and claim.stock_unit.stock_item else None,
            stock_item_model=claim.stock_unit.stock_item.model if claim.stock_unit and claim.stock_unit.stock_item else None,
            supplier_id=claim.supplier_id,
            supplier_name=claim.supplier.name if claim.supplier else None,
            linked_job_card_id=claim.linked_job_card_id,
            date_sent=claim.date_sent,
            expected_return_date=claim.expected_return_date,
            date_returned=claim.date_returned,
            outcome=claim.outcome,
            tracking_reference=claim.tracking_reference,
            notes=claim.notes,
            created_at=claim.created_at,
            updated_at=claim.updated_at,
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{claim_id}")
def delete_manufacturer_claim(claim_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Permanently delete a manufacturer warranty claim and its related history rows.

    Requires admin. This will remove rows from `manufacturer_warranty_claim_histories`
    that reference the claim, then delete the claim itself.
    """
    claim = db.query(ManufacturerWarrantyClaim).filter(ManufacturerWarrantyClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Manufacturer warranty claim not found.")

    try:
        # Delete history rows first for clarity
        db.query(ManufacturerWarrantyClaimHistory).filter(ManufacturerWarrantyClaimHistory.claim_id == claim_id).delete(synchronize_session=False)
        # Then delete the claim
        db.delete(claim)
        db.commit()
        return {"ok": True}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
