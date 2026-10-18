import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getDoctors } from "../api";
import ProfileModal from "../components/ProfileModal";
import type { AuthUser } from "../context/AuthContext";
import { useAuth } from "../context/AuthContext";

/* ── Types ─────────────────────────────────────────────────── */
interface Doctor {
  id: number;
  name: string;
  specialty: string;
  qualifications: string;
  years_experience: number;
  consultation_fee: number;
  languages: string;
  hospital: string;
  city: string;
}
interface Props {
  user: AuthUser | null;
  onOpenChat: () => void;
  onOpenSymptomChecker?: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

/* ── Specialty meta ────────────────────────────────────────── */
const SPECIALTIES = [
  { name: "Cardiology",       color: "#dc2626", bg: "#fef2f2", icon: "❤" },
  { name: "Dermatology",      color: "#d97706", bg: "#fffbeb", icon: "✦" },
  { name: "Neurology",        color: "#7c3aed", bg: "#f5f3ff", icon: "⚡" },
  { name: "Orthopaedics",     color: "#ea580c", bg: "#fff7ed", icon: "⊕" },
  { name: "Paediatrics",      color: "#16a34a", bg: "#f0fdf4", icon: "★" },
  { name: "Gynaecology",      color: "#db2777", bg: "#fdf2f8", icon: "♀" },
  { name: "ENT",              color: "#0369a1", bg: "#f0f9ff", icon: "◎" },
  { name: "General Medicine", color: "#2563eb", bg: "#eff6ff", icon: "✚" },
  { name: "Ophthalmology",    color: "#0d9488", bg: "#f0fdfa", icon: "◉" },
];

const SPEC_MAP: Record<string, string> = {
  "Cardiology": "#dc2626", "Dermatology": "#d97706", "ENT": "#7c3aed",
  "General Medicine": "#2563eb", "Gynaecology": "#db2777",
  "Neurology": "#0369a1", "Ophthalmology": "#0d9488",
  "Orthopaedics": "#ea580c", "Paediatrics": "#16a34a",
};
function specColor(s: string) { return SPEC_MAP[s] ?? "#003087"; }

function fmtRs(n: number) {
  return `Rs. ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE
═══════════════════════════════════════════════════════════════ */
export default function HomePage({ user, onOpenChat, onOpenSymptomChecker, onLogin, onLogout }: Props) {
  const [doctors, setDoctors]       = useState<Doctor[]>([]);
  const [scrolled, setScrolled]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const doctorsRef                  = useRef<HTMLDivElement>(null);
  const howRef                      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => {});
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const [profileOpen, setProfileOpen] = useState(false);

  const sidebarCls = user
    ? ` hp-root--sidebar${sidebarOpen ? "" : " hp-root--sidebar-closed"}`
    : "";

  return (
    <div className={`hp-root${sidebarCls}`}>
      {user && (
        <HpSidebar
          user={user}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
          onLogout={onLogout}
          onOpenChat={onOpenChat}
          onScrollDoctors={() => scrollTo(doctorsRef)}
          onScrollHow={() => scrollTo(howRef)}
          onOpenProfile={() => setProfileOpen(true)}
        />
      )}
      <AnimatePresence>
        {profileOpen && user && (
          <ProfileModal user={user} onClose={() => setProfileOpen(false)} />
        )}
      </AnimatePresence>

      <HpNav
        scrolled={scrolled} user={user}
        onOpenChat={onOpenChat} onLogin={onLogin} onLogout={onLogout}
        onScrollDoctors={() => scrollTo(doctorsRef)}
        onScrollHow={() => scrollTo(howRef)}
      />

      <HeroSection onOpenChat={onOpenChat} onBrowse={() => scrollTo(doctorsRef)} />
      <StatsStrip />
      <FeaturesSection />
      <SpecialtiesSection onOpenChat={onOpenChat} />
      <HowItWorksSection ref={howRef} />
      <DoctorsSection ref={doctorsRef} doctors={doctors} onOpenChat={onOpenChat} />
      <AiCtaBanner onOpenChat={onOpenChat} />
      <HpFooter
        onOpenChat={onOpenChat}
        onLogin={onLogin}
        onScrollDoctors={() => scrollTo(doctorsRef)}
        onScrollHow={() => scrollTo(howRef)}
      />
      <FloatingChatBtn onOpenChat={onOpenChat} />
    </div>
  );
}

/* ── Nav ───────────────────────────────────────────────────── */
function HpNav({ scrolled, user, onOpenChat, onLogin, onLogout, onScrollDoctors, onScrollHow }: {
  scrolled: boolean; user: AuthUser | null;
  onOpenChat: () => void; onLogin: () => void; onLogout: () => void;
  onScrollDoctors: () => void; onScrollHow: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className={`hp-nav${scrolled ? " scrolled" : ""}`}>
      <div className="hp-nav-inner">
        <div className="hp-nav-brand">
          <span className="hp-nav-brand-name">eChannelling<span className="hp-nav-brand-ai">AI</span></span>
        </div>

        <nav className="hp-nav-links">
          <button className="hp-nav-link" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Home</button>
          <button className="hp-nav-link" onClick={onScrollDoctors}>Doctors</button>
          <button className="hp-nav-link" onClick={onScrollHow}>How it works</button>
          <a className="hp-nav-link" href="tel:+94112446890">Emergency: 1990</a>
        </nav>

        <div className="hp-nav-actions">
          {user ? (
            <>
              <button className="hp-nav-chat-btn" onClick={onOpenChat}>
                <BotIcon /> AI Assistant
              </button>
              <div className="hp-nav-user">
                {user.picture
                  ? <img src={user.picture} alt={user.name} className="hp-nav-avatar" referrerPolicy="no-referrer" />
                  : <div className="hp-nav-avatar hp-nav-avatar-fallback">{user.name?.[0]}</div>
                }
                <div className="hp-nav-user-info">
                  <span className="hp-nav-user-name">{user.name?.split(" ")[0]}</span>
                  <span className="hp-nav-user-role">
                    {user.role === "admin" ? "Admin" : user.role === "doctor" ? "Doctor" : "Patient"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <button className="hp-nav-login-btn" onClick={onLogin}>Sign In</button>
              <button className="hp-nav-chat-btn" onClick={onOpenChat}>
                <BotIcon /> Book via AI
              </button>
            </>
          )}
          <button className="hp-nav-mobile-toggle" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="hp-mobile-menu">
          <button className="hp-mobile-link" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMobileOpen(false); }}>Home</button>
          <button className="hp-mobile-link" onClick={() => { onScrollDoctors(); setMobileOpen(false); }}>Doctors</button>
          <button className="hp-mobile-link" onClick={() => { onScrollHow(); setMobileOpen(false); }}>How it works</button>
          <div className="hp-mobile-divider" />
          {user ? (
            <>
              <button className="hp-mobile-link" onClick={() => { onOpenChat(); setMobileOpen(false); }}>Open AI Assistant</button>
              <button className="hp-mobile-link hp-mobile-logout" onClick={() => { onLogout(); setMobileOpen(false); }}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="hp-mobile-link" onClick={() => { onLogin(); setMobileOpen(false); }}>Sign In</button>
              <button className="hp-mobile-link hp-mobile-cta" onClick={() => { onOpenChat(); setMobileOpen(false); }}>Book via AI</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

/* ── Hero ──────────────────────────────────────────────────── */
function HeroSection({ onOpenChat, onBrowse }: { onOpenChat: () => void; onBrowse: () => void }) {
  return (
    <section className="hp-hero">
      {/* Decorative orbs */}
      <div className="hp-hero-orb hp-hero-orb-1" />
      <div className="hp-hero-orb hp-hero-orb-2" />
      <div className="hp-hero-orb hp-hero-orb-3" />

      <div className="hp-hero-inner">
        <motion.div
          className="hp-hero-text"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="hp-hero-eyebrow">
            <span className="hp-hero-eyebrow-dot" />
            AI-Powered Healthcare Booking in Sri Lanka
          </span>
          <h1 className="hp-hero-heading">
            Your Health,<br />Our&nbsp;Priority
          </h1>
          <p className="hp-hero-sub">
            Connect with top specialists across Sri Lanka. Book your channelling
            appointment instantly with our AI assistant — available 24/7.
          </p>
          <div className="hp-hero-btns">
            <button className="hp-btn-primary" onClick={onOpenChat}>
              <BotIcon />
              Book via AI Assistant
              <ArrowRightIcon />
            </button>
            <button className="hp-btn-outline" onClick={onBrowse}>
              Browse Doctors
            </button>
          </div>

          <div className="hp-hero-trust">
            <span className="hp-hero-trust-item"><CheckIcon />No registration fee</span>
            <span className="hp-hero-trust-item"><CheckIcon />Instant confirmation</span>
            <span className="hp-hero-trust-item"><CheckIcon />Secure &amp; private</span>
          </div>
        </motion.div>

        <motion.div
          className="hp-hero-mascot-wrap"
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
        >
          <img src="/hero-bot.png" alt="AI Assistant" className="hp-hero-mascot" draggable="false" />
        </motion.div>
      </div>
    </section>
  );
}

/* ── Stats strip ───────────────────────────────────────────── */
function StatsStrip() {
  const items = [
    { val: "50+",     label: "Specialist Doctors" },
    { val: "20+",     label: "Hospitals & Clinics" },
    { val: "9",       label: "Medical Specialties" },
    { val: "24 / 7",  label: "AI Booking Assistant" },
  ];
  return (
    <div className="hp-stats-strip">
      <div className="hp-stats-inner">
        {items.map(({ val, label }, i) => (
          <div key={i} className="hp-stat-item">
            <span className="hp-stat-val">{val}</span>
            <span className="hp-stat-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Features ──────────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      color: "#0096D6", bg: "rgba(0,150,214,.08)",
      icon: <BotIcon />,
      title: "AI-Powered Booking",
      desc: "Chat naturally with our AI. It understands what you need and finds the right doctor instantly.",
    },
    {
      color: "#10b981", bg: "rgba(16,185,129,.08)",
      icon: <CheckCircleIcon />,
      title: "Instant Confirmation",
      desc: "Get your appointment number in seconds. No waiting, no phone calls, no queues.",
    },
    {
      color: "#003087", bg: "rgba(0,48,135,.08)",
      icon: <DoctorsIcon />,
      title: "Top Specialists",
      desc: "Access 50+ verified specialists across all major medical disciplines in Sri Lanka.",
    },
    {
      color: "#7c3aed", bg: "rgba(124,58,237,.08)",
      icon: <LockIcon />,
      title: "Secure & Private",
      desc: "Your health information is always confidential. Powered by SLT MOBITEL infrastructure.",
    },
  ];

  return (
    <section className="hp-section hp-features-section">
      <div className="hp-section-inner">
        <div className="hp-section-header">
          <span className="hp-section-eyebrow">Why choose us</span>
          <h2 className="hp-section-title">The smarter way to book healthcare</h2>
          <p className="hp-section-sub">From finding a doctor to confirming your slot — our AI handles everything in one conversation.</p>
        </div>
        <div className="hp-features-grid">
          {features.map(({ color, bg, icon, title, desc }, i) => (
            <motion.div
              key={title}
              className="hp-feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="hp-feature-icon" style={{ color, background: bg }}>{icon}</div>
              <h3 className="hp-feature-title">{title}</h3>
              <p className="hp-feature-desc">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Specialties ───────────────────────────────────────────── */
function SpecialtiesSection({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <section className="hp-section hp-spec-section">
      <div className="hp-spec-layout">

        {/* Left — mascot */}
        <motion.div
          className="hp-spec-mascot-wrap"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img src="/spec-mascot.png" alt="" className="hp-spec-mascot" draggable="false" />
        </motion.div>

        {/* Right — header + chips */}
        <div className="hp-spec-content">
          <div className="hp-section-header hp-section-header--left">
            <span className="hp-section-eyebrow">Browse by specialty</span>
            <h2 className="hp-section-title">Find the right specialist</h2>
            <p className="hp-section-sub">Tell our AI which specialty you need and we'll find available doctors near you.</p>
          </div>
          <div className="hp-spec-grid">
            {SPECIALTIES.map(({ name, color, bg, icon }, i) => (
              <motion.button
                key={name}
                className="hp-spec-chip"
                style={{ "--spec-color": color, "--spec-bg": bg } as React.CSSProperties}
                onClick={onOpenChat}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                whileHover={{ y: -3 }}
              >
                <span className="hp-spec-icon">{icon}</span>
                <span className="hp-spec-name">{name}</span>
              </motion.button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

/* ── How it works ──────────────────────────────────────────── */
import { forwardRef } from "react";

const HowItWorksSection = forwardRef<HTMLDivElement>(function HowItWorksSection(_, ref) {
  const steps = [
    {
      num: "01", color: "#0096D6",
      icon: <ChatIcon />,
      title: "Tell AI what you need",
      desc: "Type your symptoms, preferred specialty, city, or doctor name. The AI understands natural language.",
    },
    {
      num: "02", color: "#003087",
      icon: <SearchIcon />,
      title: "AI finds your options",
      desc: "Our assistant searches available sessions, checks real-time slots and presents the best matches.",
    },
    {
      num: "03", color: "#10b981",
      icon: <CalCheckIcon />,
      title: "Confirm your booking",
      desc: "Review the appointment details and confirm. You'll receive your reference number instantly.",
    },
  ];

  return (
    <section className="hp-section hp-how-section" ref={ref}>
      <div className="hp-section-inner">
        <div className="hp-section-header">
          <span className="hp-section-eyebrow">Simple process</span>
          <h2 className="hp-section-title">Book in three steps</h2>
          <p className="hp-section-sub">No phone calls. No waiting on hold. Just a quick chat with our AI.</p>
        </div>
        <div className="hp-how-steps">
          {steps.map(({ num, color, icon, title, desc }, i) => (
            <motion.div
              key={num}
              className="hp-how-step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
            >
              <div className="hp-how-step-num" style={{ color, borderColor: `${color}30`, background: `${color}0d` }}>{num}</div>
              <div className="hp-how-step-icon" style={{ color, background: `${color}12` }}>{icon}</div>
              <h3 className="hp-how-step-title">{title}</h3>
              <p className="hp-how-step-desc">{desc}</p>
              {i < steps.length - 1 && <div className="hp-how-arrow"><ArrowRightIcon /></div>}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ── Doctors grid ──────────────────────────────────────────── */
const DoctorsSection = forwardRef<HTMLDivElement, { doctors: Doctor[]; onOpenChat: () => void }>(
  function DoctorsSection({ doctors, onOpenChat }, ref) {
    const [activeSpec, setActiveSpec] = useState<string | null>(null);
    const specs = [...new Set(doctors.map(d => d.specialty))].sort();
    const shown = (activeSpec ? doctors.filter(d => d.specialty === activeSpec) : doctors).slice(0, 8);

    return (
      <section className="hp-section hp-doctors-section" ref={ref}>
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <span className="hp-section-eyebrow">Our team</span>
            <h2 className="hp-section-title">Meet our specialists</h2>
            <p className="hp-section-sub">Experienced, verified doctors across all major specialties.</p>
          </div>

          {specs.length > 0 && (
            <div className="hp-doc-filter">
              <button
                className={`hp-doc-filter-btn${activeSpec === null ? " active" : ""}`}
                onClick={() => setActiveSpec(null)}
              >All</button>
              {specs.map(s => (
                <button
                  key={s}
                  className={`hp-doc-filter-btn${activeSpec === s ? " active" : ""}`}
                  onClick={() => setActiveSpec(s)}
                  style={{ "--fc": specColor(s) } as React.CSSProperties}
                >{s}</button>
              ))}
            </div>
          )}

          {shown.length === 0 && (
            <div className="hp-doc-empty">Loading specialists…</div>
          )}

          <div className="hp-doc-grid">
            {shown.map((d, i) => {
              const initials = d.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
              const color    = specColor(d.specialty);
              const quals    = d.qualifications.split(",").map(q => q.trim()).filter(Boolean).slice(0, 2);
              return (
                <motion.div
                  key={d.id}
                  className="hp-doc-card"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                >
                  <div className="hp-doc-card-header">
                    <div className="hp-doc-avatar" style={{ background: color }}>{initials}</div>
                    <div className="hp-doc-info">
                      <div className="hp-doc-name">{d.name}</div>
                      <div className="hp-doc-spec" style={{ color, background: `${color}12`, borderColor: `${color}25` }}>{d.specialty}</div>
                    </div>
                  </div>
                  <div className="hp-doc-quals">
                    {quals.map(q => <span key={q} className="hp-doc-qual-pill">{q}</span>)}
                  </div>
                  <div className="hp-doc-meta">
                    <span className="hp-doc-meta-item"><HospSmIcon />{d.hospital}, {d.city}</span>
                    <span className="hp-doc-meta-item"><ExpSmIcon />{d.years_experience} yrs exp</span>
                    <span className="hp-doc-meta-item"><FeeSmIcon />{fmtRs(d.consultation_fee)}</span>
                  </div>
                  <button className="hp-doc-book-btn" onClick={onOpenChat}>
                    <BotIcon /> Book via AI
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
);

/* ── AI CTA Banner ─────────────────────────────────────────── */
function AiCtaBanner({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <section className="hp-cta-banner">
      <div className="hp-cta-orb hp-cta-orb-1" />
      <div className="hp-cta-orb hp-cta-orb-2" />
      <div className="hp-cta-inner">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="hp-cta-icon-wrap"><BotIcon /></div>
          <h2 className="hp-cta-heading">Ready to book your appointment?</h2>
          <p className="hp-cta-sub">
            Chat with our AI assistant — describe your needs in plain English or Sinhala.
            Available 24 hours a day, 7 days a week.
          </p>
          <button className="hp-cta-btn" onClick={onOpenChat}>
            Start Chatting Now <ArrowRightIcon />
          </button>
          <p className="hp-cta-note">Free to use · No account required to browse</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────── */
function HpFooter({ onOpenChat, onLogin, onScrollDoctors, onScrollHow }: {
  onOpenChat: () => void; onLogin: () => void;
  onScrollDoctors: () => void; onScrollHow: () => void;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="hp-footer">
      <div className="hp-footer-inner">

        {/* Brand column */}
        <div className="hp-footer-brand">
          <div className="hp-footer-logo-row">
            <span className="hp-footer-brand-name">eChannelling<span className="hp-footer-brand-ai">AI</span></span>
          </div>
          <p className="hp-footer-tagline">
            Sri Lanka's AI-powered medical channelling service. Connect with the right specialist, instantly.
          </p>
          <div className="hp-footer-powered">
            <span>Powered by</span>
            <strong>SLT MOBITEL</strong>
          </div>
          <div className="hp-footer-socials">
            <a href="#" className="hp-footer-social" aria-label="Facebook"><FbIcon /></a>
            <a href="#" className="hp-footer-social" aria-label="Twitter"><TwIcon /></a>
            <a href="#" className="hp-footer-social" aria-label="LinkedIn"><LiIcon /></a>
          </div>
        </div>

        {/* Quick links */}
        <div className="hp-footer-col">
          <h3 className="hp-footer-col-title">Quick Links</h3>
          <ul className="hp-footer-links">
            <li><button className="hp-footer-link" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Home</button></li>
            <li><button className="hp-footer-link" onClick={onScrollDoctors}>Find Doctors</button></li>
            <li><button className="hp-footer-link" onClick={onScrollHow}>How it Works</button></li>
            <li><button className="hp-footer-link" onClick={onOpenChat}>AI Assistant</button></li>
            <li><button className="hp-footer-link" onClick={onLogin}>Sign In</button></li>
          </ul>
        </div>

        {/* Services */}
        <div className="hp-footer-col">
          <h3 className="hp-footer-col-title">Services</h3>
          <ul className="hp-footer-links">
            <li><button className="hp-footer-link" onClick={onOpenChat}>Book an Appointment</button></li>
            <li><button className="hp-footer-link" onClick={onOpenChat}>Check Availability</button></li>
            <li><button className="hp-footer-link" onClick={onOpenChat}>Reschedule Booking</button></li>
            <li><button className="hp-footer-link" onClick={onOpenChat}>Look Up Booking</button></li>
            <li><button className="hp-footer-link" onClick={onOpenChat}>Policy &amp; Fees</button></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="hp-footer-col">
          <h3 className="hp-footer-col-title">Contact Us</h3>
          <ul className="hp-footer-contact">
            <li>
              <span className="hp-footer-contact-icon"><PhoneIcon /></span>
              <div>
                <div className="hp-footer-contact-label">Customer Support</div>
                <a href="tel:+94112446890" className="hp-footer-contact-val">+94 11 2 446 890</a>
              </div>
            </li>
            <li>
              <span className="hp-footer-contact-icon"><MailIcon /></span>
              <div>
                <div className="hp-footer-contact-label">Email</div>
                <a href="mailto:support@echannelling.com" className="hp-footer-contact-val">support@echannelling.com</a>
              </div>
            </li>
            <li>
              <span className="hp-footer-contact-icon"><MapIcon /></span>
              <div>
                <div className="hp-footer-contact-label">Head Office</div>
                <span className="hp-footer-contact-val">Lotus Road, Colombo 01,<br />Sri Lanka</span>
              </div>
            </li>
            <li>
              <span className="hp-footer-contact-icon"><ClockSmIcon /></span>
              <div>
                <div className="hp-footer-contact-label">Medical Emergency</div>
                <a href="tel:1990" className="hp-footer-contact-val hp-footer-emergency">
                  1990 — Suwa Seriya (24/7)
                </a>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="hp-footer-bottom">
        <span>© {year} eChannelling by SLT MOBITEL. All rights reserved.</span>
        <span className="hp-footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Cookie Policy</a>
        </span>
      </div>
    </footer>
  );
}

/* ── Sidebar (logged-in users) ─────────────────────────────── */
function HpSidebar({ user, isOpen, onToggle, onLogout, onOpenChat, onScrollDoctors, onScrollHow, onOpenProfile }: {
  user: AuthUser;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
  onOpenChat: () => void;
  onScrollDoctors: () => void;
  onScrollHow: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <aside className="hp-sidebar">
      <button className="hp-sidebar-toggle" onClick={onToggle} aria-label={isOpen ? "Hide sidebar" : "Show sidebar"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          {isOpen ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
        </svg>
      </button>

      <div className="hp-sidebar-inner">
        <div className="hp-sidebar-profile">
          {user.picture
            ? <img src={user.picture} alt={user.name} className="hp-sidebar-avatar" referrerPolicy="no-referrer" />
            : <div className="hp-sidebar-avatar hp-sidebar-avatar-fallback">{user.name?.[0]}</div>
          }
          <div className="hp-sidebar-name">{user.name}</div>
          <div className="hp-sidebar-email">{user.email}</div>
        </div>

        <nav className="hp-sidebar-nav">
          <button className="hp-sidebar-link" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <SbHomeIcon /> Home
          </button>
          <button className="hp-sidebar-link" onClick={onScrollDoctors}>
            <SbDoctorsIcon /> Find Doctors
          </button>
          <button className="hp-sidebar-link hp-sidebar-link--cta" onClick={onOpenChat}>
            <SbBotIcon /> AI Assistant
          </button>
          <button className="hp-sidebar-link" onClick={onScrollHow}>
            <SbInfoIcon /> How it Works
          </button>
          <button className="hp-sidebar-link" onClick={onOpenProfile}>
            <SbProfileIcon /> My Profile
          </button>
        </nav>

        <div className="hp-sidebar-footer">
          <button className="hp-sidebar-logout" onClick={onLogout}>
            <SbSignOutIcon /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

function SbHomeIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function SbDoctorsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function SbBotIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M12 3v2M8 8H6a6 6 0 0 0 6 6 6 6 0 0 0 6-6h-2"/></svg>; }
function SbInfoIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function SbProfileIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function SbSignOutIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }

/* ── Floating chat button ──────────────────────────────────── */
const FAB_MESSAGES = [
  "Hi! I'm your eChannelling AI 👋",
  "Book a doctor appointment instantly",
  "Find specialists by city or specialty",
  "Check available sessions — 24/7",
  "Reschedule or look up your booking",
  "Need a cardiologist? Just ask me!",
];

/* Timing: 3.5 s visible, 0.6 s gap between bubbles */
const SHOW_MS = 3500;
const GAP_MS  = 600;

function FloatingChatBtn({ onOpenChat }: { onOpenChat: () => void }) {
  const [started,   setStarted]   = useState(false);
  const [msgIdx,    setMsgIdx]    = useState(0);
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  /* Start the cycle after 2.5 s */
  useEffect(() => {
    if (dismissed) return;
    const t = setTimeout(() => setStarted(true), 2500);
    return () => clearTimeout(t);
  }, [dismissed]);

  /* Once started, run: show → hide → next → show → … */
  useEffect(() => {
    if (!started || dismissed) return;
    setVisible(true);

    const hide = setTimeout(() => {
      setVisible(false);
      const next = setTimeout(() => {
        setMsgIdx(i => (i + 1) % FAB_MESSAGES.length);
        setVisible(true);
      }, GAP_MS);
      return () => clearTimeout(next);
    }, SHOW_MS);

    return () => clearTimeout(hide);
  }, [started, msgIdx, dismissed]);

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    setDismissed(true);
  }

  return (
    <div className="hp-fab-wrap">
      <AnimatePresence>
        {visible && !dismissed && (
          <motion.div
            key={msgIdx}
            className="hp-fab-bubble"
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 12, scale: 0.9  }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <span>{FAB_MESSAGES[msgIdx]}</span>
            <button className="hp-fab-bubble-close" onClick={dismiss} aria-label="Dismiss">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="hp-fab"
        onClick={onOpenChat}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 260, damping: 20 }}
        aria-label="Open AI Assistant"
        title="Chat with AI Assistant"
      >
        <img src="/chatbot-logo.png" alt="AI" draggable="false" />
      </motion.button>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────── */
const Ico = (d: string, w = 2) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
    strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: d }} />
);
function BotIcon()       { return Ico('<circle cx="12" cy="8" r="5"/><path d="M12 3v2M8 8H6a6 6 0 0 0 6 6 6 6 0 0 0 6-6h-2"/><path d="M8.5 13.5S9 17 12 17s3.5-3.5 3.5-3.5"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/>'); }
function ArrowRightIcon(){ return Ico('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'); }
function CheckIcon()     { return Ico('<polyline points="20 6 9 17 4 12"/>', 2.5); }
function CheckCircleIcon(){ return Ico('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'); }
function DoctorsIcon()   { return Ico('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'); }
function LockIcon()      { return Ico('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'); }
function ChatIcon()      { return Ico('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'); }
function SearchIcon()    { return Ico('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'); }
function CalCheckIcon()  { return Ico('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>'); }
function SignOutIcon()   { return Ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'); }
function CalSmIcon()     { return Ico('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'); }
function HospSmIcon()    { return Ico('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'); }
function FeeSmIcon()     { return Ico('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'); }
function ExpSmIcon()     { return Ico('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>'); }
function PhoneIcon()     { return Ico('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'); }
function MailIcon()      { return Ico('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>'); }
function MapIcon()       { return Ico('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'); }
function ClockSmIcon()   { return Ico('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function FbIcon()        { return Ico('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>'); }
function TwIcon()        { return Ico('<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>'); }
function LiIcon()        { return Ico('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'); }
