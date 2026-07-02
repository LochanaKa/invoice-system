import sys
from pathlib import Path
from decimal import Decimal
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.inventory import calculate_final_price
from schemas import GRNItemCreate, GRNCreate


def test_calculate_final_price_standard():
    """
    Test Sri Lankan tax math formula with explicitly injected rates:
    1. Base Value = 1000 + 200 = 1200
    2. Profit Value = 1200 * 0.20 (20%) = 240
    3. Value After Margin = 1200 + 240 = 1440
    4. SSCL (2.5%) = 1440 * 0.025 = 36
    5. VAT (18%) = (1440 + 36) * 0.18 = 1476 * 0.18 = 265.68
    6. Final Price = 1440 + 36 + 265.68 = 1741.68
    """
    result = calculate_final_price(
        purchase_cost=Decimal("1000.00"),
        operation_cost=Decimal("200.00"),
        profit_margin_pct=Decimal("20.00"),
        is_custom_override=False,
        custom_price=None,
        sscl_rate=Decimal("0.025"),
        vat_rate=Decimal("0.18"),
    )
    assert result["final_selling_price"] == Decimal("1741.68")
    assert result["sscl_amount"] == Decimal("36.00")
    assert result["vat_amount"] == Decimal("265.68")
    assert result["profit_margin_value"] == Decimal("240.00")


def test_calculate_final_price_custom_override():
    """
    Test that when is_custom_override is True, it returns custom_price with zero breakdown.
    """
    result = calculate_final_price(
        purchase_cost=Decimal("1000.00"),
        operation_cost=Decimal("200.00"),
        profit_margin_pct=Decimal("20.00"),
        is_custom_override=True,
        custom_price=Decimal("1500.00"),
        sscl_rate=Decimal("0.025"),
        vat_rate=Decimal("0.18"),
    )
    assert result["final_selling_price"] == Decimal("1500.00")
    assert result["profit_margin_value"] == Decimal("0.00")
    assert result["sscl_amount"] == Decimal("0.00")
    assert result["vat_amount"] == Decimal("0.00")


def test_calculate_final_price_different_rates():
    """
    Verify the function correctly applies injected rates, not hardcoded values.
    If sscl_rate=0.030 (3%) and vat_rate=0.20 (20%):
      Base = 0 + 1000 = 1000, Profit = 0, After Margin = 1000
      SSCL = 1000 * 0.03 = 30
      VAT  = (1000 + 30) * 0.20 = 206
      Final = 1000 + 30 + 206 = 1236
    """
    result = calculate_final_price(
        purchase_cost=Decimal("1000.00"),
        operation_cost=Decimal("0.00"),
        profit_margin_pct=Decimal("0.00"),
        is_custom_override=False,
        custom_price=None,
        sscl_rate=Decimal("0.030"),
        vat_rate=Decimal("0.20"),
    )
    assert result["final_selling_price"] == Decimal("1236.00")
    assert result["sscl_amount"] == Decimal("30.00")
    assert result["vat_amount"] == Decimal("206.00")


def test_grn_item_create_validation_success():
    """
    Test schema validation with correct types.
    """
    item = GRNItemCreate(
        product_id=1,
        purchase_cost=Decimal("5000.00"),
        ops_cost=Decimal("250.00"),
        margin=Decimal("15.0"),
        is_custom_override=False,
        serial_numbers=["SN-001", "SN-002"]
    )
    assert item.product_id == 1
    assert item.purchase_cost == Decimal("5000.00")
    assert item.ops_cost == Decimal("250.00")
    assert item.margin == Decimal("15.0")
    assert not item.is_custom_override
    assert item.serial_numbers == ["SN-001", "SN-002"]


def test_grn_item_create_validation_negative_values():
    """
    Test schema validation fails for negative financial values.
    """
    try:
        GRNItemCreate(
            product_id=1,
            purchase_cost=Decimal("-10.00"),
            ops_cost=Decimal("0.00"),
            margin=Decimal("15.0"),
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Validation should have failed for negative purchase_cost")


def test_grn_create_validation_min_items():
    """
    Test schema validation fails when received_items list is empty.
    """
    try:
        GRNCreate(
            supplier_id=1,
            grn_number="GRN-1001",
            received_items=[]
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Validation should have failed for empty received_items list")
