@echo off
:: ============================================================
::  Creative Computers — Daily Backup Task
::  This batch file is run automatically by Windows Task Scheduler
::  every night at 11:00 PM.
::
::  HOW TO SET UP (run this once as Administrator):
::    Right-click this file → Run as administrator
::
::  What it does:
::    1. Registers a Windows Task that runs daily at 23:00
::    2. The task calls backup.py which dumps + compresses the DB
::    3. Results are logged to backups/backup_log.txt
:: ============================================================

:: ── EDIT THIS PATH to match your backend folder ─────────────
set BACKEND_DIR=C:\Users\Lochana karunarathna\Documents\Projects\Creative Computers project\Invoice-System\backend

:: ── EDIT THIS if Python is not in your PATH ──────────────────
set PYTHON=python

:: ── Check if running as Administrator ───────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Please right-click this file and choose
    echo         "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo  Creative Computers — Backup Scheduler Setup
echo  ============================================
echo.

:: ── Add PostgreSQL bin to PATH for pg_dump ───────────────────
set PG_BIN=C:\Program Files\PostgreSQL\18\bin
if exist "%PG_BIN%\pg_dump.exe" (
    set PATH=%PG_BIN%;%PATH%
    echo  [OK] Found pg_dump at: %PG_BIN%
) else (
    :: Try PostgreSQL 17
    set PG_BIN=C:\Program Files\PostgreSQL\17\bin
    if exist "%PG_BIN%\pg_dump.exe" (
        set PATH=%PG_BIN%;%PATH%
        echo  [OK] Found pg_dump at: %PG_BIN%
    ) else (
        echo  [WARN] pg_dump.exe not found. Ensure PostgreSQL bin is in PATH.
    )
)

:: ── Create the scheduled task ────────────────────────────────
echo  Creating scheduled task "CC_Database_Backup"...

schtasks /delete /tn "CC_Database_Backup" /f >nul 2>&1

schtasks /create ^
    /tn "CC_Database_Backup" ^
    /tr "\"%PYTHON%\" \"%BACKEND_DIR%\backup.py\" --quiet" ^
    /sc DAILY ^
    /st 23:00 ^
    /ru SYSTEM ^
    /rl HIGHEST ^
    /f

if %errorlevel% equ 0 (
    echo.
    echo  [SUCCESS] Backup task created!
    echo.
    echo  Schedule : Every day at 11:00 PM
    echo  Script   : %BACKEND_DIR%\backup.py
    echo  Logs     : %BACKEND_DIR%\backups\backup_log.txt
    echo  Retention: 30 days ^(older backups auto-deleted^)
    echo.
    echo  Running a test backup now to verify everything works...
    echo.
    cd /d "%BACKEND_DIR%"
    %PYTHON% backup.py
    echo.
    echo  Done! Check the output above for SUCCESS or errors.
) else (
    echo.
    echo  [ERROR] Failed to create task. Check you are running as Administrator.
)

echo.
pause
