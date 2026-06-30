/**
 * services/api.js — All API calls to the FastAPI backend
 * ========================================================
 * Centralising API calls here means:
 *   - Every component imports from ONE place
 *   - If the base URL changes, you update it here only
 *   - Easy to see what the backend can do
 */

import axios from "axios";

// Your FastAPI server address
const BASE = "http://localhost:8000/api";

const api = axios.create({ baseURL: BASE });

// ── Invoices ─────────────────────────────────────────────────
export const getInvoices = (params) =>
  api.get("/invoices", { params }).then((r) => r.data);

export const getInvoice = (id) =>
  api.get(`/invoices/${id}`).then((r) => r.data);

export const createInvoice = (data) =>
  api.post("/invoices", data).then((r) => r.data);

export const getNextInvoiceNumber = (category, type) =>
  api.get("/invoices/next-number", { params: { category, type } }).then((r) => r.data);

export const addPayment = (invoiceId, data) =>
  api.post(`/invoices/${invoiceId}/pay`, data).then((r) => r.data);

export const markVatPosted = (invoiceId) =>
  api.patch(`/invoices/${invoiceId}/mark-vat-posted`).then((r) => r.data);

export const deleteInvoice = (id) =>
  api.delete(`/invoices/${id}`).then((r) => r.data);

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = (params) =>
  api.get("/customers", { params }).then((r) => r.data);

export const getCustomer = (id) =>
  api.get(`/customers/${id}`).then((r) => r.data);

export const getCustomerInvoices = (customerId) =>
  api.get(`/dashboard/customer-invoices/${customerId}`).then((r) => r.data);

export const createCustomer = (data) =>
  api.post("/customers", data).then((r) => r.data);

export const updateCustomer = (id, data) =>
  api.patch(`/customers/${id}`, data).then((r) => r.data);

export const deleteCustomer = (id) =>
  api.delete(`/customers/${id}`).then((r) => r.data);

export const reactivateCustomer = (id) =>
  api.patch(`/customers/${id}/reactivate`).then((r) => r.data);

// ── Dashboard ─────────────────────────────────────────────────
export const getDashboardSummary = (params) =>
  api.get("/dashboard/summary", { params }).then((r) => r.data);

export const getSalesByRep = (params) =>
  api.get("/dashboard/sales-by-rep", { params }).then((r) => r.data);

export const getLeaderboard = (params) =>
  api.get("/dashboard/leaderboard", { params }).then((r) => r.data);

export const getRevenueTrend = (params) =>
  api.get("/dashboard/revenue-trend", { params }).then((r) => r.data);

export const getTopCustomers = (params) =>
  api.get("/dashboard/top-customers", { params }).then((r) => r.data);

export const getTopOutstanding = (params) =>
  api.get("/dashboard/top-outstanding", { params }).then((r) => r.data);

export const getRoutePerformance = (params) =>
  api.get("/dashboard/route-performance", { params }).then((r) => r.data);

export const getYoYComparison = (params) =>
  api.get("/dashboard/yoy-comparison", { params }).then((r) => r.data);

export const getAgingBuckets = (params) =>
  api.get("/dashboard/aging-buckets", { params }).then((r) => r.data);

export const getDashboardLayoutPreference = () =>
  api.get("/preferences/dashboard-layout").then((r) => r.data);

export const updateDashboardLayoutPreference = (dashboard_layout) =>
  api.put("/preferences/dashboard-layout", { dashboard_layout }).then((r) => r.data);

export const getCreditAging = () =>
  api.get("/dashboard/credit-aging").then((r) => r.data);

export const getVatSummary = (year, month) =>
  api.get("/dashboard/vat-summary", { params: { year, month } }).then((r) => r.data);

export const getLookups = () =>
  api.get("/dashboard/lookups").then((r) => r.data);

export const createRoute = (data) =>
  api.post(`/routes`, data).then((r) => r.data);

export const getCompanyInfo = () =>
  api.get("/settings/company-info").then((r) => r.data);

export const updateCompanyInfo = (data) =>
  api.put("/settings/company-info", data).then((r) => r.data);

export const getWarrantySettings = () =>
  api.get("/settings/warranty").then((r) => r.data);

export const updateWarrantySettings = (data) =>
  api.put("/settings/warranty", data).then((r) => r.data);

export const getSettingRoutes = () =>
  api.get("/settings/routes").then((r) => r.data);

export const createSettingRoute = (data) =>
  api.post("/settings/routes", data).then((r) => r.data);

export const updateSettingRoute = (id, data) =>
  api.put(`/settings/routes/${id}`, data).then((r) => r.data);

export const deleteSettingRoute = (id) =>
  api.delete(`/settings/routes/${id}`).then((r) => r.data);

export const getRateSettings = () =>
  api.get("/settings/rates").then((r) => r.data);

export const createRateSetting = (data) =>
  api.post("/settings/rates", data).then((r) => r.data);

export const updateRateSetting = (id, data) =>
  api.put(`/settings/rates/${id}`, data).then((r) => r.data);

export const deleteRateSetting = (id) =>
  api.delete(`/settings/rates/${id}`).then((r) => r.data);

// ── Staff / Reps ──────────────────────────────────────────────
export const getReps = () =>
  api.get("/reps").then((r) => r.data);

export const getNextRepCode = () =>
  api.get("/reps/next-code").then((r) => r.data);

export const createRep = (data) =>
  api.post("/reps", data).then((r) => r.data);

export const deactivateRep = (id) =>
  api.patch(`/reps/${id}/deactivate`).then((r) => r.data);

export const reactivateRep = (id) =>
  api.patch(`/reps/${id}/reactivate`).then((r) => r.data);

export const updateRep = (id, data) =>
  api.patch(`/reps/${id}`, data).then((r) => r.data);

export const getRepPortfolio = (repId) =>
  api.get(`/reps/${repId}/portfolio`).then((r) => r.data);

export const getRepInvoices = (repId, params) =>
  api.get(`/reps/${repId}/invoices`, { params }).then((r) => r.data);

// ── Settings ──────────────────────────────────────────────────
/** Fetch system-wide tax & margin defaults. */
export const getSettings = () =>
  api.get("/settings").then((r) => r.data);

/**
 * Partially update settings (PATCH — only include fields you want to change).
 * @param {{ sscl_pct?: number, vat_pct?: number, profit_margin?: number }} data
 */
export const updateSettings = (data) =>
  api.patch("/settings", data).then((r) => r.data);
