/**
 * pages/Dashboard.jsx - draggable, persisted dashboard layout
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Crown,
  DollarSign,
  Edit3,
  Flag,
  GripVertical,
  Medal,
  RefreshCw,
  RotateCcw,
  Save,
  Trophy,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import {
  getAgingBuckets,
  getDashboardLayoutPreference,
  getDashboardSummary,
  getInvoices,
  getLeaderboard,
  getRevenueTrend,
  getRoutePerformance,
  getTopCustomers,
  getTopOutstanding,
  getYoYComparison,
  updateDashboardLayoutPreference,
} from "../services/api";

const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 96;
const GRID_GAP = 24;

const formatLKR = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

const periodLabels = {
  all_time: "All Time",
  monthly: "This Month",
  annually: "This Year",
};

const DEFAULT_LAYOUT = [
  { i: "kpis", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: "revenue-trend", x: 0, y: 2, w: 8, h: 6, minW: 5, minH: 4 },
  { i: "yoy", x: 8, y: 2, w: 4, h: 3, minW: 3, minH: 3 },
  { i: "route-performance", x: 8, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
  { i: "leaderboard", x: 0, y: 8, w: 8, h: 5, minW: 5, minH: 3 },
  { i: "aging", x: 8, y: 10, w: 4, h: 3, minW: 3, minH: 3 },
  { i: "top-outstanding", x: 0, y: 13, w: 4, h: 5, minW: 3, minH: 3 },
  { i: "top-customers", x: 4, y: 13, w: 4, h: 5, minW: 3, minH: 3 },
  { i: "recent-invoices", x: 8, y: 13, w: 4, h: 5, minW: 4, minH: 3 },
];

const chartColors = {
  sales: "#1F3C8A",
  repairs: "#DC2626",
  routeRevenue: "#2563EB",
  routeOutstanding: "#F59E0B",
  aging: ["#1F3C8A", "#7C3AED", "#F59E0B", "#EF4444"],
};

function mergeLayout(savedLayout) {
  if (!Array.isArray(savedLayout) || savedLayout.length === 0) {
    return DEFAULT_LAYOUT.map((item) => ({ ...item }));
  }

  const savedById = new Map(savedLayout.map((item) => [item.i, item]));
  const defaultIds = new Set(DEFAULT_LAYOUT.map((item) => item.i));
  const hasOutdatedSavedItem = savedLayout.some((item) => !defaultIds.has(item.i));
  if (hasOutdatedSavedItem) {
    return DEFAULT_LAYOUT.map((item) => ({ ...item }));
  }

  const hasBrokenSavedItem = DEFAULT_LAYOUT.some((fallback) => {
    const saved = savedById.get(fallback.i);
    if (!saved) return false;
    return (
      !Number.isFinite(Number(saved.x))
      || !Number.isFinite(Number(saved.y))
      || !Number.isFinite(Number(saved.w))
      || !Number.isFinite(Number(saved.h))
      || Number(saved.w) < fallback.minW
      || Number(saved.h) < fallback.minH
      || Number(saved.x) < 0
      || Number(saved.y) < 0
      || Number(saved.x) + Number(saved.w) > GRID_COLS
    );
  });

  if (hasBrokenSavedItem) {
    return DEFAULT_LAYOUT.map((item) => ({ ...item }));
  }

  return DEFAULT_LAYOUT.map((fallback) => {
    const saved = savedById.get(fallback.i) || {};
    const width = clamp(Number(saved.w ?? fallback.w), fallback.minW, GRID_COLS);
    return {
      ...fallback,
      x: clamp(Number(saved.x ?? fallback.x), 0, GRID_COLS - width),
      y: Math.max(0, Number(saved.y ?? fallback.y)),
      w: width,
      h: Math.max(fallback.minH, Number(saved.h ?? fallback.h)),
      i: fallback.i,
    };
  });
}

function persistableLayout(layout) {
  return layout.map(({ i, x, y, w, h, minW, minH }) => ({ i, x, y, w, h, minW, minH }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function monthOptions() {
  return [
    { value: 1, label: "Jan" },
    { value: 2, label: "Feb" },
    { value: 3, label: "Mar" },
    { value: 4, label: "Apr" },
    { value: 5, label: "May" },
    { value: 6, label: "Jun" },
    { value: 7, label: "Jul" },
    { value: 8, label: "Aug" },
    { value: 9, label: "Sep" },
    { value: 10, label: "Oct" },
    { value: 11, label: "Nov" },
    { value: 12, label: "Dec" },
  ];
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [topOutstanding, setTopOutstanding] = useState([]);
  const [routePerformance, setRoutePerformance] = useState([]);
  const [yoyComparison, setYoYComparison] = useState(null);
  const [agingBuckets, setAgingBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("all_time");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutStatus, setLayoutStatus] = useState("");
  const [gridWidth, setGridWidth] = useState(0);
  const gridRef = useRef(null);

  const months = useMemo(() => monthOptions(), []);
  const yearOptions = [selectedYear - 1, selectedYear, selectedYear + 1];

  const sanitizedRevenueTrend = useMemo(
    () => revenueTrend.map((item) => ({
      ...item,
      sales: Number(item.sales),
      repairs: Number(item.repairs),
      outstanding: Number(item.outstanding),
    })),
    [revenueTrend]
  );

  useEffect(() => {
    loadAll();
  }, [period, selectedMonth, selectedYear]);

  useEffect(() => {
    async function loadLayoutPreference() {
      try {
        const preference = await getDashboardLayoutPreference();
        setLayout(mergeLayout(preference.dashboard_layout));
      } catch {
        setLayout(DEFAULT_LAYOUT);
      }
    }
    loadLayoutPreference();
  }, []);

  useEffect(() => {
    if (loading || !gridRef.current) return undefined;

    function measureGrid() {
      if (gridRef.current) {
        setGridWidth(gridRef.current.getBoundingClientRect().width);
      }
    }

    measureGrid();
    const observer = new ResizeObserver(([entry]) => {
      setGridWidth(entry.contentRect.width || entry.target.getBoundingClientRect().width);
    });
    observer.observe(gridRef.current);
    window.addEventListener("resize", measureGrid);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureGrid);
    };
  }, [loading]);

  function getSummaryParams() {
    const params = { period };
    if (period === "monthly") {
      params.month = selectedMonth;
      params.year = selectedYear;
    } else if (period === "annually") {
      params.year = selectedYear;
    }
    return params;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const params = getSummaryParams();
      const [sum, race, recent, trend, customers, outstanding, routes, yoy, aging] = await Promise.all([
        getDashboardSummary(params),
        getLeaderboard(params),
        getInvoices({ limit: 8 }),
        getRevenueTrend(params),
        getTopCustomers({ ...params, limit: 5 }),
        getTopOutstanding({ limit: 5 }),
        getRoutePerformance(params),
        getYoYComparison(params),
        getAgingBuckets(params),
      ]);

      setSummary(sum);
      setLeaderboard(race);
      setRecentInvoices(recent);
      setRevenueTrend(trend);
      setTopCustomers(customers);
      setTopOutstanding(outstanding);
      setRoutePerformance(routes);
      setYoYComparison(yoy);
      setAgingBuckets(aging);
    } catch {
      setError("Could not load dashboard. Is the FastAPI server running?");
    } finally {
      setLoading(false);
    }
  }

  async function saveLayout() {
    setLayoutStatus("Saving...");
    try {
      const response = await updateDashboardLayoutPreference(persistableLayout(layout));
      setLayout(mergeLayout(response.dashboard_layout));
      setLayoutStatus("Saved");
    } catch {
      setLayoutStatus("Could not save");
    }
  }

  async function resetLayout() {
    const defaultLayout = DEFAULT_LAYOUT.map((item) => ({ ...item }));
    setLayout(defaultLayout);
    setLayoutStatus("Saving default layout...");
    try {
      await updateDashboardLayoutPreference(persistableLayout(defaultLayout));
      setLayoutStatus("Default layout saved");
    } catch {
      setLayoutStatus("Default layout ready to save");
    }
  }

  function updateLayoutItem(itemId, updater) {
    setLayout((current) => current.map((item) => item.i === itemId ? updater(item) : item));
  }

  function startGridInteraction(item, mode, event) {
    if (!editMode || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startItem = { ...item };
    const colWidth = gridWidth > 0
      ? (gridWidth - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
      : 80;
    const colStep = colWidth + GRID_GAP;
    const rowStep = GRID_ROW_HEIGHT + GRID_GAP;

    function handleMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const colDelta = Math.round(dx / colStep);
      const rowDelta = Math.round(dy / rowStep);

      updateLayoutItem(item.i, (currentItem) => {
        if (mode === "drag") {
          return {
            ...currentItem,
            x: clamp(startItem.x + colDelta, 0, GRID_COLS - startItem.w),
            y: Math.max(0, startItem.y + rowDelta),
          };
        }

        if (mode === "resize-e") {
          return {
            ...currentItem,
            w: clamp(startItem.w + colDelta, startItem.minW || 1, GRID_COLS - startItem.x),
          };
        }

        if (mode === "resize-s") {
          return {
            ...currentItem,
            h: Math.max(startItem.minH || 1, startItem.h + rowDelta),
          };
        }

        return {
          ...currentItem,
          w: clamp(startItem.w + colDelta, startItem.minW || 1, GRID_COLS - startItem.x),
          h: Math.max(startItem.minH || 1, startItem.h + rowDelta),
        };
      });
    }

    function handleUp() {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      if (mode === "drag") {
        setLayout((current) => {
          const draggedItem = current.find((layoutItem) => layoutItem.i === item.i);
          if (!draggedItem) return current;
          const centerX = draggedItem.x + draggedItem.w / 2;
          const centerY = draggedItem.y + draggedItem.h / 2;
          const target = current.find((layoutItem) => (
            layoutItem.i !== item.i
            && centerX >= layoutItem.x
            && centerX < layoutItem.x + layoutItem.w
            && centerY >= layoutItem.y
            && centerY < layoutItem.y + layoutItem.h
          ));
          if (!target) return current;

          return current.map((layoutItem) => {
            if (layoutItem.i === target.i) {
              return {
                ...layoutItem,
                x: clamp(startItem.x, 0, GRID_COLS - layoutItem.w),
                y: startItem.y,
              };
            }
            return layoutItem;
          });
        });
      }

      setLayoutStatus("Unsaved layout changes");
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = mode === "drag" ? "move" : mode === "resize-e" ? "ew-resize" : mode === "resize-s" ? "ns-resize" : "nwse-resize";
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }

  const totalSales = sanitizedRevenueTrend.reduce((sum, row) => sum + Number(row.sales || 0), 0);
  const totalRepairs = sanitizedRevenueTrend.reduce((sum, row) => sum + Number(row.repairs || 0), 0);
  const currentPeriodLabel =
    period === "monthly"
      ? `${periodLabels[period]} - ${months.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`
      : period === "annually"
        ? `${periodLabels[period]} - ${selectedYear}`
        : periodLabels[period];

  const widgets = {
    "kpis": (
      <div className="grid h-full grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Sales Revenue" value={formatLKR(summary?.sales_revenue)} subtitle={`${summary?.sales_invoice_count || 0} invoices`} icon={TrendingUp} color="blue" />
        <StatCard title="Repair Revenue" value={formatLKR(summary?.repair_revenue)} subtitle={`${summary?.repair_invoice_count || 0} invoices`} icon={ArrowRight} color="red" />
        <StatCard title="VAT Collected" value={formatLKR(summary?.total_vat_collected)} subtitle="Period VAT total" icon={DollarSign} color="purple" />
        <StatCard title="Outstanding Credit" value={formatLKR(summary?.total_outstanding)} subtitle="Unpaid balances" icon={AlertTriangle} color={Number(summary?.total_outstanding || 0) > 0 ? "amber" : "green"} />
      </div>
    ),
    "revenue-trend": (
      <Widget title="Revenue Trend" meta={currentPeriodLabel} editMode={editMode}>
        <div className="grid h-full min-h-0 grid-rows-2 gap-4">
          <TrendChart title="Sales Trend" total={totalSales} dataKey="sales" color={chartColors.sales} data={sanitizedRevenueTrend} />
          <TrendChart title="Repair Trend" total={totalRepairs} dataKey="repairs" color={chartColors.repairs} data={sanitizedRevenueTrend} />
        </div>
      </Widget>
    ),
    "yoy": (
      <Widget title="YoY Comparison" editMode={editMode}>
        {yoyComparison ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatLKR(yoyComparison.current_period_revenue)}</p>
                <p className="text-xs text-gray-500">Compared with prior period</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${yoyComparison.trend === "up" ? "bg-green-100 text-green-700" : yoyComparison.trend === "down" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                <span className="inline-flex items-center gap-1">
                  {yoyComparison.trend === "up" ? <ArrowUpRight size={14} /> : yoyComparison.trend === "down" ? <ArrowDownRight size={14} /> : null}
                  {Math.abs(Number(yoyComparison.change_pct || 0)).toFixed(1)}%
                </span>
              </div>
            </div>
            <InfoPair label="Prior period" value={formatLKR(yoyComparison.prior_period_revenue)} />
            <InfoPair label="Current period" value={formatLKR(yoyComparison.current_period_revenue)} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No comparison available.</p>
        )}
      </Widget>
    ),
    "top-customers": (
      <Widget title="Top Customers" meta="Top 5" editMode={editMode}>
        <RankedList
          rows={topCustomers}
          emptyText="No customers found for this period."
          getKey={(row) => row.customer_id}
          onClick={(row) => navigate(`/customers/${row.customer_id}`)}
          renderTitle={(row) => row.customer_name}
          renderSubtitle={(row) => `${row.service_count} services`}
          renderValue={(row) => formatLKR(row.total_revenue)}
          disabled={editMode}
        />
      </Widget>
    ),
    "top-outstanding": (
      <Widget title="Top Outstanding Balances" meta="Top 5" editMode={editMode}>
        <RankedList
          rows={topOutstanding}
          emptyText="No outstanding balances at the moment."
          getKey={(row) => row.customer_id}
          onClick={(row) => navigate(`/customers/${row.customer_id}`)}
          renderTitle={(row) => row.customer_name}
          renderSubtitle={(row) => row.route_name ? `Route: ${row.route_name}` : row.phone || "Contact info unavailable"}
          renderValue={(row) => formatLKR(row.total_outstanding)}
          tone="amber"
          disabled={editMode}
        />
      </Widget>
    ),
    "route-performance": (
      <Widget title="Route Performance" meta="Revenue & outstanding" editMode={editMode}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={routePerformance} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" stroke="#64748B" tick={{ fontSize: 11 }} tickFormatter={(value) => `Rs. ${Number(value).toLocaleString()}`} />
            <YAxis type="category" dataKey="route_name" width={110} stroke="#64748B" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [formatLKR(value), "Amount"]} />
            <Legend verticalAlign="top" height={24} />
            <Bar dataKey="total_revenue" name="Revenue" fill={chartColors.routeRevenue} radius={[8, 0, 0, 8]} />
            <Bar dataKey="total_outstanding" name="Outstanding" fill={chartColors.routeOutstanding} radius={[8, 0, 0, 8]} />
          </BarChart>
        </ResponsiveContainer>
      </Widget>
    ),
    "aging": (
      <Widget title="Outstanding Credit Aging" editMode={editMode}>
        <AgingWidget buckets={agingBuckets} />
      </Widget>
    ),
    "leaderboard": (
      <Widget title="Sales & Repair Race" icon={<Trophy size={17} className="text-amber-500" />} editMode={editMode}>
        <Leaderboard data={leaderboard} />
      </Widget>
    ),
    "recent-invoices": (
      <Widget title="Recent Invoices" editMode={editMode}>
        <div className="space-y-1 overflow-auto pr-1">
          {recentInvoices.map((inv) => (
            <button
              key={inv.id}
              type="button"
              disabled={editMode}
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg border-b px-2 py-2.5 text-left transition-colors last:border-0 hover:bg-cc-blue-50/50 disabled:cursor-move"
              style={{ borderColor: "#eef1fb" }}
            >
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#1F3C8A" }}>{inv.invoice_number}</div>
                <div className="max-w-[180px] truncate text-xs text-gray-400">{inv.customer_name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-800">{formatLKR(inv.amount)}</div>
                <span className="mt-0.5 inline-flex rounded-full bg-cc-blue-50 px-1.5 py-0.5 text-xs font-medium text-cc-blue-600">{inv.invoice_category}</span>
              </div>
            </button>
          ))}
        </div>
      </Widget>
    ),
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2" style={{ color: "#1F3C8A" }}>
        <RefreshCw className="animate-spin" size={18} />
        <span className="text-sm font-medium">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Creative Computers - North Western Province</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {Object.entries(periodLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${period === key ? "bg-cc-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {period === "monthly" && (
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
                {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </Select>
              <YearSelect value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} options={yearOptions} />
            </div>
          )}

          {period === "annually" && (
            <YearSelect value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} options={yearOptions} />
          )}

          <button
            type="button"
            onClick={() => setEditMode((value) => !value)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${editMode ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <Edit3 size={13} /> {editMode ? "Editing" : "Edit Dashboard"}
          </button>

          {editMode && (
            <>
              <button type="button" onClick={saveLayout} className="flex items-center gap-2 rounded-xl bg-cc-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cc-blue-700">
                <Save size={13} /> Save Layout
              </button>
              <button type="button" onClick={resetLayout} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RotateCcw size={13} /> Reset to Default
              </button>
            </>
          )}

          <button
            type="button"
            onClick={loadAll}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors hover:bg-cc-blue-50"
            style={{ borderColor: "#aab9eb", color: "#1F3C8A" }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {editMode && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span>Drag widgets from anywhere inside a widget. Resize from the right, bottom, or corner handles.</span>
          {layoutStatus && <span className="font-semibold">{layoutStatus}</span>}
        </div>
      )}

      <div
        ref={gridRef}
        className={`dashboard-grid ${editMode ? "dashboard-grid-editing" : ""}`}
        style={{ height: `${(Math.max(...layout.map((item) => item.y + item.h), 1) * (GRID_ROW_HEIGHT + GRID_GAP)) - GRID_GAP}px` }}
      >
        {layout.map((item) => {
          const colWidth = gridWidth > 0
            ? (gridWidth - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
            : 0;
          const left = item.x * (colWidth + GRID_GAP);
          const top = item.y * (GRID_ROW_HEIGHT + GRID_GAP);
          const width = item.w * colWidth + (item.w - 1) * GRID_GAP;
          const height = item.h * GRID_ROW_HEIGHT + (item.h - 1) * GRID_GAP;

          return (
            <div
              key={item.i}
              className="dashboard-grid-item"
              style={{
                height,
                left,
                top,
                width,
              }}
            >
              <div
                className={`dashboard-widget-shell relative h-full ${editMode ? "cursor-move" : ""}`}
                onPointerDown={(event) => startGridInteraction(item, "drag", event)}
              >
              {editMode && (
                <button
                  type="button"
                  className="pointer-events-none absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm"
                  title="Drag or resize widget"
                >
                  <GripVertical size={16} />
                </button>
              )}
              <div className={`h-full ${editMode ? "pointer-events-none select-none" : ""}`}>
                {widgets[item.i]}
              </div>
                {editMode && (
                  <>
                    <button
                      type="button"
                      aria-label="Resize widget width"
                      className="dashboard-resize-handle dashboard-resize-handle-e"
                      onPointerDown={(event) => startGridInteraction(item, "resize-e", event)}
                    />
                    <button
                      type="button"
                      aria-label="Resize widget height"
                      className="dashboard-resize-handle dashboard-resize-handle-s"
                      onPointerDown={(event) => startGridInteraction(item, "resize-s", event)}
                    />
                    <button
                      type="button"
                      aria-label="Resize widget"
                      className="dashboard-resize-handle dashboard-resize-handle-se"
                      onPointerDown={(event) => startGridInteraction(item, "resize-se", event)}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Widget({ title, meta, icon, editMode, children }) {
  return (
    <section className={`h-full overflow-hidden rounded-2xl border bg-white p-5 shadow-cc-sm ${editMode ? "ring-2 ring-amber-100" : ""}`} style={{ borderColor: "#d5dcf5" }}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: "#1F3C8A" }}>
          {icon}
          {title}
        </h2>
        {meta && <span className="text-xs text-slate-500">{meta}</span>}
      </div>
      <div className="h-[calc(100%-2.25rem)] min-h-0">{children}</div>
    </section>
  );
}

function TrendChart({ title, total, dataKey, color, data }) {
  return (
    <div className="min-h-0 rounded-xl bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-slate-500">{title}</p>
          <p className="text-sm font-semibold text-slate-900">{formatLKR(total)}</p>
        </div>
      </div>
      <div className="h-[calc(100%-3.25rem)] min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 6, bottom: 4 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="month_label"
              stroke="#94A3B8"
              tick={{ fontSize: 11, fill: "#334155" }}
              tickMargin={8}
              minTickGap={18}
            />
            <YAxis
              domain={["dataMin * 0.9", "dataMax * 1.1"]}
              axisLine={false}
              tickLine={false}
              tick={false}
              width={34}
            />
            <Tooltip
              labelFormatter={(label) => `Month: ${label}`}
              formatter={(value, name) => [formatLKR(value), name === "sales" ? "Sales" : "Repairs"]}
              cursor={{ stroke: "#CBD5E1", strokeWidth: 1, dasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#gradient-${dataKey})`}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RankedList({ rows, emptyText, getKey, onClick, renderTitle, renderSubtitle, renderValue, tone = "blue", disabled }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;
  const maxValue = Math.max(...rows.map((row) => Number(row.total_revenue ?? row.total_outstanding ?? 0)), 0);
  const barColor = tone === "amber" ? "#F59E0B" : chartColors.sales;

  return (
    <div className="space-y-3 overflow-auto pr-1">
      {rows.map((row) => {
        const value = Number(row.total_revenue ?? row.total_outstanding ?? 0);
        const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
        return (
          <button key={getKey(row)} type="button" disabled={disabled} onClick={() => onClick(row)} className="w-full text-left disabled:cursor-move">
            <div className={`space-y-2 rounded-xl border p-3 transition ${tone === "amber" ? "border-amber-100 bg-amber-50/40 hover:bg-amber-50" : "border-slate-100 bg-slate-50 hover:bg-cc-blue-50"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{renderTitle(row)}</p>
                  <p className="truncate text-xs text-slate-500">{renderSubtitle(row)}</p>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold text-slate-900">{renderValue(row)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AgingWidget({ buckets }) {
  const total = buckets.reduce((sum, bucket) => sum + Number(bucket.total_amount || 0), 0);

  if (buckets.length === 0 || total <= 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No outstanding credit aging data for this period.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 space-y-2 overflow-auto pr-1">
        {buckets.map((bucket, index) => {
          const amount = Number(bucket.total_amount || 0);
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;

          return (
            <div key={bucket.bucket} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColors.aging[index % chartColors.aging.length] }} />
                  <span className="truncate">{bucket.bucket}</span>
                </span>
                <span className="whitespace-nowrap text-slate-500">{formatLKR(amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: chartColors.aging[index % chartColors.aging.length],
                  }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function Leaderboard({ data }) {
  const podiumOrder = [data[1], data[0], data[2]].filter(Boolean);
  const raceRows = data.slice(3);
  const leaderTotal = Number(data[0]?.total_collected || 0);

  const podiumStyles = {
    1: { height: "h-24", accent: "from-amber-300 to-yellow-500", ring: "ring-yellow-200", Icon: Crown, label: "1st" },
    2: { height: "h-20", accent: "from-slate-200 to-slate-400", ring: "ring-slate-200", Icon: Medal, label: "2nd" },
    3: { height: "h-16", accent: "from-orange-300 to-amber-700", ring: "ring-orange-200", Icon: Medal, label: "3rd" },
  };

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No fully paid invoices yet. The race starts when payments are collected.
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4 overflow-hidden">
      <div className="rounded-xl bg-gradient-to-r from-blue-50 via-white to-green-50 p-4">
        <div className="grid min-h-44 grid-cols-3 items-end gap-3">
          {podiumOrder.map((rep) => {
            const style = podiumStyles[rep.rank] || podiumStyles[3];
            const Icon = style.Icon;

            return (
              <div
                key={rep.rep_id}
                className={`group flex min-w-0 flex-col justify-end ${rep.rank === 1 ? "order-2" : rep.rank === 2 ? "order-1" : "order-3"}`}
              >
                <div className="mb-2 text-center">
                  <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${style.accent} text-white shadow-lg ring-4 ${style.ring} transition-transform group-hover:scale-105`}>
                    <Icon size={18} />
                  </div>
                  <p className="truncate text-xs font-bold text-slate-900">{rep.rep_name}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{rep.employee_number || "CC-0000"}</p>
                  <p className="mt-1 truncate text-[11px] font-bold text-emerald-700">{formatLKR(rep.total_collected)}</p>
                </div>
                <div className={`${style.height} flex items-start justify-center rounded-t-xl bg-gradient-to-br ${style.accent} pt-2 text-sm font-black text-white shadow-inner transition-all group-hover:-translate-y-1`}>
                  {style.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 space-y-3 overflow-auto pr-1">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
          <Flag size={14} />
          Race Track
        </div>

        {raceRows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No other reps in the race yet.
          </p>
        ) : raceRows.map((rep) => {
          const pct = leaderTotal > 0 ? Math.round((Number(rep.total_collected) / leaderTotal) * 100) : 0;

          return (
            <div key={rep.rep_id} className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition-all hover:bg-white hover:shadow-md">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                    #{rep.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{rep.rep_name}</p>
                    <p className="truncate text-[11px] text-slate-500">{rep.employee_number || "CC-0000"} - {rep.invoice_count} paid invoices</p>
                  </div>
                </div>
                <p className="whitespace-nowrap text-sm font-bold text-emerald-700">{formatLKR(rep.total_collected)}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-slate-100 bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 to-amber-400 transition-all duration-700 group-hover:brightness-110"
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
              <div className="mt-1 text-right text-[11px] font-semibold text-slate-400">{pct}% of leader</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoPair({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Select({ children, ...props }) {
  return (
    <select {...props} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cc-blue-200">
      {children}
    </select>
  );
}

function YearSelect({ options, ...props }) {
  return (
    <Select {...props}>
      {options.map((year) => <option key={year} value={year}>{year}</option>)}
    </Select>
  );
}
