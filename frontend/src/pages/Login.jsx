import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  // If the user was redirected here from a protected page (e.g. typed
  // /invoices directly while logged out), send them back there after
  // a successful login instead of always landing on the dashboard.
  const from = location.state?.from?.pathname || "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: "linear-gradient(180deg, #0d1638 0%, #1F3C8A 100%)" }}>
      <div className="w-full max-w-sm">

        {/* Logo / brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg mb-4"
               style={{ background: "#27AE60" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-black text-2xl leading-none"
                    style={{ fontFamily: "Georgia, serif" }}>C</span>
            </div>
            <div className="absolute inset-0"
                 style={{
                   background: "linear-gradient(135deg, #1F3C8A 50%, transparent 50%)",
                   opacity: 0.85,
                 }} />
          </div>
          <div className="text-white font-bold text-lg leading-tight tracking-wide text-center">
            CREATIVE COMPUTERS
          </div>
          <div className="text-blue-300 text-xs mt-0.5 font-medium tracking-wider">
            INVOICE SYSTEM
          </div>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit}
              className="bg-white rounded-2xl shadow-2xl p-7 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Sign in</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter your staff username and password.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200
                            text-red-700 rounded-xl px-3 py-2.5 text-sm">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                   style={{ color: "#1F3C8A" }}>
              Username
            </label>
            <input
              type="text"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. asanka"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-cc-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                   style={{ color: "#1F3C8A" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-cc-blue-400 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-white text-sm
                       font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60"
            style={{ background: "#1F3C8A" }}
          >
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-blue-300 text-xs mt-6">
          Kurunegala, Sri Lanka · Invoice Management System
        </p>
      </div>
    </div>
  );
}
