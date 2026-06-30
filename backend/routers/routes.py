"""routers/routes.py — CRUD for delivery/sales routes

Provides a small API so the frontend can create routes on-the-fly.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Route
from schemas import RouteCreate, RouteOut, RouteUpdate

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.get("", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    rows = db.query(Route).filter(Route.is_active == True).order_by(Route.name).all()
    return [RouteOut.model_validate(r) for r in rows]


@router.post("", response_model=RouteOut, status_code=201)
def create_route(payload: RouteCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    existing = db.query(Route).filter(Route.name == name).first()
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return RouteOut.model_validate(existing)

    route = Route(name=name, is_active=True)
    db.add(route)
    db.commit()
    db.refresh(route)
    return RouteOut.model_validate(route)
