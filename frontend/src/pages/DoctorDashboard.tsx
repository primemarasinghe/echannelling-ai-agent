import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  getDoctorPortal,
  createPortalSession,
  deletePortalSession,
  updatePortalProfile,
  getPortalNotifications,
  markNotificationsRead,
} from "../api";
import { useAuth } from "../context/AuthContext";

/* ── Types ─────────────────────────────────────────────────── */
interface Patient {
  appointment_number: number;
  patient_name: string;
  patient_phone: string;
  reference: string;
  amount: number;
  created_at: string;
}
interface PortalSession {
  id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  total_slots: number;
  booked_slots: number;
  available_slots: number;
  patients: Patient[];
}
interface Consultant {
  id: number; name: string; email: string; specialty: string;
  qualifications: string; years_experience: number;
  consultation_fee: number; languages: string;
  hospital: string; city: string;
}
interface Stats {
  total_sessions: number; total_bookings: number;
  total_revenue: number; upcoming_sessions: number;
}
interface PortalData {
  consultant: Consultant;
  stats: Stats;
  sessions: PortalSession[];
}
interface Notif {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

type Tab = "sessions" | "profile";

/* ── Constants ─────────────────────────────────────────────── */
const QUAL_OPTIONS = [
  "MBBS","MD","MS","MCh","DM","FRCS","MRCP","MRCOG","DCH","DNB",
  "FCPS","PhD","Diploma in Cardiology","Diploma in Dermatology",
  "Fellowship in Neurology","Fellowship in Paediatrics",
];
const LANG_OPTIONS = ["English","Sinhala","Tamil"];

/* ── Helpers ───────────────────────────────────────────────── */
const todayStr = new Date().toISOString().split("T")[0];

function fmtRs(n: number) {
  return `Rs. ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fillPct(s: PortalSession) {
  return s.total_slots ? Math.round((s.booked_slots / s.total_slots) * 100) : 0;
}
function sessionColor(s: PortalSession) {
  if (s.available_slots === 0) return "#ef4444";
  if (fillPct(s) >= 70) return "#f7941d";
  return "#10b981";
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SPEC_AVATAR: Record<string, string> = {
  "Cardiology": "#dc2626", "Dermatology": "#d97706", "ENT": "#7c3aed",
  "General Medicine": "#2563eb", "Gynaecology": "#c026d3",
  "Neurology": "#0369a1", "Ophthalmology": "#0d9488",
  "Orthopaedics": "#ea580c", "Paediatrics": "#16a34a",
};
function specAvatarColor(s: string) { return SPEC_AVATAR[s] ?? "#003087"; }

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function DoctorDashboard() {
  const { logout } = useAuth();
  const [data, setData]                       = useState<PortalData | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [tab, setTab]                         = useState<Tab>("sessions");
  const [filter, setFilter]                   = useState<"upcoming" | "all" | "past">("upcoming");
  const [expanded, setExpanded]               = useState<number | null>(null);
  const [showAddSession, setShowAddSession]   = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [deletingId, setDeletingId]           = useState<number | null>(null);
  const [notifications, setNotifications]     = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen]             = useState(false);
  const notifPanelRef                         = useRef<HTMLDivElement>(null);
  const notifBtnRef                           = useRef<HTMLButtonElement>(null);

  /* ── Fetch portal data ────────────────────────────────────── */
  useEffect(() => {
    getDoctorPortal()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Notifications: fetch + 30 s poll ────────────────────── */
  useEffect(() => {
    const load = () => getPortalNotifications().then(setNotifications).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  /* ── Close notification panel on outside click ───────────── */
  useEffect(() => {
    if (!notifOpen) return;
    function handler(e: MouseEvent) {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        notifBtnRef.current  && !notifBtnRef.current.contains(e.target as Node)
      ) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  /* ── Derived ──────────────────────────────────────────────── */
  const sessions = useMemo(() => {
    if (!data) return [];
    if (filter === "upcoming") return data.sessions.filter(s => s.session_date >= todayStr);
    if (filter === "past")     return [...data.sessions.filter(s => s.session_date < todayStr)].reverse();
    return data.sessions;
  }, [data, filter]);

  const nextBookedSession = useMemo(() => {
    if (!data) return null;
    return data.sessions
      .filter(s => s.session_date >= todayStr && s.booked_slots > 0)
      .sort((a, b) =>
        a.session_date !== b.session_date
          ? a.session_date.localeCompare(b.session_date)
          : a.start_time.localeCompare(b.start_time)
      )[0] ?? null;
  }, [data]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  /* ── Handlers ─────────────────────────────────────────────── */
  function handleSessionCreated(newSession: PortalSession) {
    setData(prev => {
      if (!prev) return prev;
      const sessions = [...prev.sessions, newSession].sort((a, b) =>
        a.session_date === b.session_date
          ? a.start_time.localeCompare(b.start_time)
          : a.session_date.localeCompare(b.session_date)
      );
      return {
        ...prev, sessions,
        stats: { ...prev.stats, total_sessions: prev.stats.total_sessions + 1, upcoming_sessions: prev.stats.upcoming_sessions + 1 },
      };
    });
    setShowAddSession(false);
  }

  async function handleSessionDelete(sessionId: number) {
    setDeletingId(sessionId);
    try {
      await deletePortalSession(sessionId);
      setData(prev => {
        if (!prev) return prev;
        const removed    = prev.sessions.find(s => s.id === sessionId);
        const wasUpcoming = removed ? removed.session_date >= todayStr : false;
        return {
          ...prev,
          sessions: prev.sessions.filter(s => s.id !== sessionId),
          stats: {
            ...prev.stats,
            total_sessions:    prev.stats.total_sessions - 1,
            upcoming_sessions: prev.stats.upcoming_sessions - (wasUpcoming ? 1 : 0),
          },
        };
      });
      setExpanded(null);
    } catch { }
    finally { setDeletingId(null); }
  }

  function handleProfileUpdated(updated: Partial<Consultant>) {
    setData(prev => prev ? { ...prev, consultant: { ...prev.consultant, ...updated } } : prev);
    setShowEditProfile(false);
  }

  async function handleMarkAllRead() {
    await markNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  /* ── Guards ───────────────────────────────────────────────── */
  if (loading) return (
    <div className="dp-loading"><div className="dp-spinner" /><span>Loading your dashboard…</span></div>
  );
  if (!data) return (
    <div className="dp-loading"><span>Could not load dashboard. Please try again.</span></div>
  );

  const { consultant, stats } = data;
  const initials      = consultant.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarColor   = specAvatarColor(consultant.specialty);
  const qualPills     = consultant.qualifications.split(",").map(q => q.trim()).filter(Boolean);
  const langPills     = consultant.languages.split(",").map(l => l.trim()).filter(Boolean);
  const upcomingCount = data.sessions.filter(s => s.session_date >= todayStr).length;
  const pastCount     = data.sessions.filter(s => s.session_date <  todayStr).length;
  const firstName     = consultant.name.split(" ").slice(1).join(" ") || consultant.name;

  const PAGE: Record<Tab, { title: string; sub: string }> = {
    sessions: { title: "My Sessions",  sub: "Manage your channelling schedule and patient appointments" },
    profile:  { title: "My Profile",   sub: "View and update your professional details" },
  };

  return (
    <div className="dp-portal-layout">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="dp-sidebar">
        <div className="dp-sidebar-logo">
          <div className="dp-sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <div className="dp-sidebar-logo-name">eChannelling</div>
            <div className="dp-sidebar-logo-role">Doctor Portal</div>
          </div>
        </div>

        <nav className="dp-sidebar-nav">
          <span className="dp-sidebar-nav-section">Navigation</span>
          <DpNavItem tab="sessions" active={tab} onClick={setTab} icon={<CalIcon />}    label="Sessions"   />
          <DpNavItem tab="profile"  active={tab} onClick={setTab} icon={<PersonIcon />} label="My Profile" />
        </nav>

        <div className="dp-sidebar-footer">
          <div className="dp-sidebar-footer-avatar" style={{ background: avatarColor }}>{initials}</div>
          <div className="dp-sidebar-footer-info">
            <span className="dp-sidebar-footer-name">{consultant.name}</span>
            <span className="dp-sidebar-footer-spec">{consultant.specialty}</span>
          </div>
          <button className="dp-sidebar-signout" onClick={logout} title="Sign out" aria-label="Sign out">
            <SignOutIcon />
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="dp-main">

        {/* Topbar */}
        <header className="dp-main-topbar">
          <div>
            <h1 className="dp-main-title">{PAGE[tab].title}</h1>
            <p className="dp-main-sub">{PAGE[tab].sub}</p>
          </div>

          <div className="dp-topbar-right">
            <span className="dp-main-date">
              {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>

            {/* Notification bell */}
            <div className="dp-notif-wrap">
              <button
                ref={notifBtnRef}
                className={`dp-notif-btn${notifOpen ? " open" : ""}`}
                onClick={() => setNotifOpen(v => !v)}
                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="dp-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Notification panel */}
        {notifOpen && (
          <div className="dp-notif-panel" ref={notifPanelRef}>
            <div className="dp-notif-panel-header">
              <span className="dp-notif-panel-title">
                Notifications
                {unreadCount > 0 && <span className="dp-notif-count-pill">{unreadCount} new</span>}
              </span>
              {unreadCount > 0 && (
                <button className="dp-notif-read-all" onClick={handleMarkAllRead}>Mark all read</button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="dp-notif-empty">
                <BellIcon />
                <span>No notifications yet</span>
                <span className="dp-notif-empty-sub">You'll be notified when patients book your sessions</span>
              </div>
            ) : (
              <div className="dp-notif-list">
                {notifications.map(n => (
                  <div key={n.id} className={`dp-notif-item${n.is_read ? "" : " unread"}`}>
                    <div className="dp-notif-dot" />
                    <div className="dp-notif-item-body">
                      <span className="dp-notif-msg">{n.message}</span>
                      <span className="dp-notif-time">{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Sessions tab ─────────────────────────────────── */}
        {tab === "sessions" && (
          <div className="dp-content">

            {/* Big greeting */}
            <div className="dp-greeting-hero">
              <div className="dp-greeting-hero-text">
                <span className="dp-greeting-hero-label">{greeting()},</span>
                <span className="dp-greeting-hero-name">Dr. {firstName}</span>
              </div>
              <span className="dp-greeting-hero-sub">
                {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>

            {/* Next booked session highlight */}
            {nextBookedSession && (
              <NextSessionCard
                session={nextBookedSession}
                onView={() => {
                  setFilter("upcoming");
                  setExpanded(nextBookedSession.id);
                  setTimeout(() => {
                    document.getElementById(`dp-session-${nextBookedSession.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 80);
                }}
              />
            )}

            {/* KPI stats */}
            <div className="dp-stats">
              {([
                { label: "Total Sessions",    val: stats.total_sessions,       icon: <CalIcon />,   color: "#2563eb" },
                { label: "Total Bookings",    val: stats.total_bookings,       icon: <BookIcon />,  color: "#0096D6" },
                { label: "Upcoming Sessions", val: stats.upcoming_sessions,    icon: <ClockIcon />, color: "#10b981" },
                { label: "Total Revenue",     val: fmtRs(stats.total_revenue), icon: <FeeIcon />,   color: "#f7941d" },
              ] as const).map(({ label, val, icon, color }, i) => (
                <motion.div
                  key={label}
                  className="dp-stat-card"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.06 }}
                >
                  <div className="dp-stat-icon" style={{ color, background: `${color}18` }}>{icon}</div>
                  <div className="dp-stat-body">
                    <div className="dp-stat-val">{val}</div>
                    <div className="dp-stat-label">{label}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Sessions panel */}
            <div className="dp-sessions-panel">
              <div className="dp-sp-header">
                <h2 className="dp-sp-title">Sessions &amp; Patients</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="dp-sp-tabs">
                    <button className={`dp-sp-tab${filter === "upcoming" ? " active" : ""}`} onClick={() => setFilter("upcoming")}>Upcoming ({upcomingCount})</button>
                    <button className={`dp-sp-tab${filter === "past"     ? " active" : ""}`} onClick={() => setFilter("past")}>Past ({pastCount})</button>
                    <button className={`dp-sp-tab${filter === "all"      ? " active" : ""}`} onClick={() => setFilter("all")}>All ({data.sessions.length})</button>
                  </div>
                  <button className="dp-add-session-btn" onClick={() => setShowAddSession(true)}>
                    <PlusIcon /> Add Session
                  </button>
                </div>
              </div>

              {sessions.length === 0 ? (
                <div className="dp-sp-empty">No sessions in this category.</div>
              ) : (
                <div className="dp-sp-list">
                  {sessions.map(s => {
                    const pct     = fillPct(s);
                    const color   = sessionColor(s);
                    const isOpen  = expanded === s.id;
                    const isToday = s.session_date === todayStr;
                    const isPast  = s.session_date < todayStr;
                    const dateObj = new Date(s.session_date + "T00:00:00");
                    const statusLabel = s.available_slots === 0 ? "Full" : pct >= 70 ? "Filling" : "Available";

                    return (
                      <div
                        key={s.id}
                        id={`dp-session-${s.id}`}
                        className={`dp-sp-item${isOpen ? " open" : ""}${isToday ? " today" : ""}${isPast ? " past" : ""}`}
                      >
                        <div className="dp-sp-row" onClick={() => setExpanded(isOpen ? null : s.id)}>
                          <div className="dp-sp-date-badge">
                            {isToday && <span className="dp-today-tag">TODAY</span>}
                            <span className="dp-sp-day-name">{dateObj.toLocaleDateString("en-US", { weekday: "short" })}</span>
                            <span className="dp-sp-day-num">{dateObj.getDate()}</span>
                            <span className="dp-sp-month">{dateObj.toLocaleDateString("en-US", { month: "short" })}</span>
                          </div>
                          <div className="dp-sp-info">
                            <div className="dp-sp-time">{s.start_time} – {s.end_time}</div>
                            <div className="dp-sp-slots">{s.booked_slots}/{s.total_slots} slots booked</div>
                          </div>
                          <div className="dp-sp-bar-wrap">
                            <div className="dp-sp-bar">
                              <div className="dp-sp-bar-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <span className="dp-sp-pct">{pct}%</span>
                          </div>
                          <span className="dp-sp-badge" style={{ color, background: `${color}1a`, borderColor: `${color}40` }}>{statusLabel}</span>
                          <span className={`dp-sp-chevron${isOpen ? " up" : ""}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </span>
                        </div>

                        {isOpen && s.patients.length === 0 && (
                          <div className="dp-sp-no-patients">
                            <span>No bookings for this session yet.</span>
                            {!isPast && (
                              <button className="dp-del-session-btn" onClick={() => handleSessionDelete(s.id)} disabled={deletingId === s.id}>
                                {deletingId === s.id ? "Deleting…" : <><TrashIcon /> Delete Session</>}
                              </button>
                            )}
                          </div>
                        )}

                        {isOpen && s.patients.length > 0 && (
                          <div className="dp-patient-table-wrap">
                            <table className="dp-patient-table">
                              <thead>
                                <tr><th>No.</th><th>Patient</th><th>Phone</th><th>Reference</th><th>Fee Paid</th></tr>
                              </thead>
                              <tbody>
                                {s.patients.map(p => (
                                  <tr key={p.appointment_number}>
                                    <td><span className="dp-appt-num">#{p.appointment_number}</span></td>
                                    <td className="dp-patient-name">{p.patient_name}</td>
                                    <td className="dp-patient-phone">{p.patient_phone}</td>
                                    <td><span className="dp-ref">{p.reference}</span></td>
                                    <td className="dp-amount">{fmtRs(p.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Profile tab ──────────────────────────────────── */}
        {tab === "profile" && (
          <div className="dp-content">
            <div className="dp-profile-hero">
              <div
                className="dp-profile-hero-avatar"
                style={{ background: avatarColor, boxShadow: `0 0 0 4px rgba(255,255,255,.18), 0 0 0 8px rgba(255,255,255,.07), 0 12px 36px rgba(0,0,0,.28)` }}
              >
                {initials}
              </div>
              <div className="dp-profile-hero-info">
                <span className="dp-profile-hero-spec">{consultant.specialty}</span>
                <h2 className="dp-profile-hero-name">{consultant.name}</h2>
                <div className="dp-profile-hero-quals">
                  {qualPills.map(q => <span key={q} className="dp-profile-qual-pill">{q}</span>)}
                </div>
                <div className="dp-profile-hero-meta">
                  <span className="dp-profile-hero-badge"><HospIcon />{consultant.hospital}, {consultant.city}</span>
                  <span className="dp-profile-hero-badge"><ExpIcon />{consultant.years_experience} yrs experience</span>
                  <span className="dp-profile-hero-badge"><LangIcon />{consultant.languages}</span>
                </div>
              </div>
              <button className="dp-edit-profile-btn" onClick={() => setShowEditProfile(true)}>
                <EditIcon /> Edit Profile
              </button>
            </div>

            <div className="dp-profile-grid">
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><LockIcon />Specialty</div>
                <div className="dp-pic-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="dp-pic-spec-badge" style={{ background: `${avatarColor}18`, color: avatarColor, borderColor: `${avatarColor}30` }}>{consultant.specialty}</span>
                  <span className="dp-pic-admin-note">Admin managed</span>
                </div>
              </div>
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><EmailIcon />Contact Email</div>
                <div className="dp-pic-value dp-pic-mono">{consultant.email}</div>
                <div className="dp-pic-caption">Your Google account — used to sign in</div>
              </div>
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><HospIcon />Hospital</div>
                <div className="dp-pic-value">{consultant.hospital}</div>
                <div className="dp-pic-caption dp-pic-admin">{consultant.city} · Admin managed</div>
              </div>
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><FeeIcon />Consultation Fee</div>
                <div className="dp-pic-value dp-pic-fee">{fmtRs(consultant.consultation_fee)}</div>
                <div className="dp-pic-caption">Per appointment</div>
              </div>
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><ExpIcon />Experience</div>
                <div className="dp-pic-value"><span className="dp-pic-big">{consultant.years_experience}</span> yrs</div>
              </div>
              <div className="dp-profile-info-card">
                <div className="dp-pic-label"><LangIcon />Languages</div>
                <div className="dp-pic-chips">
                  {langPills.map(l => <span key={l} className="dp-pic-chip">{l}</span>)}
                </div>
              </div>
              <div className="dp-profile-info-card dp-pic-wide">
                <div className="dp-pic-label"><QualIcon />Qualifications</div>
                <div className="dp-pic-chips">
                  {qualPills.map(q => <span key={q} className="dp-pic-chip">{q}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ───────────────────────────────────────────── */}
      {showAddSession && (
        <AddSessionModal onClose={() => setShowAddSession(false)} onSuccess={handleSessionCreated} />
      )}
      {showEditProfile && (
        <EditProfileModal consultant={consultant} onClose={() => setShowEditProfile(false)} onSuccess={handleProfileUpdated} />
      )}
    </div>
  );
}

/* ── Sidebar nav item ──────────────────────────────────────── */
function DpNavItem({ tab, active, onClick, icon, label }: {
  tab: Tab; active: Tab; onClick: (t: Tab) => void;
  icon: React.ReactNode; label: string;
}) {
  return (
    <button
      className={`dp-sidebar-nav-item${active === tab ? " active" : ""}`}
      onClick={() => onClick(tab)}
      aria-current={active === tab ? "page" : undefined}
    >
      {icon}<span>{label}</span>
    </button>
  );
}

/* ── Next Booked Session highlight card ────────────────────── */
function NextSessionCard({ session: s, onView }: { session: PortalSession; onView: () => void }) {
  const dateObj = new Date(s.session_date + "T00:00:00");
  const isToday = s.session_date === todayStr;
  const pct     = fillPct(s);
  const color   = sessionColor(s);
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = dateObj.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const firstPt = s.patients[0];
  const circumference = 2 * Math.PI * 18;

  return (
    <motion.div
      className="dp-next-session-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.06 }}
    >
      <div className="dp-nsc-left">
        <div className="dp-nsc-eyebrow">
          <span className="dp-nsc-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 12, height: 12, flexShrink: 0 }}>
              <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
            </svg>
            Nearest Upcoming Session
          </span>
          {isToday && <span className="dp-nsc-today-badge">Today</span>}
        </div>
        <div className="dp-nsc-date">{dayName}, {dateStr}</div>
        <div className="dp-nsc-time">{s.start_time} – {s.end_time}</div>
        <div className="dp-nsc-patients">
          <span className="dp-nsc-pat-count" style={{ color }}>
            {s.booked_slots} patient{s.booked_slots !== 1 ? "s" : ""} booked
          </span>
          {firstPt && (
            <span className="dp-nsc-pat-name">
              &nbsp;— next up: <strong>{firstPt.patient_name}</strong> (appt #{firstPt.appointment_number})
            </span>
          )}
        </div>
      </div>

      <div className="dp-nsc-right">
        <div className="dp-nsc-ring-wrap">
          <svg viewBox="0 0 44 44" className="dp-nsc-ring">
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="4" />
            <circle
              cx="22" cy="22" r="18" fill="none"
              stroke={color} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - pct / 100)}`}
              style={{ transition: "stroke-dashoffset .5s ease", transform: "rotate(-90deg)", transformOrigin: "center" }}
            />
          </svg>
          <span className="dp-nsc-ring-pct" style={{ color }}>{pct}%</span>
        </div>
        <span className="dp-nsc-ring-label">{s.booked_slots}/{s.total_slots} slots</span>
        <button className="dp-nsc-view-btn" onClick={onView}>View Session</button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT PROFILE MODAL
═══════════════════════════════════════════════════════════════ */
function ChipGroup({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div className="dp-chip-group">
      {options.map(opt => (
        <button
          key={opt} type="button"
          className={`dp-chip-opt${selected.includes(opt) ? " on" : ""}`}
          onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function EditProfileModal({ consultant, onClose, onSuccess }: {
  consultant: Consultant; onClose: () => void; onSuccess: (updated: Partial<Consultant>) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name:             consultant.name,
    qualifications:   consultant.qualifications.split(",").map(q => q.trim()).filter(Boolean),
    years_experience: String(consultant.years_experience),
    consultation_fee: String(consultant.consultation_fee),
    languages:        consultant.languages.split(",").map(l => l.trim()).filter(Boolean),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function setField(f: string, v: string)  { setForm(p => ({ ...p, [f]: v })); setErrors(e => ({ ...e, [f]: "" })); setApiError(""); }
  function setChips(f: string, v: string[]) { setForm(p => ({ ...p, [f]: v })); setErrors(e => ({ ...e, [f]: "" })); setApiError(""); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())               e.name             = "Name is required";
    if (form.qualifications.length === 0) e.qualifications  = "Select at least one qualification";
    if (!form.years_experience)          e.years_experience = "Required";
    else if (Number(form.years_experience) < 0) e.years_experience = "Must be ≥ 0";
    if (!form.consultation_fee)          e.consultation_fee = "Required";
    else if (Number(form.consultation_fee) <= 0) e.consultation_fee = "Must be > 0";
    if (form.languages.length === 0)     e.languages        = "Select at least one language";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const result = await updatePortalProfile({
        name: form.name.trim(), qualifications: form.qualifications.join(", "),
        years_experience: Number(form.years_experience), consultation_fee: Number(form.consultation_fee),
        languages: form.languages.join(", "),
      });
      onSuccess(result);
    } catch (err: any) {
      setApiError(err?.message?.replace(/^\d+\s*/, "") || "Failed to update profile. Please try again.");
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="dp-edit-modal">
        <div className="dp-sm-header">
          <div className="dp-sm-header-left">
            <div className="dp-sm-icon"><EditIcon /></div>
            <div><div className="dp-sm-title">Edit Profile</div><div className="dp-sm-subtitle">Update your professional details</div></div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form className="dp-edit-form" onSubmit={handleSubmit} noValidate>
          <div className="dp-sm-field">
            <label className="dp-sm-label">Full Name <span className="dp-sm-req">*</span></label>
            <input className={`dp-sm-input${errors.name ? " error" : ""}`} value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Dr. Anura Perera" />
            {errors.name && <span className="dp-sm-err">{errors.name}</span>}
          </div>
          <div className="dp-sm-row">
            <div className="dp-sm-field">
              <label className="dp-sm-label">Years of Experience <span className="dp-sm-req">*</span></label>
              <input className={`dp-sm-input${errors.years_experience ? " error" : ""}`} type="number" min="0" max="60" value={form.years_experience} onChange={e => setField("years_experience", e.target.value)} />
              {errors.years_experience && <span className="dp-sm-err">{errors.years_experience}</span>}
            </div>
            <div className="dp-sm-field">
              <label className="dp-sm-label">Consultation Fee (Rs) <span className="dp-sm-req">*</span></label>
              <input className={`dp-sm-input${errors.consultation_fee ? " error" : ""}`} type="number" min="1" value={form.consultation_fee} onChange={e => setField("consultation_fee", e.target.value)} />
              {errors.consultation_fee && <span className="dp-sm-err">{errors.consultation_fee}</span>}
            </div>
          </div>
          <div className="dp-sm-field">
            <label className="dp-sm-label">Languages <span className="dp-sm-req">*</span></label>
            <ChipGroup options={LANG_OPTIONS} selected={form.languages} onChange={v => setChips("languages", v)} />
            {errors.languages && <span className="dp-sm-err">{errors.languages}</span>}
          </div>
          <div className="dp-sm-field">
            <label className="dp-sm-label">Qualifications <span className="dp-sm-req">*</span></label>
            <ChipGroup options={QUAL_OPTIONS} selected={form.qualifications} onChange={v => setChips("qualifications", v)} />
            {errors.qualifications && <span className="dp-sm-err">{errors.qualifications}</span>}
          </div>
          {apiError && (
            <div className="dp-sm-api-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {apiError}
            </div>
          )}
          <div className="dp-sm-actions">
            <button type="button" className="dp-sm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="dp-sm-submit" disabled={saving}>
              {saving ? <><div className="dp-sm-spinner" /> Saving…</> : <><EditIcon /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD SESSION MODAL
═══════════════════════════════════════════════════════════════ */
const BLANK_SESSION = { session_date: "", start_time: "", end_time: "", total_slots: "20" };

function AddSessionModal({ onClose, onSuccess }: {
  onClose: () => void; onSuccess: (s: PortalSession) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [form, setForm]     = useState(BLANK_SESSION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
    setApiError("");
  }
  function validate() {
    const e: Record<string, string> = {};
    if (!form.session_date) e.session_date = "Date is required";
    else if (form.session_date < todayStr) e.session_date = "Date cannot be in the past";
    if (!form.start_time)   e.start_time   = "Start time is required";
    if (!form.end_time)     e.end_time     = "End time is required";
    else if (form.start_time && form.end_time <= form.start_time) e.end_time = "End time must be after start time";
    const slots = Number(form.total_slots);
    if (!form.total_slots)  e.total_slots  = "Required";
    else if (slots < 1 || slots > 100) e.total_slots = "Must be between 1 and 100";
    return e;
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const result = await createPortalSession({
        session_date: form.session_date, start_time: form.start_time,
        end_time: form.end_time, total_slots: Number(form.total_slots),
      });
      onSuccess(result);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("409")) setErrors(prev => ({ ...prev, start_time: "A session already exists at this date and time" }));
      else if (msg.toLowerCase().includes("past")) setErrors(prev => ({ ...prev, session_date: "Session date cannot be in the past" }));
      else setApiError("Failed to create session. Please try again.");
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="dp-session-modal">
        <div className="dp-sm-header">
          <div className="dp-sm-header-left">
            <div className="dp-sm-icon"><CalIcon /></div>
            <div><div className="dp-sm-title">Add New Session</div><div className="dp-sm-subtitle">Schedule a new channelling session</div></div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form className="dp-sm-form" onSubmit={handleSubmit} noValidate>
          <div className="dp-sm-field">
            <label className="dp-sm-label">Session Date <span className="dp-sm-req">*</span></label>
            <input className={`dp-sm-input${errors.session_date ? " error" : ""}`} type="date" min={todayStr} value={form.session_date} onChange={e => set("session_date", e.target.value)} />
            {errors.session_date && <span className="dp-sm-err">{errors.session_date}</span>}
          </div>
          <div className="dp-sm-row">
            <div className="dp-sm-field">
              <label className="dp-sm-label">Start Time <span className="dp-sm-req">*</span></label>
              <input className={`dp-sm-input${errors.start_time ? " error" : ""}`} type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
              {errors.start_time && <span className="dp-sm-err">{errors.start_time}</span>}
            </div>
            <div className="dp-sm-field">
              <label className="dp-sm-label">End Time <span className="dp-sm-req">*</span></label>
              <input className={`dp-sm-input${errors.end_time ? " error" : ""}`} type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
              {errors.end_time && <span className="dp-sm-err">{errors.end_time}</span>}
            </div>
          </div>
          <div className="dp-sm-field">
            <label className="dp-sm-label">
              Total Appointment Slots <span className="dp-sm-req">*</span>
              <span className="dp-sm-hint">Max patients per session (1–100)</span>
            </label>
            <input className={`dp-sm-input${errors.total_slots ? " error" : ""}`} type="number" min="1" max="100" value={form.total_slots} onChange={e => set("total_slots", e.target.value)} />
            {errors.total_slots && <span className="dp-sm-err">{errors.total_slots}</span>}
          </div>
          {apiError && (
            <div className="dp-sm-api-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {apiError}
            </div>
          )}
          <div className="dp-sm-actions">
            <button type="button" className="dp-sm-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="dp-sm-submit" disabled={saving}>
              {saving ? <><div className="dp-sm-spinner" /> Creating…</> : <><CalIcon /> Add Session</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ── Icons ─────────────────────────────────────────────────── */
const I = (d: string, w = 2) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
    strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: d }} />
);
function HospIcon()    { return I('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'); }
function LangIcon()    { return I('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'); }
function CalIcon()     { return I('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'); }
function BookIcon()    { return I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'); }
function ClockIcon()   { return I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function FeeIcon()     { return I('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'); }
function ExpIcon()     { return I('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>'); }
function PersonIcon()  { return I('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'); }
function PlusIcon()    { return I('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 2.5); }
function TrashIcon()   { return I('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'); }
function EditIcon()    { return I('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'); }
function SignOutIcon() { return I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'); }
function EmailIcon()   { return I('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>'); }
function QualIcon()    { return I('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'); }
function LockIcon()    { return I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'); }
function BellIcon()    { return I('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'); }
