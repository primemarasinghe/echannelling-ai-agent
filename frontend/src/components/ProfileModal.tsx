import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { updateProfile } from "../api";
import { useAuth, type AuthUser } from "../context/AuthContext";

export default function ProfileModal({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const { updateUser } = useAuth();

  const [name,      setName]      = useState(user.name ?? "");
  const [phone,     setPhone]     = useState(user.phone ?? "");
  const [dob,       setDob]       = useState(user.date_of_birth ?? "");
  const [gender,    setGender]    = useState(user.gender ?? "");
  const [bloodType, setBloodType] = useState(user.blood_type ?? "");
  const [address,   setAddress]   = useState(user.address ?? "");
  const [ecName,    setEcName]    = useState(user.emergency_contact_name ?? "");
  const [ecPhone,   setEcPhone]   = useState(user.emergency_contact_phone ?? "");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sync if user prop changes
  useEffect(() => {
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setDob(user.date_of_birth ?? "");
    setGender(user.gender ?? "");
    setBloodType(user.blood_type ?? "");
    setAddress(user.address ?? "");
    setEcName(user.emergency_contact_name ?? "");
    setEcPhone(user.emergency_contact_phone ?? "");
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false);
    if (!name.trim()) { setError("Full name is required."); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        date_of_birth: dob || null,
        gender: gender || null,
        blood_type: bloodType || null,
        address: address.trim() || null,
        emergency_contact_name: ecName.trim() || null,
        emergency_contact_phone: ecPhone.trim() || null,
      });
      updateUser({ ...user, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = user.role === "admin" ? "Admin" : user.role === "doctor" ? "Doctor" : "Patient";

  return (
    <motion.div
      className="pf-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
    >
      <motion.div
        className="pf-modal"
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="pf-header">
          <div className="pf-header-bg" />
          <button className="pf-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div className="pf-header-content">
            <div className="pf-avatar-wrap">
              {user.picture
                ? <img src={user.picture} alt={user.name} className="pf-avatar" referrerPolicy="no-referrer" />
                : <div className="pf-avatar pf-avatar-fallback">{user.name?.[0]?.toUpperCase()}</div>
              }
            </div>
            <div className="pf-header-text">
              <div className="pf-header-name">{user.name}</div>
              <div className="pf-header-email">{user.email}</div>
              <span className="pf-role-pill">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <form className="pf-body" onSubmit={handleSave}>
          <AnimatePresence>
            {error && (
              <motion.div className="pf-alert pf-alert--error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </motion.div>
            )}
            {saved && (
              <motion.div className="pf-alert pf-alert--success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}><polyline points="20 6 9 17 4 12"/></svg>
                Profile updated successfully.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pf-section-label">Personal Details</div>
          <div className="pf-grid">
            <label className="pf-field">
              <span>Full Name</span>
              <input className="pf-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </label>
            <label className="pf-field">
              <span>Phone Number</span>
              <input className="pf-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+94 7x xxx xxxx" />
            </label>
            <label className="pf-field">
              <span>Date of Birth</span>
              <input className="pf-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </label>
            <label className="pf-field">
              <span>Gender</span>
              <select className="pf-input pf-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <label className="pf-field">
              <span>Blood Type</span>
              <select className="pf-input pf-select" value={bloodType} onChange={e => setBloodType(e.target.value)}>
                <option value="">Select blood type</option>
                {["A+","A−","B+","B−","O+","O−","AB+","AB−"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>

          <label className="pf-field pf-field--full">
            <span>Address</span>
            <textarea className="pf-input pf-textarea" value={address} onChange={e => setAddress(e.target.value)} placeholder="Your home address" rows={2} />
          </label>

          <div className="pf-section-label" style={{ marginTop: 8 }}>Emergency Contact</div>
          <div className="pf-grid">
            <label className="pf-field">
              <span>Contact Name</span>
              <input className="pf-input" type="text" value={ecName} onChange={e => setEcName(e.target.value)} placeholder="Full name" />
            </label>
            <label className="pf-field">
              <span>Contact Phone</span>
              <input className="pf-input" type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)} placeholder="+94 7x xxx xxxx" />
            </label>
          </div>

          {/* ── Footer ── */}
          <div className="pf-footer">
            <button type="button" className="pf-btn pf-btn--cancel" onClick={onClose}>Cancel</button>
            <motion.button
              type="submit"
              className="pf-btn pf-btn--save"
              disabled={saving}
              whileHover={{ scale: saving ? 1 : 1.02 }}
              whileTap={{ scale: saving ? 1 : 0.97 }}
            >
              {saving
                ? <><svg className="pf-spin" viewBox="0 0 24 24" fill="none" width={15} height={15}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Saving…</>
                : "Save Changes"
              }
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
