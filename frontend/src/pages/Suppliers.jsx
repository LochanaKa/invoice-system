import { useState, useEffect } from "react";
import { Search, RefreshCw, Pencil, Trash2, X, RotateCcw, AlertTriangle, Truck } from "lucide-react";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../services/api";

export default function Suppliers() {
  const [suppliers,    setSuppliers]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);

  // Edit fields
  const [editName,          setEditName]          = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone,         setEditPhone]         = useState("");
  const [editEmail,         setEditEmail]         = useState("");
  const [editAddress,       setEditAddress]       = useState("");
  const [editNotes,         setEditNotes]         = useState("");

  // Create fields
  const [createName,          setCreateName]          = useState("");
  const [createContactPerson, setCreateContactPerson] = useState("");
  const [createPhone,         setCreatePhone]         = useState("");
  const [createEmail,         setCreateEmail]         = useState("");
  const [createAddress,       setCreateAddress]       = useState("");
  const [createNotes,         setCreateNotes]         = useState("");
  const [createError,         setCreateError]         = useState(null);

  useEffect(() => { fetchSuppliers(); }, [search, showInactive]);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search        = search;
      if (showInactive) params.show_inactive = true;
      setSuppliers(await getSuppliers(params));
    } catch (e) {
      console.error("Failed to fetch suppliers", e);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = (s) => {
    setEditTarget(s);
    setEditName(s.name);
    setEditContactPerson(s.contact_person || "");
    setEditPhone(s.phone || "");
    setEditEmail(s.email || "");
    setEditAddress(s.address || "");
    setEditNotes(s.notes || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updateSupplier(editTarget.id, {
        name:           editName.trim(),
        contact_person: editContactPerson.trim() || null,
        phone:          editPhone.trim()         || null,
        email:          editEmail.trim()         || null,
        address:        editAddress.trim()       || null,
        notes:          editNotes.trim()         || null,
      });
      setEditTarget(null);
      fetchSuppliers();
    } catch (err) {
      console.error("Update supplier error:", err?.response?.data ?? err);
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      alert(`Failed to update supplier: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!createName.trim()) {
      setCreateError("Supplier name is required.");
      return;
    }
    setIsCreating(true);
    try {
      await createSupplier({
        name:           createName.trim(),
        contact_person: createContactPerson.trim() || null,
        phone:          createPhone.trim()         || null,
        email:          createEmail.trim()         || null,
        address:        createAddress.trim()       || null,
        notes:          createNotes.trim()         || null,
      });
      setShowCreateModal(false);
      setCreateName("");
      setCreateContactPerson("");
      setCreatePhone("");
      setCreateEmail("");
      setCreateAddress("");
      setCreateNotes("");
      fetchSuppliers();
    } catch (err) {
      console.error("Create supplier error:", err?.response?.data ?? err);
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      setCreateError(`Failed to create supplier: ${detail}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch {
      alert("Failed to deactivate supplier.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await updateSupplier(id, { is_active: true });
      fetchSuppliers();
    } catch {
      alert("Failed to reactivate supplier.");
    }
  };

  const inputCls = `w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                    focus:outline-none focus:ring-2 transition`
                    .replace(/\s+/g, " ");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"
              style={{ color: "#1F3C8A" }}>
            <Truck size={20} /> Suppliers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} vendors listed</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
            style={{ background: "#1F3C8A" }}
          >
            Add Supplier
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border shadow-cc-sm p-4 flex flex-wrap gap-4
                      items-center justify-between"
           style={{ borderColor: "#d5dcf5" }}>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search by supplier name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-xl bg-white
                       focus:outline-none focus:ring-2 transition"
            style={{ borderColor: "#d5dcf5" }}
          />
        </div>
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox" checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
              style={{ accentColor: "#1F3C8A" }}
            />
            Show inactive
          </label>
        </div>
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
                  {["Supplier Name", "Contact Person", "Phone", "Email", "Status", "Actions"].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3"
                        style={{ color: "#1F3C8A" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, idx) => (
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

                    <td className={`px-4 py-3 font-semibold ${s.is_active ? "" : "text-gray-400 line-through"}`}
                        style={s.is_active ? { color: "#1F3C8A" } : {}}>
                      {s.name}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs">{s.contact_person || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.email || "—"}</td>

                    <td className="px-4 py-3">
                      {s.is_active ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={{ background: "#e9f7ef", color: "#27AE60" }}>
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.is_active ? (
                          <>
                            <button
                              onClick={() => openEditModal(s)}
                              className="p-1.5 rounded-lg hover:bg-cc-blue-50 transition-colors"
                              style={{ color: "#1F3C8A" }}
                              title="Edit Supplier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(s)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Deactivate Supplier"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReactivate(s.id)}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-cc-green-50"
                            style={{ color: "#27AE60" }}
                            title="Reactivate Supplier"
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

            {suppliers.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No suppliers found matching the criteria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Supplier Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Add New Supplier</h3>
              <button onClick={() => setShowCreateModal(false)} disabled={isCreating}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Supplier Name *
                </label>
                <input type="text" required value={createName}
                       onChange={(e) => setCreateName(e.target.value)}
                       className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Contact Person</label>
                  <input type="text" value={createContactPerson}
                         onChange={(e) => setCreateContactPerson(e.target.value)}
                         className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Phone</label>
                  <input type="text" value={createPhone}
                         onChange={(e) => setCreatePhone(e.target.value)}
                         className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Email</label>
                <input type="email" value={createEmail}
                       onChange={(e) => setCreateEmail(e.target.value)}
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Address</label>
                <textarea rows={2} value={createAddress}
                          onChange={(e) => setCreateAddress(e.target.value)}
                          className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Notes</label>
                <textarea rows={2} value={createNotes}
                          onChange={(e) => setCreateNotes(e.target.value)}
                          className={inputCls} />
              </div>

              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t pt-4"
                   style={{ borderColor: "#eef1fb" }}>
                <button type="button" onClick={() => setShowCreateModal(false)} disabled={isCreating}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                                   hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating}
                        className="px-5 py-2 text-sm font-bold text-white rounded-xl
                                   flex items-center gap-2 transition-colors"
                        style={{ background: isCreating ? "#7f96e1" : "#1F3C8A" }}>
                  {isCreating && <RefreshCw size={14} className="animate-spin" />}
                  Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Edit Supplier Details</h3>
              <button onClick={() => setEditTarget(null)} disabled={isSaving}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Supplier Name *
                </label>
                <input type="text" required value={editName}
                       onChange={(e) => setEditName(e.target.value)}
                       className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Contact Person</label>
                  <input type="text" value={editContactPerson}
                         onChange={(e) => setEditContactPerson(e.target.value)}
                         className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Phone</label>
                  <input type="text" value={editPhone}
                         onChange={(e) => setEditPhone(e.target.value)}
                         className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Email</label>
                <input type="email" value={editEmail}
                       onChange={(e) => setEditEmail(e.target.value)}
                       className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Address</label>
                <textarea rows={2} value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Notes</label>
                <textarea rows={2} value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
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

      {/* Deactivate confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Deactivate Supplier</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to deactivate{" "}
              <span className="font-bold text-gray-900">{deleteTarget.name}</span>?{" "}
              This will disable them for incoming stock receipt options.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl transition-colors flex items-center gap-1.5">
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
