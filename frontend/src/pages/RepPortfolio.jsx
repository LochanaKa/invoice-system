import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, FileText, DollarSign, AlertCircle,
  TrendingUp, ChevronLeft, ChevronRight, ChevronRight as RowArrow,
} from "lucide-react";
import StatCard from "../components/StatCard";
import { getRepPortfolio, getRepInvoices } from "../services/api";

const formatLKR = (n) =>
  `Rs. ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-LK", {
    year: "numeric", month: "short", day: "numeric",
  });

const STATUS_STYLE = {
  "Fully Paid":      { bg: "#e9f7ef", color: "#27AE60" },
  "Partially Paid":  { bg: "#fef3c7", color: "#b45309" },
  "Unpaid":          { bg: "#fee2e2", color: "#dc2626" },
};

const PAGE_SIZE = 25;

export default function RepPortfolio() {
  const { repId } = useParams();
  const navigate  = useNavigate();

  const [portfolio, setPortfolio] = useState(null);
  const [invoices,  setInvoices]  = useState({ items: [], total: 0 });
  const [page,      setPage]      = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => { setPage(0); }, [repId]);

  useEffect(() => {
    loadData();
  }, [repId, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [port, invPage] = await Promise.all([
        getRepPortfolio(repId),
        getRepInvoices(repId, { limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
      ]);
      setPortfolio(port);
      setInvoices(invPage);
    } catch {
      setError("Could not load portfolio. Check that the staff member exists.");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(invoices.total / PAGE_SIZE));

  if (loading && !portfolio) {
    return (
      <div className="flex items-center justify-center h-64 gap-2"
           style={{ color: "#1F3C8A" }}>
        <RefreshCw className="animate-spin" size={18} />
        <span className="text-sm font-medium">Loading portfolio…</span>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/staff")}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: "#1F3C8A" }}>
          <ArrowLeft size={16} /> Back to Staff Management
        </button>
        <div className="text-center py-16 text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  const { rep } = portfolio;

  return (
    <div className="space-y-6">

      {/* Back + header */}
      <div>
        <button onClick={() => navigate("/staff")}
                className="flex items-center gap-1.5 text-sm font-medium mb-3
                           hover:opacity-80 transition-opacity"
                style={{ color: "#1F3C8A" }}>
          <ArrowLeft size={16} /> Back to Staff Management
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
              {rep.name}
              <span className="ml-2 font-mono text-base font-semibold text-gray-400">
                {rep.code}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {rep.role || "Staff Member"}
              {rep.phone ? ` · ${rep.phone}` : ""}
              {!rep.is_active && (
                <span className="ml-2 text-xs font-semibold bg-gray-100 text-gray-400
                                   px-2 py-0.5 rounded-full">
                  Inactive
                </span>
              )}
            </p>
          </div>

          <button onClick={loadData} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                             border rounded-xl transition-colors hover:bg-white"
                  style={{ borderColor: "#d5dcf5", color: "#1F3C8A" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoices Assigned"
          value={portfolio.total_invoices}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Total Revenue Generated"
          value={formatLKR(portfolio.total_sales_generated)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Outstanding Collection"
          value={formatLKR(portfolio.total_outstanding)}
          subtitle="Remaining balance to collect"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="Collection Progress"
          value={`${Number(portfolio.collection_progress_pct).toFixed(1)}%`}
          subtitle={`Collected: ${formatLKR(portfolio.collected_amount)}`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border shadow-cc-sm p-5"
           style={{ borderColor: "#d5dcf5" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Collection Progress
          </span>
          <span className="text-sm font-semibold" style={{ color: "#1F3C8A" }}>
            {Number(portfolio.collection_progress_pct).toFixed(1)}% collected
          </span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Number(portfolio.collection_progress_pct))}%`,
              background: "linear-gradient(90deg, #27AE60 0%, #1F3C8A 100%)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>Collected: {formatLKR(portfolio.collected_amount)}</span>
          <span>Outstanding: {formatLKR(portfolio.total_outstanding)}</span>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-cc-sm"
           style={{ borderColor: "#d5dcf5" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between"
             style={{ borderColor: "#eef1fb", background: "#f7f9ff" }}>
          <h2 className="text-sm font-bold" style={{ color: "#1F3C8A" }}>
            Responsible Invoices
          </h2>
          <span className="text-xs text-gray-400">
            {invoices.total} invoice{invoices.total !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2"
               style={{ color: "#1F3C8A" }}>
            <RefreshCw className="animate-spin" size={16} />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "2px solid #eef1fb" }}>
                    {["Invoice Number", "Date", "Customer", "Total Amount",
                      "Outstanding", "Status", ""].map((h) => (
                      <th key={h || "action"}
                          className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3"
                          style={{ color: "#1F3C8A" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.items.map((inv, idx) => {
                    const st = STATUS_STYLE[inv.payment_status] || STATUS_STYLE["Unpaid"];
                    return (
                      <tr key={inv.id}
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: "1px solid #f0f4ff",
                            background: idx % 2 === 0 ? "#ffffff" : "#fafbff",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#eef1fb"}
                          onMouseLeave={(e) => e.currentTarget.style.background =
                            idx % 2 === 0 ? "#ffffff" : "#fafbff"}>

                        <td className="px-4 py-3 font-mono text-xs font-semibold"
                            style={{ color: "#1F3C8A" }}>
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatDate(inv.invoice_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {inv.customer_name || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {formatLKR(inv.grand_total)}
                        </td>
                        <td className="px-4 py-3">
                          {Number(inv.credit_balance) > 0 ? (
                            <span className="font-semibold text-amber-600">
                              {formatLKR(inv.credit_balance)}
                            </span>
                          ) : (
                            <span className="font-semibold" style={{ color: "#27AE60" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                style={{ background: st.bg, color: st.color }}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <RowArrow size={14} className="text-gray-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {invoices.items.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No invoices assigned to this representative yet.
                </div>
              )}
            </div>

            {invoices.total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t"
                   style={{ borderColor: "#eef1fb" }}>
                <span className="text-xs text-gray-400">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                               border rounded-lg disabled:opacity-40 transition-colors
                               hover:bg-gray-50"
                    style={{ borderColor: "#d5dcf5", color: "#1F3C8A" }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold
                               border rounded-lg disabled:opacity-40 transition-colors
                               hover:bg-gray-50"
                    style={{ borderColor: "#d5dcf5", color: "#1F3C8A" }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
