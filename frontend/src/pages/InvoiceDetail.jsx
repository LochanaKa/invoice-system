/**
 * pages/InvoiceDetail.jsx — Invoice detail & customer-facing view
 * =================================================================
 * Displays a single invoice with CONDITIONAL rendering based on category:
 *
 *   ALL_INC ("All-Inclusive Invoice"):
 *     → Customer sees: all-inclusive line item prices + Grand Total ONLY
 *     → Profit Margin, SSCL, VAT are hidden (baked into item amounts)
 *
 *   VAT ("Tax Invoice"):
 *     → Customer sees: margin-inclusive item prices + Sub-Total + SSCL + VAT + Grand Total
 *     → Raw cost and Profit Margin are hidden (internal)
 *
 * The "Customer View" tab simulates what a customer/PDF output would show.
 * The "Internal View" tab shows full breakdown for staff.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileDown, CheckCircle, Clock, CreditCard,
  Eye, EyeOff, RefreshCw, AlertCircle, ChevronRight
} from "lucide-react";
import { getInvoice, addPayment, markVatPosted, getReps, downloadInvoicePdf } from "../services/api";

const fmt = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

const fmtPct = (n) =>
  `${(Number(n || 0) * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-LK", {
    year: "numeric", month: "long", day: "numeric",
  }) : "—";

export default function InvoiceDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [inv,       setInv]       = useState(null);
  const [reps,      setReps]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("customer");  // "customer" | "internal"

  // Payment modal state
  const [payModal,  setPayModal]  = useState(false);
  const [payForm,   setPayForm]   = useState({
    payment_method: "CASH", amount: "", cheque_number: "", bank: "", date_of_payment: "", recorded_by_rep_id: "",
  });
  const [paying,    setPaying]    = useState(false);

  // PDF download state
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadInvoicePdf(inv.id, `${inv.invoice_number}.pdf`);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "PDF download failed.";
      alert(detail);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    fetchInvoice();
    getReps().then(setReps).catch(() => setReps([]));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchInvoice() {
    setLoading(true);
    try {
      const data = await getInvoice(id);
      setInv(data);
      setError(null);
    } catch {
      setError("Invoice not found or failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment(e) {
    e.preventDefault();
    setPaying(true);
    try {
      await addPayment(id, {
        payment_method:  payForm.payment_method,
        amount:          parseFloat(payForm.amount),
        cheque_number:   payForm.cheque_number  || null,
        bank:            payForm.bank           || null,
        date_of_payment: payForm.date_of_payment || null,
        recorded_by_rep_id: payForm.recorded_by_rep_id ? Number(payForm.recorded_by_rep_id) : null,
      });
      setPayModal(false);
      setPayForm({ payment_method: "CASH", amount: "", cheque_number: "", bank: "", date_of_payment: "", recorded_by_rep_id: "" });
      await fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.detail || "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  async function handleMarkVatPosted() {
    if (!window.confirm("Mark this invoice as posted to RAMIS?")) return;
    try {
      await markVatPosted(id);
      await fetchInvoice();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to mark as posted.");
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      <RefreshCw size={18} className="animate-spin mr-2" /> Loading invoice…
    </div>
  );

  if (error || !inv) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={() => navigate("/invoices")}
              className="text-blue-600 text-sm flex items-center gap-1 hover:underline">
        <ArrowLeft size={14} /> Back to Invoices
      </button>
    </div>
  );

  const isVAT    = inv.invoice_category === "VAT";
  const isRepair = inv.service_type === "REPAIR";
  const isPaid   = Number(inv.credit_balance) === 0;

  // ── Derived values (all from stored DB fields) ─────────────────────────────
  const displaySubtotal    = inv.items.reduce((s, item) => s + Number(item.amount), 0);
  const afterMarginInternal = Number(inv.base_subtotal) + Number(inv.profit_margin_amount);
  const afterSsclInternal   = afterMarginInternal + Number(inv.sscl_amount);

  return (
    <div className="max-w-4xl space-y-5">

      {/* ── Back + actions bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/invoices")}
                className="flex items-center gap-1.5 text-sm text-gray-500
                           hover:text-gray-800 transition-colors">
          <ArrowLeft size={16} /> All Invoices
        </button>
        <div className="flex items-center gap-2">
          {isVAT && !inv.is_vat_posted && (
            <button onClick={handleMarkVatPosted}
                    className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700
                               text-white rounded-lg transition-colors">
              Mark as RAMIS Posted
            </button>
          )}
          {!isPaid && (
            <button onClick={() => setPayModal(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5
                               bg-green-600 hover:bg-green-700 text-white
                               rounded-lg transition-colors">
              <CreditCard size={13} /> Record Payment
            </button>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5
                       bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                       text-white rounded-lg transition-colors"
          >
            {downloading
              ? <><RefreshCw size={13} className="animate-spin" /> Generating…</>
              : <><FileDown size={13} /> Download PDF</>}
          </button>
        </div>
      </div>

      {/* ── Invoice header card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                ${isVAT ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                {isVAT ? "TAX INVOICE (VAT)" : "INVOICE (All-Inclusive)"}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                ${isRepair ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {inv.service_type}
              </span>
              {isVAT && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                  ${inv.is_vat_posted ? "bg-emerald-100 text-emerald-700" : "bg-yellow-50 text-yellow-600"}`}>
                  {inv.is_vat_posted ? "RAMIS Posted" : "Pending RAMIS"}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
              {inv.invoice_number}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{fmtDate(inv.invoice_date)}</p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Grand Total</p>
            <p className="text-3xl font-bold text-gray-900">{fmt(inv.grand_total)}</p>
            <div className={`mt-1 flex items-center justify-end gap-1 text-xs font-medium
              ${isPaid ? "text-green-600" : "text-amber-600"}`}>
              {isPaid
                ? <><CheckCircle size={12} /> Paid in full</>
                : <><Clock size={12} /> Outstanding: {fmt(inv.credit_balance)}</>
              }
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-5 pt-5 border-t border-gray-100 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Customer</p>
            <p className="font-medium text-gray-800">{inv.customer_name || "—"}</p>
            {inv.contact_name && <p className="text-gray-500 text-xs">{inv.contact_name}</p>}
            {inv.route_name   && <p className="text-gray-400 text-xs">{inv.route_name}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Sales Rep</p>
            <p className="font-medium text-gray-800">{inv.rep_name || "—"}</p>
            {inv.po_number && (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wide mt-2 mb-0.5">PO Number</p>
                <p className="font-medium text-gray-800">{inv.po_number}</p>
              </>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Due Date</p>
            <p className="font-medium text-gray-800">{fmtDate(inv.due_date)}</p>
            {inv.warranty && (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wide mt-2 mb-0.5">Warranty</p>
                <p className="font-medium text-gray-800">{inv.warranty}</p>
              </>
            )}
            {inv.remarks && (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wide mt-2 mb-0.5">Remarks</p>
                <p className="text-gray-600 text-xs">{inv.remarks}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab switcher: Customer View vs Internal View ───────────────────── */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-sm">
        <button
          onClick={() => setActiveTab("customer")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors
            ${activeTab === "customer"
              ? "bg-blue-600 text-white"
              : "text-gray-500 hover:bg-gray-50"}`}
        >
          <Eye size={14} /> Customer View
        </button>
        <button
          onClick={() => setActiveTab("internal")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors
            ${activeTab === "internal"
              ? "bg-slate-700 text-white"
              : "text-gray-500 hover:bg-gray-50"}`}
        >
          <EyeOff size={14} /> Internal View (Full Breakdown)
        </button>
      </div>

      {/* ── Line items table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
          {activeTab === "internal" && (
            <p className="text-xs text-gray-400 mt-0.5">
              Raw cost column visible to staff only — customer sees margin-inclusive prices
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-8">NO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">DESCRIPTION</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 w-40">SERIAL NO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3 w-16">QTY</th>
                {activeTab === "internal" && (
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3 w-28">
                    RAW COST <span className="text-gray-300 font-normal">[internal]</span>
                  </th>
                )}
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3 w-28">RATE</th>
                <th className="text-right text-xs font-medium text-gray-400 px-5 py-3 w-28">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inv.items.map((item) => {
                const rawRate = Number(item.raw_rate ?? item.rate);
                const rawAmt  = rawRate * Number(item.qty);
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-400 text-xs">{item.line_number}</td>
                    <td className="px-4 py-3 text-gray-800">{item.description}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {item.serial_no || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{item.qty}</td>
                    {activeTab === "internal" && (
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {fmt(rawRate)}
                        <div className="text-[10px] text-gray-300">= {fmt(rawAmt)}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(item.rate)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800">{fmt(item.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Totals panel — conditional on invoice type & active tab ──────── */}
        <div className="border-t border-gray-200 px-5 py-4">
          <div className="ml-auto w-80 space-y-1.5 text-sm">

            {activeTab === "customer" ? (
              // ══════════════════════════════════════════════════════════════
              //  CUSTOMER VIEW
              // ══════════════════════════════════════════════════════════════
              isVAT ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Sub-Total</span>
                    <span>{fmt(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>SSCL ({fmtPct(inv.sscl_pct)})</span>
                    <span>{fmt(inv.sscl_amount)}</span>
                  </div>
                  <div className="flex justify-between text-purple-600 font-medium">
                    <span>VAT ({fmtPct(inv.vat_pct)})</span>
                    <span>{fmt(inv.vat_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900
                                  border-t border-gray-300 pt-2 text-base">
                    <span>GRAND TOTAL</span>
                    <span>{fmt(inv.grand_total)}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 italic mb-2">
                    All taxes and margin are included in the item prices.
                  </p>
                  <div className="flex justify-between text-gray-600 text-xs mb-1">
                    <span>Items total</span>
                    <span>{fmt(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900
                                  border-t border-gray-300 pt-2 text-base">
                    <span>GRAND TOTAL</span>
                    <span>{fmt(inv.grand_total)}</span>
                  </div>
                </>
              )
            ) : (
              // ══════════════════════════════════════════════════════════════
              //  INTERNAL VIEW — full breakdown always shown
              // ══════════════════════════════════════════════════════════════
              <>
                <div className="flex justify-between text-gray-500">
                  <span>Raw Subtotal (items) <span className="text-gray-400">[internal]</span></span>
                  <span>{fmt(inv.base_subtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span>+ Profit Margin ({fmtPct(inv.profit_margin_pct)}) <span className="text-gray-400">[internal]</span></span>
                  <span>{fmt(inv.profit_margin_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-xs pl-2">
                  <span>{isVAT ? "Items subtotal (margin-inclusive)" : "After margin"}</span>
                  <span>{fmt(isVAT ? displaySubtotal : afterMarginInternal)}</span>
                </div>
                <div className="flex justify-between text-amber-600">
                  <span>+ SSCL ({fmtPct(inv.sscl_pct)})</span>
                  <span>{fmt(inv.sscl_amount)}</span>
                </div>
                {!isVAT && (
                  <div className="flex justify-between text-gray-400 text-xs pl-2">
                    <span>After SSCL</span>
                    <span>{fmt(afterSsclInternal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-purple-600">
                  <span>+ VAT ({fmtPct(inv.vat_pct)})</span>
                  <span>{fmt(inv.vat_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900
                                border-t border-gray-300 pt-2 text-base">
                  <span>GRAND TOTAL</span>
                  <span>{fmt(inv.grand_total)}</span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <ChevronRight size={12} />
                  <span>Customer sees:&nbsp;</span>
                  <span className="font-medium text-gray-600">
                    {isVAT
                      ? "Margin-inclusive item prices + SSCL + VAT + Grand Total"
                      : "All-inclusive item prices + Grand Total only"}
                  </span>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── Payment history ────────────────────────────────────────────────── */}
      {inv.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Payment History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Date", "Method", "Cheque/Ref", "Bank", "Recorded By", "Recorded On", "Amount"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inv.payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-600">{fmtDate(p.date_of_payment)}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.cheque_number || "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{p.bank || "—"}</td>
                  <td className="px-5 py-3 text-gray-600">{p.recorded_by_rep_name || "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{fmtDate(p.created_at)}</td>
                  <td className="px-5 py-3 font-medium text-green-700 text-right">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payment modal ──────────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Record Payment</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Outstanding: {fmt(inv.credit_balance)}
              </p>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select value={payForm.payment_method}
                        onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {["CASH", "CHEQUE", "BANK_TRANSFER", "ONLINE"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (Rs.) *</label>
                <input type="number" min="0.01" step="0.01" required
                       value={payForm.amount}
                       onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                       placeholder="0.00"
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Recorded By *</label>
                <select
                  value={payForm.recorded_by_rep_id}
                  required
                  onChange={(e) => setPayForm((f) => ({ ...f, recorded_by_rep_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select staff member</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}{rep.code ? ` (${rep.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {payForm.payment_method === "CHEQUE" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Number</label>
                    <input value={payForm.cheque_number}
                           onChange={(e) => setPayForm((f) => ({ ...f, cheque_number: e.target.value }))}
                           className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bank</label>
                    <input value={payForm.bank}
                           onChange={(e) => setPayForm((f) => ({ ...f, bank: e.target.value }))}
                           className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                <input type="date" value={payForm.date_of_payment}
                       onChange={(e) => setPayForm((f) => ({ ...f, date_of_payment: e.target.value }))}
                       className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={paying}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white
                                   text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {paying ? "Saving…" : "Save Payment"}
                </button>
                <button type="button" onClick={() => setPayModal(false)}
                        className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm
                                   rounded-xl hover:bg-gray-50 transition-colors">
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
