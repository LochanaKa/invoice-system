#!/usr/bin/env python3
"""
migrate_rep_codes.py — Assign CC-0000 employee numbers and roles to existing staff
==================================================================================
Maps known staff by name (preserving invoice FK links via reps.id):

    CC-0001  Asanka   — CEO
    CC-0002  Joseph   — General Manager
    CC-0003  Hasitha
    CC-0004  Pramod
    CC-0005  Shen

Usage (from the backend/ directory):
    python migrate_rep_codes.py          # dry-run (preview only)
    python migrate_rep_codes.py --apply  # execute the migration

Requires .env with DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME.
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from database import SessionLocal, engine
from migrations import run_startup_migrations
from models import Rep
from rep_codes import is_valid_rep_code
from staff_assignments import STAFF_ASSIGNMENTS, assignment_for_name


from typing import Optional, Tuple


def _expected_for_rep(rep: Rep) -> Tuple[str, Optional[str]]:
    match = assignment_for_name(rep.name)
    if match:
        return match
    return rep.code, rep.role


def _needs_migration(reps: list[Rep]) -> bool:
    for rep in reps:
        expected_code, expected_role = _expected_for_rep(rep)
        if assignment_for_name(rep.name):
            if rep.code != expected_code:
                return True
            if expected_role and (rep.role or "") != expected_role:
                return True
        elif not is_valid_rep_code(rep.code):
            return True
    return False


def preview(reps: list[Rep]) -> None:
    print(f"Found {len(reps)} staff record(s):\n")
    for rep in sorted(reps, key=lambda r: r.code if is_valid_rep_code(r.code) else r.name):
        match = assignment_for_name(rep.name)
        if match:
            new_code, new_role = match
            role_note = f", role={new_role!r}" if new_role else ""
            flag = "" if rep.code == new_code and (not new_role or rep.role == new_role) else "  <- will change"
            print(f"  {rep.name:10s}  {rep.code:12s} -> {new_code}{role_note}{flag}")
        elif not is_valid_rep_code(rep.code):
            print(f"  {rep.name:10s}  {rep.code:12s} -> (next available CC-####)  <- will change")
        else:
            print(f"  {rep.name:10s}  {rep.code:12s}  (unchanged)")
    print()


def migrate(*, dry_run: bool) -> int:
    db = SessionLocal()
    try:
        reps = db.query(Rep).order_by(Rep.id).all()
        if not reps:
            print("No reps found — nothing to do.")
            return 0

        preview(reps)

        if not _needs_migration(reps):
            print("All staff already have correct employee numbers and roles.")
            return 0

        if dry_run:
            print("Dry-run complete. Re-run with --apply to commit changes.")
            return 0

        db.close()
        run_startup_migrations(engine)
        print("Successfully assigned employee numbers and roles.")
        return 0

    except Exception as exc:
        db.rollback()
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Assign CC-0000 employee numbers and roles to existing staff."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes (default is dry-run preview only).",
    )
    args = parser.parse_args()
    return migrate(dry_run=not args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
