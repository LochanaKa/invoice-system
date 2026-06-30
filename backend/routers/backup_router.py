"""
routers/backup_router.py — Backup Management API
=================================================
GET  /api/backup/status   → last backup info + disk usage
GET  /api/backup/list     → all backup files
POST /api/backup/run      → trigger a backup immediately
"""

import os
import gzip
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks

router = APIRouter(prefix="/backup", tags=["Backup"])

BACKUP_DIR = Path(__file__).parent.parent / "backups"
LOG_FILE   = BACKUP_DIR / "backup_log.txt"


def human_size(n: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def get_backup_files():
    """Return sorted list of backup file info dicts (newest first)."""
    if not BACKUP_DIR.exists():
        return []
    files = sorted(BACKUP_DIR.glob("cc_backup_*.sql.gz"), reverse=True)
    result = []
    for f in files:
        stat  = f.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime)
        result.append({
            "filename":     f.name,
            "size_bytes":   stat.st_size,
            "size_human":   human_size(stat.st_size),
            "created_at":   mtime.isoformat(),
            "created_label": mtime.strftime("%d %b %Y  %H:%M"),
        })
    return result


def get_last_log_entries(n: int = 10) -> list[str]:
    """Return the last n lines from the backup log."""
    if not LOG_FILE.exists():
        return []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    return [l.strip() for l in lines[-n:] if l.strip()]


# ── STATUS ────────────────────────────────────────────────────
@router.get("/status")
def backup_status():
    """
    Returns overall backup health:
      - last backup file and time
      - total backup count
      - total disk space used
      - last 10 log entries
    """
    files = get_backup_files()

    total_bytes = sum(f["size_bytes"] for f in files)

    last = files[0] if files else None

    return {
        "backup_count":      len(files),
        "total_size_bytes":  total_bytes,
        "total_size_human":  human_size(total_bytes),
        "last_backup":       last,
        "backup_dir":        str(BACKUP_DIR.resolve()),
        "recent_log":        get_last_log_entries(10),
        "schedule_info":     "Daily at 23:00 via Windows Task Scheduler",
        "retention_days":    30,
    }


# ── LIST ──────────────────────────────────────────────────────
@router.get("/list")
def list_backups():
    """Return all backup files with metadata."""
    return {"backups": get_backup_files()}


# ── TRIGGER ───────────────────────────────────────────────────
@router.post("/run")
def trigger_backup(background_tasks: BackgroundTasks):
    """
    Trigger a backup immediately.
    Runs in the background so the API response returns instantly.
    Check /api/backup/status after a few seconds to see the result.
    """
    def do_backup():
        try:
            # Import here to avoid circular issues
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from backup import run_backup
            run_backup(quiet=True)
        except Exception as e:
            # Log failure
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now().isoformat()}] API-triggered backup FAILED: {e}\n")

    background_tasks.add_task(do_backup)

    return {
        "message": "Backup started in background. "
                   "Check /api/backup/status in ~10 seconds for the result.",
        "started_at": datetime.now().isoformat(),
    }
