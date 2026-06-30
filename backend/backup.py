"""
backup.py — Creative Computers PostgreSQL Backup
==================================================
Run manually:         python backup.py
Run by scheduler:     python backup.py --quiet

What it does:
  1. Calls pg_dump to export the entire creative_computers database
  2. Compresses the output with gzip (~90% size reduction)
  3. Saves to /backups/ with a timestamp filename
  4. Appends result to backup_log.txt
  5. Deletes backups older than KEEP_DAYS to save disk space

IRD Note: Gazette 2463/05 requires financial records to be kept
for a minimum of 5 years. Move files older than 30 days to an
external drive or cloud storage before they are auto-deleted here.
"""

import os
import sys
import gzip
import json
import shutil
import subprocess
import argparse
from datetime import datetime, date, timedelta
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv

from sqlalchemy import select
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects.postgresql import JSONB
from database import engine, Base
# Import models so SQLAlchemy metadata knows every table in the app.
import models

# ── Config ────────────────────────────────────────────────────
load_dotenv()

BACKUP_DIR = Path(__file__).parent / "backups"
LOG_FILE   = BACKUP_DIR / "backup_log.txt"
KEEP_DAYS  = 30       # auto-delete backups older than this many days


def resolve_pg_dump() -> str | None:
    """Return the pg_dump path, or None if it cannot be found."""
    env_path = os.getenv("PG_DUMP_PATH", "").strip()
    if env_path:
        candidate = Path(env_path)
        if candidate.is_file():
            return str(candidate)
        if os.name == "nt":
            candidate_exe = candidate.with_suffix(".exe")
            if candidate_exe.is_file():
                return str(candidate_exe)
        return None

    return shutil.which("pg_dump") or shutil.which("pg_dump.exe")


def resolve_psql() -> str | None:
    """Return the psql path, or None if it cannot be found."""
    env_path = os.getenv("PSQL_PATH", "").strip()
    if env_path:
        candidate = Path(env_path)
        if candidate.is_file():
            return str(candidate)
        if os.name == "nt":
            candidate_exe = candidate.with_suffix(".exe")
            if candidate_exe.is_file():
                return str(candidate_exe)
        return None

    return shutil.which("psql") or shutil.which("psql.exe")


PG_DUMP = resolve_pg_dump()
PSQL = resolve_psql()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", "5432"),
    "dbname":   os.getenv("DB_NAME", "creative_computers"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}


SQLALCHEMY_BACKUP_MARKER = "-- SQLALCHEMY_BACKUP: true\n"


def _sql_literal(value, column) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, Decimal)):
        return str(value)
    if isinstance(value, (datetime, date)):
        return f"'{value.isoformat()}'"
    if isinstance(value, (list, dict)):
        json_text = json.dumps(value, ensure_ascii=False)
        escaped = json_text.replace("'", "''")
        return f"'{escaped}'::jsonb" if isinstance(column.type, JSONB) else f"'{escaped}'"
    text_value = str(value)
    escaped = text_value.replace("'", "''")
    return f"'{escaped}'"


def dump_database_with_sqlalchemy(sql_path: Path, quiet: bool = False) -> None:
    """Create a SQL dump using SQLAlchemy metadata and row data."""
    with engine.begin() as conn, open(sql_path, "w", encoding="utf-8") as f:
        f.write(SQLALCHEMY_BACKUP_MARKER)
        f.write("SET client_encoding = 'UTF8';\n")
        f.write("SET standard_conforming_strings = on;\n\n")

        for table in Base.metadata.sorted_tables:
            ddl = str(CreateTable(table).compile(dialect=engine.dialect)).strip()
            f.write(f"DROP TABLE IF EXISTS {table.name} CASCADE;\n")
            f.write(ddl + ";\n\n")

        for table in Base.metadata.sorted_tables:
            rows = conn.execute(select(table)).mappings().all()
            if not rows:
                continue
            cols = ", ".join(col.name for col in table.columns)
            f.write(f"-- Data for table {table.name}\n")
            for row in rows:
                values = ", ".join(
                    _sql_literal(row[col.name], col) for col in table.columns
                )
                f.write(f"INSERT INTO {table.name} ({cols}) VALUES ({values});\n")
            f.write("\n")

    if not sql_path.exists() or sql_path.stat().st_size == 0:
        raise RuntimeError("SQLAlchemy backup produced an empty file")


# ── Helpers ───────────────────────────────────────────────────

