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
import VATReport     from "./pages/VATReport";
import AllInclusiveReport from "./pages/AllInclusiveReport";
import BackupManager  from "./pages/BackupManager";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Default route → redirect to dashboard */}
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
        <Route path="vat-report"   element={<VATReport />} />
        <Route path="all-inclusive-report" element={<AllInclusiveReport />} />
        <Route path="backup"       element={<BackupManager />} />
      </Route>
    </Routes>
  );
}
