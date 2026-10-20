import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getBookings, getGaps, getHealth, getLabBookings, getStats } from "../api";
import { useAuth } from "../context/AuthContext";
import DoctorsPage from "./DoctorsPage";

interface Stats {
  consultants: number;
  hospitals: number;
  sessions: number;
  bookings: number;
  lab_bookings?: number;
  kb_chunks: number;
  messages_logged: number;
}

interface LabBooking {
  reference: string;
  patient: string;
  phone: string;
  tests: { code: string; name: string; price: number }[];
  total: number;
  status: string;
  created_at: string;
}

interface Booking {
  reference: string;
  patient: string;
  doctor: string;
  date: string;
  appointment_number: number;
  amount: number;
  status: string;
}

interface Gap {
  id: number;
  query: string;
  session_key: string;
  at: string;
}

type Tab = "home" | "bookings" | "lab-bookings" | "gaps" | "doctors";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [labBookings, setLabBookings] = useState<LabBooking[]>([]);
  const [gaps, setGaps]               = useState<Gap[]>([]);
  const [health, setHealth]         = useState<any>(null);
  const [activeTab, setActiveTab]   = useState<Tab>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function refresh() {
    getStats().then(setStats).catch(() => {});
    getBookings().then(setBookings).catch(() => {});
    getLabBookings().then(setLabBookings).catch(() => {});
    getGaps().then(setGaps).catch(() => {});
    getHealth().then(setHealth).catch(() => {});
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  return (
    <div className="admin-layout">

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar${sidebarOpen ? "" : " collapsed"}`}>

        {/* Toggle tab — rides on right edge, always visible */}
        <button
          className="admin-sb-toggle"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          }
        </button>

        {/* Logo */}
        <div className="admin-logo">
          <div className="admin-logo-text">
            <span className="admin-logo-name">eChannelling<span className="admin-logo-ai">AI</span></span>
            <span className="admin-logo-role">Admin Panel</span>
          </div>
        </div>

        {/* Profile card */}
        <div className="admin-sb-profile">
          {user?.picture
            ? <img src={user.picture} alt={user?.name ?? ''} className="admin-sb-avatar" referrerPolicy="no-referrer" />
            : <div className="admin-sb-avatar admin-sb-avatar-fb">{user?.name?.[0]?.toUpperCase() ?? 'A'}</div>
          }
          <div className="admin-sb-name">{user?.name}</div>
          <div className="admin-sb-email">{user?.email}</div>
          <span className="admin-sb-role-pill"><ShieldIcon /> Administrator</span>
        </div>

        {/* Nav */}
        <nav className="admin-nav">
          <span className="admin-nav-section">Navigation</span>
          <NavItem tab="home"     active={activeTab} onClick={setActiveTab} icon={<HomeIcon />}   label="Home" />

          <span className="admin-nav-section">Data</span>
          <NavItem tab="doctors"  active={activeTab} onClick={setActiveTab} icon={<DoctorIcon />} label="Doctors"
            badge={stats?.consultants ? String(stats.consultants) : undefined} />
          <NavItem tab="bookings" active={activeTab} onClick={setActiveTab} icon={<BookIcon />}   label="Bookings"
            badge={bookings.length > 0 ? String(bookings.length) : undefined} />
          <NavItem tab="lab-bookings" active={activeTab} onClick={setActiveTab} icon={<LabIcon />} label="Lab Bookings"
            badge={labBookings.length > 0 ? String(labBookings.length) : undefined} />
          <NavItem tab="gaps"     active={activeTab} onClick={setActiveTab} icon={<AlertIcon />}  label="Knowledge Gaps"
            badge={gaps.length > 0 ? String(gaps.length) : undefined} badgeWarn />
        </nav>

        {/* Sign out */}
        <div className="admin-sb-footer">
          <button className="admin-sb-signout" onClick={logout} aria-label="Sign out">
            <SignOutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={`admin-main${sidebarOpen ? " sidebar-open" : " sidebar-closed"}`}>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="admin-content"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >

            {/* ── HOME ── */}
            {activeTab === "home" && (
              <>
                {/* Hero section */}
                <section className="admin-hero">
                  <div className="admin-hero-orb admin-hero-orb-1" />
                  <div className="admin-hero-orb admin-hero-orb-2" />
                  <div className="admin-hero-orb admin-hero-orb-3" />

                  <div className="admin-hero-inner">
                    <motion.div
                      className="admin-hero-text"
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <span className="admin-hero-eyebrow">
                        <ShieldIcon /> Administrator Dashboard
                      </span>
                      <h1 className="admin-hero-heading">
                        {greeting()},<br />{user?.name?.split(" ")[0] ?? "Admin"}
                      </h1>
                      <p className="admin-hero-sub">
                        Your command centre for eChannelling AI — monitor bookings, manage doctors and keep the knowledge base sharp.
                      </p>

                      <div className="admin-hero-stats">
                        <div className="admin-hero-stat">
                          <span className="admin-hero-stat-val">{stats?.consultants ?? "—"}</span>
                          <span className="admin-hero-stat-label">Doctors</span>
                        </div>
                        <div className="admin-hero-stat-divider" />
                        <div className="admin-hero-stat">
                          <span className="admin-hero-stat-val">{stats?.sessions ?? "—"}</span>
                          <span className="admin-hero-stat-label">Sessions</span>
                        </div>
                        <div className="admin-hero-stat-divider" />
                        <div className="admin-hero-stat">
                          <span className="admin-hero-stat-val">{stats?.bookings ?? "—"}</span>
                          <span className="admin-hero-stat-label">Bookings</span>
                        </div>
                      </div>

                      <div className="admin-hero-trust">
                        <span className="admin-hero-trust-item">
                          <span className={`admin-dot ${health?.status === "ok" ? "ok" : "warn"}`} />
                          {health?.status === "ok" ? "All systems operational" : "System degraded"}
                        </span>
                        <span className="admin-hero-trust-item">
                          <CheckIcon />
                          {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="admin-hero-mascot-wrap"
                      initial={{ opacity: 0, scale: 0.88, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                    >
                      <img src="/admin-mascot.png" alt="Admin AI" className="admin-hero-mascot" draggable="false" />
                    </motion.div>
                  </div>
                </section>

                {/* KPI cards */}
                <div className="admin-kpi-grid">
                  {([
                    { value: stats?.consultants,     label: "Doctors",         icon: <DoctorIcon />,   accent: "blue"   },
                    { value: stats?.hospitals,       label: "Hospitals",       icon: <HospitalIcon />, accent: "navy"   },
                    { value: stats?.sessions,        label: "Sessions",        icon: <CalIcon />,      accent: "green"  },
                    { value: stats?.bookings,        label: "Bookings",        icon: <TicketIcon />,   accent: "orange" },
                    { value: stats?.lab_bookings,    label: "Lab Bookings",    icon: <LabIcon />,      accent: "purple" },
                    { value: stats?.kb_chunks,       label: "KB Chunks",       icon: <KbIcon />,       accent: "blue"   },
                    { value: stats?.messages_logged, label: "Messages Logged", icon: <ChatIcon />,     accent: "navy"   },
                  ] as const).map((k, i) => (
                    <motion.div
                      key={k.label}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.06 }}
                    >
                      <KpiCard value={k.value} label={k.label} icon={k.icon} accent={k.accent} />
                    </motion.div>
                  ))}
                </div>

                {/* Lower two-col */}
                <div className="admin-home-grid">

                  {/* Recent bookings */}
                  <div className="admin-home-card">
                    <div className="admin-home-card-head">
                      <h3 className="admin-section-title">Recent Bookings</h3>
                      <button className="admin-link-btn" onClick={() => setActiveTab("bookings")}>
                        View all <ChevronRightIcon />
                      </button>
                    </div>
                    {bookings.length === 0
                      ? <p className="admin-home-empty">No bookings yet.</p>
                      : (
                        <div className="admin-mini-table-wrap">
                          <table className="admin-mini-table">
                            <thead>
                              <tr>
                                <th>Reference</th>
                                <th>Patient</th>
                                <th>Date</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookings.slice(0, 5).map(b => (
                                <tr key={b.reference}>
                                  <td><code className="admin-ref">{b.reference}</code></td>
                                  <td>{b.patient}</td>
                                  <td>{fmtDate(b.date)}</td>
                                  <td>
                                    <span className={`admin-status-badge status-${b.status.toLowerCase()}`}>
                                      {b.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    }
                  </div>

                  {/* Right column */}
                  <div className="admin-home-right">

                    {/* System health */}
                    <div className="admin-home-card">
                      <h3 className="admin-section-title">System Health</h3>
                      {health ? (
                        <div className="admin-health-list">
                          <HealthRow ok={health.postgres}           label="PostgreSQL" />
                          <HealthRow ok={health.pgvector}           label="pgvector extension" />
                          <HealthRow ok={health.openai_key_present} label="OpenAI API key" />
                          <HealthRow ok={true}                      label={`Model: ${health.chat_model}`} />
                        </div>
                      ) : (
                        <p className="admin-home-empty">Loading…</p>
                      )}
                    </div>

                    {/* Recent gaps */}
                    <div className="admin-home-card">
                      <div className="admin-home-card-head">
                        <h3 className="admin-section-title">Recent KB Gaps</h3>
                        <button className="admin-link-btn" onClick={() => setActiveTab("gaps")}>
                          View all <ChevronRightIcon />
                        </button>
                      </div>
                      {gaps.length === 0
                        ? <p className="admin-home-empty">No knowledge gaps yet.</p>
                        : (
                          <div className="admin-gap-mini-list">
                            {gaps.slice(0, 4).map((g, i) => (
                              <motion.div
                                key={g.id}
                                className="admin-gap-mini-item"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25, delay: i * 0.05 }}
                              >
                                <div className="admin-gap-mini-query">"{g.query}"</div>
                                <div className="admin-gap-mini-time">
                                  {new Date(g.at).toLocaleString("en-LK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )
                      }
                    </div>

                  </div>
                </div>
              </>
            )}

            {/* ── DOCTORS ── */}
            {activeTab === "doctors" && <DoctorsPage />}

            {/* ── BOOKINGS ── */}
            {activeTab === "bookings" && (
              bookings.length === 0
                ? <EmptyState text="No bookings yet." />
                : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Date</th>
                          <th>Appt #</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map(b => (
                          <tr key={b.reference}>
                            <td><code className="admin-ref">{b.reference}</code></td>
                            <td>{b.patient}</td>
                            <td>{b.doctor}</td>
                            <td>{fmtDate(b.date)}</td>
                            <td className="admin-center">{b.appointment_number}</td>
                            <td>Rs {b.amount.toLocaleString()}</td>
                            <td>
                              <span className={`admin-status-badge status-${b.status.toLowerCase()}`}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ── LAB BOOKINGS ── */}
            {activeTab === "lab-bookings" && (
              labBookings.length === 0
                ? <EmptyState text="No lab test bookings yet." />
                : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Patient</th>
                          <th>Phone</th>
                          <th>Tests</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labBookings.map(b => (
                          <tr key={b.reference}>
                            <td><code className="admin-ref">{b.reference}</code></td>
                            <td>{b.patient}</td>
                            <td>{b.phone}</td>
                            <td>
                              <div className="admin-lab-tests">
                                {b.tests.map(t => (
                                  <span key={t.code} className="admin-lab-test-chip">{t.code}</span>
                                ))}
                              </div>
                            </td>
                            <td>Rs {b.total.toLocaleString()}</td>
                            <td>
                              <span className={`admin-status-badge status-${b.status.toLowerCase()}`}>
                                {b.status}
                              </span>
                            </td>
                            <td>{new Date(b.created_at).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ── KNOWLEDGE GAPS ── */}
            {activeTab === "gaps" && (
              gaps.length === 0
                ? <EmptyState text="No knowledge gaps recorded yet." />
                : (
                  <div className="admin-gaps-list">
                    {gaps.map((g, i) => (
                      <motion.div
                        key={g.id}
                        className="admin-gap-item"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                      >
                        <div className="admin-gap-query">"{g.query}"</div>
                        <div className="admin-gap-meta">
                          <span>Session: {g.session_key}</span>
                          <span>{new Date(g.at).toLocaleString("en-LK")}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ── Sub-components ── */

function NavItem({ tab, active, onClick, icon, label, badge, badgeWarn }: {
  tab: Tab; active: Tab; onClick: (t: Tab) => void;
  icon: React.ReactNode; label: string;
  badge?: string; badgeWarn?: boolean;
}) {
  return (
    <button
      className={`admin-nav-item${active === tab ? " active" : ""}`}
      onClick={() => onClick(tab)}
      aria-current={active === tab ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {badge && <span className={`admin-nav-badge${badgeWarn ? " warn" : ""}`}>{badge}</span>}
    </button>
  );
}

function KpiCard({ value, label, icon, accent }: {
  value: any; label: string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className={`admin-kpi-card kpi-${accent}`}>
      <div className="admin-kpi-icon">{icon}</div>
      <div className="admin-kpi-body">
        <div className="admin-kpi-value">{value ?? "—"}</div>
        <div className="admin-kpi-label">{label}</div>
      </div>
    </div>
  );
}

function HealthRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="admin-health-row">
      <span className={`admin-dot ${ok ? "ok" : "error"}`} />
      <span>{label}</span>
      <span className={`admin-health-status ${ok ? "ok" : "error"}`}>
        {ok ? "OK" : "Issue"}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

/* ── Icons ── */
function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function BookIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/></svg>;
}
function AlertIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function SignOutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function ChevronRightIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function DoctorIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function HospitalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
}
function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function TicketIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>;
}
function KbIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function RefreshIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.9"/></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function LabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M9 3h6"/>
      <path d="M9 3v8L5 17a2 2 0 0 0 1.75 3h10.5A2 2 0 0 0 19 17l-4-6V3"/>
      <path d="M6.5 17h11"/>
    </svg>
  );
}
