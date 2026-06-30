"""
rep_codes.py — Employee number (CC-0000) generation and validation
"""

import re
from typing import Optional
from sqlalchemy.orm import Session

from models import Rep

REP_CODE_PATTERN = re.compile(r"^CC-(\d{4})$")


def parse_rep_code_number(code: str) -> Optional[int]:
    """Return the numeric suffix for a valid CC-0000 code, else None."""
    match = REP_CODE_PATTERN.match(code.strip().upper() if code else "")
    if not match:
        return None
    return int(match.group(1))


def get_max_rep_code_number(db: Session) -> int:
    """Find the highest CC-#### number already stored in reps.code."""
    max_num = 0
    for (code,) in db.query(Rep.code).all():
        num = parse_rep_code_number(code)
        if num is not None:
            max_num = max(max_num, num)
    return max_num


def generate_next_rep_code(db: Session) -> str:
    """Generate the next sequential employee number (e.g. CC-0015)."""
    return f"CC-{get_max_rep_code_number(db) + 1:04d}"


def is_valid_rep_code(code: str) -> bool:
    """Return True when code strictly matches CC-0000."""
    return parse_rep_code_number(code) is not None
