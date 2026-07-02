/**
 * components/Layout.jsx — Sidebar + Header
 * ==========================================
 * Themed to match Creative Computers brand:
 *   • Sidebar: deep navy (#1F3C8A) with green active states (#27AE60)
 *   • Header:  white with brand gradient accent
 *   • Logo:    SVG C-mark mirroring the real logo
 */

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, PlusCircle,
  Users, UserCog, AlertCircle, Settings2, MapPin, Cpu, Monitor, HardDrive, LogOut, KeyRound, ClipboardList
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"        },
  { to: "/invoices",     icon: FileText,        label: "Invoices"         },
  { to: "/invoices/new", icon: PlusCircle,      label: "New Invoice"      },
  { to: "/customers",    icon: Users,           label: "Customers"        },
  { to: "/staff",        icon: UserCog,         label: "Staff Management" },
  { to: "/credit",       icon: AlertCircle,     label: "Credit Aging"     },
  { to: "/reports",      icon: FileText,        label: "Reports"          },
  { to: "/job-cards", icon: ClipboardList, label: "Job Cards" },
];

/** SVG replica of the Creative Computers "C" mark */
function CCLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer green ring (the C shape) */}
      <circle cx="50" cy="50" r="48" fill="#27AE60" />
      {/* Inner cut-out to form the C */}
      <circle cx="50" cy="50" r="32" fill="#1F3C8A" />
      {/* Right-side gap of the C (white opening) */}
      <rect x="50" y="18" width="52" height="64" fill="#1F3C8A" />
      {/* Blue wedge on left inside the C */}
      <path d="M50 18 L50 82 L14 66 L14 34 Z" fill="#1F3C8A" />
      {/* Centre white cutout */}
      <circle cx="50" cy="50" r="26" fill="white" />
      {/* Gap opening on right */}
      <rect x="50" y="24" width="52" height="52" fill="white" />
    </svg>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen font-sans" style={{ background: "#f0f4ff" }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-60 flex flex-col flex-shrink-0 shadow-xl"
             style={{ background: "linear-gradient(180deg, #0d1638 0%, #1F3C8A 100%)" }}>

        {/* Logo area */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Logo image */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-lg bg-white">
              <img src="/cc_logo.png" alt="Creative Computers Logo" className="w-full h-full object-cover" />
            </div>

            <div>
              <div className="text-white font-bold text-sm leading-tight tracking-wide">
                CREATIVE
              </div>
              <div className="font-bold text-sm leading-tight tracking-wide"
                   style={{ color: "#27AE60" }}>
                COMPUTERS
              </div>
              <div className="text-blue-300 text-[10px] mt-0.5 font-medium tracking-wider">
                INVOICE SYSTEM
              </div>
            </div>
          </div>
        </div>

        {/* Divider label */}
        <div className="px-5 pt-5 pb-2">
          <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-[0.15em]">
            Navigation
          </span>
        </div>

        {/* Main nav links */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                 transition-all duration-150 group
                 ${isActive
                   ? "text-white shadow-lg"
                   : "text-blue-200 hover:text-white hover:bg-white/10"}`
              }
              style={({ isActive }) => isActive ? {
                background: "linear-gradient(90deg, #27AE60 0%, #1e904e 100%)",
              } : {}}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Settings and backup links */}
        <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-2">
          <NavLink
            to="/backup"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
               transition-all duration-150
               ${isActive
                 ? "text-white shadow-lg"
                 : "text-blue-300 hover:text-white hover:bg-white/10"}`
            }
            style={({ isActive }) => isActive ? {
              background: "linear-gradient(90deg, #27AE60 0%, #1e904e 100%)",
            } : {}}
          >
            <HardDrive size={16} className="flex-shrink-0" />
            Backups
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
               transition-all duration-150
               ${isActive
                 ? "text-white shadow-lg"
                 : "text-blue-300 hover:text-white hover:bg-white/10"}`
            }
            style={({ isActive }) => isActive ? {
              background: "linear-gradient(90deg, #27AE60 0%, #1e904e 100%)",
            } : {}}
          >
            <Settings2 size={16} className="flex-shrink-0" />
            Settings
          </NavLink>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-blue-400 text-[11px] font-medium">
            <MapPin size={11} />
            Kurunegala, Sri Lanka
          </div>
          <div className="flex items-center gap-1.5 text-blue-500 text-[10px] mt-0.5">
            <Cpu size={10} />
            v1.1 · IRD Compliant
          </div>
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <header className="bg-white border-b flex items-center justify-between
                           px-6 py-3 flex-shrink-0 shadow-sm"
                style={{ borderColor: "#d5dcf5" }}>
          {/* Left: brand stripe + date */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full"
                 style={{ background: "linear-gradient(180deg, #1F3C8A, #27AE60)" }} />
            <span className="text-gray-500 text-sm">
              {new Date().toLocaleDateString("en-LK", {
                weekday: "long", year: "numeric",
                month:   "long", day:    "numeric",
              })}
            </span>
          </div>

          {/* Right: current user + logout */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm text-sm font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #eef3ff 0%, #f7f9ff 100%)",
                    borderColor: "#c3d0f8",
                    color: "#1F3C8A",
                    boxShadow: "0 4px 12px rgba(31, 60, 138, 0.08)",
                  }}>
              <span className="text-base leading-none">☀️</span>
              <span>{getGreeting()}{user?.rep_name ? `, ${user.rep_name}` : ""}</span>
            </span>
            {/* Small animated green dot — "live" indicator */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "#27AE60" }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                    style={{ background: "#27AE60" }} />
            </span>
            <NavLink
              to="/change-password"
              title="Change your password"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm
                         font-medium text-gray-500 hover:text-cc-blue-600 hover:border-cc-blue-200
                         hover:bg-cc-blue-50 transition-colors"
              style={{ borderColor: "#d5dcf5" }}
            >
              <KeyRound size={14} />
              Change Password
            </NavLink>
            <button
              onClick={handleLogout}
              title="Log out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm
                         font-medium text-gray-500 hover:text-red-600 hover:border-red-200
                         hover:bg-red-50 transition-colors"
              style={{ borderColor: "#d5dcf5" }}
            >
              <LogOut size={14} />
              Log Out
            </button>
          </div>
        </header>

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {/* ── Copyright footer ─────────────────────────────────── */}
        <footer className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-t"
                style={{ borderColor: "#d5dcf5", background: "#f7f9ff" }}>
          {/* Left — system name */}
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 rounded-full"
                 style={{ background: "linear-gradient(180deg, #1F3C8A, #27AE60)" }} />
            <span className="text-xs font-semibold" style={{ color: "#1F3C8A" }}>
              Creative Computers
            </span>
            <span className="text-xs text-gray-400">Invoice Management System</span>
          </div>

          {/* Right — developer credit */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>© {new Date().getFullYear()} Designed &amp; developed by</span>
            <span className="font-bold" style={{ color: "#1F3C8A" }}>
              Lochana Karunarathna
            </span>
            <span className="mx-1 text-gray-300">·</span>
            <span className="font-medium" style={{ color: "#27AE60" }}>
              All rights reserved
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
