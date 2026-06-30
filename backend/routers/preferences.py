"""
routers/preferences.py - user/system preference endpoints
=========================================================
Stores the draggable dashboard widget layout as JSON.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import UserPreference
from schemas import DashboardLayoutOut, DashboardLayoutUpdate

router = APIRouter(prefix="/preferences", tags=["Preferences"])

SYSTEM_ID = "default"


def _get_or_create_preferences(db: Session) -> UserPreference:
    row = db.query(UserPreference).filter(UserPreference.system_id == SYSTEM_ID).first()
    if not row:
        row = UserPreference(system_id=SYSTEM_ID, dashboard_layout=[])
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/dashboard-layout", response_model=DashboardLayoutOut)
def get_dashboard_layout(db: Session = Depends(get_db)):
    row = _get_or_create_preferences(db)
    return DashboardLayoutOut(
        dashboard_layout=row.dashboard_layout or [],
        updated_at=row.updated_at,
    )


@router.put("/dashboard-layout", response_model=DashboardLayoutOut)
def update_dashboard_layout(
    payload: DashboardLayoutUpdate,
    db: Session = Depends(get_db),
):
    row = _get_or_create_preferences(db)
    row.dashboard_layout = payload.dashboard_layout
    db.commit()
    db.refresh(row)
    return DashboardLayoutOut(
        dashboard_layout=row.dashboard_layout or [],
        updated_at=row.updated_at,
    )
