import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getCustomer, getCustomerInvoices } from "../services/api";

const formatLKR = (n) => `Rs. ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState("outstanding"); // 'outstanding' or 'all'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const c = await getCustomer(id);
        setCustomer(c);
        const invs = await getCustomerInvoices(id);
        // API returns full InvoiceDetail objects; store all and let UI filter for outstanding
        setInvoices(invs || []);
      } catch (e) {
        console.error("Failed to load customer detail", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-2" style={{ color: "#1F3C8A" }}>
      <RefreshCw className="animate-spin" size={18} />
      <span className="text-sm font-medium">Loading customer…</span>
    </div>
  );

  if (!customer) return <div className="text-sm text-red-600">Customer not found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.route_name || "—"} · {customer.phone || "—"}</p>
        </div>
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-cc-blue-600">Back</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-cc-sm p-5" style={{ borderColor: "#d5dcf5" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Invoices</h2>
          <div className="inline-flex rounded-xl border bg-white" style={{ borderColor: "#e6eafc" }}>
            <button
              type="button"
              onClick={() => setTab("outstanding")}
              className={`px-3 py-1 text-xs font-semibold ${tab === "outstanding" ? "bg-cc-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Outstanding
            </button>
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1 text-xs font-semibold ${tab === "all" ? "bg-cc-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              All
            </button>
          </div>
        </div>

        {tab === "outstanding" ? (
          (() => {
            const outstanding = invoices.filter((i) => Number(i.credit_balance) > 0);
            return outstanding.length === 0 ? (
              <p className="text-sm text-gray-500">No unpaid invoices for this customer.</p>
            ) : (
              <div className="space-y-2">
                {outstanding.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-cc-blue-50/30 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#1F3C8A" }}>{inv.invoice_number}</div>
                      <div className="text-xs text-gray-500">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-rose-600">{formatLKR(inv.credit_balance)}</div>
                      <div className="text-xs text-gray-400">Due: {inv.due_date || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          (() => {
            return invoices.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices for this customer.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-cc-blue-50/30 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#1F3C8A" }}>{inv.invoice_number}</div>
                      <div className="text-xs text-gray-500">{new Date(inv.invoice_date).toLocaleDateString()} · {inv.service_type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">{formatLKR(inv.grand_total)}</div>
                      <div className="text-xs text-gray-400">Credit: {formatLKR(inv.credit_balance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
