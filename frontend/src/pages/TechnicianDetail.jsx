import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Check, XCircle } from "lucide-react";
import { getTechnician, getTechnicianRepairHistory } from "../services/api";

export default function TechnicianDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [technician, setTechnician] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);

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

  const statValue = (value) => typeof value === "number" ? value : 0;
  const fixedCount = jobs.filter((job) => job.outcome?.toLowerCase().includes("fixed") || job.outcome?.toLowerCase().includes("repaired")).length;
  const notFixedCount = jobs.length - fixedCount;

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
                  <div key={job.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
