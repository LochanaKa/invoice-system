import { useState, useEffect, useRef } from "react";
import { useNavigate }         from "react-router-dom";
import { Plus, Trash2, Info, Search, RefreshCw, X, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getLookups,
  getSuppliers,
  createSupplier,
  getStockItems,
  createStockItem,
  getStockCategories,
  createStockReceipt,
  addSerialsToReceiptItem,
  getSettings,
} from "../services/api";

const EMPTY_ITEM = {
  stock_item_id: "",
  qty: 1,
  unit_cost: "",
  operation_cost_type: "percentage",
  operation_cost_value: "0",
  // UI helpers
  searchQuery: "",
  isSearchOpen: false,
  requires_serial: false,
  brand: "",
  model: "",
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export default function NewStockReceipt() {
  const navigate = useNavigate();

  // ── Receipt Form State ──────────────────────────────────────────────────────
  const [supplierId,   setSupplierId]   = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNo,  setReferenceNo]  = useState("");
  const [notes,        setNotes]        = useState("");
  const [items,        setItems]        = useState([{ ...EMPTY_ITEM }]);

  // Lists & Lookups
  const [suppliers,    setSuppliers]    = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [reps,         setReps]         = useState([]);
  const [selectedRep,  setSelectedRep]  = useState("");

  // Global defaults
  const [ssclPct,      setSsclPct]      = useState(0.025);
  const [vatPct,       setVatPct]       = useState(0.18);

  // Statuses
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);

  // Search & Autocomplete
  const [suppSearch,   setSuppSearch]   = useState("");
  const [isSuppOpen,   setIsSuppOpen]   = useState(false);

  // Quick Add Supplier
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppName,      setSuppName]      = useState("");
  const [suppContact,   setSuppContact]   = useState("");
  const [suppPhone,     setSuppPhone]     = useState("");
  const [suppSaving,    setSuppSaving]    = useState(false);

  // Quick Add Catalog Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemCatId,     setItemCatId]     = useState("");
  const [itemBrand,     setItemBrand]     = useState("");
  const [itemModel,     setItemModel]     = useState("");
  const [itemReqSerial, setItemReqSerial] = useState(false);
  const [itemSaving,    setItemSaving]    = useState(false);
  const [targetRowIdx,  setTargetRowIdx]  = useState(null);

  // ── Post-Submit Serial Phase State ──────────────────────────────────────────
  const [receiptResult, setReceiptResult] = useState(null); // holds the response from POST /stock-receipts
  const [serialPhase,   setSerialPhase]   = useState(false);
  const [serialLines,   setSerialLines]   = useState([]); // lines that need serial entry
  const [activeLineIdx, setActiveLineIdx] = useState(0); // currently scanning line index
  const [scanValue,     setScanValue]     = useState("");
  const [submittingSerials, setSubmittingSerials] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  async function loadLookups() {
    setLoading(true);
    try {
      const lookups = await getLookups();
      setReps(lookups.reps || []);
      const sups = await getSuppliers();
      setSuppliers(sups);
      const cat = await getStockItems();
      setCatalogItems(cat);
      const categoriesList = await getStockCategories();
      setCategories(categoriesList);

      // Get defaults
      const settings = await getSettings().catch(() => null);
      if (settings) {
        setSsclPct(Number(settings.sscl_pct || 0.025));
        setVatPct(Number(settings.vat_pct || 0.18));
      }
    } catch (e) {
      console.error("Failed to load receipt form requirements", e);
      setError("Failed to load initial form data from server.");
    } finally {
      setLoading(false);
    }
  }

  // ── Supplier autocomplete handlers ─────────────────────────────────────────
  function handleSelectSupplier(s) {
    setSupplierId(String(s.id));
    setSuppSearch(s.name);
    setIsSuppOpen(false);
  }

  // ── Live Cost Calculations per Line ────────────────────────────────────────
  const calculateLineCost = (it) => {
    const cost = Number(it.unit_cost) || 0;
    const val = Number(it.operation_cost_value) || 0;
    let opCostAmount = 0;
    if (it.operation_cost_type === "percentage") {
      opCostAmount = round2(cost * (val / 100));
    } else {
      opCostAmount = round2(val);
    }
    const afterOp = round2(cost + opCostAmount);
    const ssclAmt = round2(afterOp * ssclPct);
    const afterSscl = round2(afterOp + ssclAmt);
    const vatAmt = round2(afterSscl * vatPct);
    const finalPrice = round2(afterSscl + vatAmt);

    return {
      opCostAmount,
      afterOp,
      ssclAmt,
      vatAmt,
      finalPrice,
    };
  };

  // ── Line action handlers ───────────────────────────────────────────────────
  function updateItemField(index, field, value) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "stock_item_id") {
        const match = catalogItems.find(c => String(c.id) === String(value));
        if (match) {
          next.requires_serial = match.requires_serial;
          next.brand = match.brand || "";
          next.model = match.model;
          next.searchQuery = `${match.brand || ""} ${match.model}`.trim();
        } else {
          next.requires_serial = false;
          next.brand = "";
          next.model = "";
          next.searchQuery = "";
        }
        next.isSearchOpen = false;
      }
      return next;
    }));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Autocomplete search inside GRN item line ────────────────────────────────
  function handleLineSearchChange(index, val) {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, searchQuery: val, stock_item_id: "", isSearchOpen: true } : item
    ));
  }

  // ── Quick Add Supplier ──────────────────────────────────────────────────────
  async function handleQuickAddSupplier() {
    if (!suppName.trim()) return;
    setSuppSaving(true);
    try {
      const vendor = await createSupplier({
        name: suppName.trim(),
        contact_person: suppContact.trim() || null,
        phone: suppPhone.trim() || null,
      });
      setSuppliers((prev) => [...prev, vendor].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(String(vendor.id));
      setSuppSearch(vendor.name);
      setShowSuppModal(false);
      setSuppName("");
      setSuppContact("");
      setSuppPhone("");
    } catch (err) {
      alert("Failed to quick-add supplier: " + (err.response?.data?.detail ?? "Error"));
    } finally {
      setSuppSaving(false);
    }
  }

  // ── Quick Add Catalog Item ──────────────────────────────────────────────────
  async function handleQuickAddItem() {
    if (!itemCatId || !itemModel.trim()) return;
    setItemSaving(true);
    try {
      const product = await createStockItem({
        category_id: Number(itemCatId),
        brand: itemBrand.trim() || null,
        model: itemModel.trim(),
        requires_serial: itemReqSerial,
      });
      setCatalogItems((prev) => [...prev, product].sort((a, b) => a.model.localeCompare(b.model)));

      // Update the specific row that initiated the add
      if (targetRowIdx !== null) {
        updateItemField(targetRowIdx, "stock_item_id", product.id);
      }

      setShowItemModal(false);
      setItemCatId("");
      setItemBrand("");
      setItemModel("");
      setItemReqSerial(false);
      setTargetRowIdx(null);
    } catch (err) {
      alert("Failed to quick-add catalog item: " + (err.response?.data?.detail ?? "Error"));
    } finally {
      setItemSaving(false);
    }
  }

  // ── Submit Stock Receipt Header & Lines ──────────────────────────────────────
  async function handleSubmitGRN(e) {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError("Please search and select a valid supplier.");
      return;
    }

    const validLines = items.filter(it => it.stock_item_id && Number(it.qty) > 0 && Number(it.unit_cost) >= 0);
    if (validLines.length === 0) {
      setError("Add at least one line item with a catalog product, valid cost and quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: Number(supplierId),
        received_date: receivedDate,
        reference_no: referenceNo.trim() || null,
        notes: notes.trim() || null,
        received_by_rep_id: selectedRep ? Number(selectedRep) : null,
        items: validLines.map(it => ({
          stock_item_id: Number(it.stock_item_id),
          qty: Number(it.qty),
          unit_cost: Number(it.unit_cost),
          operation_cost_type: it.operation_cost_type,
          operation_cost_value: Number(it.operation_cost_value),
        })),
      };

      const result = await createStockReceipt(payload);
      setReceiptResult(result);

      // Filter lines from response payload that require serial input
      const serializedLines = result.items.filter(line => {
        // match back to catalog item to see if it requires serial
        const catalogItem = catalogItems.find(c => c.id === line.stock_item_id);
        return catalogItem?.requires_serial;
      }).map(line => {
        const catalogItem = catalogItems.find(c => c.id === line.stock_item_id);
        return {
          id: line.id, // stock_receipt_item_id
          stock_item_id: line.stock_item_id,
          name: `${catalogItem?.brand || ""} ${catalogItem?.model}`.trim(),
          qty: line.qty,
          serials: [],
        };
      });

      if (serializedLines.length > 0) {
        setSerialLines(serializedLines);
        setSerialPhase(true);
      } else {
        alert("Stock receipt saved successfully! All bulk items added.");
        navigate("/stock-items");
      }
    } catch (err) {
      setError(err.response?.data?.detail ?? "Failed to save stock receipt. Check details.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Serial Intake Phase Handlers ──────────────────────────────────────────
  function handleAddSerial(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = scanValue.trim();
    if (!val) return;

    const activeLine = serialLines[activeLineIdx];
    if (activeLine.serials.includes(val)) {
      alert("This serial number is already scanned for this line.");
      setScanValue("");
      return;
    }

    if (activeLine.serials.length >= activeLine.qty) {
      alert("All serials for this line have already been entered.");
      setScanValue("");
      return;
    }

    // Update lines state
    setSerialLines(prev => prev.map((line, idx) =>
      idx === activeLineIdx ? { ...line, serials: [...line.serials, val] } : line
    ));
    setScanValue("");
  }

  function removeSerial(lineIdx, serIdx) {
    setSerialLines(prev => prev.map((line, idx) =>
      idx === lineIdx ? { ...line, serials: line.serials.filter((_, s) => s !== serIdx) } : line
    ));
  }

  async function handleSaveSerials() {
    // Validate all serials are fully scanned
    const incomplete = serialLines.find(l => l.serials.length < l.qty);
    if (incomplete) {
      alert(`Please scan all serials for: ${incomplete.name} (${incomplete.serials.length}/${incomplete.qty} scanned)`);
      return;
    }

    setSubmittingSerials(true);
    try {
      // POST serials for each serialized line
      for (const line of serialLines) {
        await addSerialsToReceiptItem(receiptResult.id, line.id, line.serials);
      }
      alert("Stock receipt saved and all serials linked successfully!");
      navigate("/stock-items");
    } catch (err) {
      alert(err.response?.data?.detail ?? "Error registering serial numbers. Check duplicates.");
    } finally {
      setSubmittingSerials(false);
    }
  }

  // ── Totals breakdown live summary ──────────────────────────────────────────
  const receiptSubtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_cost) || 0), 0);
  const calculations = items.map(calculateLineCost);
  const totalOpCost = items.reduce((s, it, idx) => s + (Number(it.qty) || 0) * calculations[idx].opCostAmount, 0);
  const totalSscl = items.reduce((s, it, idx) => s + (Number(it.qty) || 0) * calculations[idx].ssclAmt, 0);
  const totalVat = items.reduce((s, it, idx) => s + (Number(it.qty) || 0) * calculations[idx].vatAmt, 0);
  const grandTotal = items.reduce((s, it, idx) => s + (Number(it.qty) || 0) * calculations[idx].finalPrice, 0);

  const fmt = (n) => Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const inp = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;
  const lbl = `block text-xs font-semibold text-gray-600 mb-1.5`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2"
           style={{ color: "#1F3C8A" }}>
        <RefreshCw className="animate-spin" size={18} />
        <span className="text-sm">Loading receipt options...</span>
      </div>
    );
  }

  // ── UI Case 1: Scanning Serial Numbers Phase ────────────────────────────────
  if (serialPhase) {
    const activeLine = serialLines[activeLineIdx];
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#1F3C8A" }}>
            <ShieldCheck size={22} className="text-emerald-500" /> Serial Numbers Intake
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Linked to Stock Receipt Ref: <span className="font-bold">{referenceNo || receiptResult.id}</span>.
            Scan/type individual barcode serials for serialized items.
          </p>
        </div>

        {/* Status Steps */}
        <div className="flex gap-2 border-b border-gray-100 pb-3 overflow-x-auto">
          {serialLines.map((line, idx) => (
            <button
              key={line.id}
              onClick={() => setActiveLineIdx(idx)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 flex-shrink-0 ${
                activeLineIdx === idx
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}
            >
              <span>{line.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                line.serials.length === line.qty
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {line.serials.length} / {line.qty}
              </span>
            </button>
          ))}
        </div>

        {activeLine && (
          <div className="bg-white rounded-2xl border p-6 space-y-4 shadow-cc-sm" style={{ borderColor: "#d5dcf5" }}>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Active Product</span>
              <h2 className="text-lg font-bold text-gray-800 mt-0.5">{activeLine.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Please scan exactly {activeLine.qty} serial number(s).</p>
            </div>

            {/* Scanning Barcode Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-600 uppercase">Scan or Enter Serial Number</label>
              <input
                type="text"
                autoFocus
                placeholder="Scan barcode and press Enter..."
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={handleAddSerial}
                disabled={activeLine.serials.length >= activeLine.qty}
                className="w-full px-4 py-3 text-base border-2 rounded-xl focus:border-blue-600 focus:outline-none placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 italic flex items-center gap-1.5 mt-1">
                <Info size={12} /> Barcode scanners automatically submit the Enter key after scanning.
              </p>
            </div>

            {/* List of scanned serials */}
            <div>
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Scanned Serials ({activeLine.serials.length} / {activeLine.qty})</h4>
              <div className="grid grid-cols-3 gap-2">
                {activeLine.serials.map((ser, sIdx) => (
                  <div key={sIdx} className="bg-gray-50 border rounded-lg px-2.5 py-1.5 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-gray-800">{ser}</span>
                    <button type="button" onClick={() => removeSerial(activeLineIdx, sIdx)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submission Actions */}
        <div className="flex justify-between items-center bg-gray-50 p-4 border rounded-2xl">
          <span className="text-xs text-gray-500">
            Total lines: {serialLines.length} · Completed lines: {serialLines.filter(l => l.serials.length === l.qty).length}
          </span>
          <button
            type="button"
            disabled={submittingSerials}
            onClick={handleSaveSerials}
            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition rounded-xl flex items-center gap-2"
          >
            {submittingSerials && <RefreshCw size={14} className="animate-spin" />}
            Save &amp; Complete Intake
          </button>
        </div>
      </div>
    );
  }

  // ── UI Case 2: Standard Goods Received Note Form ────────────────────────────
  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#1F3C8A" }}>
          New Stock Receipt (GRN)
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Intake goods received from suppliers and record unit costs.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex gap-2 items-center">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmitGRN} className="space-y-5">
        {/* Supplier & Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-cc-sm" style={{ borderColor: "#d5dcf5" }}>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Receipt Header</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={lbl}>Supplier / Vendor *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={suppSearch}
                    onChange={(e) => {
                      setSuppSearch(e.target.value);
                      setSupplierId(""); // invalidate selection
                      setIsSuppOpen(true);
                    }}
                    onFocus={() => setIsSuppOpen(true)}
                    onBlur={() => setTimeout(() => setIsSuppOpen(false), 250)}
                    placeholder="Type to search supplier..."
                    className={inp}
                    required={!supplierId}
                  />
                  <input type="hidden" value={supplierId} required />
                  {isSuppOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                      {suppliers
                        .filter(s => s.name.toLowerCase().includes(suppSearch.toLowerCase()))
                        .slice(0, 8)
                        .map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={() => handleSelectSupplier(s)}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 text-sm border-b last:border-b-0"
                          >
                            <span className="font-medium">{s.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuppModal(true)}
                  className="px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Plus size={14} /> Quick Add
                </button>
              </div>
            </div>

            <div>
              <label className={lbl}>Reference No / invoice No</label>
              <input
                type="text"
                placeholder="e.g. INV-100253"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className={inp}
              />
            </div>

            <div>
              <label className={lbl}>Received Date *</label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className={inp}
              />
            </div>

            <div>
              <label className={lbl}>Received By Staff member</label>
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className={inp}
              >
                <option value="">— Select Staff —</option>
                {reps.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className={lbl}>Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any comments, shipment condition details..."
              className={inp}
            />
          </div>
        </div>

        {/* Lines Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-cc-sm" style={{ borderColor: "#d5dcf5" }}>
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Receipt Items</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Social Security Levy (SSCL) ({round2(ssclPct * 100)}%) and VAT ({round2(vatPct * 100)}%) are applied downstream.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <th className="text-left px-4 py-2 w-6">NO</th>
                  <th className="text-left px-4 py-2">PRODUCT MODEL</th>
                  <th className="text-center px-4 py-2 w-16">QTY</th>
                  <th className="text-right px-4 py-2 w-28">UNIT COST (Rs.)</th>
                  <th className="text-center px-4 py-2 w-48">OP COST BASIS</th>
                  <th className="text-right px-4 py-2 w-40">LINE TOTAL (FINAL)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => {
                  const calc = calculateLineCost(item);
                  return (
                    <tr key={idx} className="hover:bg-gray-50/30">
                      <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>

                      {/* Product search select */}
                      <td className="px-4 py-2 relative">
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={item.searchQuery}
                            onChange={(e) => handleLineSearchChange(idx, e.target.value)}
                            onFocus={() => {
                              // Reset results search view
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, isSearchOpen: true } : it));
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setItems(prev => prev.map((it, i) => i === idx ? { ...it, isSearchOpen: false } : it));
                              }, 250);
                            }}
                            placeholder="Type brand/model..."
                            className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTargetRowIdx(idx);
                              setShowItemModal(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition"
                            title="Add missing item to catalog"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {item.isSearchOpen && (
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border rounded-xl shadow-lg z-50">
                            {catalogItems
                              .filter(c => `${c.brand || ""} ${c.model}`.toLowerCase().includes(item.searchQuery.toLowerCase()))
                              .slice(0, 6)
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={() => updateItemField(idx, "stock_item_id", c.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex justify-between border-b last:border-b-0"
                                >
                                  <span className="font-semibold text-gray-800">{c.brand || ""} {c.model}</span>
                                  {c.requires_serial && (
                                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded text-[10px]">Serialized</span>
                                  )}
                                </button>
                              ))}
                          </div>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.qty}
                          onChange={(e) => updateItemField(idx, "qty", parseInt(e.target.value) || 1)}
                          className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent text-center"
                        />
                      </td>

                      {/* Unit Cost */}
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="0.00"
                          value={item.unit_cost}
                          onChange={(e) => updateItemField(idx, "unit_cost", e.target.value)}
                          className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent text-right"
                        />
                      </td>

                      {/* Op Cost Type & Value */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.operation_cost_value}
                            onChange={(e) => updateItemField(idx, "operation_cost_value", e.target.value)}
                            className="w-16 border-0 border-b border-gray-200 py-1 text-sm focus:outline-none text-right bg-transparent"
                          />
                          <select
                            value={item.operation_cost_type}
                            onChange={(e) => updateItemField(idx, "operation_cost_type", e.target.value)}
                            className="text-xs border-none bg-transparent py-1 text-gray-500 focus:outline-none"
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">Rs.</option>
                          </select>
                        </div>
                      </td>

                      {/* Live Breakdown Output */}
                      <td className="px-4 py-2 text-right">
                        <div className="font-semibold text-gray-800">
                          Rs. {fmt(calc.finalPrice * (Number(item.qty) || 1))}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Unit: Rs. {fmt(calc.finalPrice)}
                          <span className="mx-1">·</span>
                          Op: {item.operation_cost_type === "percentage" ? `${item.operation_cost_value}%` : `Rs.${item.operation_cost_value}`} (Rs.{fmt(calc.opCostAmount)})
                        </div>
                      </td>

                      <td className="pr-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-gray-300 hover:text-red-500 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Subtotals & Taxes Live Summary */}
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
            <div className="ml-auto w-80 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Items Cost Subtotal</span>
                <span>Rs. {fmt(receiptSubtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Total Operation Cost Add-on</span>
                <span>Rs. {fmt(totalOpCost)}</span>
              </div>
              <div className="flex justify-between text-amber-600 text-xs">
                <span>Social Security Levy (SSCL) ({round2(ssclPct * 100)}%)</span>
                <span>Rs. {fmt(totalSscl)}</span>
              </div>
              <div className="flex justify-between text-purple-700 text-xs">
                <span>Value Added Tax (VAT) ({round2(vatPct * 100)}%)</span>
                <span>Rs. {fmt(totalVat)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-2 mt-1 text-base">
                <span>GRAND TOTAL BASIS</span>
                <span>Rs. {fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 text-sm font-bold text-white rounded-xl flex items-center gap-2 transition"
          style={{ background: submitting ? "#7f96e1" : "#1F3C8A" }}
        >
          {submitting && <RefreshCw size={14} className="animate-spin" />}
          Record Receipt &amp; Enter Serials
        </button>
      </form>

      {/* Quick Add Supplier Modal */}
      {showSuppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border">
            <div className="px-5 py-3 border-b flex justify-between items-center text-white" style={{ background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)" }}>
              <span className="font-bold text-sm">Quick Add Supplier</span>
              <button onClick={() => setShowSuppModal(false)} disabled={suppSaving} className="hover:text-blue-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Supplier Name *</label>
                <input type="text" value={suppName} onChange={(e) => setSuppName(e.target.value)} className={inp} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Contact Person</label>
                <input type="text" value={suppContact} onChange={(e) => setSuppContact(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Phone Number</label>
                <input type="text" value={suppPhone} onChange={(e) => setSuppPhone(e.target.value)} className={inp} />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowSuppModal(false)} disabled={suppSaving} className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="button" onClick={handleQuickAddSupplier} disabled={suppSaving} className="px-4 py-1.5 text-xs font-bold text-white rounded-lg bg-blue-600 hover:bg-blue-700">
                  {suppSaving ? "Saving..." : "Add Supplier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border">
            <div className="px-5 py-3 border-b flex justify-between items-center text-white" style={{ background: "linear-gradient(90deg, #1F3C8A 0%, #2950cd 100%)" }}>
              <span className="font-bold text-sm">Add Missing Catalog Product</span>
              <button onClick={() => setShowItemModal(false)} disabled={itemSaving} className="hover:text-blue-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Category *</label>
                <select value={itemCatId} onChange={(e) => setItemCatId(e.target.value)} className={inp} required>
                  <option value="">— Select Category —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Brand Name</label>
                <input type="text" value={itemBrand} onChange={(e) => setItemBrand(e.target.value)} className={inp} placeholder="e.g. Dell, Samsung" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Model Name *</label>
                <input type="text" value={itemModel} onChange={(e) => setItemModel(e.target.value)} className={inp} placeholder="e.g. Latitude 5420" required />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none py-1">
                  <input type="checkbox" checked={itemReqSerial} onChange={(e) => setItemReqSerial(e.target.checked)} className="w-4 h-4 rounded" />
                  Requires Serial Tracking
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowItemModal(false)} disabled={itemSaving} className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="button" onClick={handleQuickAddItem} disabled={itemSaving} className="px-4 py-1.5 text-xs font-bold text-white rounded-lg bg-blue-600 hover:bg-blue-700">
                  {itemSaving ? "Saving..." : "Add Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
