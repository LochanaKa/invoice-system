"""
routers/dashboard.py — Summary statistics and reports
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, case, Float
from typing import List, Optional
from datetime import date
import calendar

from database import get_db
from models import Invoice, Customer, Rep, Payment, Route, CompanySettings, RateSetting, Settings
from schemas import (
    DashboardSummary,
    RepPerformance,
    CreditAging,
    RevenueTrendPoint,
    TopCustomer,
    OutstandingDebtor,
    RoutePerformanceOut,
    YoYComparison,
    AgingBucket,
    InvoiceDetail,
    LeaderboardRep,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db)
):
    """
    Top-level numbers for the main dashboard card.
    Supports a global time filter for all summary metrics.
    """
    today = date.today()
    filters = []

    if period == "monthly":
        filters.append(extract("year", Invoice.invoice_date) == (year or today.year))
        filters.append(extract("month", Invoice.invoice_date) == (month or today.month))
    elif period == "annually":
        filters.append(extract("year", Invoice.invoice_date) == (year or today.year))

    totals_query = db.query(
        func.coalesce(func.sum(case((Invoice.service_type == "SALE", Invoice.grand_total), else_=0)), 0).label("sales_revenue"),
        func.coalesce(func.sum(case((Invoice.service_type == "REPAIR", Invoice.grand_total), else_=0)), 0).label("repair_revenue"),
        func.coalesce(func.sum(Invoice.vat_amount), 0).label("total_vat"),
        func.coalesce(func.sum(Invoice.credit_balance), 0).label("outstanding"),
        func.coalesce(func.sum(case((Invoice.service_type == "SALE", 1), else_=0)), 0).label("sales_invoice_count"),
        func.coalesce(func.sum(case((Invoice.service_type == "REPAIR", 1), else_=0)), 0).label("repair_invoice_count"),
        func.coalesce(func.count(Invoice.id), 0).label("invoice_count"),
    )

    if filters:
        totals_query = totals_query.filter(*filters)

    totals = totals_query.first()

    month_sales = (db.query(func.coalesce(func.sum(Invoice.grand_total), 0))
                     .filter(Invoice.service_type == "SALE",
                             extract("year", Invoice.invoice_date) == today.year,
                             extract("month", Invoice.invoice_date) == today.month)
                     .scalar())

    month_repairs = (db.query(func.coalesce(func.sum(Invoice.grand_total), 0))
                       .filter(Invoice.service_type == "REPAIR",
                               extract("year", Invoice.invoice_date) == today.year,
                               extract("month", Invoice.invoice_date) == today.month)
                       .scalar())

    customer_count = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar()

    return DashboardSummary(
        total_sales_amount   = totals.sales_revenue,
        sales_revenue        = totals.sales_revenue,
        repair_revenue       = totals.repair_revenue,
        total_vat_collected  = totals.total_vat,
        total_outstanding    = totals.outstanding,
        sales_invoice_count  = int(totals.sales_invoice_count),
        repair_invoice_count = int(totals.repair_invoice_count),
        invoice_count        = int(totals.invoice_count),
        customer_count       = customer_count,
        sales_this_month     = month_sales or 0,
        repairs_this_month   = month_repairs or 0,
    )


def build_period_filters(period: str, year: Optional[int], month: Optional[int]):
    today = date.today()
    filters = []

    if period == "monthly":
        filters.extend([
            extract("year", Invoice.invoice_date) == (year or today.year),
            extract("month", Invoice.invoice_date) == (month or today.month),
        ])
    elif period == "annually":
        filters.append(extract("year", Invoice.invoice_date) == (year or today.year))

    return filters


@router.get("/revenue-trend", response_model=List[RevenueTrendPoint])
@router.get("/trends", response_model=List[RevenueTrendPoint])
def revenue_trend(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db)
):
    filters = []
    if period != "all_time":
        filters = build_period_filters(period, year, month)

    if period == "monthly":
        rows = (
            db.query(
                func.date_trunc("week", Invoice.invoice_date).label("week_start"),
                func.coalesce(func.cast(func.sum(case((Invoice.service_type == "SALE", Invoice.grand_total), else_=0)), Float), 0.0).label("sales"),
                func.coalesce(func.cast(func.sum(case((Invoice.service_type == "REPAIR", Invoice.grand_total), else_=0)), Float), 0.0).label("repairs"),
                func.coalesce(func.cast(func.sum(Invoice.credit_balance), Float), 0.0).label("outstanding"),
            )
            .filter(*filters)
            .group_by("week_start")
            .order_by("week_start")
            .all()
        )

        return [
            RevenueTrendPoint(
                year=int(r.week_start.year),
                month=int(r.week_start.month),
                month_label=r.week_start.strftime("Wk %d %b"),
                sales=float(r.sales),
                repairs=float(r.repairs),
                outstanding=float(r.outstanding),
            )
            for r in rows
        ]

    rows = (
        db.query(
            extract("year", Invoice.invoice_date).label("year"),
            extract("month", Invoice.invoice_date).label("month"),
            func.coalesce(func.cast(func.sum(case((Invoice.service_type == "SALE", Invoice.grand_total), else_=0)), Float), 0.0).label("sales"),
            func.coalesce(func.cast(func.sum(case((Invoice.service_type == "REPAIR", Invoice.grand_total), else_=0)), Float), 0.0).label("repairs"),
            func.coalesce(func.cast(func.sum(Invoice.credit_balance), Float), 0.0).label("outstanding"),
        )
        .filter(*filters)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    return [
        RevenueTrendPoint(
            year=int(r.year),
            month=int(r.month),
            month_label=f"{int(r.month):02d}/{int(r.year)}",
            sales=float(r.sales),
            repairs=float(r.repairs),
            outstanding=float(r.outstanding),
        )
        for r in rows
    ]


@router.get("/top-customers", response_model=List[TopCustomer])
def top_customers(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db)
):
    filters = build_period_filters(period, year, month)

    rows = (
        db.query(
            Customer.id.label("customer_id"),
            Customer.name.label("customer_name"),
            func.count(Invoice.id).label("service_count"),
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total_revenue"),
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .filter(*filters)
        .group_by(Customer.id, Customer.name)
        .order_by(desc("total_revenue"))
        .limit(limit)
        .all()
    )

    results = []
    for r in rows:
        # fetch recent paid invoices (credit_balance == 0) for quick drill-down
        paid_rows = (
            db.query(Invoice)
            .filter(Invoice.customer_id == r.customer_id, Invoice.credit_balance == 0)
            .order_by(desc(Invoice.invoice_date))
            .limit(5)
            .all()
        )

        paid_invoices = [
            {
                "id": p.id,
                "invoice_number": p.invoice_number,
                "invoice_date": p.invoice_date,
                "service_type": p.service_type,
                "grand_total": p.grand_total,
                "credit_balance": p.credit_balance,
            }
            for p in paid_rows
        ]

        results.append(
            TopCustomer(
                customer_id=int(r.customer_id),
                customer_name=r.customer_name,
                service_count=int(r.service_count),
                total_revenue=r.total_revenue,
                paid_invoices=paid_invoices,
            )
        )

    return results



@router.get("/customer-invoices/{customer_id}", response_model=List[InvoiceDetail])
def customer_invoices_with_items(customer_id: int, db: Session = Depends(get_db)):
    """Return all invoices for a customer with full items and payments (drill-down)."""
    invs = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.items),
            joinedload(Invoice.payments),
            joinedload(Invoice.rep),
            joinedload(Invoice.customer),
        )
        .filter(Invoice.customer_id == customer_id)
        .order_by(desc(Invoice.invoice_date))
        .all()
    )

    results = []
    for inv in invs:
        results.append(
            InvoiceDetail(
                id=inv.id,
                invoice_number=inv.invoice_number,
                invoice_category=inv.invoice_category,
                service_type=inv.service_type,
                invoice_date=inv.invoice_date,
                customer_id=inv.customer_id,
                rep_id=inv.rep_id,
                appointment_id=inv.appointment_id,
                amount=inv.amount,
                base_subtotal=inv.base_subtotal,
                profit_margin_pct=inv.profit_margin_pct,
                profit_margin_amount=inv.profit_margin_amount,
                sscl_pct=inv.sscl_pct,
                sscl_amount=inv.sscl_amount,
                vat_pct=inv.vat_pct,
                vat_amount=inv.vat_amount,
                grand_total=inv.grand_total,
                credit_balance=inv.credit_balance,
                is_vat_posted=inv.is_vat_posted,
                contact_name=inv.contact_name,
                due_date=inv.due_date,
                po_number=inv.po_number,
                remarks=inv.remarks,
                warranty=inv.warranty,
                created_at=inv.created_at,
                customer_name=inv.customer.name if inv.customer else None,
                rep_name=inv.rep.name if inv.rep else None,
                route_name=inv.customer.route.name if inv.customer and inv.customer.route else None,
                items=[
                    {
                        "id": it.id,
                        "invoice_id": it.invoice_id,
                        "line_number": it.line_number,
                        "description": it.description,
                        "serial_no": it.serial_no,
                        "qty": it.qty,
                        "raw_rate": it.raw_rate,
                        "rate": it.rate,
                        "amount": it.amount,
                    }
                    for it in inv.items
                ],
                payments=[p for p in inv.payments],
            )
        )

    return results


@router.get("/top-outstanding", response_model=List[OutstandingDebtor])
def top_outstanding(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Top outstanding debtor customers by unpaid credit balance."""
    rows = (
        db.query(
            Customer.id.label("customer_id"),
            Customer.name.label("customer_name"),
            Customer.phone.label("phone"),
            Route.name.label("route_name"),
            func.count(Invoice.id).label("unpaid_invoice_count"),
            func.coalesce(func.sum(Invoice.credit_balance), 0).label("total_outstanding"),
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .outerjoin(Route, Customer.route_id == Route.id)
        .filter(Invoice.credit_balance > 0)
        .filter(Customer.is_active == True)
        .group_by(Customer.id, Customer.name, Customer.phone, Route.name)
        .order_by(desc("total_outstanding"))
        .limit(limit)
        .all()
    )

    return [
        OutstandingDebtor(
            customer_id=r.customer_id,
            customer_name=r.customer_name,
            route_name=r.route_name,
            phone=r.phone,
            unpaid_invoice_count=int(r.unpaid_invoice_count),
            total_outstanding=r.total_outstanding,
        )
        for r in rows
    ]


@router.get("/route-performance", response_model=List[RoutePerformanceOut])
def route_performance(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db)
):
    filters = build_period_filters(period, year, month)

    rows = (
        db.query(
            Route.name.label("route_name"),
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total_revenue"),
            func.coalesce(func.sum(Invoice.credit_balance), 0).label("total_outstanding"),
        )
        .join(Customer, Invoice.customer_id == Customer.id)
        .join(Route, func.coalesce(Invoice.route_id, Customer.route_id) == Route.id)
        .filter(*filters)
        .group_by(Route.name)
        .order_by(desc("total_revenue"))
        .all()
    )

    return [
        RoutePerformanceOut(
            route_name=r.route_name,
            total_revenue=r.total_revenue,
            total_outstanding=r.total_outstanding,
        )
        for r in rows
    ]


