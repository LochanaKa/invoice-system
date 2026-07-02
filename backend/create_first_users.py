"""
create_first_users.py — One-time script to create login accounts
====================================================================
Run this ONCE after the `users` table exists (it's created automatically
the next time you start the FastAPI server, via Base.metadata.create_all).

What it does:
  - Looks at every row already in `reps`
  - Creates a matching login (username = first name, lowercase)
  - Prints each temporary password ONCE to the console — write these
    down and give them to staff, then have everyone change their
    password on first login (a "change password" endpoint is a good
    next feature to add).
  - Marks CEO/General Manager as admin (can manage Settings/Staff/
    Backups); everyone else is a normal rep login.
  - Skips any rep who already has a login (safe to re-run).

Usage (from the backend/ directory, with your venv active):
    python create_first_users.py
"""

import secrets
import string

from database import SessionLocal
from models import Rep, User
from auth import hash_password

ADMIN_ROLES = {"ceo", "general manager"}


def generate_temp_password(length: int = 10) -> str:
    """A random, readable temporary password — not the final one staff will use."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main():
    db = SessionLocal()
    try:
        reps = db.query(Rep).filter(Rep.is_active == True).order_by(Rep.code).all()
        if not reps:
            print("No reps found — nothing to do. Add reps first, then re-run this.")
            return

        print(f"Found {len(reps)} active rep(s). Creating logins...\n")
        print(f"{'Username':<15} {'Temp Password':<14} {'Admin?':<8} Linked Rep")
        print("-" * 65)

        created = 0
        for rep in reps:
            username = rep.name.strip().lower().split()[0]  # "Asanka" -> "asanka"

            existing = db.query(User).filter(User.username == username).first()
            if existing:
                print(f"{username:<15} {'(exists)':<14} {'—':<8} {rep.name} — skipped")
                continue

            temp_password = generate_temp_password()
            is_admin = (rep.role or "").strip().lower() in ADMIN_ROLES

            user = User(
                username=username,
                password_hash=hash_password(temp_password),
                rep_id=rep.id,
                is_admin=is_admin,
                is_active=True,
            )
            db.add(user)
            db.commit()

            print(f"{username:<15} {temp_password:<14} {'Yes' if is_admin else 'No':<8} {rep.name}")
            created += 1

        print("-" * 65)
        print(f"\nCreated {created} new login(s). Write down these passwords now —")
        print("they will NOT be shown again. Give each person their username")
        print("and temporary password, and have them log in at /login.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
