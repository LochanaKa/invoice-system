import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, UserCheck, UserMinus } from "lucide-react";
import {
  getTechnicians,
  createTechnician,
  updateTechnician,
  deactivateTechnician,
} from "../services/api";

export default function Technicians() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_phone: "",
    contact_email: "",
    specialty: "",
    is_active: true,
  });

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians(query = "") {
    setLoading(true);
    try {
      setTechnicians(await getTechnicians(query ? { search: query } : {}));
    } catch (error) {
      console.error("Failed to load technicians", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (value) => {
    setSearch(value);
    loadTechnicians(value);
  };

  const openForm = (technician = null) => {
    if (technician) {
      setEditTarget(technician);
      setFormData({
        name: technician.name,
        contact_phone: technician.contact_phone,
        contact_email: technician.contact_email || "",
        specialty: technician.specialty || "",
        is_active: technician.is_active,
      });
    } else {
      setEditTarget(null);
      setFormData({
        name: "",
        contact_phone: "",
        contact_email: "",
        specialty: "",
        is_active: true,
      });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.contact_phone.trim()) {
      alert("Name and contact phone are required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editTarget) {
        await updateTechnician(editTarget.id, {
          ...formData,
          contact_phone: formData.contact_phone.trim(),
          contact_email: formData.contact_email.trim() || null,
          specialty: formData.specialty.trim() || null,
        });
      } else {
        await createTechnician({
          ...formData,
          contact_phone: formData.contact_phone.trim(),
          contact_email: formData.contact_email.trim() || null,
          specialty: formData.specialty.trim() || null,
        });
      }
      closeForm();
      loadTechnicians(search);
    } catch (error) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "Failed to save technician.";
      alert(detail);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (technician) => {
    if (!window.confirm(`Deactivate ${technician.name}?`)) {
      return;
    }
    try {
      await deactivateTechnician(technician.id);
      loadTechnicians(search);
    } catch (error) {
      alert("Failed to deactivate technician.");
    }
  };

  const handleRowClick = (technician) => {
    navigate(`/technicians/${technician.id}`);
  };

  const headerStyle = { color: "#1F3C8A" };
  const inputCls = `w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={headerStyle}>Technicians</h1>
          <p className="text-sm text-gray-500 mt-1">Manage technician contact details, specialties, and active status.</p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-md">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name or specialty"
              className={`${inputCls} pl-10 min-w-0`}
            />
          </div>
          <button
            onClick={() => openForm()}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus size={16} /> Add Technician
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.7fr_1.7fr_1.5fr_0.9fr_1.2fr] gap-4 border-b border-slate-100 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <div>Name</div>
          <div>Contact</div>
          <div>Specialty</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-10 text-sm text-slate-500">Loading technicians…</div>
        ) : technicians.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No technicians found.</div>
        ) : (
          <div>
            {technicians.map((technician) => (
              <div
                key={technician.id}
                className="grid grid-cols-[1.7fr_1.7fr_1.5fr_0.9fr_1.2fr] gap-4 px-6 py-4 transition hover:bg-slate-50"
              >
                <button
                  type="button"
                  className="text-left font-semibold text-slate-900 hover:text-slate-700"
                  onClick={() => handleRowClick(technician)}
                >
                  {technician.name}
                </button>
                <div className="text-sm text-slate-600">
                  {technician.contact_phone}
                  <div className="text-xs text-slate-400">{technician.contact_email || "–"}</div>
                </div>
                <div className="text-sm text-slate-600">{technician.specialty || "–"}</div>
                <div className="flex items-center">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${technician.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {technician.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => openForm(technician)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <UserCheck size={14} /> Edit
                  </button>
                  {technician.is_active && (
                    <button
                      type="button"
                      onClick={() => handleDeactivate(technician)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                    >
                      <UserMinus size={14} /> Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editTarget ? "Edit Technician" : "Add Technician"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Enter the technician details that repair workflows will use.</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-10 w-10 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Name
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Contact phone
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Contact email
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Specialty
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className={inputCls}
                />
              </label>

              <label className="col-span-full flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Active
              </label>

              <div className="col-span-full flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : editTarget ? "Save changes" : "Create technician"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