@router.get("/yoy-comparison", response_model=YoYComparison)
def yoy_comparison(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db)
):
    today = date.today()

    def revenue_for(target_year: int, target_month: Optional[int] = None):
        query = db.query(func.coalesce(func.sum(Invoice.grand_total), 0))
        if period == "monthly":
            query = query.filter(
                extract("year", Invoice.invoice_date) == target_year,
                extract("month", Invoice.invoice_date) == target_month,
            )
        elif period == "annually":
            query = query.filter(extract("year", Invoice.invoice_date) == target_year)
        else:
            query = query.filter(
                extract("year", Invoice.invoice_date) == target_year,
                extract("month", Invoice.invoice_date) <= today.month,
            )
        return query.scalar() or 0

    if period == "monthly":
        current_year = year or today.year
        current_month = month or today.month
        prior_year = current_year - 1
        current_revenue = revenue_for(current_year, current_month)
        prior_revenue = revenue_for(prior_year, current_month)
    elif period == "annually":
        current_year = year or today.year
        prior_year = current_year - 1
        current_revenue = revenue_for(current_year)
        prior_revenue = revenue_for(prior_year)
    else:
        current_year = today.year
        prior_year = today.year - 1
        current_revenue = revenue_for(current_year)
        prior_revenue = revenue_for(prior_year)

    change_pct = 0
    if prior_revenue:
        change_pct = ((current_revenue - prior_revenue) / prior_revenue) * 100
    elif current_revenue:
        change_pct = 100

    trend = "flat"
    if current_revenue > prior_revenue:
        trend = "up"
    elif current_revenue < prior_revenue:
        trend = "down"

    return YoYComparison(
        current_period_revenue=current_revenue,
        prior_period_revenue=prior_revenue,
        change_pct=round(change_pct, 2),
        trend=trend,
    )


