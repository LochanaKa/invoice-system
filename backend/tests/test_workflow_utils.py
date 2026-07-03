from datetime import date

from models import StockUnit, StockUnitStatusHistory


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
