from datetime import date
import calendar


def _add_months(start_date: date, months: int) -> date:
    month = start_date.month - 1 + months
    year = start_date.year + month // 12
    month = month % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def get_warranty_summary(unit, sold_item, today: date | None = None):
    today = today or date.today()
    sale_date = None
    if sold_item and getattr(sold_item, "invoice", None) and sold_item.invoice.invoice_date:
        sale_date = sold_item.invoice.invoice_date

    manufacturer_expiry = None
    manufacturer_status = "not applicable"
    if getattr(unit, "has_manufacturer_warranty", False) and getattr(unit, "manufacturer_warranty_months", None) is not None and sale_date is not None:
        manufacturer_expiry = _add_months(sale_date, unit.manufacturer_warranty_months)
        manufacturer_status = f"valid until {manufacturer_expiry.isoformat()}" if today <= manufacturer_expiry else f"expired on {manufacturer_expiry.isoformat()}"

    customer_expiry = None
    customer_status = "not applicable"
    warranty_months = getattr(unit, "warranty_months", None)
    if warranty_months is None and sold_item is not None:
        warranty_months = getattr(sold_item, "warranty_months", None)

    if sale_date is not None and warranty_months is not None:
        customer_expiry = _add_months(sale_date, warranty_months)
        customer_status = f"valid until {customer_expiry.isoformat()}" if today <= customer_expiry else f"expired on {customer_expiry.isoformat()}"

    return {
        "sale_date": sale_date,
        "manufacturer_expiry": manufacturer_expiry,
        "manufacturer_status": manufacturer_status,
        "customer_expiry": customer_expiry,
        "customer_status": customer_status,
    }


def evaluate_job_card_warranty(unit, sold_item, today: date | None = None):
    today = today or date.today()
    summary = get_warranty_summary(unit, sold_item, today=today)

    manufacturer_valid = bool(
        getattr(unit, "has_manufacturer_warranty", False)
        and getattr(unit, "manufacturer_warranty_months", None) is not None
        and summary["manufacturer_expiry"] is not None
        and today <= summary["manufacturer_expiry"]
    )

    customer_valid = bool(
        summary["customer_expiry"] is not None and today <= summary["customer_expiry"]
    )

    if manufacturer_valid:
        return {
            "job_type": "WARRANTY_REPAIR",
            "entry_action": "send_manufacturer",
            "new_status": "with_manufacturer",
            "manufacturer_valid": True,
            "manufacturer_expiry": summary["manufacturer_expiry"],
            "customer_valid": customer_valid,
            "customer_expiry": summary["customer_expiry"],
            "manufacturer_status": summary["manufacturer_status"],
            "customer_status": summary["customer_status"],
        }

    if customer_valid:
        return {
            "job_type": "WARRANTY_REPAIR",
            "entry_action": "send_internal_warranty",
            "new_status": "with_internal_team_warranty",
            "manufacturer_valid": False,
            "manufacturer_expiry": summary["manufacturer_expiry"],
            "customer_valid": True,
            "customer_expiry": summary["customer_expiry"],
            "manufacturer_status": summary["manufacturer_status"],
            "customer_status": summary["customer_status"],
        }

    return {
        "job_type": "PAID_REPAIR",
        "entry_action": "send_internal_paid",
        "new_status": "with_internal_team_paid",
        "manufacturer_valid": False,
        "manufacturer_expiry": summary["manufacturer_expiry"],
        "customer_valid": False,
        "customer_expiry": summary["customer_expiry"],
        "manufacturer_status": summary["manufacturer_status"],
        "customer_status": summary["customer_status"],
    }