@router.get("/aging-buckets", response_model=List[AgingBucket])
def aging_buckets(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db)
):
    filters = build_period_filters(period, year, month)
    overdue_days = func.current_date() - func.coalesce(Invoice.due_date, Invoice.invoice_date)
    bucket_case = case(
        (overdue_days <= 30, "0-30 Days Overdue"),
        (overdue_days <= 60, "31-60 Days Overdue"),
        (overdue_days <= 90, "61-90 Days Overdue"),
        else_="90+ Days Overdue",
    )

    rows = (
        db.query(
            bucket_case.label("bucket"),
            func.coalesce(func.sum(Invoice.credit_balance), 0).label("total_amount"),
        )
        .filter(Invoice.credit_balance > 0, overdue_days >= 0, *filters)
        .group_by("bucket")
        .order_by("bucket")
        .all()
    )

    total_amount = sum(float(r.total_amount) for r in rows) or 0
    bucket_order = [
        "0-30 Days Overdue",
        "31-60 Days Overdue",
        "61-90 Days Overdue",
        "90+ Days Overdue",
    ]

    result = []
    for bucket in bucket_order:
        match = next((r for r in rows if r.bucket == bucket), None)
        amount = float(match.total_amount) if match else 0
        percentage = round((amount / total_amount) * 100, 1) if total_amount else 0
        result.append(AgingBucket(bucket=bucket, total_amount=amount, percentage=percentage))

    return result


