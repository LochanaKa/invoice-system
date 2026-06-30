"""
routers/pdf_router.py — PDF Invoice Generation
================================================
GET /api/invoices/{id}/pdf  → returns the invoice as a downloadable PDF

How it works:
  1. Load the invoice + all relationships from PostgreSQL
  2. Load the cc_logo.png and encode it as base64 (so it works inside HTML string)
  3. Render invoice.html (Jinja2 template) with the real data
  4. WeasyPrint converts the HTML → PDF bytes
  5. Return the bytes as a file download response
"""

import os
import base64
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from jinja2 import Environment, FileSystemLoader, select_autoescape

try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT_OK = True
except Exception:
    WEASYPRINT_OK = False

from database import get_db
from models import CompanySettings, Invoice, Customer, Rep, InvoiceItem

router = APIRouter(prefix="/invoices", tags=["PDF"])

# ── Jinja2 setup ──────────────────────────────────────────────
# __file__ is  backend/routers/pdf_router.py
# templates/   is  backend/templates/ (or backend/template/)
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
if not os.path.isdir(TEMPLATE_DIR):
    TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "template")

jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)

# ── Logo path ─────────────────────────────────────────────────
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "cc_logo.png")


def load_logo_b64() -> str | None:
    """Read cc_logo.png and return as base64 string for embedding in HTML."""
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    return None   # template will show text fallback


# ── PDF endpoint ──────────────────────────────────────────────
@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """
    Generate and return an A4 PDF for the given invoice.
    Matches Creative Computers' exact printed template.
    """
    if not WEASYPRINT_OK:
        raise HTTPException(
            status_code=501,
            detail="WeasyPrint is not installed or GTK is missing. "
                   "Install GTK runtime and restart the server."
        )

    # ── 1. Load invoice with all related data ─────────────────
    inv = (
        db.query(Invoice)
          .options(
              joinedload(Invoice.customer),
              joinedload(Invoice.rep),
              joinedload(Invoice.items.of_type(InvoiceItem)),
          )
          .filter(Invoice.id == invoice_id)
          .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Sort items by line number (joinedload doesn't guarantee order)
    inv.items.sort(key=lambda x: x.line_number)
    company = db.query(CompanySettings).filter(CompanySettings.id == 1).first()
    if not company:
        company = CompanySettings(
            company_name="Creative Computers",
            address="No. 95, Colombo Road, Kurunegala",
            tin="783634953-7000",
            phone_numbers="+94 37 22 29 181\n+94 77 57 67 070",
            default_warranty_text="Please submit the Original Invoice for warranty claims.",
        )

    # ── 2. Use stored grand total (includes margin, SSCL, VAT) ─
    grand_total = float(inv.grand_total or 0)

    # ── 3. Render the HTML template ───────────────────────────
    template = jinja_env.get_template("invoice.html")
    html_str = template.render(
        invoice     = inv,
        grand_total = grand_total,
        logo_b64    = load_logo_b64(),
        company     = company,
        company_phones = [p.strip() for p in (company.phone_numbers or "").splitlines() if p.strip()],
        warranty_terms = [p.strip() for p in (company.default_warranty_text or "").splitlines() if p.strip()],
    )

    # ── 4. Convert HTML → PDF ─────────────────────────────────
    try:
        pdf_bytes = WeasyHTML(string=html_str).write_pdf()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}"
        )

    # ── 5. Return as file download ────────────────────────────
    filename = f"{inv.invoice_number}.pdf"
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {
            "Content-Disposition":        f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )
