import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.stock_receipts import calculate_receipt_line


def test_calculate_receipt_line_percentage():
    """
    Test standard math:
    1. unit_cost = 1000
    2. operation_cost_amount = 1000 * 0.05 = 50.00
       subtotal_after_opcost = 1000 + 50 = 1050
    3. sscl_amount = 1050 * 0.025 = 26.25
       after_sscl = 1050 + 26.25 = 1076.25
    4. vat_amount = 1076.25 * 0.18 = 193.725 -> 193.73 (rounded)
       final_unit_price = 1076.25 + 193.73 = 1269.98
    """
    result = calculate_receipt_line(
        unit_cost=Decimal("1000.00"),
        operation_cost_type="percentage",
        operation_cost_value=Decimal("5.0000"),
        sscl_pct=Decimal("0.025"),
        vat_pct=Decimal("0.18"),
    )
    assert result["operation_cost_amount"] == Decimal("50.00")
    assert result["subtotal_after_opcost"] == Decimal("1050.00")
    assert result["sscl_amount"] == Decimal("26.25")
    assert result["vat_amount"] == Decimal("193.73")
    assert result["final_unit_price"] == Decimal("1269.98")


def test_calculate_receipt_line_fixed():
    """
    Test standard math with fixed operation cost:
    1. unit_cost = 1000
    2. operation_cost_amount = 150
       subtotal_after_opcost = 1000 + 150 = 1150
    3. sscl_amount = 1150 * 0.025 = 28.75
       after_sscl = 1150 + 28.75 = 1178.75
    4. vat_amount = 1178.75 * 0.18 = 212.175 -> 212.18 (rounded)
       final_unit_price = 1178.75 + 212.18 = 1390.93
    """
    result = calculate_receipt_line(
        unit_cost=Decimal("1000.00"),
        operation_cost_type="fixed",
        operation_cost_value=Decimal("150.00"),
        sscl_pct=Decimal("0.025"),
        vat_pct=Decimal("0.18"),
    )
    assert result["operation_cost_amount"] == Decimal("150.00")
    assert result["subtotal_after_opcost"] == Decimal("1150.00")
    assert result["sscl_amount"] == Decimal("28.75")
    assert result["vat_amount"] == Decimal("212.18")
    assert result["final_unit_price"] == Decimal("1390.93")
