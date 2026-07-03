import { useState, useEffect } from "react";
import { Search, RefreshCw, Pencil, Trash2, X, AlertTriangle, Package, Plus, RotateCcw } from "lucide-react";
import {
  getStockItems,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  getStockCategories,
  createStockCategory,
} from "../services/api";

export default function StockItems() {
  const [items,        setItems]        = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [categoryId,   setCategoryId]   = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);

  // Edit fields
  const [editCategoryId,     setEditCategoryId]     = useState("");
  const [editBrand,          setEditBrand]          = useState("");
  const [editModel,          setEditModel]          = useState("");
  const [editDescription,    setEditDescription]    = useState("");
  const [editRequiresSerial, setEditRequiresSerial] = useState(false);
  const [editReorderLevel,   setEditReorderLevel]   = useState("");

  // Create fields
  const [createCategoryId,     setCreateCategoryId]     = useState("");
  const [createBrand,          setCreateBrand]          = useState("");
  const [createModel,          setCreateModel]          = useState("");
  const [createDescription,    setCreateDescription]    = useState("");
  const [createRequiresSerial, setCreateRequiresSerial] = useState(false);
  const [createReorderLevel,   setCreateReorderLevel]   = useState("");
  const [createError,          setCreateError]          = useState(null);

  // Inline Category states
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName,      setNewCatName]      = useState("");
  const [catSaving,       setCatSaving]       = useState(false);

  useEffect(() => { fetchItems(); }, [search, categoryId, showInactive]);
  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    try {
      setCategories(await getStockCategories());
    } catch (e) {
      console.error("Failed to fetch categories", e);
    }
  }

  async function fetchItems() {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search        = search;
      if (categoryId)   params.category_id   = Number(categoryId);
      if (showInactive) params.show_inactive = true;
      setItems(await getStockItems(params));
    } catch (e) {
      console.error("Failed to fetch items", e);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = (item) => {
    setEditTarget(item);
    setEditCategoryId(item.category_id);
    setEditBrand(item.brand || "");
    setEditModel(item.model);
    setEditDescription(item.description || "");
    setEditRequiresSerial(item.requires_serial);
    setEditReorderLevel(item.reorder_level !== null ? item.reorder_level : "");
    setShowNewCatInput(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editCategoryId || !editModel.trim()) return;
    setIsSaving(true);
    try {
      await updateStockItem(editTarget.id, {
        category_id:     Number(editCategoryId),
        brand:           editBrand.trim()       || null,
        model:           editModel.trim(),
        description:     editDescription.trim() || null,
        requires_serial: editRequiresSerial,
        reorder_level:   editReorderLevel !== "" ? Number(editReorderLevel) : null,
      });
      setEditTarget(null);
      fetchItems();
    } catch (err) {
      console.error("Update stock item error:", err?.response?.data ?? err);
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      alert(`Failed to update item: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!createCategoryId) {
      setCreateError("Category is required.");
      return;
    }
    if (!createModel.trim()) {
      setCreateError("Model is required.");
      return;
    }
    setIsCreating(true);
    try {
      await createStockItem({
        category_id:     Number(createCategoryId),
        brand:           createBrand.trim()       || null,
        model:           createModel.trim(),
        description:     createDescription.trim() || null,
        requires_serial: createRequiresSerial,
        reorder_level:   createReorderLevel !== "" ? Number(createReorderLevel) : null,
      });
      setShowCreateModal(false);
      setCreateCategoryId("");
      setCreateBrand("");
      setCreateModel("");
      setCreateDescription("");
      setCreateRequiresSerial(false);
      setCreateReorderLevel("");
      fetchItems();
    } catch (err) {
      console.error("Create stock item error:", err?.response?.data ?? err);
      const detail = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
      setCreateError(`Failed to create item: ${detail}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteStockItem(deleteTarget.id);
      setDeleteTarget(null);
      fetchItems();
    } catch {
      alert("Failed to deactivate item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await updateStockItem(id, { is_active: true });
      fetchItems();
    } catch {
      alert("Failed to reactivate item.");
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      const newCat = await createStockCategory({ name: newCatName.trim() });
      setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      if (editTarget) {
        setEditCategoryId(newCat.id);
      } else {
        setCreateCategoryId(newCat.id);
      }
      setNewCatName("");
      setShowNewCatInput(false);
    } catch (err) {
      alert("Failed to create category: " + (err.response?.data?.detail ?? "Error"));
    } finally {
      setCatSaving(false);
    }
  };

  // ── Qty Color Helper ──────────────────────────────────────────────
  const getQtyClass = (item) => {
    const qty = item.qty_on_hand;
    const reorder = item.reorder_level;
    if (qty === 0) {
      return "bg-red-50 text-red-700 border-red-100 font-bold";
    }
    if (reorder !== null && qty <= reorder) {
      return "bg-amber-50 text-amber-700 border-amber-100 font-bold";
    }
    return "bg-green-50 text-green-700 border-green-100 font-bold";
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
            <Package size={20} /> Stock Catalog
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} products listed</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setShowNewCatInput(false);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
            style={{ background: "#1F3C8A" }}
          >
            Add Catalog Item
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
            placeholder="Search by brand or model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-xl bg-white
                       focus:outline-none focus:ring-2 transition"
            style={{ borderColor: "#d5dcf5" }}
          />
        </div>

        <div className="flex items-center gap-4">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ borderColor: "#d5dcf5" }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

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
                  {["Brand", "Model", "Category", "Qty On Hand", "Reorder Level", "Serialized", "Status", "Actions"].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3"
                        style={{ color: "#1F3C8A" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={i.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid #f0f4ff",
                        background: !i.is_active
                          ? "#fafafa"
                          : idx % 2 === 0 ? "#ffffff" : "#fafbff",
                      }}
                      onMouseEnter={(e) => i.is_active && (e.currentTarget.style.background = "#eef1fb")}
                      onMouseLeave={(e) => e.currentTarget.style.background = !i.is_active
                        ? "#fafafa" : idx % 2 === 0 ? "#ffffff" : "#fafbff"}>

                    <td className={`px-4 py-3 text-gray-700 text-xs ${i.is_active ? "" : "text-gray-400 line-through"}`}>
                      {i.brand || "—"}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${i.is_active ? "" : "text-gray-400 line-through"}`}
                        style={i.is_active ? { color: "#1F3C8A" } : {}}>
                      {i.model}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{i.category_name || "—"}</td>

                    {/* Qty on Hand Badge */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2.5 py-0.5 border rounded-full ${getQtyClass(i)}`}>
                        {i.qty_on_hand}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs">{i.reorder_level !== null ? i.reorder_level : "—"}</td>

                    {/* Serialized Badge */}
                    <td className="px-4 py-3">
                      {i.requires_serial ? (
                        <span className="text-xs font-semibold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-100">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Bulk (No)</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {i.is_active ? (
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
                        {i.is_active ? (
                          <>
                            <button
                              onClick={() => openEditModal(i)}
                              className="p-1.5 rounded-lg hover:bg-cc-blue-50 transition-colors"
                              style={{ color: "#1F3C8A" }}
                              title="Edit Item"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(i)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Deactivate Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleReactivate(i.id)}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-cc-green-50"
                            style={{ color: "#27AE60" }}
                            title="Reactivate Item"
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

            {items.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No catalog items found matching the criteria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Add Catalog Item</h3>
              <button onClick={() => setShowCreateModal(false)} disabled={isCreating}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Category *
                </label>
                <div className="flex gap-2">
                  <select
                    required
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select Category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    className="px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Plus size={14} /> Category
                  </button>
                </div>

                {showNewCatInput && (
                  <div className="mt-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={catSaving}
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg"
                    >
                      {catSaving ? "..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Brand</label>
                  <input type="text" value={createBrand}
                         onChange={(e) => setCreateBrand(e.target.value)}
                         className={inputCls} placeholder="e.g. Lenovo, HP" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Model *</label>
                  <input type="text" required value={createModel}
                         onChange={(e) => setCreateModel(e.target.value)}
                         className={inputCls} placeholder="e.g. ThinkPad E14" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Description Override</label>
                <input type="text" value={createDescription}
                       onChange={(e) => setCreateDescription(e.target.value)}
                       className={inputCls} placeholder="Defaults to '{brand} {model}' if blank" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Reorder Threshold</label>
                  <input type="number" min="0" value={createReorderLevel}
                         onChange={(e) => setCreateReorderLevel(e.target.value)}
                         className={inputCls} placeholder="e.g. 5" />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 cursor-pointer select-none py-2">
                    <input
                      type="checkbox"
                      checked={createRequiresSerial}
                      onChange={(e) => setCreateRequiresSerial(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "#1F3C8A" }}
                    />
                    Requires Serial Tracking
                  </label>
                </div>
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
                  Create Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border overflow-hidden"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="px-6 py-4 flex items-center justify-between border-b"
                 style={{
                   borderColor: "#eef1fb",
                   background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)",
                 }}>
              <h3 className="text-base font-bold text-white">Edit Catalog Item</h3>
              <button onClick={() => setEditTarget(null)} disabled={isSaving}
                      className="text-blue-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>
                  Category *
                </label>
                <div className="flex gap-2">
                  <select
                    required
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select Category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(!showNewCatInput)}
                    className="px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Plus size={14} /> Category
                  </button>
                </div>

                {showNewCatInput && (
                  <div className="mt-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={catSaving}
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg"
                    >
                      {catSaving ? "..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Brand</label>
                  <input type="text" value={editBrand}
                         onChange={(e) => setEditBrand(e.target.value)}
                         className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Model *</label>
                  <input type="text" required value={editModel}
                         onChange={(e) => setEditModel(e.target.value)}
                         className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                       style={{ color: "#1F3C8A" }}>Description Override</label>
                <input type="text" value={editDescription}
                       onChange={(e) => setEditDescription(e.target.value)}
                       className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                         style={{ color: "#1F3C8A" }}>Reorder Threshold</label>
                  <input type="number" min="0" value={editReorderLevel}
                         onChange={(e) => setEditReorderLevel(e.target.value)}
                         className={inputCls} />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-700 cursor-pointer select-none py-2">
                    <input
                      type="checkbox"
                      checked={editRequiresSerial}
                      onChange={(e) => setEditRequiresSerial(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "#1F3C8A" }}
                    />
                    Requires Serial Tracking
                  </label>
                </div>
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
              <h3 className="text-lg font-bold text-gray-900">Deactivate Catalog Item</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to deactivate{" "}
              <span className="font-bold text-gray-900">{deleteTarget.brand} {deleteTarget.model}</span>?{" "}
              This will hide this product from invoices and stock receipt screens.
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
