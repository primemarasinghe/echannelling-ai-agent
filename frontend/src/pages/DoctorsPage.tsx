import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { getDoctors, getDoctorDetail, registerDoctor, deleteDoctor, updateDoctor } from "../api";

/* ── Types ─────────────────────────────────────────────────────── */
interface DoctorSummary {
  id: number; name: string; specialty: string; qualifications: string;
  years_experience: number; consultation_fee: number;
  languages: string; hospital: string; city: string;
}
interface Seat { number: number; patient_name: string; reference: string; status: string; }
interface SessionDetail {
  id: number; session_date: string; start_time: string; end_time: string;
  total_slots: number; booked_slots: number; available_slots: number; seats: Seat[];
}
interface DoctorDetail extends DoctorSummary {
  hospital_id: number; hospital_address: string; hospital_phone: string; sessions: SessionDetail[];
}

/* ── Specialty colours ──────────────────────────────────────────── */
const SPEC_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Cardiology":       { bg: "#fef2f2", color: "#dc2626", border: "rgba(220,38,38,.18)" },
  "Dermatology":      { bg: "#fffbeb", color: "#d97706", border: "rgba(217,119,6,.18)" },
  "ENT":              { bg: "#f5f3ff", color: "#7c3aed", border: "rgba(124,58,237,.18)" },
  "General Medicine": { bg: "#eff6ff", color: "#2563eb", border: "rgba(37,99,235,.18)" },
  "Gynaecology":      { bg: "#fdf2f8", color: "#c026d3", border: "rgba(192,38,211,.18)" },
  "Neurology":        { bg: "#f0f9ff", color: "#0369a1", border: "rgba(3,105,161,.18)" },
  "Ophthalmology":    { bg: "#f0fdfa", color: "#0d9488", border: "rgba(13,148,136,.18)" },
  "Orthopaedics":     { bg: "#fff7ed", color: "#ea580c", border: "rgba(234,88,12,.18)" },
  "Paediatrics":      { bg: "#f0fdf4", color: "#16a34a", border: "rgba(22,163,74,.18)" },
};
const specStyle = (s: string) => SPEC_COLORS[s] ?? { bg: "#f0f4fb", color: "#003087", border: "rgba(0,48,135,.15)" };

/* Solid colour for avatar backgrounds — always readable with white text */
const SPEC_AVATAR: Record<string, string> = {
  "Cardiology":       "#dc2626",
  "Dermatology":      "#d97706",
  "ENT":              "#7c3aed",
  "General Medicine": "#2563eb",
  "Gynaecology":      "#c026d3",
  "Neurology":        "#0369a1",
  "Ophthalmology":    "#0d9488",
  "Orthopaedics":     "#ea580c",
  "Paediatrics":      "#16a34a",
};
const specAvatarColor = (s: string) => SPEC_AVATAR[s] ?? "#003087";

/* ── Calendar helpers ───────────────────────────────────────────── */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();   // 0=Sun
  const days  = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function sessionDotColor(s: SessionDetail) {
  const pct = s.booked_slots / s.total_slots;
  if (s.available_slots === 0) return "#ef4444";
  if (pct >= 0.7) return "#f7941d";
  return "#10b981";
}

