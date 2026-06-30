import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Map,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  createRateSetting,
  createSettingRoute,
  deleteRateSetting,
  deleteSettingRoute,
  getSettingRoutes,
  getSettings,
  updateCompanyInfo,
  updateRateSetting,
  updateSettingRoute,
  updateSettings,
  updateWarrantySettings,
} from "../services/api";

const toDisplay = (v) => (Number(v || 0) * 100).toFixed(4).replace(/\.?0+$/, "");
const fromDisplay = (s) => (parseFloat(s) / 100) || 0;
const slug = (value) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const tabs = [
  { id: "rates", label: "Rates & Margins", icon: Percent },
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "routes", label: "Logistics & Routes", icon: Map },
  { id: "defaults", label: "Invoice Defaults", icon: ShieldCheck },
];

const emptyRate = () => ({
  id: `new-${Date.now()}`,
  key: "",
  label: "",
  rate: "0",
  rate_type: "tax",
  description: "",
  is_active: true,
  isNew: true,
});

export default function Settings() {
  const [activeTab, setActiveTab] = useState("rates");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rates, setRates] = useState([]);
  const [company, setCompany] = useState({
    company_name: "Creative Computers",
    address: "",
    tin: "",
    phone_numbers: [],
  });
  const [phoneDraft, setPhoneDraft] = useState("");
  const [warranty, setWarranty] = useState("");
  const [routes, setRoutes] = useState([]);
  const [newRouteName, setNewRouteName] = useState("");

  useEffect(() => { loadSettings(); }, []);

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadSettings() {
    setLoading(true);
    let hadError = false;
    let loadedRates = false;
    try {
      const data = await getSettings();
      const loaded = (data.rates || []).map((rate) => ({
        ...rate,
        rate: toDisplay(rate.rate),
      }));
      loadedRates = loaded.length > 0;
      setRates(loaded);
      setCompany(data.company_info || {
        company_name: "Creative Computers",
        address: "",
        tin: "",
        phone_numbers: [],
      });
      setPhoneDraft((data.company_info?.phone_numbers || []).join("\n"));
      setWarranty(data.warranty?.default_warranty_text || "");
    } catch {
      hadError = true;
    }

    try {
      setRoutes(await getSettingRoutes());
    } catch {
      hadError = true;
    }

    if (hadError) {
      showToast("error", "Some settings could not be loaded from server.");
    }

    try {
      if (!loadedRates) {
        setRates([
          { id: "fallback-sscl", key: "sscl_pct", label: "SSCL", rate: "2.5", rate_type: "tax", is_active: true, isNew: true },
          { id: "fallback-vat", key: "vat_pct", label: "VAT", rate: "18", rate_type: "tax", is_active: true, isNew: true },
          { id: "fallback-margin", key: "profit_margin", label: "Profit Margin", rate: "20", rate_type: "margin", is_active: true, isNew: true },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateRateRow(id, field, value) {
    setRates((prev) => prev.map((rate) => {
      if (rate.id !== id) return rate;
      const next = { ...rate, [field]: value };
      if (field === "label" && rate.isNew && !rate.key) next.key = slug(value);
      return next;
    }));
  }

  async function saveRates(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const legacy = {};
      const savedRates = [];
      for (const rate of rates) {
        if (!rate.label.trim() || !rate.key.trim()) continue;
        const payload = {
          key: rate.key.trim(),
          label: rate.label.trim(),
          rate: fromDisplay(rate.rate),
          rate_type: rate.rate_type || "tax",
          description: rate.description || null,
          is_active: Boolean(rate.is_active),
        };
        const saved = rate.isNew
          ? await createRateSetting(payload)
          : await updateRateSetting(rate.id, payload);
        savedRates.push({ ...saved, rate: toDisplay(saved.rate) });
        if (["sscl_pct", "vat_pct", "profit_margin"].includes(saved.key)) {
          legacy[saved.key] = saved.rate;
        }
      }
      if (Object.keys(legacy).length) await updateSettings(legacy);
      setRates(savedRates);
      showToast("success", "Rates saved. New invoices will use the updated defaults.");
    } catch {
      showToast("error", "Could not save rates.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRate(rate) {
    if (rate.isNew) {
      setRates((prev) => prev.filter((r) => r.id !== rate.id));
      return;
    }
    await deleteRateSetting(rate.id);
    setRates((prev) => prev.map((r) => r.id === rate.id ? { ...r, is_active: false } : r));
  }

  async function saveCompany(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateCompanyInfo({
        ...company,
        phone_numbers: phoneDraft.split(/\r?\n/).map((p) => p.trim()).filter(Boolean),
      });
      setCompany(updated);
      setPhoneDraft((updated.phone_numbers || []).join("\n"));
      showToast("success", "Company profile saved.");
    } catch {
      showToast("error", "Could not save company profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWarranty(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateWarrantySettings({ default_warranty_text: warranty });
      setWarranty(updated.default_warranty_text || "");
      showToast("success", "Invoice defaults saved.");
    } catch {
      showToast("error", "Could not save invoice defaults.");
    } finally {
      setSaving(false);
    }
  }

  async function addRoute() {
    if (!newRouteName.trim()) return;
    try {
      const route = await createSettingRoute({ name: newRouteName.trim() });
      setRoutes((prev) => [...prev.filter((r) => r.id !== route.id), route].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRouteName("");
      showToast("success", "Route added.");
    } catch {
      showToast("error", "Could not add route.");
    }
  }

  async function saveRoute(route) {
    try {
      const updated = await updateSettingRoute(route.id, {
        name: route.name,
        is_active: route.is_active,
      });
      setRoutes((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      showToast("success", "Route updated.");
    } catch {
      showToast("error", "Could not update route.");
    }
  }

  async function deactivateRoute(route) {
    try {
      await deleteSettingRoute(route.id);
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
      showToast("success", "Route deleted.");
    } catch {
      showToast("error", "Could not delete route.");
    }
  }

  const preview = useMemo(() => {
    const get = (key) => fromDisplay(rates.find((r) => r.key === key)?.rate || "0");
    const cost = 10000;
    const margin = get("profit_margin");
    const sscl = get("sscl_pct");
    const vat = get("vat_pct");
    const profitAmt = cost * margin;
    const afterMargin = cost + profitAmt;
    const ssclAmt = afterMargin * sscl;
    const afterSscl = afterMargin + ssclAmt;
    const vatAmt = afterSscl * vat;
    return { cost, margin, sscl, vat, profitAmt, ssclAmt, vatAmt, grandTotal: afterSscl + vatAmt };
  }, [rates]);

  const fmt = (n) => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const legacyRate = (key) => rates.find((rate) => rate.key === key)?.rate || "0";
  const setLegacyRate = (key, value) => {
    setRates((prev) => prev.map((rate) => rate.key === key ? { ...rate, rate: value } : rate));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#1F3C8A" }}>
            <Settings2 size={20} style={{ color: "#27AE60" }} />
            System Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage invoice defaults, company profile, routes, tax rates, and margins.
          </p>
        </div>
      </div>

      {toast && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
            : <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />}
          {toast.msg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 bg-gray-50 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === "rates" && (
            <form onSubmit={saveRates} className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">Default Rates</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enter values as percentages (e.g. 2.5 for 2.5%)
                  </p>
                </div>

                <div className="divide-y divide-gray-50">
                  <RateRow
                    icon={<ShieldCheck size={18} className="text-amber-600" />}
                    iconBg="bg-amber-50"
                    label="SSCL (Social Security Contribution Levy)"
                    description="Applied on top of cost + margin. Included in grand total on ALL_INC invoices. Shown as an explicit line item on VAT invoices."
                    value={legacyRate("sscl_pct")}
                    onChange={(value) => setLegacyRate("sscl_pct", value)}
                  />
                  <RateRow
                    icon={<ShieldCheck size={18} className="text-purple-600" />}
                    iconBg="bg-purple-50"
                    label="VAT (Value Added Tax)"
                    description="Applied on both ALL_INC and VAT invoices. Shown as an explicit line item on VAT invoices. Baked into the grand total on ALL_INC."
                    value={legacyRate("vat_pct")}
                    onChange={(value) => setLegacyRate("vat_pct", value)}
                  />
                  <RateRow
                    icon={<TrendingUp size={18} className="text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    label="Profit Margin (Mark-up)"
                    description="Applied to item cost before SSCL and VAT. Never visible to the customer."
                    value={legacyRate("profit_margin")}
                    onChange={(value) => setLegacyRate("profit_margin", value)}
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <AlertCircle size={14} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-700">
                    Live Preview - Example on Rs. {fmt(preview.cost)} cost
                  </h2>
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="p-5 space-y-3">
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      INVOICE (All-Inclusive)
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-500"><span>Cost (items)</span><span>Rs. {fmt(preview.cost)}</span></div>
                      <div className="flex justify-between text-gray-400 text-xs pl-3"><span>+ Margin ({legacyRate("profit_margin")}%)</span><span>Rs. {fmt(preview.profitAmt)}</span></div>
                      <div className="flex justify-between text-gray-400 text-xs pl-3"><span>+ SSCL ({legacyRate("sscl_pct")}%)</span><span>Rs. {fmt(preview.ssclAmt)}</span></div>
                      <div className="flex justify-between text-gray-400 text-xs pl-3 italic"><span>+ VAT ({legacyRate("vat_pct")}%) - baked in, not shown</span><span>Rs. {fmt(preview.vatAmt)}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                        <span>GRAND TOTAL</span><span>Rs. {fmt(preview.grandTotal)}</span>
                      </div>
                      <p className="text-xs text-gray-400 italic">Customer sees only this one line.</p>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      TAX INVOICE (VAT)
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-500"><span>Sub-total (after margin)</span><span>Rs. {fmt(preview.cost + preview.profitAmt + preview.ssclAmt)}</span></div>
                      <div className="flex justify-between text-amber-600"><span>SSCL ({legacyRate("sscl_pct")}%)</span><span>Rs. {fmt(preview.ssclAmt)}</span></div>
                      <div className="flex justify-between text-purple-700 font-medium"><span>VAT ({legacyRate("vat_pct")}%)</span><span>Rs. {fmt(preview.vatAmt)}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                        <span>GRAND TOTAL</span><span>Rs. {fmt(preview.grandTotal)}</span>
                      </div>
                      <p className="text-xs text-gray-400 italic">SSCL, VAT and Grand Total shown on customer document.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={saving} className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50" style={{ background: "#1F3C8A" }}>
                <Save size={15} /> {saving ? "Saving..." : "Save Rates"}
              </button>
            </form>
          )}

          {activeTab === "company" && (
            <form onSubmit={saveCompany} className="max-w-3xl space-y-4">
              <Field label="Company Name" value={company.company_name} onChange={(v) => setCompany((c) => ({ ...c, company_name: v }))} />
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Address</span>
                <textarea value={company.address || ""} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} rows={3} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Phone Numbers</span>
                <textarea value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} rows={4} placeholder="One phone number per line" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </label>
              <button type="submit" disabled={saving} className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50" style={{ background: "#1F3C8A" }}>
                <Save size={15} /> Save Profile
              </button>
            </form>
          )}

          {activeTab === "routes" && (
            <div className="max-w-3xl space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Sales Routes</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Saved routes appear here. Edit a route name, save it, or delete routes you no longer use.
                </p>
              </div>
              <div className="flex gap-2">
                <input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} placeholder="New route name" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button type="button" onClick={addRoute} className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-lg" style={{ background: "#1F3C8A" }}>
                  <Plus size={15} /> Add New Route
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                {routes.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No routes found. Add your first route above.
                  </div>
                )}
                {routes.map((route) => (
                  <div key={route.id} className={`flex items-center gap-3 px-4 py-3 ${route.is_active ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                    <input value={route.name} onChange={(e) => setRoutes((prev) => prev.map((r) => r.id === route.id ? { ...r, name: e.target.value } : r))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <button type="button" onClick={() => saveRoute(route)} className="text-sm text-blue-700 font-semibold px-3 py-2 hover:bg-blue-50 rounded-lg">Save</button>
                    {route.is_active ? (
                      <button type="button" onClick={() => deactivateRoute(route)} className="text-sm text-red-600 font-semibold px-3 py-2 hover:bg-red-50 rounded-lg">Delete</button>
                    ) : (
                      <button type="button" onClick={() => saveRoute({ ...route, is_active: true })} className="text-sm text-green-700 font-semibold px-3 py-2 hover:bg-green-50 rounded-lg">Reactivate</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "defaults" && (
            <form onSubmit={saveWarranty} className="max-w-3xl space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Terms & Conditions Text</span>
                <textarea value={warranty} onChange={(e) => setWarranty(e.target.value)} rows={10} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </label>
              <button type="submit" disabled={saving} className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50" style={{ background: "#1F3C8A" }}>
                <Save size={15} /> Save Defaults
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </label>
  );
}

function RateRow({ icon, iconBg, label, description, value, onChange }) {
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-800">{label}</label>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="relative w-28 flex-shrink-0">
        <input
          type="number"
          min="0"
          max="100"
          step="0.0001"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Percent size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}
