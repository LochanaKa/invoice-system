import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, UserPlus, X, AlertTriangle, RotateCcw, UserCog, Pencil,
  BarChart3,
} from "lucide-react";
import {
  getReps, getNextRepCode, createRep, updateRep, deactivateRep, reactivateRep,
} from "../services/api";

export default function StaffManagement() {
  const navigate = useNavigate();
  const [staff,            setStaff]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [editTarget,       setEditTarget]       = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [nextCode,         setNextCode]         = useState("");
  const [newName,          setNewName]          = useState("");
  const [newPhone,         setNewPhone]         = useState("");
  const [newRole,          setNewRole]          = useState("");
  const [editName,         setEditName]         = useState("");
  const [editPhone,        setEditPhone]        = useState("");
  const [editRole,         setEditRole]         = useState("");
  const [isSaving,         setIsSaving]         = useState(false);
  const [isDeactivating,   setIsDeactivating]   = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      setStaff(await getReps());
    } catch (e) {
      console.error("Failed to fetch staff", e);
    } finally {
      setLoading(false);
    }
  }

  async function openAddModal() {
    setNewName("");
    setNewPhone("");
    setNewRole("");
    setShowAddModal(true);
    try {
      const data = await getNextRepCode();
      setNextCode(data.code);
    } catch {
      setNextCode("—");
    }
  }

  const openEditModal = (s) => {
    setEditTarget(s);
    setEditName(s.name);
    setEditPhone(s.phone || "");
    setEditRole(s.role || "");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setIsSaving(true);
    try {
      await createRep({
        name:  newName.trim(),
        phone: newPhone.trim(),
        role:  newRole.trim() || null,
      });
      setShowAddModal(false);
      fetchStaff();
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      alert(`Failed to add staff: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updateRep(editTarget.id, {
        name:  editName.trim(),
        phone: editPhone.trim() || null,
        role:  editRole.trim() || null,
      });
      setEditTarget(null);
      fetchStaff();
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      alert(`Failed to update staff: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateRep(deactivateTarget.id);
      setDeactivateTarget(null);
      fetchStaff();
    } catch {
      alert("Failed to deactivate staff member.");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await reactivateRep(id);
      fetchStaff();
    } catch {
      alert("Failed to reactivate staff member.");
    }
  };

  const inputCls = `w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                    focus:outline-none focus:ring-2 transition`.replace(/\s+/g, " ");

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"
              style={{ color: "#1F3C8A" }}>
            <UserCog size={20} /> Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{staff.length} staff listed</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white
                     rounded-xl transition-colors shadow-sm"
          style={{ background: "#27AE60" }}
        >
          <UserPlus size={16} /> Add New Staff
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-cc-sm"
           style={{ borderColor: "#d5dcf5" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2"
               style={{ color: "#1F3C8A" }}>
            <RefreshCw className="animate-spin" size={16} />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid #eef1fb", background: "#f7f9ff" }}>
                  {["Employee No.", "Name", "Role", "Phone Number", "Status", "Actions"].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3"
                        style={{ color: "#1F3C8A" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s, idx) => (
                  <tr key={s.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid #f0f4ff",
                        background: !s.is_active
                          ? "#fafafa"
                          : idx % 2 === 0 ? "#ffffff" : "#fafbff",
                      }}
                      onMouseEnter={(e) => s.is_active && (e.currentTarget.style.background = "#eef1fb")}
                      onMouseLeave={(e) => e.currentTarget.style.background = !s.is_active
                        ? "#fafafa" : idx % 2 === 0 ? "#ffffff" : "#fafbff"}>

                    <td className="px-4 py-3 font-mono text-xs font-semibold"
                        style={{ color: "#1F3C8A" }}>
                      {s.code}
                    </td>

                    <td className={`px-4 py-3 font-semibold
                                   ${s.is_active ? "" : "text-gray-400 line-through"}`}
                        style={s.is_active ? { color: "#1F3C8A" } : {}}>
                      <button
                        type="button"
                        onClick={() => navigate(`/staff/${s.id}/portfolio`)}
                        className="text-left hover:underline transition-colors"
                        title="View portfolio"
                      >
                        {s.name}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-gray-600 text-xs">{s.role || "—"}</td>

                    <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>

                    <td className="px-4 py-3">
                      {s.is_active ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={{ background: "#e9f7ef", color: "#27AE60" }}>
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-gray-100 text-gray-400
                                         px-2.5 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/staff/${s.id}/portfolio`)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1
                                     rounded-lg transition-colors hover:bg-cc-blue-50"
                          style={{ color: "#1F3C8A" }}
                          title="View portfolio"
                        >
                          <BarChart3 size={13} /> Portfolio
                        </button>
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg hover:bg-cc-blue-50 transition-colors"
                          style={{ color: "#1F3C8A" }}
                          title="Edit staff details"
                        >
                          <Pencil size={14} />
                        </button>
                        {s.is_active ? (
                          <button
                            onClick={() => setDeactivateTarget(s)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg
                                       border transition-colors hover:bg-amber-50"
                            style={{ color: "#b45309", borderColor: "#fcd34d" }}
                            title="Deactivate staff member"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(s.id)}
                            className="flex items-center gap-1 text-xs font-semibold
                                       px-2.5 py-1 rounded-lg transition-colors hover:bg-cc-green-50"
                            style={{ color: "#27AE60" }}
                            title="Reactivate staff member"
                          >
                            <RotateCcw size={13} /> Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {staff.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No staff members found. Click &ldquo;Add New Staff&rdquo; to get started.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Staff Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>

            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Add New Staff</h3>
              <button onClick={() => setShowAddModal(false)} disabled={isSaving}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Employee Number
                </label>
                <input type="text" readOnly value={nextCode}
                       className={`${inputCls} font-mono bg-gray-50 text-gray-600 cursor-not-allowed`}
                       style={{ borderColor: "#d5dcf5" }} />
                <p className="text-xs text-gray-400 mt-1">Auto-generated — cannot be edited</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Name *
                </label>
                <input type="text" required value={newName}
                       onChange={(e) => setNewName(e.target.value)}
                       placeholder="Full name"
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Role
                </label>
                <input type="text" value={newRole}
                       onChange={(e) => setNewRole(e.target.value)}
                       placeholder="e.g. Sales Representative"
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Phone Number *
                </label>
                <input type="text" required value={newPhone}
                       onChange={(e) => setNewPhone(e.target.value)}
                       placeholder="e.g. 077 123 4567"
                       className={inputCls} />
              </div>

              <div className="flex justify-end gap-3 border-t pt-4"
                   style={{ borderColor: "#eef1fb" }}>
                <button type="button" onClick={() => setShowAddModal(false)} disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                                   hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                        className="px-5 py-2 text-sm font-bold text-white rounded-xl
                                   flex items-center gap-2 transition-colors"
                        style={{ background: isSaving ? "#7f96e1" : "#1F3C8A" }}>
                  {isSaving && <RefreshCw size={14} className="animate-spin" />}
                  Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>

            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Edit Staff Details</h3>
              <button onClick={() => setEditTarget(null)} disabled={isSaving}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Employee Number
                </label>
                <input type="text" readOnly value={editTarget.code}
                       className={`${inputCls} font-mono bg-gray-50 text-gray-600 cursor-not-allowed`}
                       style={{ borderColor: "#d5dcf5" }} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Name *
                </label>
                <input type="text" required value={editName}
                       onChange={(e) => setEditName(e.target.value)}
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Role
                </label>
                <input type="text" value={editRole}
                       onChange={(e) => setEditRole(e.target.value)}
                       placeholder="e.g. CEO, General Manager, Sales Representative"
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Phone Number
                </label>
                <input type="text" value={editPhone}
                       onChange={(e) => setEditPhone(e.target.value)}
                       placeholder="e.g. 077 123 4567"
                       className={inputCls} />
              </div>

              <div className="flex justify-end gap-3 border-t pt-4"
                   style={{ borderColor: "#eef1fb" }}>
                <button type="button" onClick={() => setEditTarget(null)} disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                                   hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                        className="px-5 py-2 text-sm font-bold text-white rounded-xl
                                   flex items-center gap-2 transition-colors"
                        style={{ background: isSaving ? "#7f96e1" : "#1F3C8A" }}>
                  {isSaving && <RefreshCw size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirmation Modal ──────────────────────── */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center
                              justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Deactivate Staff Member</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Deactivate{" "}
              <span className="font-bold text-gray-900">{deactivateTarget.name}</span>{" "}
              ({deactivateTarget.code})? They will be removed from the Sales Person dropdown,
              but all historical invoices linked to them remain intact.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeactivateTarget(null)} disabled={isDeactivating}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                                 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleDeactivate} disabled={isDeactivating}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600
                                 hover:bg-red-700 disabled:bg-red-400 rounded-xl
                                 transition-colors flex items-center gap-1.5">
                {isDeactivating && <RefreshCw size={14} className="animate-spin" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
