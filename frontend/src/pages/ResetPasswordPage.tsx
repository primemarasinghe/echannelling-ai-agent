import { useState } from "react";
import { resetPassword } from "../api";

interface Props {
  token: string;
  onDone: () => void;
}

export default function ResetPasswordPage({ token, onDone }: Props) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6)   { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm)   { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#f0f4ff 0%,#faf5ff 100%)", padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20,
        boxShadow: "0 8px 40px rgba(79,70,229,.12)", padding: "40px 36px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 12px",
            background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>Set new password</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {success ? "Your password has been updated." : "Choose a strong password for your account."}
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "16px", marginBottom: 20,
              color: "#15803d", fontSize: 14, fontWeight: 600,
            }}>
              Password updated successfully!
            </div>
            <button
              onClick={onDone}
              style={{
                width: "100%", padding: "13px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
              }}
            >
              Sign in with new password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, padding: "10px 12px", marginBottom: 16,
                color: "#dc2626", fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  style={{
                    width: "100%", padding: "11px 40px 11px 14px", borderRadius: 8,
                    border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
                    padding: 0, fontSize: 16,
                  }}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 8,
                  border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: 10, border: "none",
                background: loading ? "#a5b4fc" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 150ms",
              }}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
