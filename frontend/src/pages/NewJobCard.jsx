import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CheckCircle2, AlertCircle, Plus, Loader2 } from "lucide-react";
import { createJobCard, getReps, getCustomers, createCustomer, searchBySerial, searchStockUnits } from "../services/api";

const intakeOptions = [
  { value: "WALK_IN", label: "Walk-in Drop-off", description: "Customer brought the device directly to the shop." },
  { value: "FIELD_GRN", label: "Field Collection (Manual GRN)", description: "Collected from the field with a paper GRN." },
];

const deviceSourceOptions = [
  {
    value: "OURS",
    label: "Our Inventory",
    description: "This device is coming from our stock and should be matched to a serial-tracked unit.",
  },
  {
    value: "CUSTOMER_OWNED",
    label: "Customer-owned Device",
    description: "The customer brought their own device for repair.",
  },
];

export default function NewJobCard() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    device_name: "",
    issue_description: "",
    received_by_staff_id: "",
    intake_method: "WALK_IN",
    assigned_to_staff_id: "",
    priority: "NORMAL",
    due_date: "",
    device_source: "OURS",
    serial_number: "",
    paper_grn_reference: "",
    linked_sales_invoice_id: null,
  });
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedStockUnit, setSelectedStockUnit] = useState(null);
  const [stockUnitLoading, setStockUnitLoading] = useState(false);
  const [stockUnitError, setStockUnitError] = useState(null);

  // Quick Add customer states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddErr, setQuickAddErr] = useState(null);

  // Serial Number Search states
  const [salesHistory, setSalesHistory] = useState(null);
  const [searchingSerial, setSearchingSerial] = useState(false);
  const [serialChecked, setSerialChecked] = useState(false);

  useEffect(() => {
    getReps()
      .then((data) => setStaff((data || []).filter((rep) => rep.is_active !== false)))
      .catch(() => setStaff([]));
    
    getCustomers()
      .then((data) => setCustomers(data || []))
      .catch(() => setCustomers([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Debounced search logic for serial number
  useEffect(() => {
    const serial = (form.serial_number || "").trim();
    if (!serial) {
      setSalesHistory(null);
      setSerialChecked(false);
      setForm((prev) => ({ ...prev, linked_sales_invoice_id: null }));
      return;
    }

    setSearchingSerial(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await searchBySerial(serial);
        setSalesHistory(data);
        setForm((prev) => ({ ...prev, linked_sales_invoice_id: data.invoice_id }));
      } catch (err) {
        setSalesHistory(null);
        setForm((prev) => ({ ...prev, linked_sales_invoice_id: null }));
      } finally {
        setSearchingSerial(false);
        setSerialChecked(true);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [form.serial_number]);

  useEffect(() => {
    const serial = (form.serial_number || "").trim();
    if (form.device_source !== "OURS" || !serial) {
      setSelectedStockUnit(null);
      setStockUnitError(null);
      setStockUnitLoading(false);
      return;
    }

    setStockUnitLoading(true);
    const delay = setTimeout(async () => {
      try {
        const unit = await searchStockUnits(serial);
        setSelectedStockUnit(unit);
        setStockUnitError(null);
      } catch (err) {
        setSelectedStockUnit(null);
        setStockUnitError(
          err.response?.data?.detail || "Could not find a matching stock unit for this serial number."
        );
      } finally {
        setStockUnitLoading(false);
      }
    }, 500);

    return () => clearTimeout(delay);
  }, [form.device_source, form.serial_number]);

  async function handleQuickAddSave() {
    if (!quickAddName.trim()) return;
    setQuickAdding(true);
    setQuickAddErr(null);
    try {
      const newCust = await createCustomer({
        name: quickAddName.trim(),
        phone: quickAddPhone.trim() || null,
      });
      setCustomers((prev) => [...prev, newCust]);
      setForm((f) => ({
        ...f,
        customer_name: newCust.name,
        customer_phone: newCust.phone || "",
      }));
      setShowQuickAdd(false);
    } catch (err) {
      setQuickAddErr(
        err.response?.data?.detail || "Failed to save customer. Please try again."
      );
    } finally {
      setQuickAdding(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (form.device_source === "OURS" && !selectedStockUnit) {
      setError("Please select a valid stock unit serial from our inventory for 'Ours' device source.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...form,
        customer_phone: form.customer_phone.trim() || null,
        received_by_staff_id: Number(form.received_by_staff_id),
        assigned_to_staff_id: form.assigned_to_staff_id ? Number(form.assigned_to_staff_id) : null,
        priority: form.priority,
        due_date: form.due_date || null,
        device_source: form.device_source,
        serial_number: form.serial_number.trim() || null,
        stock_unit_id: form.device_source === "OURS" ? selectedStockUnit?.id : null,
        job_type: form.device_source === "CUSTOMER_OWNED" ? "PAID_REPAIR" : null,
        paper_grn_reference: form.paper_grn_reference.trim() || null,
      };

      await createJobCard(payload);
      setSuccess("Job card created successfully.");
      setForm({
        customer_name: "",
        customer_phone: "",
        device_name: "",
        issue_description: "",
        received_by_staff_id: "",
        intake_method: "WALK_IN",
        assigned_to_staff_id: "",
        priority: "NORMAL",
        due_date: "",
        device_source: "OURS",
        serial_number: "",
        paper_grn_reference: "",
        linked_sales_invoice_id: null,
      });
      setSelectedStockUnit(null);
      setStockUnitError(null);
      setStockUnitLoading(false);
      setSalesHistory(null);
      setSerialChecked(false);
      setTimeout(() => navigate("/job-cards"), 800);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job card.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(form.customer_name.toLowerCase())
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
              New Job Card
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Record every repair ticket with staff accountability and intake source.
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-[#1F3C8A]">
            <ClipboardList size={20} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Customer Name</label>
            <input
              name="customer_name"
              value={form.customer_name}
              onChange={(e) => {
                handleChange(e);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onBlur={() => setTimeout(() => setIsOpen(false), 200)}
              required
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Customer or company name"
            />
            {isOpen && (filteredCustomers.length > 0 || (form.customer_name.trim() && !customers.some(c => c.name.toLowerCase() === form.customer_name.trim().toLowerCase()))) && (
              <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                {filteredCustomers.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => {
                      setForm((prev) => ({
                        ...prev,
                        customer_name: c.name,
                        customer_phone: c.phone || "",
                      }));
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 transition-colors flex flex-col border-b border-gray-50 last:border-b-0"
                  >
                    <span className="font-medium text-sm">{c.name}</span>
                    {c.phone && (
                      <span className="text-xs text-gray-400 mt-0.5">Phone: {c.phone}</span>
                    )}
                  </button>
                ))}

                {form.customer_name.trim() && !customers.some(c => c.name.toLowerCase() === form.customer_name.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onMouseDown={() => {
                      setQuickAddName(form.customer_name);
                      setQuickAddPhone(form.customer_phone || "");
                      setQuickAddErr(null);
                      setShowQuickAdd(true);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold border-t border-blue-100 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={16} />
                    Add New Customer: "{form.customer_name}"
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Customer Contact Number</label>
            <input
              name="customer_phone"
              value={form.customer_phone}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Contact number (auto-fills if customer selected)"
            />
          </div>

          <div className="md:col-span-2 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Device / Item</label>
              <input
                name="device_name"
                value={form.device_name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Laptop, phone, printer, etc."
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">Device Source</p>
              <div className="space-y-2">
                {deviceSourceOptions.map((option) => {
                  const checked = form.device_source === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${checked ? "border-[#1F3C8A] bg-blue-50" : "border-gray-200 bg-white"}`}
                    >
                      <input
                        type="radio"
                        name="device_source"
                        value={option.value}
                        checked={checked}
                        onChange={(e) => {
                          handleChange(e);
                          if (e.target.value !== "OURS") {
                            setSelectedStockUnit(null);
                            setStockUnitError(null);
                          }
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Serial Number</label>
              <div className="relative">
                <input
                  name="serial_number"
                  value={form.serial_number}
                  onChange={handleChange}
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Scan or type serial number to check sales history"
                />
                {(searchingSerial || stockUnitLoading) && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />
                )}
              </div>

              {form.device_source === "OURS" && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                  {selectedStockUnit ? (
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="font-semibold text-gray-900">Selected Stock Unit</div>
                      <div>Serial: <span className="font-medium">{selectedStockUnit.serial_number}</span></div>
                      <div>Item: <span className="font-medium">{selectedStockUnit.brand || selectedStockUnit.description || "N/A"}</span></div>
                      <div>Status: <span className="font-medium">{selectedStockUnit.status}</span></div>
                      {selectedStockUnit.sold_invoice_number && (
                        <div>Sold invoice: <span className="font-medium">#{selectedStockUnit.sold_invoice_number}</span></div>
                      )}
                      {selectedStockUnit.warranty_months != null && (
                        <div>Warranty: <span className="font-medium">{selectedStockUnit.warranty_months} months</span></div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {stockUnitError ? (
                        <span className="text-red-600">{stockUnitError}</span>
                      ) : (
                        <span>
                          Enter the serial number for a unit from our inventory. The system will automatically pick the closest matching available stock unit.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!searchingSerial && serialChecked && form.serial_number.trim() && (
                <div className="mt-2">
                  {salesHistory ? (
                    <a
                      href={`/invoices/${salesHistory.invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <span className="size-1.5 rounded-full bg-green-500 inline-block"></span>
                      Sold on Invoice #{salesHistory.invoice_number}
                      {salesHistory.invoice_date && (
                        <span className="font-normal text-green-600 ml-1">
                          · {new Date(salesHistory.invoice_date).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No internal sales history found for this serial number.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Issue Description</label>
          <textarea
            name="issue_description"
            value={form.issue_description}
            onChange={handleChange}
            required
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Describe the fault, symptoms, or service request"
          />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1F3C8A]">Intake Details</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Received By / Handled By</label>
              <select
                name="received_by_staff_id"
                value={form.received_by_staff_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select staff member</option>
                {staff.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name} {rep.code ? `(${rep.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>


            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Assign Technician</label>
              <select
                name="assigned_to_staff_id"
                value={form.assigned_to_staff_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Unassigned</option>
                {staff.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name} {rep.code ? `(${rep.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Intake Method</label>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                {intakeOptions.map((option) => {
                  const checked = form.intake_method === option.value;
                  return (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${checked ? "border-[#27AE60] bg-green-50" : "border-gray-200"}`}>
                      <input
                        type="radio"
                        name="intake_method"
                        value={option.value}
                        checked={checked}
                        onChange={handleChange}
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-800">{option.label}</span>
                        <span className="block text-xs text-gray-500">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">GRN Receipt Number</label>
            <input
              name="paper_grn_reference"
              value={form.paper_grn_reference}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter the GRN receipt number if available"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#1F3C8A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Create Job Card"}
          </button>
        </div>
      </form>

      {/* ── Quick Add Customer Modal ───────────────────────── */}
      {showQuickAdd && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Quick Add Customer</h3>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {quickAddErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
                {quickAddErr}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  placeholder="e.g. Samurdhi Bank - Gokarella"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Telephone Number (Optional)
                </label>
                <input
                  type="text"
                  value={quickAddPhone}
                  onChange={(e) => setQuickAddPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  placeholder="e.g. +94 37 123 4567"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddSave}
                disabled={quickAdding || !quickAddName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {quickAdding ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