/* ═══════════════════════════════════════════════════════════════
   LIST PAGE
═══════════════════════════════════════════════════════════════ */
export default function DoctorsPage() {
  const [doctors, setDoctors]             = useState<DoctorSummary[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [detail, setDetail]               = useState<DoctorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch]               = useState("");
  const [specialty, setSpecialty]         = useState("");
  const [city, setCity]                   = useState("");
  const [sort, setSort]                   = useState("name");
  const [showRegister, setShowRegister]   = useState(false);

  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function handleDoctorRegistered(newDoctor: DoctorSummary) {
    setDoctors(prev => [...prev, newDoctor].sort((a, b) => a.name.localeCompare(b.name)));
    setShowRegister(false);
  }

  function scrollTop() {
    document.querySelector(".admin-main")?.scrollTo({ top: 0, behavior: "instant" });
  }

  function openDoctor(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    getDoctorDetail(id).then(setDetail).catch(() => {}).finally(() => setDetailLoading(false));
    scrollTop();
  }
  function goBack() { setSelectedId(null); setDetail(null); scrollTop(); }

  function handleDoctorDeleted(id: number) {
    setDoctors(prev => prev.filter(d => d.id !== id));
    goBack();
  }

  function handleDoctorUpdated(updated: Partial<DoctorDetail>) {
    setDetail(prev => prev ? { ...prev, ...updated } : prev);
    setDoctors(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
  }

  const specialties = useMemo(() => Array.from(new Set(doctors.map(d => d.specialty))).sort(), [doctors]);
  const cities       = useMemo(() => Array.from(new Set(doctors.map(d => d.city))).sort(),      [doctors]);

  const filtered = useMemo(() => {
    let list = doctors.filter(d => {
      const text = `${d.name} ${d.specialty} ${d.hospital} ${d.city} ${d.languages}`.toLowerCase();
      return text.includes(search.toLowerCase())
        && (!specialty || d.specialty === specialty)
        && (!city      || d.city      === city);
    });
    if (sort === "fee_asc")  list = [...list].sort((a, b) => a.consultation_fee - b.consultation_fee);
    if (sort === "fee_desc") list = [...list].sort((a, b) => b.consultation_fee - a.consultation_fee);
    if (sort === "exp")      list = [...list].sort((a, b) => b.years_experience - a.years_experience);
    if (sort === "name")     list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [doctors, search, specialty, city, sort]);

  const hasFilter = !!(search || specialty || city);

  if (loading) return <div className="dr-loading"><div className="dr-spinner" /></div>;

  if (selectedId !== null) {
    return <DoctorDetailView loading={detailLoading} detail={detail} onBack={goBack} onDelete={handleDoctorDeleted} onUpdate={handleDoctorUpdated} />;
  }

  return (
    <div className="dr-list-page">

      {/* ── Filter bar ── */}
      <div className="dr-filter-bar">
        <div className="dr-search-wrap">
          <SearchIcon />
          <input
            className="dr-search" type="search"
            placeholder="Search name, specialty, hospital…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="dr-select-wrap">
          <select className="dr-select" value={specialty} onChange={e => setSpecialty(e.target.value)}>
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="dr-select-wrap">
          <select className="dr-select" value={city} onChange={e => setCity(e.target.value)}>
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="dr-select-wrap">
          <select className="dr-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="fee_asc">Fee: Low first</option>
            <option value="fee_desc">Fee: High first</option>
            <option value="exp">Most Experienced</option>
          </select>
        </div>

        {hasFilter && (
          <button className="dr-clear-btn" onClick={() => { setSearch(""); setSpecialty(""); setCity(""); }}>
            <XIcon /> Clear
          </button>
        )}
      </div>

      {/* ── Result count + register button ── */}
      <div className="dr-result-row">
        <span className="dr-result-count">
          {filtered.length === doctors.length
            ? `Showing all ${doctors.length} consultants`
            : `${filtered.length} of ${doctors.length} consultants`}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dr-result-badge">{filtered.length} results</span>
          <button className="dr-register-btn" onClick={() => setShowRegister(true)}>
            <PlusIcon /> Register Doctor
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="dr-empty">
          <EmptyIcon />
          <p>No doctors match your filters.</p>
        </div>
      ) : (
        <div className="dr-grid">
          {filtered.map((d, i) => (
            <DoctorCard key={d.id} doctor={d} onClick={() => openDoctor(d.id)} index={i} />
          ))}
        </div>
      )}

      {showRegister && (
        <RegisterDoctorModal
          onClose={() => setShowRegister(false)}
          onSuccess={handleDoctorRegistered}
        />
      )}
    </div>
  );
}

