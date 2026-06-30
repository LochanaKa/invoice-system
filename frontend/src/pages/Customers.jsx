import { useState, useEffect } from "react";
import { Search, RefreshCw, ShieldCheck, Pencil, Trash2,
         X, RotateCcw, AlertTriangle, Users } from "lucide-react";
import { getCustomers, updateCustomer, deleteCustomer,
         reactivateCustomer, getLookups } from "../services/api";

export default function Customers() {
  const [customers,    setCustomers]    = useState([]);
  const [routes,       setRoutes]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [vatOnly,      setVatOnly]      = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const [editName,    setEditName]    = useState("");
  const [editPhone,   setEditPhone]   = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTin,     setEditTin]     = useState("");
  const [editRouteId, setEditRouteId] = useState("");
  const [editVat,     setEditVat]     = useState(false);

  useEffect(() => { fetchCustomers(); }, [search, vatOnly, showInactive]);
  useEffect(() => { loadLookups(); }, []);

  async function loadLookups() {
    try {
      const data = await getLookups();
      setRoutes(data.routes || []);
    } catch (e) { console.error("Failed to load routes", e); }
  }

  async function fetchCustomers() {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search            = search;
      if (vatOnly)      params.is_vat_registered = true;
      if (showInactive) params.show_inactive      = true;
      setCustomers(await getCustomers(params));
    } catch (e) { console.error("Failed to fetch customers", e); }
    finally { setLoading(false); }
  }

  const openEditModal = (c) => {
    setEditTarget(c);
    setEditName(c.name);
    setEditPhone(c.phone || "");
    setEditAddress(c.address || "");
    setEditTin(c.tin || "");
    setEditRouteId(c.route_id || "");
    setEditVat(c.is_vat_registered || false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updateCustomer(editTarget.id, {
        name:              editName,
        phone:             editPhone   || null,
        address:           editAddress || null,
        route_id:          editRouteId ? Number(editRouteId) : null,
        is_vat_registered: editVat,
      });
      setEditTarget(null);
      fetchCustomers();
    } catch (err) {
      console.error("Update customer error:", err?.response?.data ?? err);
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      alert(`Failed to update customer: ${detail}`);
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      fetchCustomers();
    } catch { alert("Failed to deactivate customer."); }
    finally { setIsDeleting(false); }
  };

  const handleReactivate = async (id) => {
    try { await reactivateCustomer(id); fetchCustomers(); }
    catch { alert("Failed to reactivate customer."); }
  };

  // ── Shared input style ────────────────────────────────────────────
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
            <Users size={20} /> Customers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} accounts listed</p>
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
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-xl bg-white
                       focus:outline-none focus:ring-2 transition"
            style={{ borderColor: "#d5dcf5" }}
          />
        </div>
        <div className="flex items-center gap-5">
          {[
            { checked: vatOnly,      setter: setVatOnly,      label: "VAT registered only" },
            { checked: showInactive, setter: setShowInactive, label: "Show inactive"        },
          ].map(({ checked, setter, label }) => (
            <label key={label} className="flex items-center gap-2 text-sm text-gray-600
                                          cursor-pointer select-none">
              <input
                type="checkbox" checked={checked}
                onChange={(e) => setter(e.target.checked)}
                className="rounded"
                style={{ accentColor: "#1F3C8A" }}
              />
              {label}
            </label>
          ))}
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
                  {["Customer Name", "Route", "TIN", "Type", "Phone", "Status", "Actions"].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3"
                        style={{ color: "#1F3C8A" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c, idx) => (
                  <tr key={c.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid #f0f4ff",
                        background: !c.is_active
                          ? "#fafafa"
                          : idx % 2 === 0 ? "#ffffff" : "#fafbff",
                      }}
                      onMouseEnter={(e) => c.is_active && (e.currentTarget.style.background = "#eef1fb")}
                      onMouseLeave={(e) => e.currentTarget.style.background = !c.is_active
                        ? "#fafafa" : idx % 2 === 0 ? "#ffffff" : "#fafbff"}>

                    {/* Name */}
                    <td className={`px-4 py-3 font-semibold
                                   ${c.is_active ? "" : "text-gray-400 line-through"}`}
                        style={c.is_active ? { color: "#1F3C8A" } : {}}>
                      {c.name}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs">{c.route_name || "—"}</td>

                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.tin || "—"}</td>

                    {/* VAT badge */}
                    <td className="px-4 py-3">
                      {c.is_vat_registered ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold
                                         bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full">
                          <ShieldCheck size={10} /> VAT
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-gray-100 text-gray-500
                                         px-2.5 py-0.5 rounded-full">
                          General
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs">{c.phone || "—"}</td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      {c.is_active ? (
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

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.is_active ? (
                          <>
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg hover:bg-cc-blue-50 transition-colors"
                              style={{ color: "#1F3C8A" }}
                              title="Edit Customer"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400
                                         hover:text-red-600 transition-colors"
                              title="Deactivate Customer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReactivate(c.id)}
                            className="flex items-center gap-1 text-xs font-semibold
                                       px-2.5 py-1 rounded-lg transition-colors hover:bg-cc-green-50"
                            style={{ color: "#27AE60" }}
                            title="Reactivate Customer"
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

            {customers.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No customers found matching the criteria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Customer Modal ─────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>

            {/* Modal header */}
            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Edit Customer Details</h3>
              <button onClick={() => setEditTarget(null)} disabled={isSaving}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Customer Name *
                </label>
                <input type="text" required value={editName}
                       onChange={(e) => setEditName(e.target.value)}
                       className={inputCls}
                       style={{ "--tw-ring-color": "#1F3C8A" }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Phone</label>
                  <input type="text" value={editPhone}
                         onChange={(e) => setEditPhone(e.target.value)}
                         className={inputCls} />
                </div>
              </div>

              {/* Route */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Route</label>
                <select value={editRouteId} onChange={(e) => setEditRouteId(e.target.value)}
                        className={inputCls + " bg-white"}>
                  <option value="">No Route Assigned</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Address</label>
                <textarea rows={3} value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className={inputCls} />
              </div>

              {/* VAT checkbox */}
              <div className="flex items-center gap-3 border-t pt-3"
                   style={{ borderColor: "#eef1fb" }}>
                <input type="checkbox" id="editVat" checked={editVat}
                       onChange={(e) => setEditVat(e.target.checked)}
                       style={{ accentColor: "#1F3C8A" }}
                       className="w-4 h-4 rounded" />
                <label htmlFor="editVat" className="text-sm font-medium text-gray-700 cursor-pointer">
                  VAT Registered Customer
                </label>
              </div>

              {/* Actions */}
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
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center
                              justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Deactivate Customer</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to deactivate{" "}
              <span className="font-bold text-gray-900">{deleteTarget.name}</span>?{" "}
              This will hide them from invoice forms. All historical invoices, payments,
              and credit balances remain fully intact.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                                 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600
                                 hover:bg-red-700 disabled:bg-red-400 rounded-xl
                                 transition-colors flex items-center gap-1.5">
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
