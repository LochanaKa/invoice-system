import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getManufacturerWarrantyClaims, updateManufacturerWarrantyClaim, getSerialFullHistory, getManufacturerClaimHistory, deleteManufacturerWarrantyClaim } from "../services/api";
import { RefreshCw, Link as LinkIcon, Edit3 } from "lucide-react";

const OUTCOME_COLORS = {
  pending: { bg: "bg-amber-100", text: "text-amber-800" },
  repaired: { bg: "bg-emerald-100", text: "text-emerald-800" },
  replaced_by_manufacturer: { bg: "bg-sky-100", text: "text-sky-800" },
  rejected: { bg: "bg-red-100", text: "text-red-800" },
};

function formatDate(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

export default function ManufacturerWarranty() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);
  const [totalClaims, setTotalClaims] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [unitStatus, setUnitStatus] = useState("");
  const [techCharge, setTechCharge] = useState("");
  const [serialHistory, setSerialHistory] = useState(null);
  const [serialHistoryLoading, setSerialHistoryLoading] = useState(false);
  const [claimHistory, setClaimHistory] = useState(null);
  const [claimHistoryLoading, setClaimHistoryLoading] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadClaims();
  }, [filterOutcome, page, limit, searchTerm]);

  async function loadClaims() {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (filterOutcome) params.outcome = filterOutcome;
      if (searchTerm) params.search = searchTerm;
      const data = await getManufacturerWarrantyClaims(params);
      setClaims(data.items);
      setTotalClaims(data.total);
    } catch (err) {
      console.error("Failed to load claims", err);
      setClaims([]);
      setTotalClaims(0);
    } finally {
      setLoading(false);
    }
  }

  const openEditor = (claim) => {
    try {
      console.log("ManufacturerWarranty: openEditor", claim);
    } catch (e) {}
    setSelected({ ...claim });
    setHistoryLoadError(null);
  };

  useEffect(() => {
    if (!selected || !selected.stock_unit_serial_number) {
      setSerialHistory(null);
      setUnitStatus("");
      setTechCharge("");
      return;
    }
    let mounted = true;
    setSerialHistoryLoading(true);
    setHistoryLoadError(null);
    getSerialFullHistory(selected.stock_unit_serial_number)
      .then((h) => {
        if (mounted) setSerialHistory(h);
      })
      .catch((err) => {
        console.error("Failed to load serial history", err);
        if (mounted) {
          setSerialHistory(null);
          setHistoryLoadError("Unable to load serial history.");
        }
      })
      .finally(() => mounted && setSerialHistoryLoading(false));
    return () => (mounted = false);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setClaimHistory(null);
      return;
    }

    let mounted = true;
    setClaimHistoryLoading(true);
    setHistoryLoadError(null);
    getManufacturerClaimHistory(selected.id)
      .then((history) => {
        if (mounted) setClaimHistory(history);
      })
      .catch((err) => {
        console.error("Failed to load claim history", err);
        if (mounted) {
          setClaimHistory(null);
          setHistoryLoadError("Unable to load claim history.");
        }
      })
      .finally(() => mounted && setClaimHistoryLoading(false));

    return () => (mounted = false);
  }, [selected]);

  useEffect(() => {
    console.log("ManufacturerWarranty: selected changed", selected);
  }, [selected]);

  const closeEditor = () => {
    setSelected(null);
    setValidationError(null);
  };

  const validateClaimUpdate = () => {
    if (!selected) return null;
    if (!selected.outcome || selected.outcome.trim() === "") {
      return "Please select an outcome.";
    }
    if (selected.date_returned) {
      const returnedAt = new Date(selected.date_returned);
      if (Number.isNaN(returnedAt.getTime())) {
        return "Please enter a valid return date.";
      }
      if (selected.date_sent) {
        const sentAt = new Date(selected.date_sent);
        if (!Number.isNaN(sentAt.getTime()) && returnedAt < sentAt) {
          return "Date returned cannot be before date sent.";
        }
      }
    }
    return null;
  };

  const saveClaim = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const validationMsg = validateClaimUpdate();
    if (validationMsg) {
      setValidationError(validationMsg);
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    try {
      const payload = {
        outcome: selected.outcome,
        date_returned: selected.date_returned || null,
        tracking_reference: selected.tracking_reference || null,
        notes: selected.notes || null,
        unit_status: unitStatus || undefined,
        amount_charged_by_technician: techCharge !== "" ? Number(techCharge) : undefined,
      };
      await updateManufacturerWarrantyClaim(selected.id, payload);
      closeEditor();
      loadClaims();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to update claim";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClaim = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete manufacturer claim #${selected.id}? This will remove the claim and all its history.`)) return;
    try {
      setIsSaving(true);
      await deleteManufacturerWarrantyClaim(selected.id);
      closeEditor();
      loadClaims();
    } catch (err) {
      console.error("Failed to delete claim", err);
      alert(err?.response?.data?.detail || err?.message || "Failed to delete claim");
    } finally {
      setIsSaving(false);
    }
  };

  const daysOut = (dateSent) => {
    if (!dateSent) return "–";
    const diff = Math.floor((new Date() - new Date(dateSent)) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1F3C8A" }}>Manufacturer Warranty Claims</h1>
          <p className="text-sm text-gray-500 mt-1">Track items sent to manufacturers and update outcomes when they return.</p>
        </div>

        {selected && (
          <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
            Selected: #{selected.id} — S/N: {selected.stock_unit_serial_number || "—"}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setPage(0);
                setSearchTerm(searchValue.trim());
              }
            }}
            placeholder="Search serial, model, supplier"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setSearchTerm(searchValue.trim());
            }}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            Search
          </button>
          <select value={filterOutcome} onChange={(e) => { setFilterOutcome(e.target.value); setPage(0); }} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">All outcomes</option>
            <option value="pending">Pending (out)</option>
            <option value="repaired">Repaired</option>
            <option value="replaced_by_manufacturer">Replaced</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={() => { setPage(0); loadClaims(); }} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_0.9fr_0.9fr_0.4fr] gap-4 border-b border-slate-100 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <div>Item</div>
          <div>Supplier</div>
          <div>Date Sent</div>
          <div>Outcome</div>
          <div>Days Out</div>
          <div />
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-10 text-sm text-slate-500">Loading claims…</div>
        ) : claims.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No claims found.</div>
        ) : (
          <div>
            {claims.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditor(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditor(c); }}
                className="w-full text-left grid grid-cols-[2fr_1.2fr_1fr_0.9fr_0.9fr_0.4fr] gap-4 px-6 py-4 hover:bg-slate-50 transition cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900">{(c.stock_item_brand || "") + (c.stock_item_model ? ` ${c.stock_item_model}` : "")}</div>
                  <div className="text-xs text-slate-400">S/N: {c.stock_unit_serial_number || "—"}</div>
                </div>
                <div className="text-sm text-slate-700">{c.supplier_name || "—"}</div>
                <div className="text-sm text-slate-600 whitespace-nowrap">{formatDate(c.date_sent)}</div>
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${OUTCOME_COLORS[c.outcome]?.bg || "bg-slate-100"} ${OUTCOME_COLORS[c.outcome]?.text || "text-slate-600"}`}>
                    {c.outcome}
                  </span>
                </div>
                <div className="text-sm text-slate-600">{c.outcome === "pending" ? `${daysOut(c.date_sent)} d` : "—"}</div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(c);
                    }}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                    title="Edit claim"
                  >
                    <Edit3 size={14} />
                  </button>
                  {c.stock_unit_serial_number && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/serial-history', { state: { serial: c.stock_unit_serial_number } });
                      }}
                      className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                      title="Open serial history"
                    >
                      <LinkIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-b-3xl border border-t-0 border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {claims.length} of {totalClaims} claim{totalClaims === 1 ? "" : "s"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          <span className="text-sm">
            Page {page + 1} of {Math.max(1, Math.ceil(totalClaims / limit))}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= totalClaims} className="rounded-xl border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            Next
          </button>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} className="rounded-xl border px-3 py-2 text-sm">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {selected && (
        <>
        {/* small debug banner while developing */}
        <div className="fixed left-4 top-4 z-[99999] rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          Debug: selected id {selected?.id} — serial {selected?.stock_unit_serial_number}
        </div>
        <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6" onClick={closeEditor}>
          <div className="relative z-[10000] w-full max-w-2xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Update Claim #{selected.id}</h2>
                <p className="text-sm text-slate-500 mt-1">Item: {selected.stock_item_brand} {selected.stock_item_model} — S/N {selected.stock_unit_serial_number}</p>
              </div>
              <button type="button" onClick={closeEditor} className="h-10 w-10 rounded-full border border-slate-200 p-2 text-slate-500">✕</button>
            </div>

            {historyLoadError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {historyLoadError}
              </div>
            )}

            {(serialHistoryLoading || claimHistoryLoading) && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading claim details…
              </div>
            )}

            <form onSubmit={saveClaim} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Outcome
                <select value={selected.outcome} onChange={(e) => setSelected({ ...selected, outcome: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm">
                  <option value="pending">pending</option>
                  <option value="repaired">repaired</option>
                  <option value="replaced_by_manufacturer">replaced_by_manufacturer</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Date returned
                <input type="date" value={selected.date_returned || ""} onChange={(e) => setSelected({ ...selected, date_returned: e.target.value || null })} className="w-full rounded-xl border px-3 py-2 text-sm" />
              </label>

              <label className="col-span-full space-y-2 text-sm font-medium text-slate-700">
                Tracking reference
                <input type="text" value={selected.tracking_reference || ""} onChange={(e) => setSelected({ ...selected, tracking_reference: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm" />
              </label>

              <label className="col-span-full space-y-2 text-sm font-medium text-slate-700">
                Notes
                <textarea value={selected.notes || ""} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm" rows={4} />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Unit status
                <select value={unitStatus} onChange={(e) => setUnitStatus(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
                  <option value="">(no change)</option>
                  <option value="in_stock">in_stock</option>
                  <option value="with_manufacturer">with_manufacturer</option>
                  <option value="returned">returned</option>
                  <option value="returned_pending_check">returned_pending_check</option>
                  <option value="repaired_awaiting_pickup">repaired_awaiting_pickup</option>
                  <option value="defective">defective</option>
                  <option value="scrapped">scrapped</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Technician charge (Rs.)
                <input type="number" step="0.01" value={techCharge} onChange={(e) => setTechCharge(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" />
              </label>

              {validationError && (
                <div className="col-span-full rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                  {validationError}
                </div>
              )}

              <div className="col-span-full flex items-center gap-3 pt-2">
                <button type="submit" disabled={isSaving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{isSaving ? "Saving…" : "Save changes"}</button>
                <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                <button type="button" onClick={handleDeleteClaim} disabled={isSaving} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">Delete claim</button>
                {selected?.stock_unit_serial_number && (
                  <button type="button" onClick={() => navigate('/serial-history', { state: { serial: selected.stock_unit_serial_number } })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Open full serial history</button>
                )}
                {selected?.linked_job_card_id && (
                  <button type="button" onClick={() => navigate(`/new-repair-invoice?job_card_id=${selected.linked_job_card_id}`)} className="ml-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">Create technician invoice</button>
                )}
              </div>
            </form>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div>
                <h3 className="text-sm font-semibold text-[#1F3C8A]">Unit Timeline</h3>
                {serialHistoryLoading ? (
                  <div className="text-sm text-slate-500 mt-2">Loading history…</div>
                ) : !serialHistory || !serialHistory.timeline || serialHistory.timeline.length === 0 ? (
                  <div className="text-sm text-slate-500 mt-2">No history available for this unit.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {serialHistory.timeline.map((ev) => (
                      <div key={`${ev.type}-${ev.id}`} className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">{ev.title}</div>
                          <div className="text-xs text-gray-400">{new Date(ev.date).toLocaleString()}</div>
                        </div>
                        {ev.subtitle && <div className="mt-1 text-sm text-gray-600">{ev.subtitle}</div>}
                        {ev.detail && <div className="mt-1 text-sm text-gray-700">{ev.detail}</div>}
                        {ev.note && <div className="mt-1 text-sm text-gray-700">Note: {ev.note}</div>}
                        {ev.changed_by && <div className="mt-1 text-xs text-gray-500">Changed by: {ev.changed_by}</div>}
                        {ev.technician_name && <div className="mt-1 text-xs text-gray-500">Technician: {ev.technician_name}</div>}
                        {ev.amount_charged_by_technician != null && (
                          <div className="mt-1 text-xs text-gray-500">Cost: Rs. {Number(ev.amount_charged_by_technician).toLocaleString("en-LK", { minimumFractionDigits: 2 })}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1F3C8A]">Claim History</h3>
                  <span className="text-xs text-slate-500">{claimHistory?.length ?? 0} entries</span>
                </div>
                {claimHistoryLoading ? (
                  <div className="mt-3 text-sm text-slate-500">Loading claim history…</div>
                ) : claimHistory?.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-500">No claim history available yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {claimHistory.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{entry.note || "Claim updated"}</div>
                            <div className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                            {entry.new_outcome || "updated"}
                          </span>
                        </div>
                        {entry.old_outcome && entry.new_outcome && entry.old_outcome !== entry.new_outcome && (
                          <div className="mt-2 text-sm text-slate-600">
                            Outcome: <span className="font-semibold">{entry.old_outcome}</span> → <span className="font-semibold">{entry.new_outcome}</span>
                          </div>
                        )}
                        {(entry.changed_by_rep_name || entry.changed_by_username) && (
                          <div className="mt-2 text-xs text-slate-500">
                            Updated by: {entry.changed_by_rep_name || entry.changed_by_username}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
