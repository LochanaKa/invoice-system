/**
 * pages/VATReport.jsx — Monthly VAT Summary for IRD Filing
 * ==========================================================
 * Gazette No. 2463/05 compliance tool.
 * Shows all VAT tax invoices for a selected month with
 * RAMIS posting status and PDF export.
 */

import { useState, useEffect } from "react";
import {
  RefreshCw, Download, CheckCircle,
  AlertTriangle, ShieldCheck, FileText
} from "lucide-react";
import { API_BASE } from "../config";
import { authFetch } from "../services/api";

const API = API_BASE;

const fmtLKR = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-LK", { year:"numeric", month:"short", day:"numeric" })
  : "—";

// ── month name helper ────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function VATReport() {
  const now   = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [marking, setMarking] = useState(false);
  const [dlLoad,  setDlLoad]  = useState(false);
  const [toast,   setToast]   = useState(null);

  // Auto-load when year/month changes
  useEffect(() => { fetchReport(); }, [year, month]); // eslint-disable-line

  async function fetchReport() {
    setLoading(true); setError(null);
    try {
      const res = await authFetch(`${API}/vat-report/summary?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed");
      setReport(await res.json());
    } catch {
      setError("Could not load VAT report. Is the FastAPI server running?");
    } finally { setLoading(false); }
  }

  async function handleMarkAllPosted() {
    if (!window.confirm(
      `Mark ALL ${report.unposted_count} unposted invoices for ${MONTHS[month-1]} ${year} as RAMIS posted?\n\nThis cannot be undone.`
    )) return;
    setMarking(true);
    try {
      const res = await authFetch(
        `${API}/vat-report/mark-all-posted?year=${year}&month=${month}`,
        { method: "POST" }
      );
      const data = await res.json();
      showToast(data.message, "success");
      fetchReport();
    } catch {
      showToast("Failed to mark invoices as posted.", "error");
    } finally { setMarking(false); }
  }

  async function handleDownloadPDF() {
    setDlLoad(true);
    try {
      const res = await authFetch(`${API}/vat-report/pdf?year=${year}&month=${month}`);
      if (!res.ok) { showToast("PDF generation failed.", "error"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `VAT_Summary_${year}_${String(month).padStart(2,"0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { showToast("Could not reach server.", "error"); }
    finally { setDlLoad(false); }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── year options: current year and 2 prior ───────────────
  const yearOptions = [now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2];

  const inp = `text-sm border rounded-lg px-3 py-2 bg-white
               focus:outline-none focus:ring-2 transition`.replace(/\s+/g," ");

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3
                         rounded-xl shadow-lg text-sm font-medium
                         ${toast.type === "success"
                           ? "bg-green-600 text-white"
                           : "bg-red-600 text-white"}`}>
          {toast.type === "success"
            ? <CheckCircle size={16} />
            : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
            VAT Summary Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gazette No. 2463/05 · IRD Monthly Filing · VAT No. 783634953-7000
          </p>
        </div>

        {/* Period selector + actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                  className={inp} style={{ borderColor: "#d5dcf5" }}>
            {MONTHS.map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>

          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className={inp} style={{ borderColor: "#d5dcf5" }}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button onClick={fetchReport} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                             rounded-lg border transition-colors"
                  style={{ borderColor: "#d5dcf5", color: "#1F3C8A" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {report && report.unposted_count > 0 && (
            <button onClick={handleMarkAllPosted} disabled={marking}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold
                               rounded-lg transition-colors text-white"
                    style={{ background: "#7c3aed" }}>
              <ShieldCheck size={13} />
              {marking ? "Posting…" : `Mark All Posted (${report.unposted_count})`}
            </button>
          )}

          <button onClick={handleDownloadPDF} disabled={dlLoad || !report}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                             rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ background: "#1F3C8A" }}>
            {dlLoad ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            {dlLoad ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !report && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <RefreshCw className="animate-spin" size={16} />
          <span className="text-sm">Loading VAT data…</span>
        </div>
      )}

      {/* Summary cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Tax Invoices",      value: report.invoice_count,        color: "#1F3C8A", prefix: "" },
              { label: "Total Taxable",     value: fmtLKR(report.total_taxable), color: "#1F3C8A" },
              { label: "Total VAT (18%)",   value: fmtLKR(report.total_vat),    color: "#7c3aed" },
              { label: "Grand Total",       value: fmtLKR(report.grand_total),  color: "#1b5e20" },
              { label: "RAMIS Posted",
                value: `${report.posted_count} / ${report.invoice_count}`,
                color: report.unposted_count === 0 ? "#1b5e20" : "#b45309" },
            ].map((card) => (
              <div key={card.label}
                   className="bg-white rounded-2xl border p-4"
                   style={{ borderColor: "#d5dcf5" }}>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  {card.label}
                </div>
                <div className="text-lg font-bold" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* RAMIS status banner */}
          {report.invoice_count === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
              <FileText className="mx-auto mb-2 text-gray-300" size={28} />
              <div className="text-gray-500 text-sm font-medium">
                No VAT invoices for {MONTHS[month-1]} {year}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                Try a different month or create a new TAX-INVOICE
              </div>
            </div>
          ) : report.unposted_count === 0 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200
                            rounded-xl p-4">
              <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
              <div>
                <div className="text-sm font-semibold text-green-800">
                  All {report.invoice_count} invoices posted to RAMIS
                </div>
                <div className="text-xs text-green-600 mt-0.5">
                  {MONTHS[month-1]} {year} filing is complete
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200
                            rounded-xl p-4">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
              <div>
                <div className="text-sm font-semibold text-amber-800">
                  {report.unposted_count} invoice{report.unposted_count > 1 ? "s" : ""} pending RAMIS submission
                </div>
                <div className="text-xs text-amber-600 mt-0.5">
                  Submit to RAMIS and click "Mark All Posted" to complete this period
                </div>
              </div>
            </div>
          )}

          {/* Invoice table */}
          {report.invoices.length > 0 && (
            <div className="bg-white rounded-2xl border overflow-hidden"
                 style={{ borderColor: "#d5dcf5" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between"
                   style={{ borderColor: "#eef1fb", background: "#f7f9ff" }}>
                <h2 className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: "#1F3C8A" }}>
                  VAT Tax Invoices — {MONTHS[month-1]} {year}
                </h2>
                <span className="text-xs text-gray-400">
                  {report.invoice_count} invoices · Supplier TIN: {report.supplier_tin}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#f7f9ff", borderBottom: "2px solid #eef1fb" }}>
                      {["#", "Invoice No.", "Date", "Customer", "Customer TIN",
                        "Taxable Value", "SSCL", "VAT (18%)", "Grand Total", "RAMIS"].map((h) => (
                        <th key={h}
                            className={`px-3 py-2.5 font-bold uppercase tracking-wide text-left
                              ${["Taxable Value","SSCL","VAT (18%)","Grand Total"].includes(h) ? "text-right" : ""}`}
                            style={{ color: "#1F3C8A", fontSize: "10px" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.invoices.map((inv, idx) => (
                      <tr key={inv.id}
                          style={{
                            borderBottom: "1px solid #f0f4ff",
                            background: idx % 2 === 0 ? "#fff" : "#fafbff"
                          }}>
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold"
                            style={{ color: "#1F3C8A" }}>
                          {inv.invoice_number}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fmtDate(inv.invoice_date)}
                        </td>
                        <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate font-medium">
                          {inv.customer_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {inv.customer_tin}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {fmtLKR(inv.taxable_value)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {fmtLKR(inv.sscl_amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold"
                            style={{ color: "#7c3aed" }}>
                          {fmtLKR(inv.vat_amount)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold"
                            style={{ color: "#1F3C8A" }}>
                          {fmtLKR(inv.grand_total)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {inv.is_vat_posted ? (
                            <span className="inline-flex items-center gap-1 text-xs
                                             font-semibold text-green-700 bg-green-50
                                             px-2 py-0.5 rounded-full">
                              <CheckCircle size={10} /> Posted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs
                                             font-semibold text-amber-700 bg-amber-50
                                             px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #1F3C8A", background: "#eef1fb" }}>
                      <td colSpan={5}
                          className="px-3 py-2.5 font-bold text-right text-xs"
                          style={{ color: "#1F3C8A" }}>
                        TOTAL ({report.invoice_count} invoices)
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold"
                          style={{ color: "#1F3C8A" }}>
                        {fmtLKR(report.total_taxable)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold"
                          style={{ color: "#1F3C8A" }}>
                        {fmtLKR(report.total_sscl)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold"
                          style={{ color: "#7c3aed" }}>
                        {fmtLKR(report.total_vat)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold"
                          style={{ color: "#1F3C8A" }}>
                        {fmtLKR(report.grand_total)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold"
                          style={{ color: "#1b5e20" }}>
                        {report.posted_count}/{report.invoice_count}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
