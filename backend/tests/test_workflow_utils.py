import sys
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models import ManufacturerWarrantyClaim, StockUnit, StockUnitStatusHistory
from routers.manufacturer_warranty import update_manufacturer_claim
from schemas import ManufacturerWarrantyClaimUpdate


class DummyDB:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)


def test_record_status_change_creates_history_and_updates_status():
    unit = StockUnit(
        id=1,
        receipt_item_id=10,
        stock_item_id=20,
        serial_number="SN-TEST-001",
        status="in_stock",
    )

    db = DummyDB()
    history = unit.record_status_change(db, "with_internal_team_paid", note="Test move", changed_by_rep_id=2)

    assert unit.status == "with_internal_team_paid"
    assert isinstance(history, StockUnitStatusHistory)
    assert history.old_status == "in_stock"
    assert history.new_status == "with_internal_team_paid"
    assert history.note == "Test move"
    assert history.changed_by_rep_id == 2
    assert db.added and db.added[0] is history


def test_record_status_change_returns_none_when_same_status():
    unit = StockUnit(
        id=2,
        receipt_item_id=11,
        stock_item_id=21,
        serial_number="SN-TEST-002",
        status="in_stock",
    )
    db = DummyDB()
    result = unit.record_status_change(db, "in_stock", note="No-op")
    assert result is None
    assert db.added == []


def test_manufacturer_warranty_update_preserves_explicit_unit_status():
    class DummyQuery:
        def __init__(self, result):
            self.result = result

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return self.result

        def all(self):
            return []

        def order_by(self, *args, **kwargs):
            return self

    class DummySession:
        def __init__(self, claim, unit):
            self.claim = claim
            self.unit = unit
            self.added = []
            self.committed = False
            self.refreshed = None

        def add(self, obj):
            self.added.append(obj)

        def commit(self):
            self.committed = True

        def refresh(self, obj):
            self.refreshed = obj

        def query(self, model):
            if model is ManufacturerWarrantyClaim:
                return DummyQuery(self.claim)
            if model is StockUnit:
                return DummyQuery(self.unit)
            return DummyQuery(None)

    class DummyClaim:
        def __init__(self, unit):
            self.id = 7
            self.outcome = "pending"
            self.date_sent = date(2026, 1, 1)
            self.stock_unit_id = 99
            self.stock_unit = unit
            self.linked_job_card_id = None
            self.tracking_reference = None
            self.notes = None
            self.date_returned = None
            self.supplier_id = 0
            self.supplier = None
            self.changed_by_rep_name = None
            self.created_at = None
            self.updated_at = None
            self.expected_return_date = None

    unit = StockUnit(
        id=99,
        receipt_item_id=10,
        stock_item_id=20,
        serial_number="SN-TEST-003",
        status="with_manufacturer",
    )

    claim = DummyClaim(unit)
    db = DummySession(claim, unit)

    payload = ManufacturerWarrantyClaimUpdate(outcome="repaired", unit_status="returned")

    result = update_manufacturer_claim(7, payload, current_user=type("User", (), {"rep_id": 3, "id": 11})(), db=db)

    assert result is not None
    assert unit.status == "returned"
    assert db.committed is True
