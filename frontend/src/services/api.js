/**
 * services/api.js — All API calls to the FastAPI backend
 * ========================================================
 * Centralising API calls here means:
 *   - Every component imports from ONE place
 *   - If the base URL changes, you update it here only
 *   - Easy to see what the backend can do
 */

import axios from "axios";
import { API_BASE } from "../config";

const BASE = API_BASE;

const api = axios.create({ baseURL: BASE });

// ── Attach the saved JWT to every request automatically ────────
// Analogy: this is the doorman checking your wristband before you
// even reach the front desk — every single api.get/post/etc call
// passes through here first, so no page has to remember to add the
// header itself.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── If the token is rejected (expired / invalid), log out cleanly ──
// A 401 from ANY endpoint means "your session is no longer valid" —
// so we clear the stored token and bounce to /login rather than
// leaving the user stuck looking at a broken page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes("/auth/login")) {
      localStorage.removeItem("cc_token");
      localStorage.removeItem("cc_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Raw fetch with auth header attached ─────────────────────
// PDF downloads and a couple of pages use the browser's native fetch()
// directly (usually because they need the raw Response/blob, not JSON
// via axios). Since every backend route now requires a token, those
// calls need the same Authorization header the axios interceptor
// above adds automatically — this helper does that for plain fetch.
export function authFetch(url, options = {}) {
  const token = localStorage.getItem("cc_token");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export { BASE as API_BASE_URL };

// ── Auth ─────────────────────────────────────────────────────
/**
 * FastAPI's OAuth2PasswordRequestForm expects form-encoded data,
 * not JSON — so we build a URLSearchParams body instead of a plain
 * object here. This is the one endpoint that looks different from
 * every other call in this file.
 */
export const login = (username, password) => {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  return axios
    .post(`${BASE}/auth/login`, form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    .then((r) => r.data);
};

export const getMe = () => api.get("/auth/me").then((r) => r.data);

export const changePassword = (current_password, new_password) =>
  api.patch("/auth/change-password", { current_password, new_password }).then((r) => r.data);

export const getUsers = () => api.get("/auth/users").then((r) => r.data);

export const createUser = (data) => api.post("/auth/users", data).then((r) => r.data);

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
