import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Edit3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { deleteRepairJob, getTechnician, getTechnicianRepairHistory, updateRepairJob } from "../services/api";

export default function TechnicianDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [technician, setTechnician] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const { user } = useAuth();
  const canEdit = Boolean(user?.is_admin);

  useEffect(() => {
    loadTechnician();
  }, [id]);

  async function loadTechnician() {
    setLoading(true);
    try {
      setTechnician(await getTechnician(id));
    } catch (error) {
      console.error(error);
      alert("Failed to load technician.");
      navigate("/technicians");
      return;
    } finally {
      setLoading(false);
    }
    await loadJobs();
  }

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      setJobs(await getTechnicianRepairHistory(id));
    } catch (error) {
      console.error(error);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

  const fixedCount = jobs.filter((job) => job.outcome?.toLowerCase().includes("fixed") || job.outcome?.toLowerCase().includes("repaired")).length;
  const notFixedCount = jobs.length - fixedCount;

  const openEditor = (job) => {
    setSelectedJob({
      ...job,
      amount_charged_by_technician: job.amount_charged_by_technician ?? "",
      outcome: job.outcome || "pending",
      date_returned: job.date_returned || "",
    });
    setValidationError(null);
  };

  const closeEditor = () => {
    setSelectedJob(null);
    setValidationError(null);
  };

  const validateJobUpdate = () => {
    if (!selectedJob) return null;
    if (!selectedJob.outcome || selectedJob.outcome.trim() === "") {
      return "Please select an outcome.";
    }
    if (selectedJob.date_returned) {
      const returnedAt = new Date(selectedJob.date_returned);
      if (Number.isNaN(returnedAt.getTime())) {
        return "Please enter a valid return date.";
      }
      if (selectedJob.date_sent) {
        const sentAt = new Date(selectedJob.date_sent);
        if (!Number.isNaN(sentAt.getTime()) && returnedAt < sentAt) {
          return "Date returned cannot be before date sent.";
        }
      }
    }
    return null;
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!selectedJob || !canEdit) return;
    const validationMessage = validateJobUpdate();
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    try {
      const payload = {
        outcome: selectedJob.outcome || null,
        date_returned: selectedJob.date_returned || null,
        amount_charged_by_technician:
          selectedJob.amount_charged_by_technician === "" || selectedJob.amount_charged_by_technician == null
            ? null
            : Number(selectedJob.amount_charged_by_technician),
      };
      await updateRepairJob(selectedJob.id, payload);
      closeEditor();
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || error?.message || "Failed to update repair job");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob || !canEdit) return;
    if (!window.confirm(`Delete repair job #${selectedJob.id}?`)) return;
    try {
      setIsSaving(true);
      await deleteRepairJob(selectedJob.id);
      closeEditor();
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || error?.message || "Failed to delete repair job");
    } finally {
      setIsSaving(false);
    }
  };

  const goToCreateRepairInvoice = (job) => {
    navigate("/invoices/new", {
      state: {
        prefill: {
          customer_id: job?.customer_id ?? null,
          rep_id: job?.rep_id ?? null,
          description: `Repair: ${job?.stock_unit_serial_number || ""}`,
        },
        link_job_card_id: job?.linked_job_card_id ?? null,
        return_to: `/technicians/${id}`,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate("/technicians")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> Back to technicians
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Technician profile</h1>
            <p className="text-sm text-slate-500">Contact details and repair job history for this technician.</p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 px-5 py-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total jobs</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{jobs.length}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="text-sm text-slate-500">Loading technician…</div>
          ) : technician ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{technician.name}</h2>
                <p className="text-sm text-slate-500">{technician.specialty || "No specialty provided"}</p>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Phone</div>
                  <div className="mt-1">{technician.contact_phone}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Email</div>
                  <div className="mt-1">{technician.contact_email || "–"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</div>
                  <div className="mt-1">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${technician.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {technician.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Technician not found.</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Jobs logged</div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{jobs.length}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fixed / repaired</div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{fixedCount}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Not fixed</div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{notFixedCount}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Repair job history</h2>
                <p className="text-sm text-slate-500">Most recent assignments appear first.</p>
              </div>
              <ClipboardList size={20} className="text-slate-400" />
            </div>

            {loadingJobs ? (
              <div className="mt-6 text-sm text-slate-500">Loading repair history…</div>
            ) : jobs.length === 0 ? (
              <div className="mt-6 rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
                No repair jobs are recorded for this technician yet.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditor(job)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEditor(job);
                      }
                    }}
                    className="cursor-pointer rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Job #{job.id}</div>
                        <div className="text-xs text-slate-500">Sent {job.date_sent}</div>
                      </div>
                      <div className="space-y-1 text-right text-sm text-slate-600">
                        <div>Outcome: <span className="font-semibold text-slate-900">{job.outcome}</span></div>
                        <div>Returned: {job.date_returned || "Pending"}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-slate-600">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Stock unit</div>
                        <div className="mt-1">{job.stock_unit_serial_number ? `${job.stock_unit_serial_number} (#${job.stock_unit_id})` : "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Charged</div>
                        <div className="mt-1">{job.amount_charged_by_technician != null ? `Rs. ${job.amount_charged_by_technician}` : "Not billed"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Job card</div>
                        <div className="mt-1">{job.linked_job_card_id ? `#${job.linked_job_card_id}` : "None"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(job);
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      {job.job_type === "PAID_REPAIR" && !job.linked_sales_invoice_id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToCreateRepairInvoice(job);
                          }}
                          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700"
                        >
                          Create Repair Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6" onClick={closeEditor}>
          <div className="relative z-[10000] w-full max-w-[42rem] overflow-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Repair job #{selectedJob.id}</h2>
                <p className="mt-1 text-sm text-slate-500">Update the technician outcome, return date, and technician charge.</p>
              </div>
              <button type="button" onClick={closeEditor} className="h-10 w-10 rounded-full border border-slate-200 p-2 text-slate-500">✕</button>
            </div>

            {!canEdit && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                View only — administrators can update or delete repair jobs.
              </div>
            )}

            <form onSubmit={handleSaveJob} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Outcome
                <select value={selectedJob.outcome || "pending"} onChange={(e) => setSelectedJob({ ...selectedJob, outcome: e.target.value })} disabled={!canEdit} className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50">
                  <option value="pending">pending</option>
                  <option value="repaired">repaired</option>
                  <option value="replaced_by_manufacturer">replaced_by_manufacturer</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Date returned
                <input type="date" value={selectedJob.date_returned || ""} onChange={(e) => setSelectedJob({ ...selectedJob, date_returned: e.target.value || null })} disabled={!canEdit} className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Amount charged by technician
                <input type="number" step="0.01" value={selectedJob.amount_charged_by_technician ?? ""} onChange={(e) => setSelectedJob({ ...selectedJob, amount_charged_by_technician: e.target.value })} disabled={!canEdit} className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
              </label>

              {validationError && (
                <div className="col-span-full rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                  {validationError}
                </div>
              )}

              <div className="col-span-full flex flex-wrap items-center gap-3 pt-2">
                {canEdit && (
                  <>
                    <button type="submit" disabled={isSaving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{isSaving ? "Saving…" : "Save changes"}</button>
                    <button type="button" onClick={handleDeleteJob} disabled={isSaving} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">Delete repair job</button>
                  </>
                )}
                <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
