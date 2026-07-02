"""
routers/auth_router.py — Login endpoint
==========================================
  POST /api/auth/login  → check username+password, return a JWT
  GET  /api/auth/me      → who am I? (used by the frontend on page load
                            to check "is my saved token still valid?")
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import User
from auth import verify_password, hash_password, create_access_token, get_current_user
from schemas import TokenResponse, UserOut, UserCreate

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2PasswordRequestForm expects form-encoded 'username' and
    'password' fields (not JSON) — this is a FastAPI/OAuth2 convention
    that also makes the interactive /docs page work out of the box.
    The frontend will send these as form data too (see api.js).
    """
    user = (
        db.query(User)
        .options(joinedload(User.rep))
        .filter(User.username == form_data.username)
        .first()
    )

    # Deliberately vague error message — "wrong username" vs "wrong
    # password" tells an attacker which usernames exist. Always say
    # the same thing for both cases.
    if not user or not user.is_active or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token({"sub": user.username})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut(
            id=user.id,
            username=user.username,
            is_admin=user.is_admin,
            rep_id=user.rep_id,
            rep_name=user.rep.name if user.rep else None,
        ),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Used by the frontend on app load to validate a saved token."""
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        is_admin=current_user.is_admin,
        rep_id=current_user.rep_id,
        rep_name=current_user.rep.name if current_user.rep else None,
    )


def _require_admin(current_user: User) -> None:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")


@router.get("/users", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: list all login accounts (for a Staff Management screen)."""
    _require_admin(current_user)
    users = db.query(User).options(joinedload(User.rep)).order_by(User.username).all()
    return [
        UserOut(
            id=u.id, username=u.username, is_admin=u.is_admin,
            rep_id=u.rep_id, rep_name=u.rep.name if u.rep else None,
        )
        for u in users
    ]


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: create a new login for a staff member."""
    _require_admin(current_user)

    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Username '{payload.username}' already taken.")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        rep_id=payload.rep_id,
        is_admin=payload.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id, username=user.username, is_admin=user.is_admin,
        rep_id=user.rep_id, rep_name=user.rep.name if user.rep else None,
    )
