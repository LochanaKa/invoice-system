import sys
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from schemas import JobCardCreate, JobCardUpdate
from warranty_utils import evaluate_job_card_warranty


def test_field_grn_requires_paper_grn_reference():
    try:
        JobCardCreate(
            customer_name="John Doe",
            device_name="Laptop",
            issue_description="Battery issue",
            received_by_staff_id=1,
            intake_method="FIELD_GRN",
        )
    except ValueError as exc:
        assert "paper_grn_reference" in str(exc)
    else:
        raise AssertionError("FIELD_GRN intake should require paper_grn_reference")


def test_walk_in_can_be_created_without_grn_reference():
    payload = JobCardCreate(
        customer_name="Jane Doe",
        device_name="Phone",
        issue_description="Screen replacement",
        received_by_staff_id=2,
        intake_method="WALK_IN",
    )

    assert payload.paper_grn_reference is None
    assert payload.intake_method == "WALK_IN"


def test_walk_in_can_accept_grn_reference():
    payload = JobCardCreate(
        customer_name="Jamie Doe",
        device_name="Phone",
        issue_description="Battery replacement",
        received_by_staff_id=8,
        intake_method="WALK_IN",
        paper_grn_reference="GRN-1001",
    )

    assert payload.paper_grn_reference == "GRN-1001"


def test_assigned_technician_can_be_set_optional():
    payload = JobCardCreate(
        customer_name="Alex Smith",
        device_name="Tablet",
        issue_description="Charging port repair",
        received_by_staff_id=3,
        assigned_to_staff_id=4,
    )

    assert payload.assigned_to_staff_id == 4


def test_update_schema_accepts_assigned_staff_change():
    payload = JobCardUpdate(assigned_to_staff_id=5)

    assert payload.assigned_to_staff_id == 5


def test_priority_can_be_set_optional():
    payload = JobCardCreate(
        customer_name="Taylor Doe",
        device_name="Monitor",
        issue_description="Display flickering",
        received_by_staff_id=6,
        priority="HIGH",
    )

    assert payload.priority == "HIGH"


def test_due_date_can_be_set_optional():
    payload = JobCardCreate(
        customer_name="Casey Doe",
        device_name="Keyboard",
        issue_description="Key replacement",
        received_by_staff_id=7,
        due_date="2026-07-10",
    )

    assert payload.due_date == date(2026, 7, 10)


def test_serial_number_can_be_set_optional():
    payload = JobCardCreate(
        customer_name="Riley Doe",
        device_name="Laptop",
        issue_description="Motherboard issue",
        received_by_staff_id=9,
        serial_number="SN-12345",
    )

    assert payload.serial_number == "SN-12345"


def test_customer_phone_can_be_set():
    payload = JobCardCreate(
        customer_name="Riley Doe",
        customer_phone="0771234567",
        device_name="Laptop",
        issue_description="Motherboard issue",
        received_by_staff_id=9,
        serial_number="SN-12345",
    )

    assert payload.customer_phone == "0771234567"


def test_update_schema_accepts_customer_phone_change():
    payload = JobCardUpdate(customer_phone="0779876543")

    assert payload.customer_phone == "0779876543"


def test_manufacturer_warranty_takes_priority_when_still_valid():
    today = date(2026, 7, 15)
    unit = type("Unit", (), {
        "has_manufacturer_warranty": True,
        "manufacturer_warranty_months": 6,
        "warranty_months": 3,
        "sold_invoice_item_id": 99,
    })()
    invoice = type("Invoice", (), {"invoice_date": date(2026, 4, 1)})()
    sold_item = type("SoldItem", (), {"invoice": invoice})()

    result = evaluate_job_card_warranty(unit, sold_item, today=today)

    assert result["job_type"] == "WARRANTY_REPAIR"
    assert result["entry_action"] == "send_manufacturer"
    assert result["new_status"] == "with_manufacturer"


def test_customer_warranty_is_used_when_manufacturer_warranty_is_not_applicable():
    today = date(2026, 7, 15)
    unit = type("Unit", (), {
        "has_manufacturer_warranty": False,
        "manufacturer_warranty_months": None,
        "warranty_months": 12,
        "sold_invoice_item_id": 100,
    })()
    invoice = type("Invoice", (), {"invoice_date": date(2026, 1, 1)})()
    sold_item = type("SoldItem", (), {"invoice": invoice})()

    result = evaluate_job_card_warranty(unit, sold_item, today=today)

    assert result["job_type"] == "WARRANTY_REPAIR"
    assert result["entry_action"] == "send_internal_warranty"
    assert result["new_status"] == "with_internal_team_warranty"

