import { useSearchParams } from "react-router-dom";
import { FileSpreadsheet, FileText } from "lucide-react";
import VATReport from "./VATReport";
import AllInclusiveReport from "./AllInclusiveReport";

const tabs = [
  {
    id: "vat",
    label: "VAT Report",
    description: "IRD monthly filing summary",
    icon: FileSpreadsheet,
  },
  {
    id: "all-inclusive",
    label: "All-Inclusive",
    description: "Business watch summary for ALL_INC invoices",
    icon: FileText,
  },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "all-inclusive" ? "all-inclusive" : "vat";

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "#d5dcf5" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
              Reports
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              View VAT and All-Inclusive summaries from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "text-white shadow-md"
                      : "bg-white text-gray-600 hover:text-[#1F3C8A]"
                  }`}
                  style={
                    isActive
                      ? { background: "linear-gradient(90deg, #27AE60 0%, #1e904e 100%)", borderColor: "#27AE60" }
                      : { borderColor: "#d5dcf5" }
                  }
                >
                  <Icon size={16} />
                  <span>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === "vat" ? <VATReport /> : <AllInclusiveReport />}
    </div>
  );
}
