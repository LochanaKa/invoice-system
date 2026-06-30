"""
staff_assignments.py — Canonical employee numbers and roles for existing staff
"""

from typing import Optional, Tuple

# (name match, employee code, default role)
STAFF_ASSIGNMENTS: list[tuple[str, str, Optional[str]]] = [
    ("Asanka",  "CC-0001", "CEO"),
    ("Joseph",  "CC-0002", "General Manager"),
    ("Hasitha", "CC-0003", None),
    ("Pramod",  "CC-0004", None),
    ("Shen",    "CC-0005", None),
]


def assignment_for_name(name: str) -> Optional[Tuple[str, Optional[str]]]:
    """Return (code, role) for a known staff name, case-insensitive."""
    key = name.strip().lower()
    for staff_name, code, role in STAFF_ASSIGNMENTS:
        if staff_name.lower() == key:
            return code, role
    return None
