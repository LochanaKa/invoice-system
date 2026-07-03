"""
auth.py — Password hashing, JWT tokens, and route protection
================================================================
Three jobs live here:

  1. Turn a plaintext password into a hash (and check a password
     against a stored hash) — using bcrypt.
  2. Create and verify JWT ("JSON Web Token") access tokens — the
     signed, tamper-proof "ID badge" a user gets after logging in.
  3. A FastAPI dependency (`get_current_user`) that any router can
     use to require a valid token before running.

Analogy: bcrypt is the lock on the front door (turns a password into
something unreadable, even if the database itself leaks). A JWT is a
wristband from a concert — once issued, the doorman (get_current_user)
just checks the wristband is real and not expired; they don't need to
re-check your ID every time you walk through a different door.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

# ── Config ────────────────────────────────────────────────────
# SECRET_KEY signs every token. If this leaks, anyone can forge a
# valid login — treat it like a password. Store it in .env, never
# commit it, and use a long random string in production.
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-insecure-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8  # matches the 8-hour session requirement

# Tells FastAPI's auto-generated /docs page where to send login requests,
# and reads the "Authorization: Bearer <token>" header automatically.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password hashing ─────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """
    Turn a plaintext password into a bcrypt hash for storage.
    bcrypt automatically salts each hash, so two identical passwords
    produce two different hashes — this defeats rainbow-table attacks.
    """
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a login attempt's password against the stored hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


# ── JWT tokens ────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """
    Build a signed JWT containing `data` (we'll put the username in it)
    plus an expiry timestamp. FastAPI/jwt handles the signing — nobody
    can edit the payload without invalidating the signature.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Verify a token's signature and expiry, and return its payload."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# ── FastAPI dependency: require a logged-in user ─────────────────
# Any route that adds `current_user: User = Depends(get_current_user)`
# to its parameters will now 401 automatically if there's no valid
# token — FastAPI runs this function before the route body executes.

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    username: Optional[str] = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")

    return user


# ── FastAPI dependency: require an admin user ─────────────────────
# Drop-in replacement for get_current_user on routes that only admins
# should reach (settings, stock management, staff management, etc.).
# Returns the same User object so route functions that inspect the user
# work identically either way.

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Extends get_current_user: additionally requires is_admin == True."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action.",
        )
    return current_user
