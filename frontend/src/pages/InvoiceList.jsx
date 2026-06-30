/**
 * pages/InvoiceList.jsx — branded for Creative Computers
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw, ChevronRight, Trash2, AlertTriangle, Download } from "lucide-react";
import { getInvoices, deleteInvoice } from "../services/api";

const API = "http://localhost:8000/api";

const formatLKR = (n) =>
  `Rs. ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-LK", {
    year: "numeric", month: "short", day: "numeric",
  });

// ── PDF download helper ───────────────────────────────────────
async function downloadPDF(invoiceId, invoiceNumber) {
  try {
    const res = await fetch(`${API}/invoices/${invoiceId}/pdf`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`PDF error: ${err.detail || "Unknown error"}`);
      return;
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Could not generate PDF. Is the FastAPI server running?");
  }
}

export default function InvoiceList() {
  const navigate = useNavigate();

  const [invoices,     setInvoices]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [dlId,         setDlId]         = useState(null); // tracks which row is downloading PDF

  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("");
  const [type,     setType]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  async function handleDelete(id) {
    setIsDeleting(true);
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      setDeleteTarget(null);
    } catch {
      alert("Failed to delete invoice.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownload(e, inv) {
    e.stopPropagation(); // prevent row click navigating away
    setDlId(inv.id);
    await downloadPDF(inv.id, inv.invoice_number);
    setDlId(null);
  }

  useEffect(() => { fetchInvoices(); },
    [search, category, type, dateFrom, dateTo]); // eslint-disable-line

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = {};
      if (search)   params.search    = search;
      if (category) params.category  = category;
      if (type)     params.type      = type;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      setInvoices(await getInvoices({ ...params, limit: 100 }));
      setError(null);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = `text-sm border rounded-lg px-3 py-2 bg-white
                    focus:outline-none focus:ring-2 focus:ring-cc-blue-400 transition`
                    .replace(/\s+/g, " ");

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {invoices.length} invoices shown · click any row to view detail
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border shadow-cc-sm p-4"
           style={{ borderColor: "#d5dcf5" }}>
        <div className="flex flex-wrap gap-3 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search invoice number or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 ${inputCls}`}
              style={{ borderColor: "#d5dcf5" }}
            />
          </div>

          <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className={inputCls} style={{ borderColor: "#d5dcf5" }}>
            <option value="">All types</option>
            <option value="ALL_INC">All-Inclusive</option>
            <option value="VAT">VAT</option>
          </select>

          <select value={type} onChange={(e) => setType(e.target.value)}
                  className={inputCls} style={{ borderColor: "#d5dcf5" }}>
            <option value="">Sales &amp; Repairs</option>
            <option value="SALE">Sales only</option>
            <option value="REPAIR">Repairs only</option>
          </select>

          <input type="date" value={dateFrom}
                 onChange={(e) => setDateFrom(e.target.value)}
                 className={inputCls} style={{ borderColor: "#d5dcf5" }} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo}
                 onChange={(e) => setDateTo(e.target.value)}
                 className={inputCls} style={{ borderColor: "#d5dcf5" }} />

          {(search || category || type || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch(""); setCategory(""); setType("");
                setDateFrom(""); setDateTo("");
              }}
              className="text-xs font-medium hover:underline"
              style={{ color: "#1F3C8A" }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-cc-sm"
           style={{ borderColor: "#d5dcf5" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2"
               style={{ color: "#1F3C8A" }}>
            <RefreshCw className="animate-spin" size={16} />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid #eef1fb", background: "#f7f9ff" }}>
                  {["Invoice No.", "Date", "Customer", "Route", "Rep",
                    "Type", "Grand Total", "Credit", "Service", "PDF", "", ""].map((h, i) => (
                    <th key={i}
                        className={`text-xs font-bold uppercase tracking-wide
                                    px-4 py-3 whitespace-nowrap
                                    ${h === "Grand Total" || h === "Credit" ? "text-right" : "text-left"}`}
                        style={{ color: "#1F3C8A" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="cursor-pointer group transition-colors"
                    style={{
                      borderBottom: "1px solid #f0f4ff",
                      background: idx % 2 === 0 ? "#ffffff" : "#fafbff",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#eef1fb"}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fafbff"}
                  >
                    {/* Invoice number */}
                    <td className="px-4 py-3 font-mono text-xs font-bold"
                        style={{ color: "#1F3C8A" }}>
                      {inv.invoice_number}
                    </td>

                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatDate(inv.invoice_date)}
                    </td>

                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate text-xs">
                      {inv.customer_name || "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {inv.route_name || "—"}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {inv.rep_name || "—"}
                    </td>

                    {/* Category badge */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                        ${inv.invoice_category === "VAT"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-cc-blue-50 text-cc-blue-700"}`}>
                        {inv.invoice_category}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-gray-800 text-xs">
                      {formatLKR(inv.grand_total)}
                    </td>

                    {/* Credit */}
                    <td className="px-4 py-3 text-right text-xs">
                      {Number(inv.credit_balance) > 0 ? (
                        <span className="text-amber-600 font-semibold">
                          {formatLKR(inv.credit_balance)}
                        </span>
                      ) : (
                        <span className="font-semibold" style={{ color: "#27AE60" }}>
                          Paid
                        </span>
                      )}
                    </td>

                    {/* Service type */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                        ${inv.service_type === "REPAIR"
                          ? "bg-orange-50 text-orange-600"
                          : "bg-cc-green-50 text-cc-green-700"}`}>
                        {inv.service_type}
                      </span>
                    </td>

                    {/* ── PDF download button ── */}
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={(e) => handleDownload(e, inv)}
                        disabled={dlId === inv.id}
                        title={`Download ${inv.invoice_number}.pdf`}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-1
                                   rounded-lg border transition-colors
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          color: "#1F3C8A",
                          borderColor: "#d5dcf5",
                          background: "#f7f9ff",
                        }}
                      >
                        {dlId === inv.id
                          ? <RefreshCw size={12} className="animate-spin" />
                          : <Download size={12} />}
                        {dlId === inv.id ? "…" : "PDF"}
                      </button>
                    </td>

                    {/* Delete */}
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(inv); }}
                        className="text-gray-300 hover:text-red-500 p-1 rounded-md
                                   hover:bg-red-50 transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>

                    {/* Row arrow */}
                    <td className="px-3 py-3 text-right">
                      <ChevronRight size={14}
                        className="inline-block text-gray-200 group-hover:text-cc-blue-400 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {invoices.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No invoices match the current filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border"
               style={{ borderColor: "#d5dcf5" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Invoice</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to delete Invoice{" "}
              <span className="font-mono font-bold text-gray-900">
                {deleteTarget.invoice_number}
              </span>?{" "}
              This will permanently remove the invoice, all line items, and payment records.
              <span className="font-semibold text-red-600"> This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100
                           hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600
                           hover:bg-red-700 disabled:bg-red-400 rounded-xl
                           transition-colors flex items-center gap-1.5"
              >
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
