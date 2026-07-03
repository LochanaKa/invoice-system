import sys
from pathlib import Path
from datetime import date, datetime

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.stock_units import get_serial_full_history


class StubSupplier:
    def __init__(self, name):
        self.name = name


class StubReceipt:
    def __init__(self, id, received_date, reference_no, supplier):
        self.id = id
        self.received_date = received_date
        self.reference_no = reference_no
        self.supplier = supplier


class StubReceiptItem:
    def __init__(self, final_unit_price, receipt):
        self.final_unit_price = final_unit_price
        self.receipt = receipt


class StubStockItem:
    def __init__(self, brand, model, description):
        self.brand = brand
        self.model = model
        self.description = description


class StubRep:
    def __init__(self, name):
        self.name = name


class StubStatusHistory:
    def __init__(self, id, changed_at, old_status, new_status, note, changed_by_rep):
        self.id = id
        self.changed_at = changed_at
        self.old_status = old_status
        self.new_status = new_status
        self.note = note
        self.changed_by_rep = changed_by_rep


class StubStockUnit:
    def __init__(
        self,
        id,
        serial_number,
        status,
        receipt_item,
        stock_item,
        sold_invoice_item_id=None,
        warranty_months=None,
        has_manufacturer_warranty=False,
        manufacturer_warranty_months=None,
        status_history=None,
    ):
        self.id = id
        self.serial_number = serial_number
        self.status = status
        self.receipt_item = receipt_item
        self.stock_item = stock_item
        self.sold_invoice_item_id = sold_invoice_item_id
        self.warranty_months = warranty_months
        self.has_manufacturer_warranty = has_manufacturer_warranty
        self.manufacturer_warranty_months = manufacturer_warranty_months
        self.status_history = status_history or []


class StubCustomer:
    def __init__(self, name):
        self.name = name


class StubInvoice:
    def __init__(self, id, invoice_number, invoice_date, customer):
        self.id = id
        self.invoice_number = invoice_number
        self.invoice_date = invoice_date
        self.customer = customer


class StubInvoiceItem:
    def __init__(self, id, invoice):
        self.id = id
        self.invoice = invoice


class StubJobCard:
    def __init__(self, id, created_at, device_name, issue_description, status, device_source, stock_unit_id):
        self.id = id
        self.created_at = created_at
        self.device_name = device_name
        self.issue_description = issue_description
        self.status = status
        self.device_source = device_source
        self.stock_unit_id = stock_unit_id


class StubTechnician:
    def __init__(self, name):
        self.name = name


class StubRepairJob:
    def __init__(
        self,
        id,
        date_sent,
        technician,
        linked_job_card_id,
        outcome,
        amount_charged_by_technician,
        date_returned,
    ):
        self.id = id
        self.date_sent = date_sent
        self.technician = technician
        self.linked_job_card_id = linked_job_card_id
        self.outcome = outcome
        self.amount_charged_by_technician = amount_charged_by_technician
        self.date_returned = date_returned


class DummyQuery:
    def __init__(self, response=None):
        self.response = response

    def options(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        if isinstance(self.response, list):
            return self.response[0] if self.response else None
        return self.response

    def all(self):
        return self.response if self.response is not None else []

    def limit(self, *args, **kwargs):
        return self


class DummyDB:
    def __init__(self, stock_unit=None, job_cards=None, invoice_item=None, repair_jobs=None):
        self.stock_unit = stock_unit
        self.job_cards = job_cards or []
        self.invoice_item = invoice_item
        self.repair_jobs = repair_jobs or []

    def query(self, model):
        model_name = getattr(model, '__name__', str(model))
        if model_name == 'StockUnit':
            return DummyQuery(self.stock_unit)
        if model_name == 'JobCard':
            return DummyQuery(self.job_cards)
        if model_name == 'InvoiceItem':
            return DummyQuery(self.invoice_item)
        if model_name == 'RepairJob':
            return DummyQuery(self.repair_jobs)
        return DummyQuery(None)


def test_get_serial_full_history_returns_serial_history_for_stock_unit_with_repair_and_sale():
    supplier = StubSupplier(name='ACME Supplies')
    receipt = StubReceipt(id=1, received_date=date(2026, 6, 1), reference_no='GRN-100', supplier=supplier)
    receipt_item = StubReceiptItem(final_unit_price=1250.00, receipt=receipt)
    stock_item = StubStockItem(brand='Dell', model='Latitude 5540', description='Business laptop')
    status_history = [
        StubStatusHistory(
            id=1,
            changed_at=datetime(2026, 6, 15, 10, 0),
            old_status='in_stock',
            new_status='sold',
            note='Sold to customer',
            changed_by_rep=StubRep(name='Nimal'),
        )
    ]
    unit = StubStockUnit(
        id=10,
        serial_number='SN-12345',
        status='sold',
        receipt_item=receipt_item,
        stock_item=stock_item,
        sold_invoice_item_id=20,
        warranty_months=12,
        has_manufacturer_warranty=True,
        manufacturer_warranty_months=12,
        status_history=status_history,
    )

    invoice = StubInvoice(id=2, invoice_number='INV-001', invoice_date=date(2026, 6, 20), customer=StubCustomer(name='ABC Traders'))
    invoice_item = StubInvoiceItem(id=20, invoice=invoice)
    job_card = StubJobCard(
        id=5,
        created_at=datetime(2026, 6, 10, 9, 30),
        device_name='Laptop repair',
        issue_description='Faulty keyboard',
        status='COMPLETED',
        device_source='WALK_IN',
        stock_unit_id=10,
    )
    repair_job = StubRepairJob(
        id=7,
        date_sent=date(2026, 6, 11),
        technician=StubTechnician(name='Ravi'),
        linked_job_card_id=5,
        outcome='Repaired',
        amount_charged_by_technician=1500.00,
        date_returned=date(2026, 6, 18),
    )

    dummy_db = DummyDB(
        stock_unit=unit,
        job_cards=[job_card],
        invoice_item=invoice_item,
        repair_jobs=[repair_job],
    )

    result = get_serial_full_history('SN-12345', db=dummy_db)

    assert result.serial_number == 'SN-12345'
    assert result.origin.source == 'stock'
    assert result.origin.supplier_name == 'ACME Supplies'
    assert result.sale_info.sold is True
    assert result.sale_info.invoice_number == 'INV-001'
    assert result.warranty.note == 'Within warranty' or result.warranty.note is not None
    assert any(event.type == 'receipt' for event in result.timeline)
    assert any(event.type == 'status_change' for event in result.timeline)
    assert any(event.type == 'job_card' for event in result.timeline)
    assert any(event.type == 'repair_job' for event in result.timeline)


def test_get_serial_full_history_returns_job_card_only_history_when_no_stock_unit_exists():
    job_card = StubJobCard(
        id=11,
        created_at=datetime(2026, 6, 21, 14, 0),
        device_name='Printer service',
        issue_description='Paper jam',
        status='NEW',
        device_source='WALK_IN',
        stock_unit_id=None,
    )
    dummy_db = DummyDB(stock_unit=None, job_cards=[job_card], invoice_item=None, repair_jobs=[])

    result = get_serial_full_history('SN-XYZ-001', db=dummy_db)

    assert result.serial_number == 'SN-XYZ-001'
    assert result.origin.source == 'job_card'
    assert result.origin.no_stock_history is True
    assert result.device_name == 'Printer service'
    assert len(result.timeline) == 1
    assert result.timeline[0].type == 'job_card'
