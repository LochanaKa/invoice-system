import { useState } from "react";
import { KeyRound, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { changePassword } from "../services/api";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving,  setSaving]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  const inp = `w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
               focus:outline-none focus:ring-2 focus:ring-cc-blue-400 transition`;
  const lbl = `block text-xs font-bold uppercase tracking-wider mb-1.5`;

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={20} style={{ color: "#1F3C8A" }} />
        <h1 className="text-xl font-bold" style={{ color: "#1F3C8A" }}>
          Change Password
        </h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Update your login password. You'll stay signed in afterward.
      </p>

      <form onSubmit={handleSubmit}
            className="bg-white rounded-2xl border shadow-cc-sm p-6 space-y-4"
            style={{ borderColor: "#d5dcf5" }}>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200
                          text-red-700 rounded-xl px-3 py-2.5 text-sm">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200
                          text-green-700 rounded-xl px-3 py-2.5 text-sm">
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
            Password changed successfully.
          </div>
        )}

        <div>
          <label className={lbl} style={{ color: "#1F3C8A" }}>Current Password</label>
          <input type="password" required value={currentPassword}
                 onChange={(e) => setCurrentPassword(e.target.value)}
                 className={inp} />
        </div>

        <div>
          <label className={lbl} style={{ color: "#1F3C8A" }}>New Password</label>
          <input type="password" required value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 placeholder="At least 6 characters"
                 className={inp} />
        </div>

        <div>
          <label className={lbl} style={{ color: "#1F3C8A" }}>Confirm New Password</label>
          <input type="password" required value={confirmPassword}
                 onChange={(e) => setConfirmPassword(e.target.value)}
                 className={inp} />
        </div>

        <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 text-white text-sm
                           font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                style={{ background: "#1F3C8A" }}>
          {saving && <RefreshCw size={14} className="animate-spin" />}
          {saving ? "Saving…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
