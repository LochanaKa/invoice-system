import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, RefreshCw, Search, PlusCircle } from "lucide-react";
import { getJobCards } from "../services/api";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" }) : "—";

const getDueBadge = (card) => {
  if (!card.due_date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(card.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const status = String(card.status || "NEW").toUpperCase();
  const isCompleted = ["COMPLETED", "CANCELLED"].includes(status);

  if (!isCompleted && dueDate < today) {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Overdue</span>;
  }

  if (!isCompleted && dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)) {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Due soon</span>;
  }

  return null;
};

export default function JobCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getJobCards();
        setCards(data || []);
      } catch {
        setError("Failed to load job cards.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchingCards = !term
      ? cards
      : cards.filter((card) =>
          [card.customer_name, card.device_name, card.issue_description, card.received_by_staff_name, card.assigned_to_staff_name, card.priority, card.paper_grn_reference]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        );

    return [...matchingCards].sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (aDue === bDue) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return aDue - bDue;
    });
  }, [cards, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
            Job Cards / Repair Tickets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track repair intake with staff accountability and field GRN references.
          </p>
        </div>
        <button
          onClick={() => navigate("/job-cards/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1F3C8A] px-4 py-2 text-sm font-semibold text-white"
        >
          <PlusCircle size={16} />
          New Job Card
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, device, or staff"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#1F3C8A]">
            <RefreshCw className="animate-spin" size={16} />
            <span className="text-sm">Loading job cards…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filteredCards.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">No job cards found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid #eef1fb", background: "#f7f9ff" }}>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Handled By</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Intake</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">GRN</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#1F3C8A]">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => (
                  <tr
                    key={card.id}
                    className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50"
                    style={{ background: "#fff" }}
                    onClick={() => navigate(`/job-cards/${card.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{card.customer_name}</td>
                    <td className="px-4 py-3 text-gray-700">{card.device_name}</td>
                    <td className="px-4 py-3 text-gray-700">{card.received_by_staff_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{card.assigned_to_staff_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.priority === "URGENT" ? "bg-red-50 text-red-700" : card.priority === "HIGH" ? "bg-orange-50 text-orange-700" : "bg-slate-50 text-slate-700"}`}>
                        {card.priority || "NORMAL"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.intake_method === "FIELD_GRN" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                        {card.intake_method === "FIELD_GRN" ? "Field GRN" : "Walk-in"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{card.status ? card.status.replaceAll("_", " ") : "NEW"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{formatDate(card.due_date)}</span>
                        {getDueBadge(card)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{card.paper_grn_reference || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(card.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
