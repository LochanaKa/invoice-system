/**
 * components/ProtectedRoute.jsx — Route guard
 * ==============================================
 * Wraps <Layout /> in App.jsx. Before rendering the actual page,
 * it checks: is anyone logged in?
 *
 *   - Still checking a saved token (page just loaded) → show a
 *     spinner, don't flash the login page then immediately swap it.
 *   - No user → redirect to /login, remembering where they were
 *     headed so Login.jsx can send them back after signing in.
 *   - Logged in → render the page as normal (<Outlet />).
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2"
           style={{ color: "#1F3C8A" }}>
        <RefreshCw className="animate-spin" size={18} />
        <span className="text-sm font-medium">Checking session…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