/* ── Doctor card ─────────────────────────────────────────────── */
function DoctorCard({ doctor: d, onClick, index = 0 }: { doctor: DoctorSummary; onClick: () => void; index?: number }) {
  const initials     = d.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const st           = specStyle(d.specialty);
  const avatarColor  = specAvatarColor(d.specialty);
  const langList     = d.languages.split(",").map(l => l.trim());
  const feeLabel = d.consultation_fee >= 1000
    ? `${(d.consultation_fee / 1000 % 1 === 0
        ? d.consultation_fee / 1000
        : (d.consultation_fee / 1000).toFixed(1))}k`
    : String(d.consultation_fee);

  return (
    <motion.button
      className="dr-card"
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.045, 0.44), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, boxShadow: "0 20px 48px rgba(0,48,135,.13), 0 4px 16px rgba(0,0,0,.08)" }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Header: avatar + name + specialty */}
      <div className="dr-card-header">
        <div className="dr-card-avatar" style={{ background: avatarColor, color: "#fff", boxShadow: `0 6px 18px ${avatarColor}55` }}>
          {initials}
        </div>
        <div className="dr-card-head">
          <div className="dr-card-name">{d.name}</div>
          <span className="dr-spec-pill" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
            {d.specialty}
          </span>
        </div>
      </div>

      {/* Stats: Experience · Fee · Languages */}
      <div className="dr-card-stats">
        <div className="dr-stat">
          <span className="dr-stat-label">Experience</span>
          <span className="dr-stat-value">{d.years_experience} <span className="dr-stat-unit">yrs</span></span>
        </div>
        <div className="dr-stat">
          <span className="dr-stat-label">Rs Fee</span>
          <span className="dr-stat-value">{feeLabel}</span>
        </div>
        <div className="dr-stat">
          <span className="dr-stat-label">Languages</span>
          <span className="dr-stat-value">{langList.length}</span>
        </div>
      </div>

      {/* Footer: hospital row + CTA */}
      <div className="dr-card-footer-new">
        <div className="dr-card-hosp-row">
          <HospitalIcon /><span>{d.hospital}</span>
          <span className="dr-card-dot" /><span>{d.city}</span>
        </div>
        <div className="dr-card-cta-bar">
          <span>View Profile</span>
          <ChevronRightIcon />
        </div>
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL VIEW  ─  profile + calendar
═══════════════════════════════════════════════════════════════ */
function DoctorDetailView({
  loading, detail, onBack, onDelete, onUpdate,
}: {
  loading: boolean; detail: DoctorDetail | null;
  onBack: () => void; onDelete: (id: number) => void;
  onUpdate: (updated: Partial<DoctorDetail>) => void;
}) {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [modalSession, setModalSession]         = useState<SessionDetail | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [deleteError, setDeleteError]           = useState("");
  const [showEdit, setShowEdit]                 = useState(false);
  const [sessionTab, setSessionTab]             = useState<"upcoming" | "past" | "all">("upcoming");

  /* Must be before any conditional return */
  const sessionMap = useMemo(
    () => new Map((detail?.sessions ?? []).map(s => [s.session_date, s])),
    [detail?.sessions]
  );

  if (loading || !detail) {
    return <div className="dr-loading"><div className="dr-spinner" /></div>;
  }

  const initials    = detail.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const st          = specStyle(detail.specialty);
  const heroAvatar  = specAvatarColor(detail.specialty);
  const qualPills   = detail.qualifications.split(",").map(q => q.trim()).filter(Boolean);

  /* Overall stats */
  const totalSlots  = detail.sessions.reduce((a, s) => a + s.total_slots, 0);
  const totalBooked = detail.sessions.reduce((a, s) => a + s.booked_slots, 0);
  const totalAvail  = detail.sessions.reduce((a, s) => a + s.available_slots, 0);
  const overallPct  = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;

  const todayStr         = today.toISOString().split("T")[0];
  const occColor         = overallPct >= 80 ? "#ef4444" : overallPct >= 50 ? "#f7941d" : "#10b981";
  const upcomingSessions = detail.sessions.filter(s => s.session_date >= todayStr);
  const pastSessions     = detail.sessions.filter(s => s.session_date <  todayStr);
  const sessionList      = sessionTab === "upcoming" ? upcomingSessions
    : sessionTab === "past" ? pastSessions
    : [...detail.sessions].sort((a, b) => a.session_date.localeCompare(b.session_date));

  const grid = buildCalendarGrid(calYear, calMonth);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }
  function dateKey(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteDoctor(detail.id);
      onDelete(detail.id);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("409")) {
        setDeleteError(msg.replace(/^\d+\s*/, ""));
      } else {
        setDeleteError("Failed to delete doctor. Please try again.");
      }
      setDeleting(false);
    }
  }

  return (
    <div className="dr-detail-page">
      <div className="dr-detail-topbar">
        <button className="dr-back-btn" onClick={onBack}><BackIcon /> Back to Doctors</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="dr-edit-btn" onClick={() => setShowEdit(true)}>
            <EditIcon /> Edit Doctor
          </button>
          <button className="dr-delete-btn" onClick={() => { setShowDeleteConfirm(true); setDeleteError(""); }}>
            <TrashIcon /> Delete Doctor
          </button>
        </div>
      </div>

      {/* Profile hero */}
      <div className="dr-profile-card">
        {/* Large avatar */}
        <div
          className="dr-profile-avatar"
          style={{
            background: heroAvatar,
            boxShadow: `0 0 0 4px rgba(255,255,255,.18), 0 0 0 8px rgba(255,255,255,.07), 0 12px 40px rgba(0,0,0,.30)`,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="dr-profile-info">
          <span className="dr-profile-spec-pill" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
            {detail.specialty}
          </span>
          <h2 className="dr-profile-name">{detail.name}</h2>

          {/* Qualifications as pills */}
          <div className="dr-profile-quals">
            {qualPills.map(q => (
              <span key={q} className="dr-profile-qual-pill">{q}</span>
            ))}
          </div>

          <div className="dr-profile-meta">
            <MetaBadge icon={<ExpIcon />}  label={`${detail.years_experience} yrs exp`} />
            <MetaBadge icon={<LangIcon />} label={detail.languages} />
            <MetaBadge icon={<FeeIcon />}  label={`Rs ${detail.consultation_fee.toLocaleString()}`} orange />
            {detail.email && <MetaBadge icon={<EmailIcon />} label={detail.email} />}
          </div>
        </div>

        {/* Side cards */}
        <div className="dr-profile-side">
          <div className="dr-side-card">
            <div className="dr-side-label">Hospital</div>
            <div className="dr-side-name">{detail.hospital}</div>
            <div className="dr-side-sub">{detail.hospital_address}</div>
            <div className="dr-side-sub"><PhoneIcon />{detail.hospital_phone}</div>
          </div>
          <div className="dr-side-card">
            <div className="dr-side-label">Overall Occupancy</div>
            <div className="dr-occ-row">
              <span className="dr-occ-pct">{overallPct}%</span>
              <div className="dr-occ-bar-wrap">
                <div className="dr-occ-bar">
                  <div className="dr-occ-fill" style={{
                    width: `${overallPct}%`,
                    background: overallPct >= 90 ? "#ef4444" : overallPct >= 60 ? "#f7941d" : "#10b981",
                  }} />
                </div>
                <div className="dr-occ-nums">
                  <span><span className="occ-dot b" />{totalBooked} booked</span>
                  <span><span className="occ-dot a" />{totalAvail} free</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="dr-quick-stats">
        <div className="dr-qs-card">
          <div className="dr-qs-icon" style={{ color: "#2563eb", background: "rgba(37,99,235,.10)" }}><CalIcon /></div>
          <div className="dr-qs-body">
            <div className="dr-qs-value">{detail.sessions.length}</div>
            <div className="dr-qs-label">Total Sessions</div>
          </div>
        </div>
        <div className="dr-qs-card">
          <div className="dr-qs-icon" style={{ color: "#10b981", background: "rgba(16,185,129,.10)" }}><ClockIcon /></div>
          <div className="dr-qs-body">
            <div className="dr-qs-value">{upcomingSessions.length}</div>
            <div className="dr-qs-label">Upcoming</div>
          </div>
        </div>
        <div className="dr-qs-card">
          <div className="dr-qs-icon" style={{ color: "#f7941d", background: "rgba(247,148,29,.10)" }}><PersonIcon /></div>
          <div className="dr-qs-body">
            <div className="dr-qs-value">{totalBooked}</div>
            <div className="dr-qs-label">Patients Served</div>
          </div>
        </div>
        <div className="dr-qs-card">
          <div className="dr-qs-icon" style={{ color: occColor, background: `${occColor}1a` }}><OccIcon /></div>
          <div className="dr-qs-body">
            <div className="dr-qs-value" style={{ color: occColor }}>{overallPct}%</div>
            <div className="dr-qs-label">Avg Occupancy</div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="dr-cal-card">
        <div className="dr-cal-header">
          <button className="dr-cal-nav" onClick={prevMonth}><ChevronLeftIcon /></button>
          <span className="dr-cal-title">{MONTHS[calMonth]} {calYear}</span>
          <button className="dr-cal-nav" onClick={nextMonth}><ChevronRightSmIcon /></button>
          <span className="dr-cal-sub">{detail.sessions.length} session{detail.sessions.length !== 1 ? "s" : ""} total</span>
          <div className="dr-cal-legend">
            <span className="dr-cal-li"><span className="cal-dot" style={{background:"#10b981"}} />Available</span>
            <span className="dr-cal-li"><span className="cal-dot" style={{background:"#f7941d"}} />Filling</span>
            <span className="dr-cal-li"><span className="cal-dot" style={{background:"#ef4444"}} />Full</span>
          </div>
        </div>

        <div className="dr-cal-days-header">
          {DAYS.map(d => <span key={d} className="dr-cal-day-name">{d}</span>)}
        </div>

        <div className="dr-cal-grid">
          {grid.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="dr-cal-cell empty" />;
            const key = dateKey(day);
            const session = sessionMap.get(key);
            const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
            const dotColor = session ? sessionDotColor(session) : null;
            return (
              <div
                key={key}
                className={`dr-cal-cell${session ? " has-session" : ""}${isToday ? " today" : ""}`}
                onClick={session ? () => setModalSession(session) : undefined}
                title={session ? `${session.start_time}–${session.end_time} · ${session.available_slots} seats left` : undefined}
              >
                <span className="dr-cal-num">{day}</span>
                {dotColor && <span className="dr-cal-dot" style={{ background: dotColor }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions list */}
      <div className="dr-sessions-section">
        <div className="dr-ss-header">
          <h3 className="dr-ss-title">Sessions</h3>
          <div className="dr-ss-tabs">
            {(["upcoming", "past", "all"] as const).map(tab => (
              <button
                key={tab}
                className={`dr-ss-tab${sessionTab === tab ? " active" : ""}`}
                onClick={() => setSessionTab(tab)}
              >
                {tab === "upcoming" ? `Upcoming (${upcomingSessions.length})`
                 : tab === "past"   ? `Past (${pastSessions.length})`
                 : `All (${detail.sessions.length})`}
              </button>
            ))}
          </div>
        </div>

        {sessionList.length === 0 ? (
          <div className="dr-ss-empty">No sessions in this category.</div>
        ) : (
          <div className="dr-ss-list">
            {sessionList.map(s => {
              const sDotColor = sessionDotColor(s);
              const sPct = s.total_slots > 0 ? Math.round((s.booked_slots / s.total_slots) * 100) : 0;
              const dateObj = new Date(s.session_date + "T00:00:00");
              const isPast = s.session_date < todayStr;
              const statusLabel = s.available_slots === 0 ? "Full" : sPct >= 70 ? "Filling" : "Available";
              return (
                <button
                  key={s.id}
                  className={`dr-ss-item${isPast ? " past" : ""}`}
                  onClick={() => setModalSession(s)}
                >
                  <div className="dr-ss-date-badge">
                    <span className="dr-ss-day-name">{dateObj.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <span className="dr-ss-day-num">{dateObj.getDate()}</span>
                    <span className="dr-ss-month">{dateObj.toLocaleDateString("en-US", { month: "short" })}</span>
                  </div>
                  <div className="dr-ss-info">
                    <div className="dr-ss-time"><ClockIcon />{s.start_time} – {s.end_time}</div>
                    <div className="dr-ss-slots">{s.booked_slots}/{s.total_slots} slots booked</div>
                  </div>
                  <div className="dr-ss-bar-wrap">
                    <div className="dr-ss-bar">
                      <div className="dr-ss-bar-fill" style={{ width: `${sPct}%`, background: sDotColor }} />
                    </div>
                    <span className="dr-ss-pct">{sPct}%</span>
                  </div>
                  <span className="dr-ss-badge" style={{ color: sDotColor, background: `${sDotColor}1a`, borderColor: `${sDotColor}40` }}>
                    {statusLabel}
                  </span>
                  <span className="dr-ss-chevron"><ChevronRightIcon /></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Session modal */}
      {modalSession && (
        <SessionModal
          session={modalSession}
          doctorName={detail.name}
          onClose={() => setModalSession(null)}
        />
      )}

      {/* Edit modal */}
      {showEdit && detail && (
        <RegisterDoctorModal
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => { onUpdate(updated); setShowEdit(false); }}
          initialData={detail}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <div className="modal-backdrop" onClick={e => { if (e.currentTarget === e.target) setShowDeleteConfirm(false); }}>
          <div className="del-confirm">
            <div className="del-confirm-icon"><TrashIcon /></div>
            <div className="del-confirm-title">Delete Doctor</div>
            <div className="del-confirm-body">
              Are you sure you want to remove <strong>{detail.name}</strong> from the system?
              This will also delete all their sessions.
            </div>
            {deleteError && <div className="del-confirm-error"><AlertIcon /> {deleteError}</div>}
            <div className="del-confirm-actions">
              <button className="del-cancel-btn" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="del-confirm-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><div className="rd-btn-spinner" /> Deleting…</> : <><TrashIcon /> Delete</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Session modal ───────────────────────────────────────────── */
function SessionModal({ session: s, doctorName, onClose }: {
  session: SessionDetail; doctorName: string; onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const pct = Math.round((s.booked_slots / s.total_slots) * 100);

  const dateLabel = new Date(s.session_date).toLocaleDateString("en-LK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSeat) setSelectedSeat(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, selectedSeat]);

  /* reset selected seat when session changes */
  useEffect(() => { setSelectedSeat(null); }, [s.id]);

  function handleSeatClick(seat: Seat) {
    setSelectedSeat(prev => prev?.number === seat.number ? null : seat);
  }

  return createPortal(
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className={`modal-box${selectedSeat ? " has-detail" : ""}`}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-doctor">{doctorName}</div>
            <div className="modal-date">{dateLabel}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {/* Session meta */}
        <div className="modal-meta">
          <div className="modal-meta-item"><ClockIcon /><span>{s.start_time} – {s.end_time}</span></div>
          <div className="modal-stats">
            <span className="modal-stat booked">
              <span className="modal-stat-num">{s.booked_slots}</span>Booked
            </span>
            <span className="modal-stat avail">
              <span className="modal-stat-num">{s.available_slots}</span>Available
            </span>
            <span className="modal-stat total">
              <span className="modal-stat-num">{s.total_slots}</span>Total
            </span>
          </div>
          <div className="modal-occ">
            <div className="modal-occ-bar">
              <div className="modal-occ-fill" style={{
                width: `${pct}%`,
                background: pct >= 90 ? "#ef4444" : pct >= 60 ? "#f7941d" : "#10b981",
              }} />
            </div>
            <span className="modal-occ-pct">{pct}%</span>
          </div>
        </div>

        {/* Body: seat map + optional booking detail side panel */}
        <div className="modal-body">
          <div className="modal-inner">
            <SeatMap
              session={s}
              selectedSeat={selectedSeat}
              onSeatClick={handleSeatClick}
            />
          </div>

          {selectedSeat && (
            <BookingDetail
              seat={selectedSeat}
              session={s}
              onClose={() => setSelectedSeat(null)}
            />
          )}
        </div>

        {!selectedSeat && s.booked_slots > 0 && (
          <div className="modal-hint">
            <PointerIcon /> Click any orange seat to view patient details
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Booking detail panel ────────────────────────────────────── */
function BookingDetail({ seat, session, onClose }: {
  seat: Seat; session: SessionDetail; onClose: () => void;
}) {
  return (
    <div className="booking-detail">
      <div className="bd-header">
        <div className="bd-seat-num">
          <span className="bd-seat-label">Seat</span>
          <span className="bd-seat-val">#{seat.number}</span>
        </div>
        <span className="bd-status confirmed">Confirmed</span>
        <button className="bd-close" onClick={onClose} aria-label="Close details"><XIcon /></button>
      </div>

      <div className="bd-body">
        <div className="bd-field">
          <span className="bd-field-label"><PersonIcon /> Patient Name</span>
          <span className="bd-field-val">{seat.patient_name}</span>
        </div>
        <div className="bd-field">
          <span className="bd-field-label"><RefIcon /> Reference No.</span>
          <span className="bd-field-val mono">{seat.reference}</span>
        </div>
        <div className="bd-field">
          <span className="bd-field-label"><CalIcon /> Session Date</span>
          <span className="bd-field-val">
            {new Date(session.session_date).toLocaleDateString("en-LK", {
              weekday: "short", day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>
        <div className="bd-field">
          <span className="bd-field-label"><ClockIcon /> Session Time</span>
          <span className="bd-field-val">{session.start_time} – {session.end_time}</span>
        </div>
        <div className="bd-field">
          <span className="bd-field-label"><SeatIcon /> Appointment No.</span>
          <span className="bd-field-val">#{seat.number} of {session.total_slots}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Seat map ────────────────────────────────────────────────── */
function SeatMap({ session, selectedSeat, onSeatClick }: {
  session: SessionDetail;
  selectedSeat?: Seat | null;
  onSeatClick?: (seat: Seat) => void;
}) {
  const bookedMap = new Map<number, Seat>();
  session.seats.forEach(s => bookedMap.set(s.number, s));
  const seats = Array.from({ length: session.total_slots }, (_, i) => i + 1);
  const cols = Math.min(10, session.total_slots);

  return (
    <div className="seat-map">
      <div className="seat-screen-wrap">
        <div className="seat-screen">CONSULTATION ROOM</div>
        <div className="seat-screen-shadow" />
      </div>
      <div className="seat-grid-wrap">
        <div className="seat-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {seats.map(n => {
            const b = bookedMap.get(n);
            const isSelected = selectedSeat?.number === n;
            if (b) {
              return (
                <div
                  key={n}
                  className={`seat booked${isSelected ? " selected" : ""}`}
                  onClick={() => onSeatClick?.(b)}
                  title={`Seat ${n} — ${b.patient_name}`}
                >
                  <span className="seat-num">{n}</span>
                </div>
              );
            }
            return <div key={n} className="seat avail"><span className="seat-num">{n}</span></div>;
          })}
        </div>
      </div>
      <div className="seat-legend-row">
        <span className="seat-li"><span className="seat-demo avail" />Available</span>
        <span className="seat-li"><span className="seat-demo booked" />Booked</span>
        <span className="seat-li"><span className="seat-demo selected" />Selected</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REGISTER DOCTOR MODAL
═══════════════════════════════════════════════════════════════ */
const SPECIALTIES = [
  "Cardiology","Dermatology","ENT","General Medicine",
  "Gynaecology","Neurology","Ophthalmology","Orthopaedics","Paediatrics",
];

const QUAL_OPTIONS = [
  "MBBS","MD","MS","MCh","DM","FRCS","MRCP","MRCOG","DCH","DNB",
  "FCPS","PhD","Diploma in Cardiology","Diploma in Dermatology",
  "Fellowship in Neurology","Fellowship in Paediatrics",
];

const LANG_OPTIONS = ["English","Sinhala","Tamil"];

const BLANK_FORM = {
  name: "", email: "", specialty: "", qualifications: [] as string[],
  years_experience: "", consultation_fee: "", languages: [] as string[],
};

/* ── MultiSelectDropdown ─────────────────────────────────────── */
function MultiSelectDropdown({
  options, selected, onChange, placeholder, error,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  }

  const trigLabel = selected.length === 0
    ? (placeholder ?? "Select…")
    : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div ref={wrapRef} className="msd-wrap">
      <button
        type="button"
        className={`msd-trigger${open ? " open" : ""}${error ? " error" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`msd-trig-label${selected.length === 0 ? " empty" : ""}`}>{trigLabel}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="msd-panel">
          {options.map(opt => (
            <label key={opt} className={`msd-item${selected.includes(opt) ? " on" : ""}`}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="msd-chips">
          {selected.map(s => (
            <span key={s} className="msd-chip">
              {s}
              <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s}`}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterDoctorModal({
  onClose, onSuccess, initialData,
}: {
  onClose: () => void;
  onSuccess: (d: any) => void;
  initialData?: DoctorDetail;
}) {
  const isEdit = !!initialData;
  const backdropRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(() => isEdit && initialData ? {
    name:             initialData.name,
    email:            initialData.email ?? "",
    specialty:        initialData.specialty,
    qualifications:   initialData.qualifications.split(", ").filter(Boolean),
    years_experience: String(initialData.years_experience),
    consultation_fee: String(initialData.consultation_fee),
    languages:        initialData.languages.split(", ").filter(Boolean),
  } : BLANK_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
    setApiError("");
  }

  function setChips(field: string, value: string[]) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
    setApiError("");
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())                  e.name             = "Name is required";
    if (!form.email.trim())                 e.email            = "Email is required";
    else if (!form.email.toLowerCase().endsWith("@gmail.com")) e.email = "Must be a Gmail address (@gmail.com)";
    if (!form.specialty)                    e.specialty        = "Select a specialty";
    if (form.qualifications.length === 0)   e.qualifications   = "Select at least one qualification";
    if (!form.years_experience)             e.years_experience = "Required";
    else if (Number(form.years_experience) < 0) e.years_experience = "Must be ≥ 0";
    if (!form.consultation_fee)             e.consultation_fee = "Required";
    else if (Number(form.consultation_fee) <= 0) e.consultation_fee = "Must be > 0";
    if (form.languages.length === 0)        e.languages        = "Select at least one language";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setApiError("");
    try {
      const payload = {
        name:             form.name.trim(),
        email:            form.email.trim().toLowerCase(),
        specialty:        form.specialty,
        qualifications:   form.qualifications.join(", "),
        years_experience: Number(form.years_experience),
        consultation_fee: Number(form.consultation_fee),
        languages:        form.languages.join(", "),
      };
      const result = isEdit
        ? await updateDoctor(initialData!.id, payload)
        : await registerDoctor(payload);
      onSuccess(result);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("409") || msg.toLowerCase().includes("email already exists")) {
        setErrors(prev => ({ ...prev, email: "This email is already registered" }));
      } else if (msg.includes("400") && msg.toLowerCase().includes("gmail")) {
        setErrors(prev => ({ ...prev, email: "Must be a Gmail address (@gmail.com)" }));
      } else {
        setApiError(isEdit ? "Failed to update doctor. Please try again." : "Failed to register doctor. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="rd-modal">
        {/* Header */}
        <div className="rd-header">
          <div className="rd-header-left">
            <div className="rd-header-icon">{isEdit ? <EditIcon /> : <DoctorPlusIcon />}</div>
            <div>
              <div className="rd-title">{isEdit ? "Edit Doctor" : "Register New Doctor"}</div>
              <div className="rd-subtitle">{isEdit ? "Update the consultant's details" : "Fill in the details to add a consultant to the system"}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {/* Form */}
        <form className="rd-form" onSubmit={handleSubmit} noValidate>
          <div className="rd-section-label">Personal Information</div>

          {/* Full name — full width */}
          <div className="rd-field rd-full">
            <label className="rd-label">Full Name <span className="rd-req">*</span></label>
            <input
              className={`rd-input${errors.name ? " error" : ""}`}
              placeholder="Dr. Anura Perera"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
            {errors.name && <span className="rd-err">{errors.name}</span>}
          </div>

          {/* Email — full width */}
          <div className="rd-field rd-full">
            <label className="rd-label">
              Email Address <span className="rd-req">*</span>
              <span className="rd-label-hint">Must be a Gmail — used for doctor dashboard access</span>
            </label>
            <input
              className={`rd-input${errors.email ? " error" : ""}`}
              type="email"
              placeholder="doctor@gmail.com"
              value={form.email}
              onChange={e => set("email", e.target.value)}
            />
            {errors.email && <span className="rd-err">{errors.email}</span>}
          </div>

          {/* Specialty + Languages side by side */}
          <div className="rd-row">
            <div className={`rd-field${errors.specialty ? " has-err" : ""}`}>
              <label className="rd-label">Specialty <span className="rd-req">*</span></label>
              <div className="rd-select-wrap">
                <select
                  className={`rd-select${errors.specialty ? " error" : ""}`}
                  value={form.specialty}
                  onChange={e => set("specialty", e.target.value)}
                >
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {errors.specialty && <span className="rd-err">{errors.specialty}</span>}
            </div>
            <div className={`rd-field${errors.languages ? " has-err" : ""}`}>
              <label className="rd-label">Languages <span className="rd-req">*</span></label>
              <MultiSelectDropdown
                options={LANG_OPTIONS}
                selected={form.languages}
                onChange={v => setChips("languages", v)}
                placeholder="Select languages…"
                error={!!errors.languages}
              />
              {errors.languages && <span className="rd-err">{errors.languages}</span>}
            </div>
          </div>

          {/* Qualifications — full width on its own row */}
          <div className={`rd-field rd-full${errors.qualifications ? " has-err" : ""}`}>
            <label className="rd-label">Qualifications <span className="rd-req">*</span></label>
            <MultiSelectDropdown
              options={QUAL_OPTIONS}
              selected={form.qualifications}
              onChange={v => setChips("qualifications", v)}
              placeholder="Select qualifications…"
              error={!!errors.qualifications}
            />
            {errors.qualifications && <span className="rd-err">{errors.qualifications}</span>}
          </div>

          <div className="rd-section-label" style={{ marginTop: 4 }}>Practice Details</div>

          {/* Experience + Fee */}
          <div className="rd-row">
            <div className={`rd-field${errors.years_experience ? " has-err" : ""}`}>
              <label className="rd-label">Years of Experience <span className="rd-req">*</span></label>
              <input
                className={`rd-input${errors.years_experience ? " error" : ""}`}
                type="number" min="0" max="60" placeholder="12"
                value={form.years_experience}
                onChange={e => set("years_experience", e.target.value)}
              />
              {errors.years_experience && <span className="rd-err">{errors.years_experience}</span>}
            </div>
            <div className={`rd-field${errors.consultation_fee ? " has-err" : ""}`}>
              <label className="rd-label">Consultation Fee (Rs) <span className="rd-req">*</span></label>
              <input
                className={`rd-input${errors.consultation_fee ? " error" : ""}`}
                type="number" min="1" placeholder="2500"
                value={form.consultation_fee}
                onChange={e => set("consultation_fee", e.target.value)}
              />
              {errors.consultation_fee && <span className="rd-err">{errors.consultation_fee}</span>}
            </div>
          </div>

          {/* API-level error */}
          {apiError && <div className="rd-api-error"><AlertIcon />{apiError}</div>}

          {/* Actions */}
          <div className="rd-actions">
            <button type="button" className="rd-cancel-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="rd-submit-btn" disabled={saving}>
              {saving
                ? <><div className="rd-btn-spinner" />{isEdit ? "Saving…" : "Registering…"}</>
                : isEdit ? <><EditIcon /> Save Changes</> : <><DoctorPlusIcon /> Register Doctor</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */
function MetaBadge({ icon, label, orange }: { icon: React.ReactNode; label: string; orange?: boolean }) {
  return <span className={`dr-meta-badge${orange ? " orange" : ""}`}>{icon}{label}</span>;
}

/* ── Icons ───────────────────────────────────────────────────── */
const I = (d: string, w = 2) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;

function SearchIcon()      { return I('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'); }
function XIcon()           { return I('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 2.5); }
function HospitalIcon()    { return I('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'); }
function ChevronRightIcon(){ return I('<polyline points="9 18 15 12 9 6"/>', 2.5); }
function ChevronLeftIcon() { return I('<polyline points="15 18 9 12 15 6"/>'); }
function ChevronRightSmIcon(){ return I('<polyline points="9 18 15 12 9 6"/>'); }
function BackIcon()        { return I('<polyline points="15 18 9 12 15 6"/>'); }
function ExpIcon()         { return I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function LangIcon()        { return I('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'); }
function FeeIcon()         { return I('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'); }
function PhoneIcon()       { return I('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.1 6.1l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>'); }
function ClockIcon()       { return I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function EmptyIcon()       { return I('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>', 1.5); }
function PersonIcon()      { return I('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'); }
function RefIcon()         { return I('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'); }
function CalIcon()         { return I('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'); }
function SeatIcon()        { return I('<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><path d="M6 20h12"/><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/>'); }
function PointerIcon()     { return I('<path d="M9 9s0-3 3-3 3 3 3 3v6"/><path d="M9 9H6a3 3 0 0 0 0 6h1"/><path d="M15 9h3a3 3 0 0 1 0 6h-1"/><line x1="9" y1="18" x2="15" y2="18"/>'); }
function PlusIcon()        { return I('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 2.5); }
function ChevronDownIcon() { return I('<polyline points="6 9 12 15 18 9"/>'); }
function TrashIcon()       { return I('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'); }
function EditIcon()        { return I('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'); }
function DoctorPlusIcon()  { return I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>'); }
function AlertIcon()       { return I('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'); }
function EmailIcon()       { return I('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>'); }
function OccIcon()         { return I('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'); }