@router.get("/sales-by-rep", response_model=List[RepPerformance])
def sales_by_rep(
    year:  Optional[int] = Query(None, description="Filter by year e.g. 2026"),
    month: Optional[int] = Query(None, description="Filter by month 1-12"),
    db: Session = Depends(get_db)
):
    """
    Sales and returns grouped by sales rep.
    Used for rep performance dashboard.
    """
    q = (db.query(
             Rep.name.label("rep_name"),
             func.count(Invoice.id).label("invoice_count"),
             func.coalesce(
                 func.sum(case((Invoice.service_type == "SALE", Invoice.grand_total), else_=0)), 0
             ).label("total_sales"),
             func.coalesce(
                 func.sum(case((Invoice.service_type == "REPAIR", Invoice.grand_total), else_=0)), 0
             ).label("total_repairs"),
         )
         .join(Invoice, Invoice.rep_id == Rep.id)
         .group_by(Rep.name)
         .order_by(desc("total_sales")))

    if year:  q = q.filter(extract("year",  Invoice.invoice_date) == year)
    if month: q = q.filter(extract("month", Invoice.invoice_date) == month)

    rows = q.all()
    return [
        RepPerformance(
            rep_name      = r.rep_name,
            invoice_count = r.invoice_count,
            total_sales   = r.total_sales,
            total_repairs = r.total_repairs,
        )
        for r in rows
    ]


