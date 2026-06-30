"""
routers/vat_report.py — VAT Summary Report for IRD Filing
===========================================================
Gazette No. 2463/05 (effective April 2026):
  - VAT-registered businesses must report all tax invoices monthly
  - Each invoice must show: supplier TIN, customer TIN, sequential
    number, taxable value, VAT amount
  - RAMIS platform integration tracks posting status

Endpoints:
  GET  /api/vat-report/summary?year=&month=   → JSON summary
  POST /api/vat-report/mark-all-posted?year=&month= → mark all posted
  GET  /api/vat-report/pdf?year=&month=       → PDF download
"""

import os, base64, calendar
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, func
from jinja2 import Environment, FileSystemLoader, select_autoescape

try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT_OK = True
except Exception:
    WEASYPRINT_OK = False

from database import get_db
from models import Invoice, Customer, Rep

router = APIRouter(prefix="/vat-report", tags=["VAT Report"])

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
if not os.path.isdir(TEMPLATE_DIR):
    TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "template")
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "cc_logo.png")

CC_TIN = "783634953-7000"   # Creative Computers VAT/TIN number


def load_logo_b64():
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return None


def get_vat_invoices(year: int, month: int, db: Session):
    """Return all VAT SALE invoices for a given month, with customer."""
    return (
        db.query(Invoice, Customer)
          .join(Customer, Invoice.customer_id == Customer.id)
          .filter(
              Invoice.invoice_category == "VAT",
              Invoice.service_type      == "SALE",
              extract("year",  Invoice.invoice_date) == year,
              extract("month", Invoice.invoice_date) == month,
          )
          .order_by(Invoice.invoice_number)
          .all()
    )


# ── GET SUMMARY ───────────────────────────────────────────────
@router.get("/summary")
def vat_summary(
    year:  int = Query(..., description="Year e.g. 2026"),
    month: int = Query(..., description="Month 1-12"),
    db: Session = Depends(get_db),
):
    """
    Full VAT summary for a given month.
    Used to populate the VAT Report page in React.
    """
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1–12")

    rows = get_vat_invoices(year, month, db)

    total_taxable = sum(float((inv.base_subtotal or 0) + (inv.profit_margin_amount or 0)) for inv, _ in rows)
    total_sscl    = sum(float(inv.sscl_amount or 0) for inv, _ in rows)
    total_vat     = sum(float(inv.vat_amount or 0) for inv, _ in rows)
    total_grand   = sum(float(inv.grand_total or 0) for inv, _ in rows)
    posted_count  = sum(1 for inv, _ in rows if inv.is_vat_posted)

    invoices_out = []
    for inv, cust in rows:
        invoices_out.append({
            "id":             inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date":   str(inv.invoice_date),
            "customer_name":  cust.name,
            "customer_tin":   cust.tin or "—",
            "contact_name":   inv.contact_name or "",
            "taxable_value":  float((inv.base_subtotal or 0) + (inv.profit_margin_amount or 0)),
            "sscl_amount":    float(inv.sscl_amount or 0),
            "vat_amount":     float(inv.vat_amount or 0),
            "grand_total":    float(inv.grand_total or 0),
            "is_vat_posted":  inv.is_vat_posted,
        })

    return {
        "year":           year,
        "month":          month,
        "month_name":     calendar.month_name[month],
        "period":         f"{year}-{month:02d}",
        "supplier_tin":   CC_TIN,
        "invoice_count":  len(rows),
        "posted_count":   posted_count,
        "unposted_count": len(rows) - posted_count,
        "total_taxable":  round(total_taxable, 2),
        "total_sscl":     round(total_sscl, 2),
        "total_vat":      round(total_vat, 2),
        "grand_total":    round(total_grand, 2),
        "invoices":       invoices_out,
    }


# ── MARK ALL AS POSTED ────────────────────────────────────────
@router.post("/mark-all-posted")
def mark_all_posted(
    year:  int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Mark every unposted VAT invoice in this month as submitted to RAMIS.
    Called after the accountant uploads the period data to the IRD system.
    """
    rows = get_vat_invoices(year, month, db)
    count = 0
    for inv, _ in rows:
        if not inv.is_vat_posted:
            inv.is_vat_posted = True
            count += 1
    db.commit()
    return {
        "message": f"Marked {count} invoices as RAMIS posted "
                   f"for {calendar.month_name[month]} {year}"
    }


# ── PDF EXPORT ────────────────────────────────────────────────
@router.get("/pdf")
def vat_summary_pdf(
    year:  int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Generate a printable IRD-format VAT summary report for the period.
    """
    if not WEASYPRINT_OK:
        raise HTTPException(status_code=501,
            detail="WeasyPrint not available. Install GTK runtime.")

    data = vat_summary(year=year, month=month, db=db)

    template  = jinja_env.get_template("vat_summary.html")
    today_str = date.today().isoformat()
    html_str  = template.render(report=data, logo_b64=load_logo_b64(), today=today_str)

    pdf_bytes = WeasyHTML(string=html_str).write_pdf()
    filename  = f"VAT_Summary_{year}_{month:02d}.pdf"

    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {
            "Content-Disposition":           f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )
