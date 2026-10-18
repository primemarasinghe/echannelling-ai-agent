import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface BookingSession {
  session_id: number;
  doctor: string;
  date: string;
  day: string;
  start_time: string;
  available_slots: number;
  fee_lkr: number;
  hospital: string;
}

interface CurrentUser {
  name: string;
  phone?: string | null;
  date_of_birth?: string | null;
}

interface Props {
  session: BookingSession;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onBook: (name: string, phone: string, age: string, forSelf: boolean) => void;
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? String(age) : "";
}

export default function BookingFormModal({ session: s, currentUser, onClose, onBook }: Props) {
  const [forSelf, setForSelf] = useState(true);

  const selfName  = currentUser?.name  ?? "";
  const selfPhone = currentUser?.phone ?? "";
  const selfAge   = calcAge(currentUser?.date_of_birth);

  const [name,  setName]  = useState(selfName);
  const [phone, setPhone] = useState(selfPhone);
  const [age,   setAge]   = useState(selfAge);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const backdropRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  /* Reset fields when toggling who the booking is for */
  useEffect(() => {
    if (forSelf) {
      setName(selfName);
      setPhone(selfPhone);
      setAge(selfAge);
    } else {
      setName("");
      setPhone("");
      setAge("");
    }
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forSelf]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, []);

  const fmtDate = () => {
    const d = new Date(s.date + "T00:00:00");
    return d.toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" });
  };

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Patient name is required";
    if (!phone.trim()) {
      e.phone = "Phone number is required";
    } else {
      const clean = phone.replace(/[\s\-().+]/g, "");
      const norm  = clean.startsWith("94") && clean.length === 11 ? "0" + clean.slice(2) : clean;
      if (!/^0\d{9}$/.test(norm)) e.phone = "Enter a valid 10-digit Sri Lankan number";
    }
    if (age && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120))
      e.age = "Enter a valid age";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onBook(name.trim(), phone.trim(), age.trim(), forSelf);
  }

  /* ── Styles ── */
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "9px 0", border: "none", borderRadius: 8,
    fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 180ms",
    background: active ? "var(--slt-navy)" : "transparent",
    color: active ? "#fff" : "var(--ink-2)",
  });

  const fieldStyle: React.CSSProperties = {
    marginBottom: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "var(--ink-3)", textTransform: "uppercase" as const,
    letterSpacing: ".05em", marginBottom: 5,
  };

  const inputStyle = (hasErr: boolean, readOnly = false): React.CSSProperties => ({
    width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
    border: `1.5px solid ${hasErr ? "var(--error)" : readOnly ? "var(--line)" : "var(--line)"}`,
    background: readOnly ? "var(--surf-2)" : "#fff",
    color: readOnly ? "var(--ink-2)" : "var(--ink)",
    outline: "none", boxSizing: "border-box" as const,
    cursor: readOnly ? "default" : "text",
  });

  const errStyle: React.CSSProperties = { fontSize: 12, color: "var(--error)", marginTop: 4 };

  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "flex",
    alignItems: "center", gap: 4,
  };

  const missingCount = forSelf
    ? [!selfPhone, !selfAge].filter(Boolean).length
    : 0;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.48)",
        backdropFilter: "blur(5px)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <style>{`
        @keyframes bfm-in {
          from { opacity:0; transform:scale(.95) translateY(12px) }
          to   { opacity:1; transform:none }
        }
        .bfm-input:focus { border-color: var(--slt-blue) !important; box-shadow: 0 0 0 3px rgba(0,112,192,.12); }
      `}</style>

      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 460,
        boxShadow: "0 28px 72px rgba(0,0,0,.24)", overflow: "hidden",
        animation: "bfm-in 220ms cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* ── Session header ── */}
        <div style={{
          background: "linear-gradient(135deg, #003087 0%, #0055a5 55%, #0070c0 100%)",
          padding: "22px 22px 20px", color: "#fff", position: "relative",
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 14, right: 14,
              background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8,
              width: 32, height: 32, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", opacity: .7, marginBottom: 5, textTransform: "uppercase" }}>
            Book Appointment
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>{s.doctor}</div>
          <div style={{ fontSize: 13, opacity: .8, marginBottom: 14 }}>{s.hospital}</div>

          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
            {[
              { icon: "📅", text: fmtDate() },
              { icon: "🕐", text: s.start_time },
              { icon: "💳", text: `Rs. ${s.fee_lkr.toLocaleString()}` },
              { icon: "🪑", text: `${s.available_slots} slots left` },
            ].map(item => (
              <div key={item.text} style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                background: "rgba(255,255,255,.13)", borderRadius: 6, padding: "4px 9px",
                fontWeight: 500,
              }}>
                <span style={{ fontSize: 13 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form body ── */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 22px 24px" }} noValidate>

          {/* Who is this for */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Booking for</div>
            <div style={{ display: "flex", background: "var(--surf-2)", borderRadius: 10, padding: 3, gap: 3 }}>
              <button type="button" style={tabStyle(forSelf)}  onClick={() => setForSelf(true)}>
                Myself
              </button>
              <button type="button" style={tabStyle(!forSelf)} onClick={() => setForSelf(false)}>
                Someone else
              </button>
            </div>
          </div>

          {/* Profile nudge when self has missing fields */}
          {forSelf && missingCount > 0 && (
            <div style={{
              background: "rgba(0,112,192,.07)", border: "1px solid rgba(0,112,192,.2)",
              borderRadius: 8, padding: "8px 12px", fontSize: 12,
              color: "var(--slt-navy)", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {missingCount === 1 ? "1 field" : `${missingCount} fields`} missing from your profile — fill them below or
              <strong style={{ cursor: "default" }}>&nbsp;update your profile</strong> to auto-fill next time.
            </div>
          )}

          {/* Patient name */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Patient Name <span style={{ color: "var(--error)" }}>*</span></label>
            <input
              ref={!forSelf ? firstInputRef : undefined}
              className="bfm-input"
              value={name}
              readOnly={forSelf}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="Full name"
              style={inputStyle(!!errors.name, forSelf)}
            />
            {forSelf && (
              <div style={hintStyle}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Auto-filled from your profile
              </div>
            )}
            {errors.name && <div style={errStyle}>{errors.name}</div>}
          </div>

          {/* Phone + Age */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Phone Number <span style={{ color: "var(--error)" }}>*</span></label>
              <input
                ref={forSelf && !selfPhone ? firstInputRef : undefined}
                className="bfm-input"
                type="tel"
                value={phone}
                readOnly={forSelf && !!selfPhone}
                onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })); }}
                placeholder="077 123 4567"
                style={inputStyle(!!errors.phone, forSelf && !!selfPhone)}
              />
              {forSelf && selfPhone && (
                <div style={hintStyle}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Auto-filled from your profile
                </div>
              )}
              {errors.phone && <div style={errStyle}>{errors.phone}</div>}
            </div>

            <div>
              <label style={labelStyle}>Age</label>
              <input
                className="bfm-input"
                type="number"
                min={1} max={120}
                value={age}
                readOnly={forSelf && !!selfAge}
                onChange={e => { setAge(e.target.value); setErrors(p => ({ ...p, age: "" })); }}
                placeholder="—"
                style={inputStyle(!!errors.age, forSelf && !!selfAge)}
              />
              {forSelf && selfAge && (
                <div style={hintStyle}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  From DOB
                </div>
              )}
              {errors.age && <div style={errStyle}>{errors.age}</div>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 10,
                border: "1.5px solid var(--line)", background: "#fff",
                color: "var(--ink-2)", fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
                background: "var(--slt-navy)", color: "#fff",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Confirm Booking
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
