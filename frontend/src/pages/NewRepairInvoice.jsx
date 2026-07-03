/**
 * pages/NewRepairInvoice.jsx — Repair Invoice Creation
 * =====================================================
 * Standalone page for REPAIR invoices; do NOT share logic with NewInvoice.jsx.
 *
 * Differences from NewInvoice.jsx (Sales):
 *  - service_type hard-coded to "REPAIR" (amber badge, no dropdown).
 *  - No serial scanner or stock catalog picker — all lines are free-text.
 *  - Section 0: Job Card selector — picking a card pre-fills serial + description.
 *    Supports ?job_card_id= param; JobCardDetail uses this to launch from a card.
 *  - On successful save, calls PATCH /jobs/:id → linked_sales_invoice_id = inv.id.
 *  - Tax & Margin Rates: intentionally the pre-Prompt-3 MANUAL entry (no stock chain).
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Info, Search, ClipboardList, Loader2 } from "lucide-react";
import {
  getLookups, getCustomers, createInvoice, getSettings,
  getNextInvoiceNumber, createCustomer, createRoute,
  authFetch, updateJobCard, getJobCards,
} from "../services/api";
import { API_BASE } from "../config";
import { round2, calculateItemRow, calculateInvoiceTotals } from "../utils/invoiceCalc";

const EMPTY_ITEM = { description: "", serial_no: "", qty: 1, rate: "" };
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NewRepairInvoice() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    invoice_number:   "",
    invoice_category: "ALL_INC",
    invoice_date:     new Date().toISOString().split("T")[0],
    due_date:   "", po_number: "", warranty: "", contact_name: "",
    customer_tin: "", customer_phone: "", customer_id: "",
    rep_id: "", credit_balance: "0", remarks: "", route_id: "",
  });
  const [rates, setRates] = useState({ profit_margin_pct: "", sscl_pct: "", vat_pct: "" });
  const [items,          setItems]          = useState([{ ...EMPTY_ITEM }]);
  const [reps,           setReps]           = useState([]);
  const [customers,      setCustomers]      = useState([]);
  const [routes,         setRoutes]         = useState([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState(null);
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [printing,       setPrinting]       = useState(false);

  const [custSearch,  setCustSearch]  = useState("");
  const [isOpen,      setIsOpen]      = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [isRouteOpen, setIsRouteOpen] = useState(false);

  const [showQuickAdd,  setShowQuickAdd]  = useState(false);
  const [quickAddName,  setQuickAddName]  = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAdding,   setQuickAdding]   = useState(false);
  const [quickAddErr,   setQuickAddErr]   = useState(null);

  const [jobCardSearch,   setJobCardSearch]   = useState("");
  const [jobCardResults,  setJobCardResults]  = useState([]);
  const [jobCardLoading,  setJobCardLoading]  = useState(false);
  const [jobCardOpen,     setJobCardOpen]     = useState(false);
  const [linkedJobCard,   setLinkedJobCard]   = useState(null);
  const [linkedJobCardId, setLinkedJobCardId] = useState(null);

  // ── On mount: lookups + settings ─────────────────────────────────────────
  useEffect(() => {
    getLookups().then(async (d) => {
      setReps(d.reps);
      setRoutes(d.routes || []);
      if (d.settings) {
        setRates({
          profit_margin_pct: String(round2(Number(d.settings.profit_margin) * 100)),
          sscl_pct:          String(round2(Number(d.settings.sscl_pct)      * 100)),
          vat_pct:           String(round2(Number(d.settings.vat_pct)       * 100)),
        });
        setSettingsLoaded(true);
      }
      const walk = (d.routes || []).find((r) => r.name === "Walk-In Customer");
      if (!walk) {
        try { const nr = await createRoute({ name: "Walk-In Customer" }); setRoutes(p => [...p, nr]); setForm(f => ({ ...f, route_id: nr.id })); }
        catch {}
      } else { setForm((f) => ({ ...f, route_id: walk.id })); }
    });
    getCustomers().then(setCustomers);
    getSettings()
      .then((s) => {
        setRates({
          profit_margin_pct: String(round2(Number(s.profit_margin) * 100)),
          sscl_pct:          String(round2(Number(s.sscl_pct)      * 100)),
          vat_pct:           String(round2(Number(s.vat_pct)       * 100)),
        });
        setSettingsLoaded(true);
      })
      .catch(() => { setRates({ profit_margin_pct: "20", sscl_pct: "2.5", vat_pct: "18" }); setSettingsLoaded(true); });
  }, []);

  // ── Auto-load job card from ?job_card_id= ────────────────────────────────
  useEffect(() => {
    const jcId = searchParams.get("job_card_id");
    if (!jcId) return;
    getJobCards().then((cards) => {
      const found = cards.find((c) => String(c.id) === String(jcId));
      if (found) attachJobCard(found);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Invoice number ─────────────────────────────────────────────────────────
  useEffect(() => {
    getNextInvoiceNumber(form.invoice_category, "REPAIR")
      .then((d) => setForm((f) => ({ ...f, invoice_number: d.invoice_number })))
      .catch((err) => console.error(err));
  }, [form.invoice_category]);

  // ── Customer / route sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (form.customer_id && customers.length > 0) {
      const m = customers.find((c) => String(c.id) === String(form.customer_id));
      if (m) { setCustSearch(m.name); setForm((f) => ({ ...f, customer_tin: m.tin || "", customer_phone: m.phone || "" })); }
    } else if (!form.customer_id) { setForm((f) => ({ ...f, customer_tin: "", customer_phone: "" })); }
  }, [form.customer_id, customers]);

  useEffect(() => {
    if (form.route_id && routes.length > 0) {
      const m = routes.find((r) => String(r.id) === String(form.route_id));
      if (m) setRouteSearch(m.name);
    }
  }, [form.route_id, routes]);

  // ── Attach job card ───────────────────────────────────────────────────────
  function attachJobCard(card) {
    setLinkedJobCard(card);
    setLinkedJobCardId(card.id);
    setJobCardSearch(`#${card.id} — ${card.device_name} (${card.customer_name})`);
    setJobCardOpen(false);
    const descVal = card.issue_description
      ? `Repair: ${card.device_name} — ${card.issue_description}`
      : `Repair: ${card.device_name}`;
    setItems((prev) => {
      const empty = prev.length === 1 && !prev[0].description && !prev[0].rate;
      if (empty) return [{ ...prev[0], description: descVal, serial_no: card.serial_number || "" }];
      return [...prev, { ...EMPTY_ITEM, description: descVal, serial_no: card.serial_number || "" }];
    });
    if (!form.customer_id) {
      const matched = customers.find((c) => c.name.toLowerCase() === card.customer_name.toLowerCase());
      if (matched) {
        setForm((f) => ({ ...f, customer_id: String(matched.id), customer_tin: matched.tin || "", customer_phone: matched.phone || card.customer_phone || "" }));
        setCustSearch(matched.name);
      } else if (card.customer_phone) {
        setForm((f) => ({ ...f, customer_phone: card.customer_phone }));
      }
    }
  }

  // ── Job card search ───────────────────────────────────────────────────────
  const handleJobCardSearch = useCallback(async (q) => {
    setJobCardLoading(true);
    try {
      const all      = await getJobCards();
      const unlocked = all.filter((c) => !c.linked_sales_invoice_id);
      if (!q.trim() || q.startsWith("#")) {
        setJobCardResults(unlocked.slice(0, 20));
      } else {
        const lq = q.toLowerCase();
        setJobCardResults(unlocked.filter((c) =>
          String(c.id).includes(q) ||
          c.customer_name.toLowerCase().includes(lq) ||
          c.device_name.toLowerCase().includes(lq) ||
          (c.serial_number || "").toLowerCase().includes(lq)
        ).slice(0, 20));
      }
      setJobCardOpen(true);
    } catch { setJobCardResults([]); }
    finally   { setJobCardLoading(false); }
  }, []);

  function handleSelectCustomer(cust) {
    setForm((f) => ({ ...f, customer_id: String(cust.id), customer_tin: cust.tin || "", customer_phone: cust.phone || "" }));
    setCustSearch(cust.name); setIsOpen(false);
  }
  function handleSearchChange(e) {
    setCustSearch(e.target.value);
    setForm((f) => ({ ...f, customer_id: "", customer_tin: "", customer_phone: "" }));
    setIsOpen(true);
  }
  function handleSelectRoute(route) {
    setForm((f) => ({ ...f, route_id: String(route.id) }));
    setRouteSearch(route.name); setRouteFilter(""); setIsRouteOpen(false);
  }
  function handleRouteSearchChange(e) {
    setRouteSearch(e.target.value); setRouteFilter(e.target.value);
    setForm((f) => ({ ...f, route_id: "" })); setIsRouteOpen(true);
  }
  async function handleQuickAddSave() {
    if (!quickAddName.trim()) return;
    setQuickAdding(true); setQuickAddErr(null);
    try {
      const n = await createCustomer({ name: quickAddName.trim(), phone: quickAddPhone.trim() || null });
      setCustomers((p) => [...p, n]);
      setForm((f) => ({ ...f, customer_id: String(n.id), customer_tin: "", customer_phone: n.phone || "" }));
      setCustSearch(n.name); setShowQuickAdd(false);
    } catch (err) { setQuickAddErr(err.response?.data?.detail || "Failed to save customer."); }
    finally       { setQuickAdding(false); }
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function addItem()         { setItems((prev) => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(index) { if (items.length === 1) return; setItems((prev) => prev.filter((_, i) => i !== index)); }

  // ── Live totals ───────────────────────────────────────────────────────────
  const marginPct = (Number(rates.profit_margin_pct) || 0) / 100;
  const ssclPct   = (Number(rates.sscl_pct)          || 0) / 100;
  const vatPct    = (Number(rates.vat_pct)            || 0) / 100;
  const category  = form.invoice_category;
  const lineCalcs = items.map((item) => calculateItemRow(item, category, marginPct, ssclPct, vatPct));
  const { baseSubtotal, profitAmt, displaySubtotal, ssclAmt, vatAmt, grandTotal } =
    calculateInvoiceTotals(lineCalcs, category, ssclPct, vatPct);
  const isVAT = category === "VAT";

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setError(null);
    if (!form.customer_id) { setError("Please select a valid customer."); setSubmitting(false); return; }
    const validItems = items.filter((it) => it.description.trim() && Number(it.rate) > 0);
    if (!validItems.length) { setError("Add at least one line item with a description and rate."); setSubmitting(false); return; }
    try {
      const inv = await createInvoice({
        invoice_number: form.invoice_number, invoice_category: form.invoice_category,
        service_type: "REPAIR",
        invoice_date: form.invoice_date, due_date: form.due_date || null,
        po_number: form.po_number || null, warranty: form.warranty || null,
        contact_name: form.contact_name || null,
        customer_tin: form.customer_tin?.trim() || null,
        customer_phone: form.customer_phone?.trim() || null,
        customer_id: parseInt(form.customer_id),
        rep_id: form.rep_id ? parseInt(form.rep_id) : null,
        credit_balance: parseFloat(form.credit_balance) || 0,
        remarks: form.remarks || null,
        profit_margin_pct: marginPct, sscl_pct: ssclPct, vat_pct: vatPct,
        items: validItems.map((it) => ({
          description: it.description, serial_no: it.serial_no || null,
          stock_item_id: null, qty: parseInt(it.qty) || 1, rate: parseFloat(it.rate) || 0,
        })),
        route_id: form.route_id ? parseInt(form.route_id) : null,
      });
      setCreatedInvoice(inv);
      if (linkedJobCardId) {
        try { await updateJobCard(linkedJobCardId, { linked_sales_invoice_id: inv.id }); }
        catch (jcErr) { console.warn("Failed to link job card:", jcErr); }
      }
    } catch (err) { setError(err.response?.data?.detail || "Failed to create invoice. Check all required fields."); }
    finally       { setSubmitting(false); }
  }

  async function handlePrint() {
    if (!createdInvoice || printing) return;
    setPrinting(true);
    try {
      const res = await authFetch(`${API_BASE}/invoices/${createdInvoice.id}/pdf`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(`PDF error: ${e.detail || "Unknown"}`); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
      iframe.src = url; document.body.appendChild(iframe);
      iframe.onload = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch { window.open(url, "_blank"); }
        finally { setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); setPrinting(false); }, 1500); }
      };
    } catch { alert("Could not generate PDF."); setPrinting(false); }
  }

  const inp = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;
  const lbl = `block text-xs font-medium text-gray-600 mb-1`;
  const rateInp = `w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Repair Invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a repair service invoice — pricing is entered manually per line.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{error}</div>}

      {createdInvoice && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl p-4 flex items-center justify-between">
          <span>
            ✓ Invoice <strong>{createdInvoice.invoice_number}</strong> created.
            {linkedJobCardId && <span className="ml-2">Job Card #{linkedJobCardId} linked.</span>}
          </span>
          <button type="button" onClick={() => navigate(`/invoices/${createdInvoice.id}`)}
                  className="text-sm font-medium text-green-700 underline hover:text-green-900">
            View Invoice →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 0: Job Card Selector ──────────────────────── */}
        <div className="bg-white rounded-xl border border-blue-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-[#1F3C8A]" />
            <h2 className="text-sm font-semibold text-gray-700">Link to Job Card</h2>
            <span className="text-xs text-gray-400 font-normal ml-1">optional — auto-fills serial &amp; description</span>
          </div>

          {linkedJobCard ? (
            <div className="flex items-start justify-between gap-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="text-sm">
                <div className="font-semibold text-[#1F3C8A]">Job Card #{linkedJobCard.id} — {linkedJobCard.device_name}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {linkedJobCard.customer_name}
                  {linkedJobCard.serial_number && <span className="ml-2 font-mono">S/N: {linkedJobCard.serial_number}</span>}
                </div>
                <div className="text-xs text-gray-500 mt-1">{linkedJobCard.issue_description}</div>
              </div>
              <button type="button" onClick={() => { setLinkedJobCard(null); setLinkedJobCardId(null); setJobCardSearch(""); }}
                      className="text-xs text-gray-400 hover:text-red-500 whitespace-nowrap transition-colors">
                ✕ Unlink
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text" value={jobCardSearch}
                onChange={(e) => { setJobCardSearch(e.target.value); handleJobCardSearch(e.target.value); }}
                onFocus={() => handleJobCardSearch(jobCardSearch)}
                onBlur={() => setTimeout(() => setJobCardOpen(false), 200)}
                placeholder="Search by customer name, device, serial number or job card #…"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              {jobCardLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
              {jobCardOpen && jobCardResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  {jobCardResults.map((card) => (
                    <button key={card.id} type="button" onMouseDown={() => attachJobCard(card)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-[#1F3C8A]">#{card.id}</span>
                          <span className="text-sm font-medium text-gray-800 ml-2">{card.device_name}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          card.status === "NEW" ? "bg-blue-50 text-blue-700" :
                          card.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-700" :
                          card.status === "READY_FOR_PICKUP" ? "bg-green-50 text-green-700" :
                          "bg-gray-100 text-gray-500"}`}>
                          {card.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {card.customer_name}
                        {card.serial_number && <span className="ml-2 font-mono text-gray-400">S/N: {card.serial_number}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{card.issue_description}</div>
                    </button>
                  ))}
                </div>
              )}
              {jobCardOpen && !jobCardResults.length && !jobCardLoading && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-gray-400 italic">
                  No open (unlinked) job cards found
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 1: Invoice Header ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">Invoice Header</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {["ALL_INC", "VAT"].map((cat) => (
                <button key={cat} type="button"
                        onClick={() => setForm((f) => ({ ...f, invoice_category: cat }))}
                        className={`px-3 py-1.5 font-medium transition-colors ${form.invoice_category === cat ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {cat === "VAT" ? "TAX-INVOICE (VAT)" : "INVOICE (All-Inclusive)"}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-semibold">🔧 REPAIR</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Invoice Number *</label>
              <input value={form.invoice_number} required
                     onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                     placeholder={isVAT ? "2026-06-R12600" : "CCFR-R01000"} className={inp} />
            </div>
            <div>
              <label className={lbl}>Invoice Date *</label>
              <input type="date" value={form.invoice_date} required
                     onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={form.due_date}
                     onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>PO Number</label>
              <input value={form.po_number} onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
                     placeholder="Optional" className={inp} />
            </div>
            <div>
              <label className={lbl}>Technician / Rep</label>
              <select value={form.rep_id} onChange={(e) => setForm((f) => ({ ...f, rep_id: e.target.value }))} className={inp}>
                <option value="">— Select rep —</option>
                {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className={lbl}>Route</label>
              <input type="text" value={routeSearch} onChange={handleRouteSearchChange}
                     onFocus={() => { setRouteFilter(""); setIsRouteOpen(true); }}
                     onBlur={() => setTimeout(() => setIsRouteOpen(false), 250)}
                     placeholder="Type to search route..." className={inp} />
              {isRouteOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  {routes.filter((r) => r.name.toLowerCase().includes(routeFilter.toLowerCase())).map((r) => (
                    <button key={r.id} type="button" onMouseDown={() => handleSelectRoute(r)}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm text-gray-700 transition-colors border-b border-gray-50 last:border-b-0">
                      {r.name}
                    </button>
                  ))}
                  {!routes.filter(r => r.name.toLowerCase().includes(routeFilter.toLowerCase())).length && (
                    <div className="px-4 py-3 text-sm text-gray-500 italic">No matching routes found</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Customer ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Customer Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={lbl}>Customer / Institution *</label>
              <input type="text" value={custSearch} onChange={handleSearchChange}
                     onFocus={() => setIsOpen(true)} onBlur={() => setTimeout(() => setIsOpen(false), 250)}
                     placeholder="Type to search customer..." className={inp} required={!form.customer_id} />
              <input type="hidden" value={form.customer_id} required />
              {isOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  {customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0, 8).map(c => (
                    <button key={c.id} type="button" onMouseDown={() => handleSelectCustomer(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 transition-colors flex flex-col border-b border-gray-50 last:border-b-0">
                      <span className="font-medium text-sm">{c.name}</span>
                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                        {c.tin && <span>TIN: {c.tin}</span>}{c.phone && <span>Phone: {c.phone}</span>}
                      </div>
                    </button>
                  ))}
                  {custSearch.trim() && !customers.some(c => c.name.toLowerCase() === custSearch.trim().toLowerCase()) && (
                    <button type="button"
                            onMouseDown={() => { setQuickAddName(custSearch); setQuickAddPhone(""); setQuickAddErr(null); setShowQuickAdd(true); setIsOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold border-t border-blue-100 flex items-center gap-1.5">
                      <Plus size={16} /> Add New Customer: "{custSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className={lbl}>Contact Name / Title</label>
              <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                     placeholder="The Manager / The Accountant" className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer TIN</label>
              <input value={form.customer_tin} onChange={(e) => setForm((f) => ({ ...f, customer_tin: e.target.value }))}
                     placeholder="Enter customer TIN" className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer Contact Number</label>
              <input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                     placeholder="Auto-filled from job card or customer record" className={inp} />
            </div>
          </div>
        </div>

        {/* ── Section 3: Tax & Margin Rates ────────────────────────
            Intentionally unchanged from pre-Prompt-3 manual entry.
            Repair invoices have no stock receipt chain to pull from.
        ──────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-gray-700">Tax &amp; Margin Rates</h2>
            {settingsLoaded && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Pre-filled from global defaults</span>}
          </div>
          <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
            <Info size={12} /> Override per-invoice if needed. These rates are locked into the invoice on save.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[["Profit Margin %", "profit_margin_pct", "Internal — never shown to customer"],
              ["SSCL %", "sscl_pct", isVAT ? "Shown on VAT invoice" : "Baked into grand total"],
              ["VAT %", "vat_pct", isVAT ? "Shown on VAT invoice" : "Baked into grand total"]
            ].map(([label, key, hint]) => (
              <div key={key}>
                <label className={lbl}>{label}</label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.01" value={rates[key]}
                         onChange={(e) => setRates((r) => ({ ...r, [key]: e.target.value }))}
                         className={rateInp} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 4: Line Items ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter raw cost — margin{isVAT ? "" : ", SSCL, and VAT"} are rolled into the customer-facing amount.
              </p>
            </div>
            <button type="button" onClick={addItem}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={14} /> Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-6">NO</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">DESCRIPTION</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-40">SERIAL NO</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-16">QTY</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2 w-28">
                    RAW COST (Rs.) <span className="text-gray-300 font-normal">[internal]</span>
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2 w-28">
                    {isVAT ? "ITEM PRICE" : "ALL-IN PRICE"}
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, i) => {
                  const line = lineCalcs[i];
                  return (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2">
                        <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)}
                               placeholder="Repair service or parts description"
                               className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={item.serial_no} onChange={(e) => updateItem(i, "serial_no", e.target.value)}
                               placeholder="Serial / ref"
                               className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="1" value={item.qty} onChange={(e) => updateItem(i, "qty", e.target.value)}
                               className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent text-center" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" step="0.01" value={item.rate}
                               onChange={(e) => updateItem(i, "rate", e.target.value)} placeholder="0.00"
                               className="w-full border-0 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent text-right" />
                        {line.rawAmount > 0 && <p className="text-[10px] text-gray-300 text-right mt-0.5">raw: Rs. {fmt(line.rawAmount)}</p>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">Rs. {fmt(line.displayAmount)}</td>
                      <td className="pr-3">
                        <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="ml-auto w-80 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Raw Subtotal <em className="text-gray-300">[internal]</em></span><span>Rs. {fmt(baseSubtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>+ Profit Margin ({rates.profit_margin_pct}%) <em className="text-gray-300">[internal]</em></span><span>Rs. {fmt(profitAmt)}</span>
              </div>
              {isVAT && <div className="flex justify-between text-gray-600"><span>Sub-Total (items)</span><span>Rs. {fmt(displaySubtotal)}</span></div>}
              <div className={`flex justify-between text-xs ${isVAT ? "text-amber-600" : "text-gray-400"}`}>
                <span>+ SSCL ({rates.sscl_pct}%){!isVAT && <em className="text-gray-300"> [baked in]</em>}</span><span>Rs. {fmt(ssclAmt)}</span>
              </div>
              <div className={`flex justify-between text-xs ${isVAT ? "text-purple-600" : "text-gray-400"}`}>
                <span>+ VAT ({rates.vat_pct}%){!isVAT && <em className="text-gray-300"> [baked in]</em>}</span><span>Rs. {fmt(vatAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                <span>GRAND TOTAL</span><span>Rs. {fmt(grandTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 italic">
                {isVAT ? "Customer will see: margin-inclusive item prices + SSCL + VAT + Grand Total" : "Customer will see: all-inclusive item prices + Grand Total only"}
              </p>
              <div className="pt-2">
                <label className={lbl}>Credit Balance (Rs.) — 0 if paid upfront</label>
                <input type="number" min="0" step="0.01" value={form.credit_balance}
                       onChange={(e) => setForm((f) => ({ ...f, credit_balance: e.target.value }))} className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 5: Warranty ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Warranty</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Warranty</label>
              <input value={form.warranty} onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))}
                     placeholder="e.g. 90 days parts & labour" className={inp} />
            </div>
          </div>
        </div>

        {/* ── Section 6: Remarks ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className={lbl}>Remarks (optional)</label>
          <textarea value={form.remarks} rows={2}
                    onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                    placeholder="Internal notes..." className={`${inp} resize-none`} />
        </div>

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
            {submitting ? "Creating..." : `Create Repair ${isVAT ? "Tax Invoice" : "Invoice"}`}
          </button>
          <button type="button" onClick={handlePrint} disabled={!createdInvoice || printing}
                  className="px-5 py-3 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {printing ? "Printing..." : "Print"}
          </button>
          <button type="button" onClick={() => navigate("/invoices")}
                  className="px-5 py-3 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>

      {/* ── Quick-Add Customer Modal ──────────────────────────────── */}
      {showQuickAdd && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Quick Add Customer</h3>
              <button type="button" onClick={() => setShowQuickAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {quickAddErr && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">{quickAddErr}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name *</label>
                <input type="text" value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)}
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Telephone (Optional)</label>
                <input type="text" value={quickAddPhone} onChange={(e) => setQuickAddPhone(e.target.value)}
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowQuickAdd(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
              <button type="button" onClick={handleQuickAddSave} disabled={quickAdding || !quickAddName.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {quickAdding ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
