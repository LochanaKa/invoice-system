"""
main.py — FastAPI Application Entry Point
==========================================
This is where FastAPI starts. It:
  1. Creates the app instance
  2. Registers all routers (invoices, customers, dashboard, settings)
  3. Enables CORS so your React frontend can talk to it
  4. Provides a health-check endpoint

Run with:
    uvicorn main:app --reload --port 8000

Then open: http://localhost:8000/docs
(FastAPI auto-generates interactive API documentation — try it!)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from routers import invoices, customers, dashboard, settings, pdf_router, vat_report, all_inc_report, reps, routes,  backup_router,  preferences
from database import engine
from models import Base
from migrations import run_startup_migrations

# ── Auto-create any missing tables on startup ─────────────────────────────────
# This is non-destructive: existing tables and their data are never touched.
# It creates the `settings` table (and any other new tables) without needing
# the full migration SQL to be run first.
Base.metadata.create_all(bind=engine, checkfirst=True)
run_startup_migrations(engine)

app = FastAPI(
    title       = "Creative Computers — Invoice API",
    description = "Backend for the CC invoicing system.",
    version     = "1.1.0",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://localhost:5173"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
    expose_headers=["Content-Disposition"],
)

# ── Static files (logo etc.) ──────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Routers ───────────────────────────────────────────────────
app.include_router(invoices.router,   prefix="/api")
app.include_router(customers.router,  prefix="/api")
app.include_router(dashboard.router,  prefix="/api")
app.include_router(pdf_router.router, prefix="/api")   # ← PDF
app.include_router(settings.router,   prefix="/api")   # ← Settings
app.include_router(vat_report.router, prefix="/api") #  ← VAT report
app.include_router(all_inc_report.router, prefix="/api") #  ← All-Inclusive report
app.include_router(reps.router,       prefix="/api") #  ← Staff management
app.include_router(routes.router,     prefix="/api") #  ← Routes CRUD
app.include_router(preferences.router, prefix="/api") #  ← Dashboard layout preferences
app.include_router(backup_router.router, prefix="/api") #  ← Backup management

@app.get("/", tags=["Health"])
def root():
    """Quick check that the server is alive."""
    return {
        "status":  "running",
        "system":  "Creative Computers Invoice API",
        "version": "1.1.0",
        "docs":    "/docs",
    }

# ── Serve React build ─────────────────────────────────────────
# After npm run build, the React app lives in backend/static/react/
# FastAPI serves index.html for any URL not matched by an API route.
# This is what makes React Router work correctly on refresh.

REACT_DIR    = STATIC_DIR / "react"
REACT_ASSETS = REACT_DIR / "assets"
REACT_INDEX  = REACT_DIR / "index.html"

# Mount React's compiled JS/CSS assets
if REACT_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(REACT_ASSETS)), name="react-assets")

# Catch-all: serve React's index.html for every other URL
# FastAPI processes this LAST — all /api routes above take priority
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_react(full_path: str):
    if REACT_INDEX.exists():
        return FileResponse(str(REACT_INDEX))
    return {
        "message": "React build not found.",
        "fix": "Run:  cd frontend && npm run build",
        "then": "Restart the server."
    }
