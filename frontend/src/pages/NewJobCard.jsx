import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CheckCircle2, AlertCircle } from "lucide-react";
import { createJobCard, getReps } from "../services/api";

const intakeOptions = [
  { value: "WALK_IN", label: "Walk-in Drop-off", description: "Customer brought the device directly to the shop." },
  { value: "FIELD_GRN", label: "Field Collection (Manual GRN)", description: "Collected from the field with a paper GRN." },
];

export default function NewJobCard() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: "",
    device_name: "",
    issue_description: "",
    received_by_staff_id: "",
    intake_method: "WALK_IN",
    assigned_to_staff_id: "",
    priority: "NORMAL",
    due_date: "",
    serial_number: "",
    paper_grn_reference: "",
  });
  const [staff, setStaff] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    getReps()
      .then((data) => setStaff((data || []).filter((rep) => rep.is_active !== false)))
      .catch(() => setStaff([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...form,
        received_by_staff_id: Number(form.received_by_staff_id),
        assigned_to_staff_id: form.assigned_to_staff_id ? Number(form.assigned_to_staff_id) : null,
        priority: form.priority,
        due_date: form.due_date || null,
        serial_number: form.serial_number.trim(),
        paper_grn_reference: form.paper_grn_reference.trim(),
      };

      await createJobCard(payload);
      setSuccess("Job card created successfully.");
      setForm({
        customer_name: "",
        device_name: "",
        issue_description: "",
        received_by_staff_id: "",
        intake_method: "WALK_IN",
        assigned_to_staff_id: "",
        priority: "NORMAL",
        due_date: "",
        serial_number: "",
        paper_grn_reference: "",
      });
      setTimeout(() => navigate("/job-cards"), 800);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job card.");
    } finally {
      setSubmitting(false);
    }
  };

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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Customer Name</label>
            <input
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Customer or company name"
            />
          </div>

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

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Serial Number</label>
              <input
                name="serial_number"
                value={form.serial_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Scan or type serial number"
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
    </div>
  );
}
