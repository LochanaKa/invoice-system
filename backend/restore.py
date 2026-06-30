"""
restore.py — Restore Creative Computers Database from Backup
=============================================================
USAGE:
  python restore.py                         ← shows available backups, prompts to choose
  python restore.py cc_backup_2026_06_25.sql.gz  ← restore specific file

⚠ WARNING: This OVERWRITES the current database.
   All data since the backup was taken will be LOST.
   Only run this to recover from a failure.
"""

import os
import sys
import gzip
import shutil
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from sqlalchemy import text
from database import engine

load_dotenv()

SQLALCHEMY_BACKUP_MARKER = "-- SQLALCHEMY_BACKUP: true\n"

BACKUP_DIR = Path(__file__).parent / "backups"

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", "5432"),
    "dbname":   os.getenv("DB_NAME", "creative_computers"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

def find_psql() -> str | None:
    psql_path = os.getenv("PSQL_PATH", "").strip()
    if psql_path:
        candidate = Path(psql_path)
        if candidate.is_file():
            return str(candidate)
        if os.name == "nt":
            candidate_exe = candidate.with_suffix(".exe")
            if candidate_exe.is_file():
                return str(candidate_exe)
        return None

    pg_dump_path = os.getenv("PG_DUMP_PATH", "").strip()
    if pg_dump_path:
        candidate = Path(pg_dump_path)
        if candidate.parent.exists():
            possible = candidate.parent / ("psql.exe" if os.name == "nt" else "psql")
            if possible.is_file():
                return str(possible)

    return shutil.which("psql") or shutil.which("psql.exe")


PSQL = find_psql()


def human_size(n):
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024: return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def restore_with_sqlalchemy(sql_path: Path) -> None:
    """Restore SQL directly using SQLAlchemy when psql is unavailable."""
    sql_text = sql_path.read_text(encoding="utf-8")

    # SQLAlchemy cannot execute psql meta-commands or extended COPY blocks.
    # Detect SQL files created by our SQLAlchemy fallback and run them directly.
    if sql_text.startswith(SQLALCHEMY_BACKUP_MARKER):
        with engine.begin() as conn:
            conn.exec_driver_sql(sql_text)
        return

    raise RuntimeError(
        "Unable to restore this backup via SQLAlchemy fallback. "
        "Use PostgreSQL's psql utility or restore a backup created by the app's SQLAlchemy fallback."
    )


def run_psql_command(cmd, env):
    """Run a psql command and return the completed process."""
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        print(f"\nERROR: psql command failed:\n{stderr}")
    return result


def list_backups():
    files = sorted(BACKUP_DIR.glob("cc_backup_*.sql.gz"), reverse=True)
    if not files:
        print("No backup files found in backups/ folder.")
        return []
    print(f"\n{'#':<4} {'Filename':<40} {'Size':<10} {'Date'}")
    print("─" * 72)
    for i, f in enumerate(files, 1):
        mtime = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        print(f"{i:<4} {f.name:<40} {human_size(f.stat().st_size):<10} {mtime}")
    return files


def restore_from_file(gz_path: Path):
    print(f"\nWARNING: You are about to RESTORE from:")
    print(f"   {gz_path.name}")
    print(f"\n   This will OVERWRITE the entire '{DB_CONFIG['dbname']}' database.")
    print(f"   ALL data since this backup was taken will be PERMANENTLY LOST.\n")

    confirm = input("Type YES to confirm: ").strip()
    if confirm != "YES":
        print("Restore cancelled.")
        sys.exit(0)

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_CONFIG["password"]

    if not PSQL:
        with gzip.open(gz_path, "rt", encoding="utf-8", errors="ignore") as check:
            header = check.read(len(SQLALCHEMY_BACKUP_MARKER))
        if not header.startswith(SQLALCHEMY_BACKUP_MARKER):
            print("\nERROR: This backup was created by pg_dump and cannot be restored without PostgreSQL's psql utility.")
            print("Install PostgreSQL or set PSQL_PATH to the psql executable, then retry.")
            print("If you only have PG_DUMP_PATH set, set PSQL_PATH to the corresponding psql.exe.")
            sys.exit(1)

    # ── 1. Decompress to temp file ────────────────────────────
    print("\n[1/3] Decompressing backup...")
    with tempfile.NamedTemporaryFile(suffix=".sql", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    with gzip.open(gz_path, "rb") as f_in, open(tmp_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    print(f"      Decompressed: {human_size(tmp_path.stat().st_size)}")

    if PSQL:
        # ── 2. Drop + recreate database ───────────────────────────
        print(f"\n[2/3] Dropping and recreating '{DB_CONFIG['dbname']}'...")

        base_args = ["-h", DB_CONFIG["host"], "-p", DB_CONFIG["port"],
                     "-U", DB_CONFIG["user"], "--no-password"]

        result = run_psql_command(
            [PSQL, *base_args, "-d", "postgres",
             "-c", f"DROP DATABASE IF EXISTS {DB_CONFIG['dbname']};"],
            env
        )
        if result.returncode != 0:
            tmp_path.unlink()
            sys.exit(1)

        result = run_psql_command(
            [PSQL, *base_args, "-d", "postgres",
             "-c", f"CREATE DATABASE {DB_CONFIG['dbname']};"],
            env
        )
        if result.returncode != 0:
            tmp_path.unlink()
            sys.exit(1)

        print("      Done.")

        # ── 3. Restore from SQL file ──────────────────────────────
        print(f"\n[3/3] Restoring data (this may take a minute)...")
        result = run_psql_command(
            [PSQL, *base_args, "-d", DB_CONFIG["dbname"], "-f", str(tmp_path)],
            env
        )

        tmp_path.unlink()   # cleanup temp file

        if result.returncode != 0:
            print("\nRestore failed during SQL execution.")
            sys.exit(1)
    else:
        print("\n[2/3] Restoring database via SQLAlchemy fallback (no psql found)...")
        try:
            restore_with_sqlalchemy(tmp_path)
        except RuntimeError as err:
            print(f"\nERROR: {err}")
            tmp_path.unlink()
            sys.exit(1)
        tmp_path.unlink()   # cleanup temp file

    print(f"\nRestore complete from: {gz_path.name}")
    print(f"   Database '{DB_CONFIG['dbname']}' has been restored.")


def main():
    print("=" * 60)
    print("  Creative Computers — Database Restore Tool")
    print("=" * 60)

    if len(sys.argv) > 1:
        # Specific file provided as argument
        gz_path = BACKUP_DIR / sys.argv[1]
        if not gz_path.exists():
            print(f"❌ File not found: {gz_path}")
            sys.exit(1)
    else:
        # Interactive: show list and prompt
        backups = list_backups()
        if not backups:
            sys.exit(1)
        print()
        choice = input("Enter backup number to restore (or q to quit): ").strip()
        if choice.lower() == "q":
            sys.exit(0)
        try:
            gz_path = backups[int(choice) - 1]
        except (ValueError, IndexError):
            print("Invalid selection.")
            sys.exit(1)

    restore_from_file(gz_path)


if __name__ == "__main__":
    main()
