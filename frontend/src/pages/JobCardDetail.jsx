import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Save, ClipboardList, FileText, Trash2 } from "lucide-react";
import { getJobCard, updateJobCard, deleteJobCard, getReps, runJobCardAction, getTechnicians, getStockUnitBySerial, getAvailableReplacementUnits } from "../services/api";
import { useAuth } from "../context/AuthContext";

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
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [showTechModal, setShowTechModal] = useState(false);
  const [techs, setTechs] = useState([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [dateSent, setDateSent] = useState("");
  const [amountCharged, setAmountCharged] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [replacementUnits, setReplacementUnits] = useState([]);
  const [selectedReplacementUnitId, setSelectedReplacementUnitId] = useState("");
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [stockUnitStatus, setStockUnitStatus] = useState(null);
  const [handledByRepId, setHandledByRepId] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, reps] = await Promise.all([getJobCard(id), getReps()]);
        setCard(data);
        if (data && data.serial_number) {
          try {
            const su = await getStockUnitBySerial(data.serial_number);
            setStockUnitStatus(su.status);
          } catch (_) {
            setStockUnitStatus(null);
          }
        }
        setStatus(data.status || "NEW");
        setNotes(data.notes || "");
        setPriority(data.priority || "MEDIUM");
        setDueDate(data.due_date || "");
        setAssignedToStaffId(data.assigned_to_staff_id ? String(data.assigned_to_staff_id) : "");
        // default handledBy to current user rep or assigned staff
        setHandledByRepId((user?.rep_id && String(user.rep_id)) || (data.assigned_to_staff_id ? String(data.assigned_to_staff_id) : ""));
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

  const handleWorkflowAction = async (action) => {
    // Actions that require technician details: show modal first
    if (action === "send_third_party_warranty" || action === "send_third_party_paid") {
      setPendingAction(action);
      setShowTechModal(true);
      // load technicians when opening modal
      try {
        const t = await getTechnicians();
        setTechs(t || []);
      } catch (e) {
        setTechs([]);
      }
      return;
    }

    if (action === "replace_under_warranty") {
      if (!card?.stock_unit_id) {
        setActionError("Unable to determine the original stock unit for replacement.");
        return;
      }
      setPendingAction(action);
      setShowReplacementModal(true);
      setReplacementLoading(true);
      setActionError(null);
      setSelectedReplacementUnitId("");
      try {
        const units = await getAvailableReplacementUnits(card.stock_unit_id);
        setReplacementUnits(units || []);
      } catch (err) {
        setReplacementUnits([]);
        setActionError(err.response?.data?.detail || err.message || "Failed to load replacement units.");
      } finally {
        setReplacementLoading(false);
      }
      return;
    }

    // Simple actions: POST to /jobs/{id}/action
    setWorkflowSaving(true);
    setActionError(null);
    try {
      const payload = { action };
      if (action === "send_internal_warranty" || action === "send_internal_paid") {
        // Include which internal rep handled this transition
        payload.handled_by_rep_id = handledByRepId ? Number(handledByRepId) : user?.rep_id;
      }
      const updated = await runJobCardAction(id, payload);
      setCard(updated);
      // refresh stock unit status if linked
      if (updated && updated.serial_number) {
        try {
          const su = await getStockUnitBySerial(updated.serial_number);
          setStockUnitStatus(su.status);
        } catch (_) {
          setStockUnitStatus(null);
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || err.message || "Failed to apply action.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const submitTechnicianAction = async () => {
    if (!pendingAction) return;
    if (!selectedTechnicianId) {
      setActionError("Please select a technician.");
      return;
    }
    setWorkflowSaving(true);
    setActionError(null);
    try {
      const payload = {
        action: pendingAction,
        technician_id: selectedTechnicianId ? Number(selectedTechnicianId) : undefined,
        date_sent: dateSent || undefined,
        amount_charged_by_technician: amountCharged ? Number(amountCharged) : undefined,
      };
      const updated = await runJobCardAction(id, payload);
      setCard(updated);
      setShowTechModal(false);
      setPendingAction(null);
      setSelectedTechnicianId("");
      setDateSent("");
      setAmountCharged("");
      // refresh stock unit status if linked
      if (updated && updated.serial_number) {
        try {
          const su = await getStockUnitBySerial(updated.serial_number);
          setStockUnitStatus(su.status);
        } catch (_) {
          setStockUnitStatus(null);
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || err.message || "Failed to apply action.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const submitReplacementAction = async () => {
    if (!pendingAction) return;
    if (!selectedReplacementUnitId) {
      setActionError("Please select a replacement unit.");
      return;
    }
    setWorkflowSaving(true);
    setActionError(null);
    try {
      const payload = {
        action: pendingAction,
        replacement_stock_unit_id: Number(selectedReplacementUnitId),
      };
      const updated = await runJobCardAction(id, payload);
      setCard(updated);
      setShowReplacementModal(false);
      setPendingAction(null);
      setSelectedReplacementUnitId("");
      setReplacementUnits([]);
      // refresh stock unit status if linked
      if (updated && updated.serial_number) {
        try {
          const su = await getStockUnitBySerial(updated.serial_number);
          setStockUnitStatus(su.status);
        } catch (_) {
          setStockUnitStatus(null);
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || err.message || "Failed to apply action.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleMarkFixed = async () => {
    // For paid repairs, ensure an invoice exists before marking complete.
    if (card.job_type === "PAID_REPAIR" && !card.linked_sales_invoice_id) {
      // Redirect staff to create the repair invoice; the invoice flow will link back to this job card.
      navigate(`/invoices/new-repair?job_card_id=${card.id}`);
      return;
    }

    setWorkflowSaving(true);
    setActionError(null);
    try {
      const updated = await runJobCardAction(id, { action: "mark_fixed" });
      setCard(updated);
      if (updated && updated.serial_number) {
        try {
          const su = await getStockUnitBySerial(updated.serial_number);
          setStockUnitStatus(su.status);
        } catch (_) {
          setStockUnitStatus(null);
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || err.message || "Failed to mark fixed.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    if (!window.confirm(`Delete job card #${card.id}? This cannot be undone.`)) return;

    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteJobCard(card.id);
      navigate("/job-cards");
    } catch (err) {
      setActionError(err.response?.data?.detail || err.message || "Failed to delete job card.");
    } finally {
      setIsDeleting(false);
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
              {stockUnitStatus && (
                <div className="mt-0.5 text-sm text-gray-500">Stock status: {stockUnitStatus.replaceAll("_", " ")}</div>
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
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {isDeleting ? "Deleting…" : "Delete Job Card"}
              </button>
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
            <div className="text-sm font-semibold text-[#1F3C8A]">Workflow</div>

            <div className="mt-3 text-sm text-gray-700">
              <div className="font-medium">Job Type</div>
              <div className="mt-1">{card.job_type ? card.job_type.replaceAll("_", " ") : "—"}</div>
            </div>

            <div className="mt-3 text-sm text-gray-700">
              <div className="font-medium">Current Status</div>
              <div className="mt-1">{(card.status || "NEW").replaceAll("_", " ")}</div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next Actions</div>
              <div className="mt-2 text-sm text-gray-700">
                <label className="block text-xs text-gray-500">Handled by</label>
                <select value={handledByRepId} onChange={(e) => setHandledByRepId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="">(Current user)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {/* Warranty path actions */}
                {card.job_type === "WARRANTY_REPAIR" && (
                  <>
                    <button
                      onClick={() => handleWorkflowAction("send_manufacturer")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Send to Manufacturer (Warranty)</button>
                    <button
                      onClick={() => handleWorkflowAction("send_internal_warranty")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Internal Team</button>
                    <button
                      onClick={() => handleWorkflowAction("send_third_party_warranty")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Send to Third-party Warranty</button>
                    <button
                      onClick={() => handleWorkflowAction("replace_under_warranty")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                    >Replace Unit (Warranty)</button>
                  </>
                )}

                {/* Paid repair path actions */}
                {card.job_type === "PAID_REPAIR" && (
                  <>
                    <button
                      onClick={() => handleWorkflowAction("send_internal_paid")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Internal Paid</button>
                    <button
                      onClick={() => handleWorkflowAction("send_third_party_paid")}
                      disabled={workflowSaving}
                      className="w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Send to Third-party Paid Repair</button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMarkFixed()}
                        disabled={workflowSaving}
                        className="flex-1 rounded-lg bg-[#1F3C8A] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >Mark as Fixed</button>
                      <button
                        onClick={() => navigate(`/invoices/new-repair?job_card_id=${card.id}`)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                      >Create Repair Invoice</button>
                    </div>
                  </>
                )}

                {/* Fallback: generic status picker */}
                {!card.job_type && (
                  <div>
                    <label className="block text-xs text-gray-500">Manual Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1F3C8A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >{saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />} Save</button>
                  </div>
                )}
              </div>
            </div>

            {actionError && <div className="mt-3 text-sm text-red-600">{actionError}</div>}
            {workflowSaving && <div className="mt-3 text-sm text-gray-600">Applying action…</div>}
            {/* Technician modal for third-party actions */}
            {showTechModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg p-4 w-full max-w-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Technician details</div>
                    <button onClick={() => { setShowTechModal(false); setPendingAction(null); }} className="text-sm text-gray-500">Close</button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500">Technician</label>
                      <select value={selectedTechnicianId} onChange={(e) => setSelectedTechnicianId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                        <option value="">Select technician</option>
                        {techs.map((t) => (
                          <option key={t.id} value={t.id}>{t.name || t.display_name || t.username}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Date Sent</label>
                      <input type="date" value={dateSent} onChange={(e) => setDateSent(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Amount charged by technician</label>
                      <input type="number" step="0.01" value={amountCharged} onChange={(e) => setAmountCharged(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowTechModal(false); setPendingAction(null); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">Cancel</button>
                      <button onClick={submitTechnicianAction} disabled={workflowSaving} className="rounded-lg bg-[#1F3C8A] px-3 py-2 text-sm font-medium text-white">{workflowSaving ? "Submitting…" : "Submit"}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showReplacementModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg p-4 w-full max-w-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Select replacement unit</div>
                    <button onClick={() => { setShowReplacementModal(false); setPendingAction(null); setReplacementUnits([]); }} className="text-sm text-gray-500">Close</button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500">Replacement unit</label>
                      <select value={selectedReplacementUnitId} onChange={(e) => setSelectedReplacementUnitId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                        <option value="">Select replacement serial</option>
                        {replacementLoading ? (
                          <option value="">Loading available units…</option>
                        ) : replacementUnits.length > 0 ? (
                          replacementUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.serial_number} — {unit.brand} {unit.model}</option>
                          ))
                        ) : (
                          <option value="">No replacement units available</option>
                        )}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowReplacementModal(false); setPendingAction(null); setReplacementUnits([]); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">Cancel</button>
                      <button onClick={submitReplacementAction} disabled={workflowSaving || replacementLoading} className="rounded-lg bg-[#1F3C8A] px-3 py-2 text-sm font-medium text-white">{workflowSaving ? "Submitting…" : "Submit"}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
