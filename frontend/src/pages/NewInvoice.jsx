/**
 * pages/NewInvoice.jsx — Invoice creation with line items
 * =========================================================
 * Staff enter raw cost per line item. Margin (and taxes for ALL_INC) are
 * automatically rolled into the customer-facing line amount.
 *
 * ALL_INC: display amount = raw + margin + SSCL + VAT (per line)
 * VAT:     display amount = raw + margin; SSCL/VAT at invoice level
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }         from "react-router-dom";
import { Plus, Trash2, Info, Barcode, Search, AlertTriangle, CheckCircle2, Loader2, Package } from "lucide-react";
import { getLookups, getCustomers, createInvoice, getSettings, getNextInvoiceNumber, createCustomer, createRoute, authFetch, lookupSerial, getStockItems } from "../services/api";
import { API_BASE } from "../config";
import { round2, calculateItemRow, calculateInvoiceTotals } from "../utils/invoiceCalc";

// stock_item_id + suggested_price track catalog-linked rows for price-drift warning
// stock_price_chain: full StockReceiptItemOut for stock-linked lines (prevents price drift).
// pricing_override: when true, staff can manually edit price even for stock-linked lines.
const EMPTY_ITEM = { description: "", serial_no: "", qty: 1, rate: "", stock_item_id: null, suggested_price: null, stock_price_chain: null, pricing_override: false };

const fmt = (n) => Number(n || 0).toLocaleString("en-LK", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export default function NewInvoice() {
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    invoice_number:   "",
    invoice_category: "ALL_INC",
    // service_type is always SALE on this page — hard-coded in the payload
    invoice_date:     new Date().toISOString().split("T")[0],
    due_date:         "",
    po_number:        "",
    warranty:         "",
    contact_name:     "",
    customer_tin:     "",
    customer_phone:   "",
    customer_id:      "",
    rep_id:           "",
    credit_balance:   "0",
    remarks:          "",
  });

  // Per-invoice rate overrides — pre-populated from global settings
  const [rates, setRates] = useState({
    profit_margin_pct: "",   // display value as "%" string e.g. "20"
    sscl_pct:          "",   // e.g. "2.5"
    vat_pct:           "",   // e.g. "18"
  });

  const [items,        setItems]        = useState([{ ...EMPTY_ITEM }]);
  const [reps,         setReps]         = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [routes,       setRoutes]       = useState([]);
  const [companyInfo,  setCompanyInfo]  = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);
  // Tracks the invoice object returned from the backend after creation
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [printing, setPrinting] = useState(false);

  // Searchable autocomplete state
  const [custSearch,   setCustSearch]   = useState("");
  const [isOpen,       setIsOpen]       = useState(false);
  const [routeSearch,  setRouteSearch]  = useState("");
  const [routeFilter,  setRouteFilter]  = useState("");
  const [isRouteOpen,  setIsRouteOpen]  = useState(false);

  // Quick Add customer states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAdding,  setQuickAdding]  = useState(false);
  const [quickAddErr,  setQuickAddErr]  = useState(null);

  // ── Serial scan state ────────────────────────────────────────────────────
  const [serialInput,   setSerialInput]   = useState("");
  const [serialError,   setSerialError]   = useState(null);   // inline error
  const [serialSuccess, setSerialSuccess] = useState(null);   // brief green flash
  const [serialLoading, setSerialLoading] = useState(false);
  const serialInputRef = useRef(null);

  // ── Non-serialized stock picker state ────────────────────────────────────
  const [stockSearch,        setStockSearch]        = useState("");
  const [stockResults,       setStockResults]       = useState([]);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [stockSearchOpen,    setStockSearchOpen]    = useState(false);
  const [pendingStockItem,   setPendingStockItem]   = useState(null);  // item chosen, awaiting qty
  const [pendingStockQty,    setPendingStockQty]    = useState("1");
  const pendingQtyRef = useRef(null);

  // ── On mount: load lookups + global settings defaults ────────────────────
  useEffect(() => {
    getLookups().then(async (d) => {
      setReps(d.reps);
      setRoutes(d.routes || []);
      setCompanyInfo(d.company_info || null);
      if (d.settings) {
        setRates({
          profit_margin_pct: String(round2(Number(d.settings.profit_margin) * 100)),
          sscl_pct:          String(round2(Number(d.settings.sscl_pct)      * 100)),
          vat_pct:           String(round2(Number(d.settings.vat_pct)       * 100)),
        });
        setSettingsLoaded(true);
      }
      // ensure "Walk-In Customer" route exists — create if missing
      const walk = (d.routes || []).find(r => r.name === "Walk-In Customer");
      if (!walk) {
        try {
          const nr = await createRoute({ name: "Walk-In Customer" });
          setRoutes((prev) => [...prev, nr]);
          setForm((f) => ({ ...f, route_id: nr.id }));
        } catch (e) {
          console.error("Could not create Walk-In Customer route", e);
        }
      } else {
        setForm((f) => ({ ...f, route_id: walk.id }));
      }
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
      .catch(() => {
        // Fallback to hardcoded defaults if the settings endpoint fails
        setRates({ profit_margin_pct: "20", sscl_pct: "2.5", vat_pct: "18" });
        setSettingsLoaded(true);
      });
  }, []);

  // ── Fetch next invoice number when category changes (service_type is always SALE) ─
  useEffect(() => {
    getNextInvoiceNumber(form.invoice_category, "SALE")
      .then((d) => {
        setForm((f) => ({ ...f, invoice_number: d.invoice_number }));
      })
      .catch((err) => {
        console.error("Failed to fetch next invoice number:", err);
      });
  }, [form.invoice_category]);

  // Sync search input if customer is loaded/pre-selected
  useEffect(() => {
    if (form.customer_id && customers.length > 0) {
      const match = customers.find(c => String(c.id) === String(form.customer_id));
      if (match) {
        setCustSearch(match.name);
        setForm((f) => ({
          ...f,
          customer_tin: match.tin || "",
          customer_phone: match.phone || "",
        }));
      }
    } else if (!form.customer_id) {
      setForm((f) => ({ ...f, customer_tin: "", customer_phone: "" }));
    }
  }, [form.customer_id, customers]);

  useEffect(() => {
    if (form.route_id && routes.length > 0) {
      const match = routes.find(r => String(r.id) === String(form.route_id));
      if (match) {
        setRouteSearch(match.name);
      }
    }
  }, [form.route_id, routes]);

  function handleSelectCustomer(cust) {
    setForm((f) => ({
      ...f,
      customer_id: String(cust.id),
      customer_tin: cust.tin || "",
      customer_phone: cust.phone || "",
    }));
    setCustSearch(cust.name);
    setIsOpen(false);
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setCustSearch(val);
    setForm((f) => ({
      ...f,
      customer_id: "",
      customer_tin: "",
      customer_phone: "",
    })); // Invalidate current selection until selected
    setIsOpen(true);
  }

  function handleSelectRoute(route) {
    setForm((f) => ({ ...f, route_id: String(route.id) }));
    setRouteSearch(route.name);
    setRouteFilter("");
    setIsRouteOpen(false);
  }

  function handleRouteSearchChange(e) {
    const val = e.target.value;
    setRouteSearch(val);
    setRouteFilter(val);
    setForm((f) => ({ ...f, route_id: "" }));
    setIsRouteOpen(true);
  }

  async function handleQuickAddSave() {
    if (!quickAddName.trim()) return;
    setQuickAdding(true);
    setQuickAddErr(null);
    try {
      const newCust = await createCustomer({
        name: quickAddName.trim(),
        phone: quickAddPhone.trim() || null,
      });
      setCustomers((prev) => [...prev, newCust]);
      setForm((f) => ({
        ...f,
        customer_id: String(newCust.id),
        customer_tin: "",
        customer_phone: newCust.phone || "",
      }));
      setCustSearch(newCust.name);
      setShowQuickAdd(false);
    } catch (err) {
      setQuickAddErr(
        err.response?.data?.detail || "Failed to save customer. Please try again."
      );
    } finally {
      setQuickAdding(false);
    }
  }

  // ── Item helpers ─────────────────────────────────────────────────────────
  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }
  function addItem()         { setItems((prev) => [...prev, { ...EMPTY_ITEM }]); }
  function removeItem(index) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Toggle per-line pricing override (unlock stock-linked locked price for manual edit)
  function togglePricingOverride(index) {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, pricing_override: !item.pricing_override } : item
    ));
  }

  // ── Serial scan handler ───────────────────────────────────────────────────
  // Called on Enter in the scan input. Looks up the serial via
  // GET /stock-units/lookup/{serial}, then appends a new row.
  async function handleSerialScan(e) {
    if (e.key !== "Enter") return;
    const serial = serialInput.trim();
    if (!serial) return;

    // Duplicate guard — don't add if same serial is already in the list
    const serialExists = items.some((it) => {
      const s = (it.serial_no || "").toString();
      return s.split(",").map(x=>x.trim()).includes(serial);
    });
    if (serialExists) {
      setSerialError(`Serial "${serial}" is already added to this invoice.`);
      return;
    }

    setSerialError(null);
    setSerialSuccess(null);
    setSerialLoading(true);

    try {
      let unit = null;
      try {
        unit = await lookupSerial(serial);
      } catch (err) {
        // If exact lookup failed with 404, try a fuzzy search before giving up
        const status = err.response?.status;
        if (status === 404) {
          try {
            unit = await lookupSerial(serial, true);
            // Inform the operator that a fuzzy match was used
            setSerialError(`No exact match for "${serial}" — using closest match: ${unit.serial_number}`);
          } catch (err2) {
            // rethrow original to be handled by outer catch
            throw err;
          }
        } else {
          throw err;
        }
      }
      // unit shape: { serial_number, status, stock_item_id, brand, model,
      //               description, final_unit_price, ... }
      const desc = [unit.brand, unit.model].filter(Boolean).join(" ") || unit.description || "";

      setItems((prev) => {
        // drop any trailing empty row first
        const base = prev.filter((it) => it.description || it.rate);
        // Try to find an existing row for the same stock_item_id
        const idx = base.findIndex((it) => it.stock_item_id === unit.stock_item_id);
        if (idx >= 0) {
          // Append serial to the existing row and increment qty
          const existing = { ...base[idx] };
          const existingSerials = (existing.serial_no || "").toString();
          const mergedSerials = existingSerials ? `${existingSerials},${unit.serial_number}` : unit.serial_number;
          existing.serial_no = mergedSerials;
          existing.qty = Number(existing.qty || 0) + 1;
          // keep pricing info as-is
          base[idx] = existing;
          return base;
        }

        // Otherwise create a new row for this serialized unit
        return [
          ...base,
          {
            ...EMPTY_ITEM,
            description:       desc,
            serial_no:         unit.serial_number,
            qty:               1,
            // Use unit_cost as the raw rate — the backend adds margin/SSCL/VAT from global rates.
            rate:              String(unit.latest_price?.unit_cost ?? unit.final_unit_price ?? ""),
            stock_item_id:     unit.stock_item_id,
            suggested_price:   unit.final_unit_price,
            stock_price_chain: unit.latest_price ?? null,
            pricing_override:  false,
          },
        ];
      });

      setSerialInput("");
      setSerialSuccess(`✓ Added: ${desc} (${serial})`);
      setTimeout(() => setSerialSuccess(null), 3000);
      // Return focus immediately so operator can scan the next item
      setTimeout(() => serialInputRef.current?.focus(), 50);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setSerialError(`Serial "${serial}" not found in stock.`);
      } else if (status === 409) {
        setSerialError(`Serial "${serial}" is already sold or not available.`);
      } else {
        setSerialError(err.response?.data?.detail || `Lookup failed for "${serial}".`);
      }
    } finally {
      setSerialLoading(false);
    }
  }

  // ── Non-serialized stock item search (debounced) ──────────────────────────
  const handleStockSearch = useCallback(async (q) => {
    if (!q.trim()) { setStockResults([]); setStockSearchOpen(false); return; }
    setStockSearchLoading(true);
    try {
      const results = await getStockItems({ search: q, show_inactive: false });
      // Only show non-serialized items in this picker (serialized ones must be scanned)
      setStockResults(results.filter((it) => !it.requires_serial));
      setStockSearchOpen(true);
    } catch { setStockResults([]); }
    finally   { setStockSearchLoading(false); }
  }, []);

  function handleSelectStockItem(item) {
    setPendingStockItem(item);
    setPendingStockQty("1");
    setStockSearch(item.brand ? `${item.brand} ${item.model || ""}`.trim() : (item.model || item.description || ""));
    setStockSearchOpen(false);
    // Move focus to qty input immediately
    setTimeout(() => pendingQtyRef.current?.focus(), 50);
  }

  function commitStockItem() {
    if (!pendingStockItem) return;
    const qty = Math.max(1, parseInt(pendingStockQty) || 1);
    const desc = [pendingStockItem.brand, pendingStockItem.model]
      .filter(Boolean).join(" ") || pendingStockItem.description || "";

    const chain = pendingStockItem.latest_price ?? null;
    setItems((prev) => [
      ...prev.filter((it) => it.description || it.rate),
      {
        ...EMPTY_ITEM,
        description:       desc,
        qty:               qty,
        rate:              String(chain?.unit_cost ?? ""),
        stock_item_id:     pendingStockItem.id,
        suggested_price:   chain?.final_unit_price ?? null,
        stock_price_chain: chain,
        pricing_override:  false,
      },
    ]);
    setPendingStockItem(null);
    setStockSearch("");
    setPendingStockQty("1");
  }

  // ── Live totals (mirrors backend formula exactly) ─────────────────────────
  const marginPct = (Number(rates.profit_margin_pct) || 0) / 100;
  const ssclPct   = (Number(rates.sscl_pct)          || 0) / 100;
  const vatPct    = (Number(rates.vat_pct)            || 0) / 100;
  const category  = form.invoice_category;

  // For locked stock-linked lines: use the stored receipt chain values directly.
  // This keeps the UI totals in sync with the recorded receiving-time price without re-calculating.
  function calcFromChain(item) {
    const ch  = item.stock_price_chain;
    const qty = Number(item.qty) || 1;
    if (category === "ALL_INC") {
      return {
        rawAmount:     round2(qty * Number(ch.unit_cost)),
        profitAmt:     round2(qty * Number(ch.operation_cost_amount)),
        ssclAmt:       round2(qty * Number(ch.sscl_amount)),
        vatAmt:        round2(qty * Number(ch.vat_amount)),
        displayAmount: round2(qty * Number(ch.final_unit_price)),
      };
    }
    // VAT mode: taxes are applied at invoice level, not per-line
    return {
      rawAmount:     round2(qty * Number(ch.unit_cost)),
      profitAmt:     round2(qty * Number(ch.operation_cost_amount)),
      ssclAmt:       0,
      vatAmt:        0,
      displayAmount: round2(qty * Number(ch.subtotal_after_opcost)),
    };
  }

  const lineCalcs = items.map((item) =>
    (item.stock_price_chain && !item.pricing_override)
      ? calcFromChain(item)
      : calculateItemRow(item, category, marginPct, ssclPct, vatPct)
  );

  const {
    baseSubtotal, profitAmt, displaySubtotal, ssclAmt, vatAmt, grandTotal,
  } = calculateInvoiceTotals(lineCalcs, category, ssclPct, vatPct);

  const isVAT = category === "VAT";

  // ── Price-drift check ────────────────────────────────────────────────────
  // Returns list of items where rate was manually edited away from the
  // catalog-suggested price (non-blocking — just warns staff).
  const priceDriftItems = items.filter((it) => {
    // Locked stock-linked lines are read-only — they can't drift
    if (it.stock_price_chain && !it.pricing_override) return false;
    if (it.suggested_price == null) return false;
    const suggested = parseFloat(it.suggested_price);
    const entered   = parseFloat(it.rate);
    if (isNaN(suggested) || isNaN(entered)) return false;
    return Math.abs(suggested - entered) > 0.01;
  });

  // ── Form submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!form.customer_id) {
      setError("Please select a valid customer from the suggestions or quick add a new one.");
      setSubmitting(false);
      return;
    }

    const validItems = items.filter(
      (it) => it.description.trim() && Number(it.rate) > 0
    );

    if (validItems.length === 0) {
      setError("Add at least one line item with a description and rate.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        invoice_number:   form.invoice_number,
        invoice_category: form.invoice_category,
        service_type:     "SALE",   // hard-coded — this page is Sales only
        invoice_date:     form.invoice_date,
        due_date:         form.due_date    || null,
        po_number:        form.po_number   || null,
        warranty:         form.warranty    || null,
        contact_name:     form.contact_name || null,
        customer_tin:     form.customer_tin?.trim() || null,
        customer_phone:   form.customer_phone?.trim() || null,
        customer_id:      parseInt(form.customer_id),
        rep_id:           form.rep_id ? parseInt(form.rep_id) : null,
        credit_balance:   parseFloat(form.credit_balance) || 0,
        remarks:          form.remarks || null,

        // Per-invoice rate overrides (sent as 0–1 decimals)
        profit_margin_pct: marginPct,
        sscl_pct:          ssclPct,
        vat_pct:           vatPct,

        items: validItems.map((it) => ({
          description:   it.description,
          serial_no:     it.serial_no     || null,
          stock_item_id: it.stock_item_id || null,
          qty:           parseInt(it.qty)   || 1,
          // For locked stock-linked lines: send unit_cost as the raw rate so the backend
          // computes margin+SSCL+VAT on top of it — not on top of an already-marked-up price.
          rate: (it.stock_price_chain && !it.pricing_override)
            ? parseFloat(it.stock_price_chain.unit_cost) || 0
            : parseFloat(it.rate) || 0,
          pricing_override: !!it.pricing_override,
        })),
        route_id: form.route_id ? parseInt(form.route_id) : null,
      };

      const inv = await createInvoice(payload);
      // Keep the created invoice in local state so the Print button can use it.
      setCreatedInvoice(inv);
      // Note: we no longer navigate away immediately — user can print or continue editing.
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Failed to create invoice. Check all required fields."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Print helper: fetches PDF blob and sends it to print (opens print dialog)
  async function handlePrint() {
    if (!createdInvoice || printing) return;
    setPrinting(true);
    const API = API_BASE;
    try {
      const res = await authFetch(`${API}/invoices/${createdInvoice.id}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`PDF error: ${err.detail || "Unknown error"}`);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      // Create an invisible iframe to host the PDF and call print on it.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          // Fallback: open PDF in new tab if iframe print fails
          window.open(url, "_blank");
        } finally {
          // Cleanup after a short delay to allow print dialog to open
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
            setPrinting(false);
          }, 1500);
        }
      };
    } catch (err) {
      alert("Could not generate PDF. Is the FastAPI server running?");
      setPrinting(false);
    }
  }

  const inp = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;
  const lbl = `block text-xs font-medium text-gray-600 mb-1`;
  const rateInp = `w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm
                   text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Sale Invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Create a sales invoice — for stock items sold to customers.
          For repair work, use <a href="/invoices/new-repair" className="text-blue-600 underline hover:text-blue-800">New Repair Invoice</a>.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700
                        text-sm rounded-xl p-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 1: Invoice Header ───────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">Invoice Header</h2>
            {/* Category toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {["ALL_INC", "VAT"].map((cat) => (
                <button key={cat} type="button"
                  onClick={() => setForm((f) => ({ ...f, invoice_category: cat }))}
                  className={`px-3 py-1.5 font-medium transition-colors
                    ${form.invoice_category === cat
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {cat === "VAT" ? "TAX-INVOICE (VAT)" : "INVOICE (All-Inclusive)"}
                </button>
              ))}
            </div>
            {/* Hard-coded type badge — no dropdown */}
            <span className="ml-auto text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">🛒 SALE</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Invoice Number *</label>
              <input value={form.invoice_number} required
                     onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                     placeholder={isVAT ? "2026-06-S12600" : "CCFR-S01000"}
                     className={inp} />
            </div>
            <div>
              <label className={lbl}>Invoice Date *</label>
              <input type="date" value={form.invoice_date} required
                     onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                     className={inp} />
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={form.due_date}
                     onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                     className={inp} />
            </div>
            <div>
              <label className={lbl}>PO Number</label>
              <input value={form.po_number}
                     onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
                     placeholder="Optional" className={inp} />
            </div>
            <div>
              <label className={lbl}>Sales Person</label>
              <select value={form.rep_id}
                      onChange={(e) => setForm((f) => ({ ...f, rep_id: e.target.value }))}
                      className={inp}>
                <option value="">— Select rep —</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className={lbl}>Route</label>
              <input
                type="text"
                value={routeSearch}
                onChange={handleRouteSearchChange}
                onFocus={() => {
                  setRouteFilter("");
                  setIsRouteOpen(true);
                }}
                onBlur={() => setTimeout(() => setIsRouteOpen(false), 250)}
                placeholder="Type to search route..."
                className={inp}
              />

              {isRouteOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  {routes
                    .filter((r) => r.name.toLowerCase().includes(routeFilter.toLowerCase()))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={() => handleSelectRoute(r)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 transition-colors flex flex-col border-b border-gray-50 last:border-b-0"
                      >
                        <span className="font-medium text-sm">{r.name}</span>
                      </button>
                    ))}

                  {routes.filter((r) => r.name.toLowerCase().includes(routeFilter.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 italic">
                      No matching routes found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Customer ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Customer Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className={lbl}>Customer / Institution Details *</label>
              <input
                type="text"
                value={custSearch}
                onChange={handleSearchChange}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 250)}
                placeholder="Type to search customer..."
                className={inp}
                required={!form.customer_id}
              />
              <input type="hidden" value={form.customer_id} required />

              {isOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(custSearch.toLowerCase()))
                    .slice(0, 8)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 transition-colors flex flex-col border-b border-gray-50 last:border-b-0"
                      >
                        <span className="font-medium text-sm">{c.name}</span>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                          {c.tin && <span>TIN: {c.tin}</span>}
                          {c.phone && <span>Phone: {c.phone}</span>}
                        </div>
                      </button>
                    ))}

                  {custSearch.trim() && !customers.some(c => c.name.toLowerCase() === custSearch.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onMouseDown={() => {
                        setQuickAddName(custSearch);
                        setQuickAddPhone("");
                        setQuickAddErr(null);
                        setShowQuickAdd(true);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold border-t border-blue-100 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus size={16} />
                      Add New Customer: "{custSearch}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className={lbl}>Contact Name / Title</label>
              <input value={form.contact_name}
                     onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                     placeholder="The Manager / The Accountant"
                     className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer TIN</label>
              <input value={form.customer_tin}
                     onChange={(e) => setForm((f) => ({ ...f, customer_tin: e.target.value }))}
                     placeholder="Enter customer TIN"
                     className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer Contact Number</label>
              <input value={form.customer_phone}
                     onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                     placeholder="Auto-filled from saved customer details"
                     className={inp} />
            </div>
          </div>
        </div>

        {/* ── Section 3: Tax & Margin Rates ────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-gray-700">Tax &amp; Margin Rates</h2>
            {settingsLoaded && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Pre-filled from global defaults
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
            <Info size={12} />
            Override per-invoice if needed. These rates apply to <strong>free-text</strong> lines — stock-linked lines use their receiving-time pricing.
          </p>
          {items.some(it => it.stock_price_chain && !it.pricing_override) && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5">
              <Package size={12} className="shrink-0" />
              {items.filter(it => it.stock_price_chain && !it.pricing_override).length} stock-linked line(s) on this invoice — their margin/SSCL/VAT come from the receiving record, not from these rate fields.
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Profit Margin */}
            <div>
              <label className={lbl}>Profit Margin %</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={rates.profit_margin_pct}
                  onChange={(e) => setRates((r) => ({ ...r, profit_margin_pct: e.target.value }))}
                  className={rateInp}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Internal — never shown to customer</p>
            </div>

            {/* SSCL */}
            <div>
              <label className={lbl}>SSCL %</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={rates.sscl_pct}
                  onChange={(e) => setRates((r) => ({ ...r, sscl_pct: e.target.value }))}
                  className={rateInp}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {isVAT ? "Shown on VAT invoice" : "Baked into grand total"}
              </p>
            </div>

            {/* VAT */}
            <div>
              <label className={lbl}>VAT %</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={rates.vat_pct}
                  onChange={(e) => setRates((r) => ({ ...r, vat_pct: e.target.value }))}
                  className={rateInp}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {isVAT ? "Shown on VAT invoice" : "Baked into grand total"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 4: Line items ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* ── Stock item entry panel ─────────────────────────── */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>

            {/* Serialized scan row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                <Barcode size={13} className="text-blue-500" />
                Scan / Enter Serial Number
                <span className="text-gray-300 font-normal">(for serialised items — press Enter or scan barcode)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={serialInputRef}
                    type="text"
                    value={serialInput}
                    onChange={(e) => { setSerialInput(e.target.value); setSerialError(null); }}
                    onKeyDown={handleSerialScan}
                    placeholder="Scan barcode or type serial number, then press Enter…"
                    autoComplete="off"
                    spellCheck={false}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm font-mono
                                focus:outline-none focus:ring-2 transition-colors
                                ${serialError
                                  ? "border-red-300 bg-red-50 focus:ring-red-300"
                                  : serialSuccess
                                    ? "border-green-300 bg-green-50 focus:ring-green-300"
                                    : "border-blue-200 bg-blue-50/40 focus:ring-blue-400"}`}
                  />
                  {serialLoading && (
                    <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />
                  )}
                </div>
              </div>

              {/* Inline feedback messages */}
              {serialError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} />
                  {serialError}
                  <button type="button" onClick={() => { setSerialError(null); setSerialInput(""); serialInputRef.current?.focus(); }}
                          className="ml-auto text-red-400 hover:text-red-600 font-medium">
                    Clear
                  </button>
                </div>
              )}
              {serialSuccess && !serialError && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={12} /> {serialSuccess}
                </div>
              )}
            </div>

            {/* Non-serialized stock picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                <Package size={13} className="text-gray-400" />
                Add Non-Serialized Item from Catalog
                <span className="text-gray-300 font-normal">(toner, cables, accessories…)</span>
              </label>
              <div className="flex items-end gap-2">
                {/* Search box */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => {
                      const q = e.target.value;
                      setStockSearch(q);
                      setPendingStockItem(null);
                      handleStockSearch(q);
                    }}
                    onFocus={() => { if (stockResults.length) setStockSearchOpen(true); }}
                    onBlur={() => setTimeout(() => setStockSearchOpen(false), 200)}
                    placeholder="Search catalog by brand / model…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  {stockSearchLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                  {stockSearchOpen && stockResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 top-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                      {stockResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={() => handleSelectStockItem(item)}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700
                                     transition-colors flex justify-between items-center border-b border-gray-50 last:border-b-0"
                        >
                          <span className="text-sm font-medium">
                            {[item.brand, item.model].filter(Boolean).join(" ") || item.description}
                          </span>
                          <span className="text-xs text-gray-400 ml-3">
                            Rs. {Number(item.final_unit_price || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            {item.qty_on_hand != null && (
                              <span className={item.qty_on_hand > 0 ? "text-green-600 ml-2" : "text-red-500 ml-2"}>
                                ({item.qty_on_hand} in stock)
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {stockSearchOpen && stockResults.length === 0 && !stockSearchLoading && stockSearch.trim() && (
                    <div className="absolute left-0 right-0 mt-1 top-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-gray-400 italic">
                      No non-serialized items match "{stockSearch}"
                    </div>
                  )}
                </div>

                {/* Qty + Add button — visible only when an item is selected */}
                {pendingStockItem && (
                  <>
                    <input
                      ref={pendingQtyRef}
                      type="number" min="1" step="1"
                      value={pendingStockQty}
                      onChange={(e) => setPendingStockQty(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && commitStockItem()}
                      className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center
                                 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={commitStockItem}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                                 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Manual free-text reminder */}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Info size={11} />
              You can also add free-text line items (e.g. repair labour) directly in the table below — those won't be linked to stock.
            </p>
          </div>

          {/* ── Table header + Add button ───────────────────────────────── */}
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <p className="text-xs text-gray-400">
              For free-text lines: enter raw cost — margin{isVAT ? "" : ", SSCL, and VAT"} roll in. Stock-linked lines auto-lock to their receipt pricing.
            </p>
            <button type="button" onClick={addItem}
                    className="flex items-center gap-1.5 text-xs text-blue-600
                               hover:text-blue-700 font-medium">
              <Plus size={14} /> Add free-text row
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
                  const rawAmt = line.rawAmount;
                  return (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          value={item.description}
                          onChange={(e) => updateItem(i, "description", e.target.value)}
                          placeholder="Product or service description"
                          className="w-full border-0 border-b border-gray-200 py-1 text-sm
                                     focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={item.serial_no}
                          onChange={(e) => updateItem(i, "serial_no", e.target.value)}
                          placeholder="Serial / batch"
                          className="w-full border-0 border-b border-gray-200 py-1 text-sm
                                     focus:outline-none focus:border-blue-500 bg-transparent"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number" min="1" value={item.qty}
                          onChange={(e) => updateItem(i, "qty", e.target.value)}
                          className="w-full border-0 border-b border-gray-200 py-1 text-sm
                                     focus:outline-none focus:border-blue-500 bg-transparent text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        {(item.stock_price_chain && !item.pricing_override) ? (
                          /* ── Locked stock pricing panel ── */
                          <div>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm font-medium text-gray-700">
                                Rs. {fmt(Number(item.stock_price_chain.unit_cost))}
                              </span>
                              <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                🔒 stock
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 text-right mt-1 space-y-0.5 leading-4">
                              <div>margin/op: +Rs. {fmt(Number(item.stock_price_chain.operation_cost_amount))}</div>
                              <div>SSCL: +Rs. {fmt(Number(item.stock_price_chain.sscl_amount))}</div>
                              <div>VAT: +Rs. {fmt(Number(item.stock_price_chain.vat_amount))}</div>
                              <div className="text-blue-600 font-semibold border-t border-blue-100 pt-0.5">
                                = Rs. {fmt(Number(item.stock_price_chain.final_unit_price))} / unit
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePricingOverride(i)}
                              className="text-[10px] text-amber-500 hover:text-amber-700 hover:underline mt-1 block text-right w-full"
                            >
                              Override pricing
                            </button>
                          </div>
                        ) : (
                          /* ── Manual / overridden entry ── */
                          <div>
                            <input
                              type="number" min="0" step="0.01" value={item.rate}
                              onChange={(e) => updateItem(i, "rate", e.target.value)}
                              placeholder="0.00"
                              className={`w-full border-0 py-1 text-sm focus:outline-none bg-transparent text-right
                                ${item.suggested_price != null && Math.abs(parseFloat(item.suggested_price) - parseFloat(item.rate || 0)) > 0.01
                                  ? "border-b border-amber-400 text-amber-700"
                                  : "border-b border-gray-200 focus:border-blue-500"}`}
                            />
                            {item.suggested_price != null && Math.abs(parseFloat(item.suggested_price) - parseFloat(item.rate || 0)) > 0.01 && (
                              <p className="text-[10px] text-amber-500 text-right mt-0.5">
                                suggested: Rs. {fmt(item.suggested_price)}
                              </p>
                            )}
                            {rawAmt > 0 && (
                              <p className="text-[10px] text-gray-300 text-right mt-0.5">
                                raw: Rs. {fmt(rawAmt)}
                              </p>
                            )}
                            {item.stock_price_chain && (
                              <button
                                type="button"
                                onClick={() => togglePricingOverride(i)}
                                className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline block text-right w-full mt-0.5"
                              >
                                ↩ Restore stock pricing
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">
                        Rs. {fmt(line.displayAmount)}
                      </td>
                      <td className="pr-3">
                        <button type="button" onClick={() => removeItem(i)}
                                className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Totals section (internal breakdown for staff) ─── */}
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="ml-auto w-80 space-y-1.5 text-sm">

              <div className="flex justify-between text-gray-500 text-xs">
                <span>Raw Subtotal <em className="text-gray-300">[internal]</em></span>
                <span>Rs. {fmt(baseSubtotal)}</span>
              </div>

              <div className="flex justify-between text-gray-400 text-xs">
                <span>+ Profit Margin ({rates.profit_margin_pct}%) <em className="text-gray-300">[internal]</em></span>
                <span>Rs. {fmt(profitAmt)}</span>
              </div>

              {isVAT && (
                <div className="flex justify-between text-gray-600">
                  <span>Sub-Total (items)</span>
                  <span>Rs. {fmt(displaySubtotal)}</span>
                </div>
              )}

              <div className={`flex justify-between text-xs ${isVAT ? "text-amber-600" : "text-gray-400"}`}>
                <span>+ SSCL ({rates.sscl_pct}%){!isVAT && <em className="text-gray-300"> [baked in]</em>}</span>
                <span>Rs. {fmt(ssclAmt)}</span>
              </div>

              <div className={`flex justify-between text-xs ${isVAT ? "text-purple-600" : "text-gray-400"}`}>
                <span>+ VAT ({rates.vat_pct}%){!isVAT && <em className="text-gray-300"> [baked in]</em>}</span>
                <span>Rs. {fmt(vatAmt)}</span>
              </div>

              <div className="flex justify-between font-bold text-gray-900
                              border-t border-gray-200 pt-2 text-base">
                <span>GRAND TOTAL</span>
                <span>Rs. {fmt(grandTotal)}</span>
              </div>

              <p className="text-xs text-gray-400 italic">
                {isVAT
                  ? "Customer will see: margin-inclusive item prices + SSCL + VAT + Grand Total"
                  : "Customer will see: all-inclusive item prices + Grand Total only"}
              </p>

              {/* Credit balance */}
              <div className="pt-2">
                <label className={lbl}>Credit Balance (Rs.) — 0 if paid upfront</label>
                <input type="number" min="0" step="0.01"
                       value={form.credit_balance}
                       onChange={(e) => setForm((f) => ({ ...f, credit_balance: e.target.value }))}
                       className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 5: Warranty ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Warranty</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Warranty</label>
              <input value={form.warranty}
                     onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))}
                     placeholder="e.g. 1 Year, 3 Years"
                     className={inp} />
            </div>
          </div>
        </div>

        {/* ── Section 6: Remarks ──────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className={lbl}>Remarks (optional)</label>
          <textarea value={form.remarks} rows={2}
                    onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                    placeholder="Internal notes..."
                    className={`${inp} resize-none`} />
        </div>

        {/* ── Price-drift warning (non-blocking) ─────────────── */}
        {priceDriftItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Price override detected</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {priceDriftItems.length} line item{priceDriftItems.length > 1 ? "s have" : " has"} a rate different from
                the catalog price. Please confirm this is intentional before submitting.
              </p>
              <ul className="mt-1 space-y-0.5">
                {priceDriftItems.map((it, idx) => (
                  <li key={idx} className="text-xs text-amber-700">
                    • {it.description || "(unnamed)"} — entered Rs. {fmt(it.rate)}, suggested Rs. {fmt(it.suggested_price)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white
                             text-sm font-medium py-3 rounded-xl transition-colors
                             disabled:opacity-50">
            {submitting ? "Creating..." : `Create ${isVAT ? "Tax Invoice" : "Invoice"}`}
          </button>

          <button type="button"
                  onClick={handlePrint}
                  disabled={!createdInvoice || printing}
                  className="px-5 py-3 border border-gray-200 text-gray-600
                             text-sm rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {printing ? "Printing..." : "Print"}
          </button>

          <button type="button" onClick={() => navigate("/invoices")}
                  className="px-5 py-3 border border-gray-200 text-gray-600
                             text-sm rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>

      {/* ── Quick Add Customer Modal ───────────────────────── */}
      {showQuickAdd && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Quick Add Customer</h3>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {quickAddErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
                {quickAddErr}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  placeholder="e.g. Samurdhi Bank - Gokarella"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Telephone Number (Optional)
                </label>
                <input
                  type="text"
                  value={quickAddPhone}
                  onChange={(e) => setQuickAddPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                  placeholder="e.g. +94 37 123 4567"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddSave}
                disabled={quickAdding || !quickAddName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {quickAdding ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
