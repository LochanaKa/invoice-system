"""
routers/settings.py - System Settings API
=========================================
Manages rates, company profile, invoice defaults, and sales routes.
"""

from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import CompanySettings, RateSetting, Route, Settings
from schemas import (
    CompanyInfoOut,
    CompanyInfoUpdate,
    RateSettingCreate,
    RateSettingOut,
    RateSettingUpdate,
    RouteCreate,
    RouteOut,
    RouteUpdate,
    SettingsOut,
    SettingsUpdate,
    WarrantyOut,
    WarrantyUpdate,
)

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULT_WARRANTY = (
    "Please submit the Original Invoice for warranty claims.\n"
    "Warranty period is one year less than 14 working days.\n"
    "Goods once sold are not refundable.\n"
    "Warranty covers only manufacturer defects."
)


def _phones_to_list(value: str | None) -> list[str]:
    return [p.strip() for p in (value or "").splitlines() if p.strip()]


def _phones_to_text(value: list[str]) -> str:
    return "\n".join(p.strip() for p in value if p and p.strip())


def _get_or_create_settings(db: Session) -> Settings:
    row = db.query(Settings).filter(Settings.id == 1).first()
    if not row:
        row = Settings(
            id=1,
            sscl_pct=Decimal("0.025"),
            vat_pct=Decimal("0.18"),
            profit_margin=Decimal("0.20"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_company(db: Session) -> CompanySettings:
    row = db.query(CompanySettings).filter(CompanySettings.id == 1).first()
    if not row:
        row = CompanySettings(
            id=1,
            company_name="Creative Computers",
            address="No. 95, Colombo Road, Kurunegala",
            tin="783634953-7000",
            phone_numbers="+94 37 22 29 181\n+94 77 57 67 070",
            default_warranty_text=DEFAULT_WARRANTY,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _sync_legacy_rates(db: Session, settings: Settings) -> None:
    defaults = [
        ("sscl_pct", "SSCL", settings.sscl_pct, "tax", "Social Security Contribution Levy"),
        ("vat_pct", "VAT", settings.vat_pct, "tax", "Value Added Tax"),
        ("profit_margin", "Profit Margin", settings.profit_margin, "margin", "Default item markup"),
    ]
    for key, label, rate, rate_type, description in defaults:
        row = db.query(RateSetting).filter(RateSetting.key == key).first()
        if not row:
            db.add(RateSetting(
                key=key,
                label=label,
                rate=rate,
                rate_type=rate_type,
                description=description,
                is_active=True,
            ))
    db.commit()


def _settings_response(db: Session, settings: Settings) -> SettingsOut:
    _sync_legacy_rates(db, settings)
    company = _get_or_create_company(db)
    rates = db.query(RateSetting).order_by(RateSetting.id).all()
    return SettingsOut(
        sscl_pct=settings.sscl_pct,
        vat_pct=settings.vat_pct,
        profit_margin=settings.profit_margin,
        updated_at=settings.updated_at,
        rates=[
            RateSettingOut(
                id=r.id,
                key=r.key,
                label=r.label,
                rate=r.rate,
                rate_type=r.rate_type,
                description=r.description,
                is_active=True if r.is_active is None else r.is_active,
                updated_at=r.updated_at,
            )
            for r in rates
        ],
        company_info=CompanyInfoOut(
            company_name=company.company_name,
            address=company.address,
            tin=company.tin,
            phone_numbers=_phones_to_list(company.phone_numbers),
            updated_at=company.updated_at,
        ),
        warranty=WarrantyOut(
            default_warranty_text=company.default_warranty_text or "",
            updated_at=company.updated_at,
        ),
    )


def _apply_legacy_rate(db: Session, key: str, rate: Decimal) -> None:
    settings = _get_or_create_settings(db)
    if key == "sscl_pct":
        settings.sscl_pct = rate
    elif key == "vat_pct":
        settings.vat_pct = rate
    elif key == "profit_margin":
        settings.profit_margin = rate


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _settings_response(db, _get_or_create_settings(db))


@router.patch("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    row = _get_or_create_settings(db)

    if payload.sscl_pct is not None:
        row.sscl_pct = payload.sscl_pct
    if payload.vat_pct is not None:
        row.vat_pct = payload.vat_pct
    if payload.profit_margin is not None:
        row.profit_margin = payload.profit_margin

    db.commit()
    db.refresh(row)

    for key, rate in {
        "sscl_pct": row.sscl_pct,
        "vat_pct": row.vat_pct,
        "profit_margin": row.profit_margin,
    }.items():
        rate_row = db.query(RateSetting).filter(RateSetting.key == key).first()
        if rate_row:
            rate_row.rate = rate
    db.commit()
    db.refresh(row)
    return _settings_response(db, row)


@router.get("/rates", response_model=List[RateSettingOut])
def list_rates(db: Session = Depends(get_db)):
    _sync_legacy_rates(db, _get_or_create_settings(db))
    return db.query(RateSetting).order_by(RateSetting.id).all()


@router.post("/rates", response_model=RateSettingOut, status_code=201)
def create_rate(payload: RateSettingCreate, db: Session = Depends(get_db)):
    row = RateSetting(**payload.model_dump())
    db.add(row)
    try:
        _apply_legacy_rate(db, row.key, row.rate)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A rate with this key already exists")


@router.put("/rates/{rate_id}", response_model=RateSettingOut)
def update_rate(rate_id: int, payload: RateSettingUpdate, db: Session = Depends(get_db)):
    row = db.query(RateSetting).filter(RateSetting.id == rate_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Rate not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    _apply_legacy_rate(db, row.key, row.rate)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/rates/{rate_id}", status_code=204)
def deactivate_rate(rate_id: int, db: Session = Depends(get_db)):
    row = db.query(RateSetting).filter(RateSetting.id == rate_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Rate not found")
    row.is_active = False
    db.commit()
    return None


@router.get("/company-info", response_model=CompanyInfoOut)
def get_company_info(db: Session = Depends(get_db)):
    row = _get_or_create_company(db)
    return CompanyInfoOut(
        company_name=row.company_name,
        address=row.address,
        tin=row.tin,
        phone_numbers=_phones_to_list(row.phone_numbers),
        updated_at=row.updated_at,
    )


@router.put("/company-info", response_model=CompanyInfoOut)
def update_company_info(payload: CompanyInfoUpdate, db: Session = Depends(get_db)):
    row = _get_or_create_company(db)
    row.company_name = payload.company_name.strip()
    row.address = payload.address
    row.tin = payload.tin
    row.phone_numbers = _phones_to_text(payload.phone_numbers)
    db.commit()
    db.refresh(row)
    return get_company_info(db)


@router.get("/warranty", response_model=WarrantyOut)
def get_warranty(db: Session = Depends(get_db)):
    row = _get_or_create_company(db)
    return WarrantyOut(
        default_warranty_text=row.default_warranty_text or "",
        updated_at=row.updated_at,
    )


@router.put("/warranty", response_model=WarrantyOut)
def update_warranty(payload: WarrantyUpdate, db: Session = Depends(get_db)):
    row = _get_or_create_company(db)
    row.default_warranty_text = payload.default_warranty_text
    db.commit()
    db.refresh(row)
    return get_warranty(db)


@router.get("/routes", response_model=List[RouteOut])
def list_setting_routes(include_inactive: bool = True, db: Session = Depends(get_db)):
    q = db.query(Route)
    if not include_inactive:
        q = q.filter(Route.is_active == True)
    return q.order_by(Route.name).all()


@router.post("/routes", response_model=RouteOut, status_code=201)
def create_setting_route(payload: RouteCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    existing = db.query(Route).filter(Route.name == name).first()
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    row = Route(name=name, is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/routes/{route_id}", response_model=RouteOut)
def update_setting_route(route_id: int, payload: RouteUpdate, db: Session = Depends(get_db)):
    row = db.query(Route).filter(Route.id == route_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Route not found")
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.is_active is not None:
        row.is_active = payload.is_active
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Route name already exists")


@router.delete("/routes/{route_id}", status_code=204)
def deactivate_setting_route(route_id: int, db: Session = Depends(get_db)):
    row = db.query(Route).filter(Route.id == route_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Route not found")
    row.is_active = False
    db.commit()
    return None