@router.get("/leaderboard", response_model=List[LeaderboardRep])
def sales_repair_race_leaderboard(
    period: str = Query("all_time", regex="^(all_time|monthly|annually)$"),
    year: Optional[int] = Query(None, description="Year filter for monthly or annual views"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter when period=monthly"),
    db: Session = Depends(get_db),
):
    """
    Ranked race leaderboard by actual collected revenue.
    Only fully paid invoices count: Invoice.credit_balance == 0.
    SALE and REPAIR grand totals are combined.
    """
    filters = build_period_filters(period, year, month)

    rows = (
        db.query(
            Rep.id.label("rep_id"),
            Rep.name.label("rep_name"),
            Rep.code.label("employee_number"),
            func.count(Invoice.id).label("invoice_count"),
            func.coalesce(func.sum(case((Invoice.service_type == "SALE", 1), else_=0)), 0).label("sale_count"),
            func.coalesce(func.sum(case((Invoice.service_type == "REPAIR", 1), else_=0)), 0).label("repair_count"),
            func.coalesce(func.sum(Invoice.grand_total), 0).label("total_collected"),
        )
        .join(Invoice, Invoice.rep_id == Rep.id)
        .filter(Rep.is_active == True)
        .filter(Invoice.credit_balance == 0)
        .filter(Invoice.service_type.in_(["SALE", "REPAIR"]))
        .filter(*filters)
        .group_by(Rep.id, Rep.name, Rep.code)
        .order_by(desc("total_collected"), Rep.name)
        .all()
    )

    return [
        LeaderboardRep(
            rank=index,
            rep_id=int(row.rep_id),
            rep_name=row.rep_name,
            employee_number=row.employee_number,
            invoice_count=int(row.invoice_count or 0),
            sale_count=int(row.sale_count or 0),
            repair_count=int(row.repair_count or 0),
            total_collected=row.total_collected,
        )
        for index, row in enumerate(rows, start=1)
    ]


@router.get("/credit-aging", response_model=List[CreditAging])
def credit_aging(db: Session = Depends(get_db)):
    """
    All invoices with outstanding credit_balance > 0,
    sorted by oldest first — the most overdue at the top.
    Days overdue is calculated from the invoice date to today.
    """
    today = date.today()

    rows = (db.query(Invoice, Customer)
              .join(Customer, Invoice.customer_id == Customer.id)
              .filter(Invoice.credit_balance > 0,
                      Invoice.service_type == "SALE")
              .order_by(Invoice.invoice_date)   # oldest first
              .all())

    result = []
    for inv, cust in rows:
        days = (today - inv.invoice_date).days
        result.append(CreditAging(
            customer_name  = cust.name,
            invoice_number = inv.invoice_number,
            invoice_date   = inv.invoice_date,
            amount         = inv.amount,
            credit_balance = inv.credit_balance,
            days_overdue   = days,
        ))
    return result


@router.get("/vat-summary")
def vat_summary(
    year:  int = Query(..., description="Year e.g. 2026"),
    month: int = Query(..., description="Month 1-12"),
    db: Session = Depends(get_db)
):
    """
    VAT summary for a given month — used for IRD filing.
    Returns total taxable value and VAT collected.
    """
    rows = (db.query(
                Invoice.invoice_number,
                Invoice.invoice_date,
                Customer.name.label("customer_name"),
                Customer.tin.label("customer_tin"),
                Invoice.amount,
                Invoice.vat_amount,
                Invoice.is_vat_posted,
            )
            .join(Customer, Invoice.customer_id == Customer.id)
            .filter(
                Invoice.invoice_category == "VAT",
                Invoice.service_type == "SALE",
                extract("year",  Invoice.invoice_date) == year,
                extract("month", Invoice.invoice_date) == month,
            )
            .order_by(Invoice.invoice_number)
            .all())

    total_taxable = sum(float(r.amount) for r in rows)
    total_vat     = sum(float(r.vat_amount) for r in rows)

    return {
        "period":       f"{year}-{month:02d}",
        "month_name":   calendar.month_name[month],
        "invoice_count": len(rows),
        "total_taxable": round(total_taxable, 2),
        "total_vat":     round(total_vat, 2),
        "invoices": [
            {
                "invoice_number": r.invoice_number,
                "invoice_date":   str(r.invoice_date),
                "customer_name":  r.customer_name,
                "customer_tin":   r.customer_tin,
                "taxable_value":  float(r.amount),
                "vat_amount":     float(r.vat_amount),
                "is_vat_posted":  r.is_vat_posted,
            }
            for r in rows
        ]
    }


@router.get("/lookups")
def get_lookups(db: Session = Depends(get_db)):
    """
    All dropdown data for the frontend in one call.
    Avoids 4 separate API calls when loading a form.
    """
    reps   = db.query(Rep).filter(Rep.is_active == True).order_by(Rep.name).all()
    routes = db.query(Route).filter(Route.is_active == True).order_by(Route.name).all()
    settings = db.query(Settings).filter(Settings.id == 1).first()
    company = db.query(CompanySettings).filter(CompanySettings.id == 1).first()
    rates = db.query(RateSetting).filter(RateSetting.is_active == True).order_by(RateSetting.id).all()

    return {
        "reps":   [{"id": r.id, "name": r.name, "code": r.code} for r in reps],
        "routes": [{"id": r.id, "name": r.name, "is_active": r.is_active} for r in routes],
        "settings": {
            "sscl_pct": settings.sscl_pct if settings else 0.025,
            "vat_pct": settings.vat_pct if settings else 0.18,
            "profit_margin": settings.profit_margin if settings else 0.20,
            "rates": [
                {
                    "id": rate.id,
                    "key": rate.key,
                    "label": rate.label,
                    "rate": rate.rate,
                    "rate_type": rate.rate_type,
                    "description": rate.description,
                    "is_active": rate.is_active,
                }
                for rate in rates
            ],
        },
        "company_info": {
            "company_name": company.company_name if company else "Creative Computers",
            "address": company.address if company else "No. 95, Colombo Road, Kurunegala",
            "tin": company.tin if company else "783634953-7000",
            "phone_numbers": [
                p.strip() for p in ((company.phone_numbers if company else "") or "").splitlines()
                if p.strip()
            ],
        },
        "warranty": {
            "default_warranty_text": company.default_warranty_text if company else "",
        },
    }
