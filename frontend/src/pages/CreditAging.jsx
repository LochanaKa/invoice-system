import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getCreditAging } from "../services/api";

const formatLKR = (n) =>
  `Rs. ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-LK", {
    year: "numeric", month: "short", day: "numeric"
  });

// Color-code the "days overdue" badge
function AgingBadge({ days }) {
  const cls =
    days > 90 ? "bg-red-100 text-red-700" :
    days > 30 ? "bg-amber-100 text-amber-700" :
                "bg-yellow-50 text-yellow-700";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {days} days
    </span>
  );
}

export default function CreditAging() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCreditAging()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.credit_balance), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Credit Aging</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Invoices with outstanding balances — oldest first
        </p>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4
                        flex items-center gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0" size={18} />
          <div>
            <div className="text-sm font-medium text-amber-800">
              Total outstanding: {formatLKR(total)}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              {rows.length} invoice{rows.length !== 1 ? "s" : ""} with unpaid balances
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <RefreshCw className="animate-spin mr-2" size={16} /> Loading...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Customer", "Invoice No.", "Invoice Date",
                  "Invoice Amount", "Outstanding", "Age"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium
                                         text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800
                                 max-w-[220px] truncate">{r.customer_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">
                    {r.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(r.invoice_date)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatLKR(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">
                    {formatLKR(r.credit_balance)}
                  </td>
                  <td className="px-4 py-3">
                    <AgingBadge days={r.days_overdue} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    🎉 No outstanding credit balances
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