def log(msg: str, quiet: bool = False):
    """Write to log file and optionally print."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    if not quiet:
        print(line)


def human_size(n_bytes: int) -> str:
    """Convert bytes to human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if n_bytes < 1024:
            return f"{n_bytes:.1f} {unit}"
        n_bytes /= 1024
    return f"{n_bytes:.1f} TB"


# ── Main backup function ──────────────────────────────────────

def run_backup(quiet: bool = False) -> dict:
    """
    Execute one backup cycle.
    Returns a dict with status, filename, size_bytes.
    Raises Exception on failure.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
    sql_path  = BACKUP_DIR / f"cc_backup_{timestamp}.sql"
    gz_path   = BACKUP_DIR / f"cc_backup_{timestamp}.sql.gz"

    log(f"Starting backup → {gz_path.name}", quiet)

    if PG_DUMP and PSQL:
        # ── 1. Run pg_dump ────────────────────────────────────────
        env = os.environ.copy()
        env["PGPASSWORD"] = DB_CONFIG["password"]   # pass password without prompt

        cmd = [
            PG_DUMP,
            "-h", DB_CONFIG["host"],
            "-p", DB_CONFIG["port"],
            "-U", DB_CONFIG["user"],
            "-d", DB_CONFIG["dbname"],
            "-f", str(sql_path),
            "--no-password",
        ]
        if not quiet:
            cmd.append("--verbose")

        result = subprocess.run(
            cmd, env=env,
            capture_output=True, text=True,
            timeout=300   # 5-minute timeout
        )

        if result.returncode != 0:
            err = result.stderr or result.stdout or "Unknown pg_dump error"
            log(f"FAILED — pg_dump error: {err[:200]}", quiet)
            raise RuntimeError(f"pg_dump failed (exit {result.returncode}): {err[:200]}")

        if not sql_path.exists() or sql_path.stat().st_size == 0:
            log("FAILED — pg_dump produced empty file", quiet)
            raise RuntimeError("pg_dump produced an empty backup file")

        raw_size = sql_path.stat().st_size
        log(f"pg_dump complete — raw size: {human_size(raw_size)}", quiet)
    else:
        if PG_DUMP and not PSQL:
            log("psql not found; using SQLAlchemy fallback backup to ensure restore compatibility", quiet)
        else:
            log("pg_dump not found; using SQLAlchemy fallback backup", quiet)
        dump_database_with_sqlalchemy(sql_path, quiet)
        raw_size = sql_path.stat().st_size
        log(f"SQLAlchemy backup complete — raw size: {human_size(raw_size)}", quiet)

    # ── 2. Compress with gzip ─────────────────────────────────
    with open(sql_path, "rb") as f_in, gzip.open(gz_path, "wb", compresslevel=6) as f_out:
        shutil.copyfileobj(f_in, f_out)

    sql_path.unlink()   # remove uncompressed version

    gz_size = gz_path.stat().st_size
    ratio   = round((1 - gz_size / raw_size) * 100) if raw_size else 0
    log(f"Compressed → {human_size(gz_size)} ({ratio}% smaller)", quiet)

    # ── 3. Cleanup old backups ────────────────────────────────
    cutoff = datetime.now() - timedelta(days=KEEP_DAYS)
    removed = 0
    for old_file in sorted(BACKUP_DIR.glob("cc_backup_*.sql.gz")):
        if datetime.fromtimestamp(old_file.stat().st_mtime) < cutoff:
            old_file.unlink()
            removed += 1
            log(f"Deleted old backup: {old_file.name}", quiet)

    if removed:
        log(f"Cleanup: removed {removed} backup(s) older than {KEEP_DAYS} days", quiet)

    log(f"SUCCESS — {gz_path.name} ({human_size(gz_size)})", quiet)

    return {
        "status":     "success",
        "filename":   gz_path.name,
        "size_bytes": gz_size,
        "size_human": human_size(gz_size),
    }


# ── CLI entry point ───────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Creative Computers DB Backup")
    parser.add_argument("--quiet", "-q", action="store_true",
                        help="Suppress console output (for scheduled runs)")
    args = parser.parse_args()

    try:
        result = run_backup(quiet=args.quiet)
        if not args.quiet:
            print(f"\n✅ Backup complete: {result['filename']} ({result['size_human']})")
        sys.exit(0)
    except Exception as e:
        log(f"ERROR — {e}", quiet=args.quiet)
        if not args.quiet:
            print(f"\n❌ Backup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
