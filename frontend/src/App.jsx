/**
 * App.jsx — Routing
 * ==================
 * React Router maps URL paths to page components.
 * Layout wraps every page with the sidebar + header.
 *
 * Analogy: Layout is the picture frame. Each page is a different
 * painting — the frame stays the same, only the painting changes.
 */

import { Routes, Route, Navigate } from "react-router-dom";
import Layout        from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login          from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Dashboard     from "./pages/Dashboard";
import InvoiceList   from "./pages/InvoiceList";
import NewInvoice    from "./pages/NewInvoice";
import InvoiceDetail from "./pages/InvoiceDetail";
import Customers     from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import StaffManagement from "./pages/StaffManagement";
import RepPortfolio    from "./pages/RepPortfolio";
import CreditAging   from "./pages/CreditAging";
import Settings      from "./pages/Settings";
import Reports from "./pages/Reports";
import NewJobCard from "./pages/NewJobCard";
import JobCards from "./pages/JobCards";
import JobCardDetail from "./pages/JobCardDetail";
import BackupManager  from "./pages/BackupManager";

export default function App() {
  return (
    <Routes>
      {/* Public — no login required */}
      <Route path="/login" element={<Login />} />

      {/* Everything below requires a valid session. ProtectedRoute
          checks auth, then Layout renders the sidebar/header, then
          the actual page renders inside it via <Outlet />. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="invoices"     element={<InvoiceList />} />
          <Route path="invoices/new" element={<NewInvoice />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="customers"    element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="staff"              element={<StaffManagement />} />
          <Route path="staff/:repId/portfolio" element={<RepPortfolio />} />
          <Route path="credit"       element={<CreditAging />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="job-cards" element={<JobCards />} />
          <Route path="job-cards/new" element={<NewJobCard />} />
          <Route path="job-cards/:id" element={<JobCardDetail />} />
          <Route path="backup"       element={<BackupManager />} />
          <Route path="change-password" element={<ChangePassword />} />
        </Route>
      </Route>
    </Routes>
  );
}
