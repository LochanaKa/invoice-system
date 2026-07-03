import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save, ClipboardList, FileText } from "lucide-react";
import { getJobCard, updateJobCard, getReps } from "../services/api";

const statusOptions = ["NEW", "IN_PROGRESS", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"];

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function JobCardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("NEW");
  const [notes, setNotes] = useState("");
  const [assignedToStaffId, setAssignedToStaffId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, reps] = await Promise.all([getJobCard(id), getReps()]);
        setCard(data);
        setStatus(data.status || "NEW");
        setNotes(data.notes || "");
        setPriority(data.priority || "MEDIUM");
        setDueDate(data.due_date || "");
        setAssignedToStaffId(data.assigned_to_staff_id ? String(data.assigned_to_staff_id) : "");
        setStaff((reps || []).filter((rep) => rep.is_active !== false));
      } catch {
        setError("Failed to load job card.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateJobCard(id, { status, notes, assigned_to_staff_id: assignedToStaffId ? Number(assignedToStaffId) : null, priority, due_date: dueDate || null });
      setCard(updated);
    } catch {
      setError("Failed to update job card.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[#1F3C8A]">
        <RefreshCw className="animate-spin" size={16} />
        <span className="text-sm">Loading job card…</span>
      </div>
    );
  }

  if (!card) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-red-600">Job card not found.</div>;
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-medium text-[#1F3C8A]">
        <ArrowLeft size={16} />
        Back to job cards
      </button>

      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#1F3C8A]">
              <ClipboardList size={18} />
              <h1 className="text-xl font-bold">Job Card #{card.id}</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">Customer, device, intake mode, and service progress for this ticket.</p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-[#1F3C8A]">
            {card.intake_method === "FIELD_GRN" ? "Field Collection" : "Walk-in"}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</div>
              <div className="mt-1 text-base font-semibold text-gray-800">{card.customer_name}</div>
              {card.customer_phone && (
                <div className="mt-0.5 text-sm text-gray-500">Phone: {card.customer_phone}</div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Device</div>
              <div className="mt-1 text-base font-semibold text-gray-800">{card.device_name}</div>
              {card.serial_number && (
                <div className="mt-0.5 text-sm text-gray-500 font-mono">S/N: {card.serial_number}</div>
              )}
              {card.linked_sales_invoice_id ? (
                /* Invoice already exists — show a view link */
                <div className="mt-1.5">
                  <a
                    href={`/invoices/${card.linked_sales_invoice_id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <span className="size-1.5 rounded-full bg-green-500 inline-block"></span>
                    Invoice {card.linked_sales_invoice_number || `#${card.linked_sales_invoice_id}`}
                  </a>
                </div>
              ) : (
                /* No invoice yet — offer to create one */
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/invoices/new-repair?job_card_id=${card.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <FileText size={11} />
                    Create Repair Invoice
                  </button>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Issue</div>
              <div className="mt-1 text-sm leading-6 text-gray-700">{card.issue_description}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Received By</div>
              <div className="mt-1 text-sm text-gray-700">{card.received_by_staff_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</div>
              <div className="mt-1 text-sm text-gray-700">{formatDate(card.due_date)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paper GRN</div>
              <div className="mt-1 text-sm text-gray-700">{card.paper_grn_reference || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Created</div>
              <div className="mt-1 text-sm text-gray-700">{formatDate(card.created_at)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="text-sm font-semibold text-[#1F3C8A]">Update Status</div>
            <label className="mt-3 block text-sm font-medium text-gray-700">Current Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>

            <label className="mt-4 block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />

            <label className="mt-4 block text-sm font-medium text-gray-700">Assign Technician</label>
            <select
              value={assignedToStaffId}
              onChange={(e) => setAssignedToStaffId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {staff.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.name} {rep.code ? `(${rep.code})` : ""}</option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              placeholder="Add diagnostic notes, progress updates, or pickup instructions"
            />

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1F3C8A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
