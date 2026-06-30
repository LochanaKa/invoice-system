"""
routers/all_inc_report.py — All-Inclusive Invoice Summary Report
===============================================================
This endpoint produces a monthly business-watch summary for all-inclusive
invoices. It is intentionally similar to the VAT report page, but tailored to
invoice category ALL_INC and internal reporting rather than IRD filing.

Endpoints:
  GET  /api/all-inclusive-report/summary?year=&month=  → JSON summary
  GET  /api/all-inclusive-report/pdf?year=&month=      → PDF download
"""

import os, base64, calendar
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import extract
from jinja2 import Environment, FileSystemLoader, select_autoescape

from database import get_db
from models import Invoice, Customer

router = APIRouter(prefix="/all-inclusive-report", tags=["All-Inclusive Report"])

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
if not os.path.isdir(TEMPLATE_DIR):
    TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "template")
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "cc_logo.png")

CC_TIN = "783634953-7000"   # Creative Computers VAT/TIN number

try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT_OK = True
except Exception:
    WEASYPRINT_OK = False


def load_logo_b64():
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return None


def get_all_inc_invoices(year: int, month: int, db: Session):
    """Return all ALL_INC SALE invoices for a given month, with customer."""
    return (
        db.query(Invoice, Customer)
          .join(Customer, Invoice.customer_id == Customer.id)
          .filter(
              Invoice.invoice_category == "ALL_INC",
              Invoice.service_type      == "SALE",
              extract("year",  Invoice.invoice_date) == year,
              extract("month", Invoice.invoice_date) == month,
          )
          .order_by(Invoice.invoice_number)
          .all()
    )


@router.get("/summary")
def all_inc_summary(
    year:  int = Query(..., description="Year e.g. 2026"),
    month: int = Query(..., description="Month 1-12"),
    db: Session = Depends(get_db),
):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1–12")

    rows = get_all_inc_invoices(year, month, db)

    total_taxable = sum(float((inv.base_subtotal or 0) + (inv.profit_margin_amount or 0)) for inv, _ in rows)
    total_sscl    = sum(float(inv.sscl_amount or 0) for inv, _ in rows)
    total_vat     = sum(float(inv.vat_amount or 0) for inv, _ in rows)
    total_grand   = sum(float(inv.grand_total or 0) for inv, _ in rows)

    invoices_out = []
    for inv, cust in rows:
        invoices_out.append({
            "id":             inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date":   str(inv.invoice_date),
            "customer_name":  cust.name,
            "customer_tin":   cust.tin or "—",
            "taxable_value":  float((inv.base_subtotal or 0) + (inv.profit_margin_amount or 0)),
            "sscl_amount":    float(inv.sscl_amount or 0),
            "vat_amount":     float(inv.vat_amount or 0),
            "grand_total":    float(inv.grand_total or 0),
        })

    return {
        "year":           year,
        "month":          month,
        "month_name":     calendar.month_name[month],
        "period":         f"{year}-{month:02d}",
        "supplier_tin":   CC_TIN,
        "invoice_count":  len(rows),
        "total_taxable":  round(total_taxable, 2),
        "total_sscl":     round(total_sscl, 2),
        "total_vat":      round(total_vat, 2),
        "grand_total":    round(total_grand, 2),
        "invoices":       invoices_out,
    }


@router.get("/pdf")
def all_inc_summary_pdf(
    year:  int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    if not WEASYPRINT_OK:
        raise HTTPException(status_code=501,
            detail="WeasyPrint not available. Install GTK runtime.")

    data = all_inc_summary(year=year, month=month, db=db)
    data["title"] = "All-Inclusive Summary Report"
    data["subtitle"] = "Business Watch — Monthly All-Inclusive Invoices"

    template  = jinja_env.get_template("allinc_summary.html")
    today_str = date.today().isoformat()
    html_str  = template.render(report=data, logo_b64=load_logo_b64(), today=today_str)

    pdf_bytes = WeasyHTML(string=html_str).write_pdf()
    filename  = f"ALL_INC_Summary_{year}_{month:02d}.pdf"

    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {
            "Content-Disposition":           f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )
