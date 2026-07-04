import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Search, RefreshCw, AlertTriangle, Clock, ListChecks, Package, Link as LinkIcon } from "lucide-react";
import { getSerialFullHistory } from "../services/api";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-LK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const row = "grid gap-2 md:grid-cols-2 xl:grid-cols-4";
const label = "text-xs uppercase tracking-[0.18em] text-gray-500";
const value = "text-sm font-semibold text-gray-900";

export default function SerialLookup() {
  const [serial, setSerial] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const s = location?.state?.serial;
    if (s) {
      setSerial(s);
      // auto-run search
      (async () => {
        setError(null);
        setHistory(null);
        setLoading(true);
        try {
          const data = await getSerialFullHistory(s);
          setHistory(data);
        } catch (err) {
          const detail = err?.response?.data?.detail || err?.message || "Could not load serial history.";
          setError(detail);
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state?.serial]);

  async function handleSearch(e) {
    e.preventDefault();
    setError(null);
    setHistory(null);
    const cleanSerial = serial.trim();
    if (!cleanSerial) {
      setError("Enter a serial number to search.");
      return;
    }

    setLoading(true);
    try {
      const data = await getSerialFullHistory(cleanSerial);
      setHistory(data);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Could not load serial history.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3C8A]">Serial History Lookup</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search a serial number to see stock receipt history, job card activity, repair jobs, and sale details.
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <label className="w-full">
          <span className="block text-sm font-semibold text-gray-700 mb-1">Serial Number</span>
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Enter serial number"
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-[#1F3C8A] focus:outline-none focus:ring-2 focus:ring-[#1F3C8A]/20"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1F3C8A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#16437b] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {history && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-[#1F3C8A] mb-4">
                <Package size={18} />
                <div>
                  <h2 className="text-lg font-semibold">Unit Overview</h2>
                  <p className="text-sm text-gray-500">Key details for this serial number.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className={label}>Serial Number</div>
                  <div className={value}>{history.serial_number}</div>
                </div>
                <div>
                  <div className={label}>Item</div>
                  <div className={value}>{history.brand || "—"} {history.model || ""}</div>
                </div>
                <div>
                  <div className={label}>Description</div>
                  <div className={value}>{history.description || "—"}</div>
                </div>
                <div>
                  <div className={label}>Device / Job</div>
                  <div className={value}>{history.device_name || "—"}</div>
                </div>
                <div>
                  <div className={label}>Current Status</div>
                  <div className={value}>{history.current_status_label || "—"}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-[#1F3C8A] mb-4">
                  <Clock size={18} />
                  <div>
                    <h2 className="text-lg font-semibold">Origin</h2>
                    <p className="text-sm text-gray-500">Where this serial was first recorded.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className={label}>Source</div>
                    <div className={value}>{history.origin.source === "stock" ? "Stock receipt" : "Job card"}</div>
                  </div>
                  <div>
                    <div className={label}>Receipt / Job Created</div>
                    <div className={value}>{history.origin.receipt_date ? fmtDate(history.origin.receipt_date) : history.origin.job_card_created_at ? fmtDateTime(history.origin.job_card_created_at) : "—"}</div>
                  </div>
                  <div>
                    <div className={label}>GRN Reference</div>
                    <div className={value}>{history.origin.grn_reference || "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Supplier</div>
                    <div className={value}>{history.origin.supplier_name || "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Stock history available</div>
                    <div className={value}>{history.origin.no_stock_history ? "No" : "Yes"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-[#1F3C8A] mb-4">
                  <ListChecks size={18} />
                  <div>
                    <h2 className="text-lg font-semibold">Sale & Warranty</h2>
                    <p className="text-sm text-gray-500">Sale status and warranty details.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className={label}>Sold</div>
                    <div className={value}>{history.sale_info.sold ? "Yes" : "No"}</div>
                  </div>
                  <div>
                    <div className={label}>Invoice</div>
                    <div className={value}>{history.sale_info.invoice_number || "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Customer</div>
                    <div className={value}>{history.sale_info.customer_name || "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Sale Date</div>
                    <div className={value}>{history.sale_info.sale_date ? fmtDate(history.sale_info.sale_date) : "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Warranty expires</div>
                    <div className={value}>{history.warranty.expiry_date ? fmtDate(history.warranty.expiry_date) : "—"}</div>
                  </div>
                  <div>
                    <div className={label}>Warranty note</div>
                    <div className={value}>{history.warranty.note || "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#1F3C8A] mb-4">
              <LinkIcon size={18} />
              <div>
                <h2 className="text-lg font-semibold">Timeline</h2>
                <p className="text-sm text-gray-500">Chronological events for this serial.</p>
              </div>
            </div>

            {history.timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                No timeline events are available for this serial.
              </div>
            ) : (
              <div className="space-y-4">
                {history.timeline.map((event) => (
                  <div key={`${event.type}-${event.id}`} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                        {event.subtitle && <div className="text-sm text-gray-500">{event.subtitle}</div>}
                      </div>
                      <div className="text-xs uppercase tracking-[0.18em] text-gray-400">{fmtDateTime(event.date)}</div>
                    </div>
                    {event.detail && <div className="mt-3 text-sm text-gray-700">{event.detail}</div>}
                    {event.note && <div className="mt-2 text-sm text-gray-500">Note: {event.note}</div>}
                    {event.changed_by && <div className="mt-2 text-sm text-gray-500">Changed by: {event.changed_by}</div>}
                    {event.technician_name && <div className="mt-2 text-sm text-gray-500">Technician: {event.technician_name}</div>}
                    {event.amount_charged_by_technician != null && (
                      <div className="mt-2 text-sm text-gray-500">Cost: Rs. {Number(event.amount_charged_by_technician).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
