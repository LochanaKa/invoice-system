/**
 * pages/BackupManager.jsx — Database Backup Management
 * ======================================================
 * Shows backup status, history, manual trigger, and IRD
 * retention guidance.
 */

import { useState, useEffect } from "react";
import {
  RefreshCw, Database, HardDrive, Clock,
  CheckCircle, AlertTriangle, Play, Shield
} from "lucide-react";

import { API_BASE } from "../config";
import { authFetch } from "../services/api";
const API = API_BASE;

const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("en-LK", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  : "Never";

export default function BackupManager() {
  const [status,   setStatus]   = useState(null);
  const [backups,  setBackups]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [running,  setRunning]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [showLog,  setShowLog]  = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        authFetch(`${API}/backup/status`).then(r => r.json()),
        authFetch(`${API}/backup/list`).then(r => r.json()),
      ]);
      setStatus(s);
      setBackups(b.backups || []);
    } catch {
      showToast("Could not reach backup API.", "error");
    } finally { setLoading(false); }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await authFetch(`${API}/backup/run`, { method: "POST" });
      const data = await res.json();
      showToast("Backup started! Refreshing in 12 seconds…", "success");
      setTimeout(() => { loadAll(); setRunning(false); }, 12000);
    } catch {
      showToast("Failed to start backup.", "error");
      setRunning(false);
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const lastOk = status?.last_backup;
  const lastDate = lastOk ? new Date(lastOk.created_at) : null;
  const hoursAgo = lastDate
    ? Math.round((Date.now() - lastDate.getTime()) / 3600000)
    : null;
  const isHealthy = hoursAgo !== null && hoursAgo < 26;

  const inp = `border rounded-lg px-3 py-2 text-sm bg-white
               focus:outline-none focus:ring-2 transition`.replace(/\s+/g," ");

  return (
    <div className="max-w-5xl space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3
                         rounded-xl shadow-lg text-sm font-medium
                         ${toast.type==="success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color:"#1F3C8A" }}>
            Backup Manager
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            PostgreSQL daily backups · 30-day retention · IRD 5-year archive guidance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                             rounded-lg border transition-colors"
                  style={{ borderColor:"#d5dcf5", color:"#1F3C8A" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""}/>
            Refresh
          </button>
          <button onClick={handleRunNow} disabled={running || loading}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold
                             rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ background:"#1F3C8A" }}>
            {running ? <RefreshCw size={13} className="animate-spin"/> : <Play size={13}/>}
            {running ? "Backing up…" : "Run Backup Now"}
          </button>
        </div>
      </div>

      {/* Health banner */}
      {status && (
        isHealthy ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200
                          rounded-xl p-4">
            <CheckCircle className="text-green-600 flex-shrink-0" size={18}/>
            <div>
              <div className="text-sm font-semibold text-green-800">
                Backup system healthy
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                Last backup: {fmtDate(lastOk?.created_at)} ({hoursAgo}h ago) ·
                {" "}{lastOk?.size_human}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200
                          rounded-xl p-4">
            <AlertTriangle className="text-amber-600 flex-shrink-0" size={18}/>
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {lastOk ? `Last backup was ${hoursAgo}h ago — may be overdue` : "No backups found yet"}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                Run a backup now or check that the Task Scheduler is configured
              </div>
            </div>
          </div>
        )
      )}

      {/* Stat cards */}
      {status && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Database, label: "Total Backups",     value: status.backup_count,       color:"#1F3C8A" },
            { icon: HardDrive,label: "Storage Used",      value: status.total_size_human,    color:"#1b5e20" },
            { icon: Clock,    label: "Schedule",          value: "Daily 11:00 PM",           color:"#1F3C8A" },
            { icon: Shield,   label: "Retention Period",  value: `${status.retention_days} days`, color:"#7c3aed" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border p-4"
                 style={{ borderColor:"#d5dcf5" }}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon size={16} style={{ color: c.color }}/>
                <span className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two columns: backup list + guidance */}
      <div className="grid grid-cols-3 gap-5">

        {/* Backup file list */}
        <div className="col-span-2 bg-white rounded-2xl border overflow-hidden"
             style={{ borderColor:"#d5dcf5" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between"
               style={{ borderColor:"#eef1fb", background:"#f7f9ff" }}>
            <h2 className="text-xs font-bold uppercase tracking-wide"
                style={{ color:"#1F3C8A" }}>Backup Files</h2>
            <span className="text-xs text-gray-400">{backups.length} files</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <RefreshCw className="animate-spin" size={14}/>
              <span className="text-sm">Loading…</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No backups yet. Click "Run Backup Now" to create the first one.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background:"#f7f9ff", borderBottom:"1px solid #eef1fb" }}>
                  {["#","Filename","Size","Created"].map(h => (
                    <th key={h}
                        className="px-4 py-2.5 text-left font-bold uppercase tracking-wide"
                        style={{ color:"#1F3C8A", fontSize:"10px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={b.filename}
                      style={{
                        borderBottom:"1px solid #f0f4ff",
                        background: i === 0 ? "#f0fff4" : i % 2 === 0 ? "#fff" : "#fafbff"
                      }}>
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color:"#1F3C8A" }}>
                      {b.filename}
                      {i === 0 && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700
                                         px-1.5 py-0.5 rounded-full font-semibold">
                          latest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{b.size_human}</td>
                    <td className="px-4 py-2.5 text-gray-500">{b.created_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Guidance panel */}
        <div className="space-y-4">

          {/* IRD retention */}
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor:"#d5dcf5" }}>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-purple-600"/>
              <h3 className="text-xs font-bold uppercase tracking-wide text-purple-700">
                IRD Retention Rule
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Gazette 2463/05 requires financial records to be kept for a minimum of{" "}
              <strong>5 years</strong>.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-2">
              This system auto-deletes backups after <strong>30 days</strong> to save disk space.
              Before deletion, copy files older than 30 days to:
            </p>
            <ul className="mt-2 space-y-1">
              {["An external USB hard drive", "Google Drive / OneDrive folder", "A second PC on the network"].map(item => (
                <li key={item} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* How to restore */}
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor:"#d5dcf5" }}>
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} style={{ color:"#1F3C8A" }}/>
              <h3 className="text-xs font-bold uppercase tracking-wide"
                  style={{ color:"#1F3C8A" }}>
                How to Restore
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              If data is lost (e.g. PC crash), open Command Prompt in the{" "}
              <code className="bg-gray-100 px-1 rounded">backend/</code> folder and run:
            </p>
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400">
              python restore.py
            </div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              It will show available backups and ask you to confirm before overwriting anything.
            </p>
          </div>

          {/* Task Scheduler */}
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor:"#d5dcf5" }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-amber-600"/>
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700">
                Auto-Backup Setup
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              To enable daily automatic backups:
            </p>
            <ol className="space-y-1">
              {[
                "Edit BACKEND_DIR path in setup_scheduler.bat",
                "Right-click setup_scheduler.bat",
                'Choose "Run as administrator"',
                "Done — backs up every night at 11 PM",
              ].map((step, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">{i+1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Recent log */}
      {status?.recent_log?.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden"
             style={{ borderColor:"#d5dcf5" }}>
          <button onClick={() => setShowLog(v => !v)}
                  className="w-full px-5 py-3 flex items-center justify-between
                             border-b text-left"
                  style={{ borderColor:"#eef1fb", background:"#f7f9ff" }}>
            <h2 className="text-xs font-bold uppercase tracking-wide"
                style={{ color:"#1F3C8A" }}>
              Recent Backup Log
            </h2>
            <span className="text-xs text-gray-400">{showLog ? "▲ hide" : "▼ show"}</span>
          </button>
          {showLog && (
            <div className="p-4 bg-gray-900 rounded-b-2xl overflow-x-auto">
              {status.recent_log.map((line, i) => (
                <div key={i}
                     className={`text-xs font-mono mb-0.5 ${
                       line.includes("SUCCESS") ? "text-green-400" :
                       line.includes("ERROR") || line.includes("FAILED") ? "text-red-400" :
                       "text-gray-400"
                     }`}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
