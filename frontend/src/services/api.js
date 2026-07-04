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

export const getTechnicians = (params) =>
  api.get("/technicians", { params }).then((r) => r.data);

export const getTechnician = (id) =>
  api.get(`/technicians/${id}`).then((r) => r.data);

export const createTechnician = (data) =>
  api.post("/technicians", data).then((r) => r.data);

export const updateTechnician = (id, data) =>
  api.patch(`/technicians/${id}`, data).then((r) => r.data);

export const deactivateTechnician = (id) =>
  api.patch(`/technicians/${id}/deactivate`).then((r) => r.data);

export const getTechnicianRepairHistory = (technicianId) =>
  api.get(`/technicians/${technicianId}/repair-jobs`).then((r) => r.data);

export const updateRepairJob = (id, data) =>
  api.patch(`/repair-jobs/${id}`, data).then((r) => r.data);

export const deleteRepairJob = (id) =>
  api.delete(`/repair-jobs/${id}`).then((r) => r.data);

export const createJobCard = (data) =>
  api.post("/jobs", data).then((r) => r.data);

export const getJobCards = () =>
  api.get("/jobs").then((r) => r.data);

export const getJobCard = (id) =>
  api.get(`/jobs/${id}`).then((r) => r.data);

export const updateJobCard = (id, data) =>
  api.patch(`/jobs/${id}`, data).then((r) => r.data);

export const linkJobCardInvoice = (id, data) =>
  api.patch(`/job-cards/${id}/link-invoice`, data).then((r) => r.data);

export const deleteJobCard = (id) =>
  api.delete(`/jobs/${id}`).then((r) => r.data);

// Run workflow action on a job card (uses backend /jobs/{id}/action endpoint)
export const runJobCardAction = (jobCardId, payload) =>
  api.post(`/jobs/${jobCardId}/action`, payload).then((r) => r.data);

export const getAvailableReplacementUnits = (unitId) =>
  api.get(`/stock-units/${unitId}/available-replacements`).then((r) => r.data);

// Fetch a stock unit by serial (allow any status) — used to show updated status
export const getStockUnitBySerial = (serialNumber) =>
  api.get(`/stock-units/lookup/${encodeURIComponent(serialNumber)}`, { params: { allow_any_status: true } }).then((r) => r.data);

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

export const searchBySerial = (serialNumber) =>
  api.get(`/invoices/search-by-serial/${serialNumber}`).then((r) => r.data);

/**
 * Download the invoice PDF for a given invoice ID.
 * Requests the binary PDF from the backend, creates a temporary object URL,
 * triggers the browser's native file-save dialog, then cleans up.
 *
 * @param {number|string} invoiceId  - The invoice primary key
 * @param {string}        filename   - Suggested filename (e.g. "CCFR-S00013.pdf")
 */
export const downloadInvoicePdf = async (invoiceId, filename) => {
  const response = await api.get(`/invoices/${invoiceId}/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `invoice-${invoiceId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Stock Management ─────────────────────────────────────────
export const getSuppliers = (params) =>
  api.get("/suppliers", { params }).then((r) => r.data);

export const getSupplier = (id) =>
  api.get(`/suppliers/${id}`).then((r) => r.data);

export const createSupplier = (data) =>
  api.post("/suppliers", data).then((r) => r.data);

export const updateSupplier = (id, data) =>
  api.patch(`/suppliers/${id}`, data).then((r) => r.data);

export const deleteSupplier = (id) =>
  api.delete(`/suppliers/${id}`).then((r) => r.data);

export const getStockCategories = () =>
  api.get("/stock-categories").then((r) => r.data);

export const createStockCategory = (data) =>
  api.post("/stock-categories", data).then((r) => r.data);

export const getStockItems = (params) =>
  api.get("/stock-items", { params }).then((r) => r.data);

export const getStockItem = (id) =>
  api.get(`/stock-items/${id}`).then((r) => r.data);

export const createStockItem = (data) =>
  api.post("/stock-items", data).then((r) => r.data);

export const updateStockItem = (id, data) =>
  api.patch(`/stock-items/${id}`, data).then((r) => r.data);

export const deleteStockItem = (id) =>
  api.delete(`/stock-items/${id}`).then((r) => r.data);

export const getStockReceipts = (params) =>
  api.get("/stock-receipts", { params }).then((r) => r.data);

export const getStockReceipt = (id) =>
  api.get(`/stock-receipts/${id}`).then((r) => r.data);

export const createStockReceipt = (data) =>
  api.post("/stock-receipts", data).then((r) => r.data);

export const addSerialsToReceiptItem = (receiptId, receiptItemId, serialNumbers) =>
  api.post(`/stock-receipts/${receiptId}/items/${receiptItemId}/serials`, { serial_numbers: serialNumbers }).then((r) => r.data);

export const getStockUnits = (params) =>
  api.get("/stock-units", { params }).then((r) => r.data);

export const lookupSerial = (serialNumber, fuzzy = false) =>
  api
    .get(`/stock-units/lookup/${encodeURIComponent(serialNumber)}`, {
      params: fuzzy ? { fuzzy: true } : undefined,
    })
    .then((r) => r.data);

export const searchStockUnits = (serialNumber) =>
  api
    .get(`/stock-units/lookup/${encodeURIComponent(serialNumber)}`, {
      params: { fuzzy: true, allow_any_status: true },
    })
    .then((r) => r.data);

export const getSerialFullHistory = (serialNumber) =>
  api
    .get(`/stock-units/${encodeURIComponent(serialNumber)}/full-history`)
    .then((r) => r.data);

// ── Manufacturer warranty claims ─────────────────────────────────
export const getManufacturerWarrantyClaims = (params) =>
  api.get("/manufacturer-warranty-claims", { params }).then((r) => r.data);

export const updateManufacturerWarrantyClaim = (id, data) =>
  api.patch(`/manufacturer-warranty-claims/${id}`, data).then((r) => r.data);

export const getManufacturerClaimHistory = (claimId) =>
  api.get(`/manufacturer-warranty-claims/${claimId}/history`).then((r) => r.data);

export const deleteManufacturerWarrantyClaim = (id) =>
  api.delete(`/manufacturer-warranty-claims/${id}`).then((r) => r.data);

