import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { clearSession, sendMessage } from "../api";
import ChatHistory from "../components/ChatHistory";
import EvidencePanel from "../components/EvidencePanel";
import Message from "../components/Message";
import ProfileModal from "../components/ProfileModal";
import { PromptBox } from "../components/ui/chatgpt-prompt-input";
import { useAuth } from "../context/AuthContext";
import { useConversations } from "../hooks/useConversations";

function newSessionId() {
  return "demo-" + Math.random().toString(36).slice(2, 8);
}

const STARTERS = [
  "What happens if I miss my appointment?",
  "I need a dermatologist in Colombo",
  "How much is the channelling service charge?",
  "Can I reschedule my booking ECH99887766?",
];

const FEATURES = [
  {
    title: "Find Doctors",
    desc:  "By specialty, city or hospital",
    color: "fc-blue",
    query: "I need a cardiologist in Colombo",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    title: "Check Slots",
    desc:  "Available sessions for doctors",
    color: "fc-green",
    query: "Show me available sessions for Dr. Vishaka Amarasinghe",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
        <line x1="9"  y1="16" x2="15" y2="16"/>
        <line x1="12" y1="13" x2="12" y2="19"/>
      </svg>
    ),
  },
  {
    title: "My Booking",
    desc:  "Look up or reschedule appointment",
    color: "fc-navy",
    query: "I want to check my booking",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="11" y2="17"/>
      </svg>
    ),
  },
  {
    title: "Policy & Fees",
    desc:  "Cancellation, refunds & charges",
    color: "fc-orange",
    query: "What is the cancellation policy?",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
];

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.9" />
    </svg>
  );
}

export default function UserDashboard({ onHome, onSymptomChecker }: { onHome?: () => void; onSymptomChecker?: () => void }) {
  const sessionRef = useRef(newSessionId());

  const [messages,          setMessages]          = useState<any[]>([]);
  const [busy,              setBusy]              = useState(false);
  const [evidenceOpen,      setEvidenceOpen]      = useState(false);
  const [evidenceIdx,       setEvidenceIdx]       = useState<number | null>(null);
  const [resetKey,          setResetKey]          = useState(0);
  const [profileOpen,       setProfileOpen]       = useState(false);
  const [pendingBookingIdx, setPendingBookingIdx] = useState<number | null>(null);
  const { user } = useAuth();

  const { conversations, save, remove } = useConversations();

  const threadRef = useRef<HTMLDivElement>(null);
  const formRef   = useRef<HTMLFormElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    promptRef.current?.focus();
  }, [resetKey]);

  useEffect(() => {
    const saveable = messages.filter((m: any) => m.role !== "booking_form");
    if (saveable.length > 0) save(sessionRef.current, saveable);
  }, [messages, save]);

  async function doSubmit(text: string) {
    if (!text.trim() || busy) return;

    setPendingBookingIdx(null);
    setBusy(true);
    setMessages(m => [...m, { role: "user", content: text.trim() }]);
    setResetKey(k => k + 1);

    try {
      const res = await sendMessage(text.trim(), sessionRef.current);

      setMessages(m => {
        const idx = m.length;
        const next = [...m, {
          role:            "assistant",
          content:         res.answer,
          mode:            res.mode,
          grounded:        res.grounded,
          sources:         res.sources,
          tool_calls:      res.tool_calls,
          latency_ms:      res.latency_ms,
          pending_booking: res.pending_booking ?? null,
          doctor_cards:    res.doctor_cards ?? null,
          session_cards:   res.session_cards ?? null,
          session_window:  res.session_window ?? null,
        }];

        if (res.pending_booking) {
          setPendingBookingIdx(idx);
        }

        if ((res.sources?.length || res.tool_calls?.length) && !evidenceOpen) {
          setEvidenceIdx(next.length - 1);
          setEvidenceOpen(true);
        } else if (evidenceOpen) {
          setEvidenceIdx(next.length - 1);
        }
        return next;
      });
    } catch (err: any) {
      const isRate = err.isRateLimit === true;
      setMessages(m => [...m, {
        role: "assistant",
        content: isRate
          ? `**Rate limit reached.** ${err.message}`
          : `Could not reach the assistant. Make sure the backend is running.\n\n\`${err.message}\``,
        mode:          "no_source",
        grounded:      false,
        sources:       [],
        tool_calls:    [],
        latency_ms:    0,
        is_rate_limit: isRate,
        retry_after:   err.retryAfter ?? null,
      }]);
    } finally {
      setBusy(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd   = new FormData(e.currentTarget);
    const text = (fd.get("message") as string | null)?.trim() ?? "";
    if (text) doSubmit(text);
  }

  function handleViewSources(i: number) {
    if (evidenceIdx === i && evidenceOpen) {
      setEvidenceOpen(false);
    } else {
      setEvidenceIdx(i);
      setEvidenceOpen(true);
    }
  }

  async function reset() {
    await clearSession(sessionRef.current).catch(() => {});
    sessionRef.current = newSessionId();
    setMessages([]);
    setPendingBookingIdx(null);
    setEvidenceOpen(false);
    setEvidenceIdx(null);
    setResetKey(k => k + 1);
  }

  function loadConversation(conv: any) {
    sessionRef.current = conv.id;
    setMessages(conv.messages);
    setPendingBookingIdx(null);
    setEvidenceOpen(false);
    setEvidenceIdx(null);
    setResetKey(k => k + 1);
  }

  return (
    <div className="app">
      <div className="app-body">
        <ChatHistory
          conversations={conversations}
          activeId={sessionRef.current}
          onSelect={loadConversation}
          onNew={reset}
          onDelete={remove}
          onHome={onHome}
          onOpenProfile={() => setProfileOpen(true)}
          onSymptomChecker={onSymptomChecker}
          user={user}
        />

        <div className="chat-content">
        <div className="chat-wrapper">
        <main className="chat-main">
          <div className="chat-orb chat-orb-1" aria-hidden="true" />
          <div className="chat-orb chat-orb-2" aria-hidden="true" />
          <div className="chat-orb chat-orb-3" aria-hidden="true" />

          <div className="thread" ref={threadRef}>
            {messages.length === 0 && (
              <div className="empty">
                <img src="/mascot.gif" alt="e-Channelling assistant" className="empty-mascot" draggable="false" />
                <h2>Hi! I'm your e-Channelling&nbsp;Assistant</h2>
                <p className="empty-sub">
                  Ask me anything about doctors, appointments or channelling&nbsp;policy
                </p>
                <div className="feature-grid" role="list">
                  {FEATURES.map(f => (
                    <button
                      key={f.title}
                      className="feature-card"
                      role="listitem"
                      onClick={() => doSubmit(f.query)}
                      aria-label={`${f.title}: ${f.desc}`}
                    >
                      <div className={`feature-card-icon ${f.color}`} aria-hidden="true">
                        {f.icon}
                      </div>
                      <div className="feature-card-text">
                        <span className="feature-card-title">{f.title}</span>
                        <span className="feature-card-desc">{f.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="chips-label">Or try asking</p>
                <div className="chips" role="list">
                  {STARTERS.map(s => (
                    <button key={s} className="chip" role="listitem" onClick={() => doSubmit(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <Message
                key={i}
                msg={m}
                active={evidenceIdx === i && evidenceOpen}
                onViewSources={() => handleViewSources(i)}
                onCancelBooking={() => doSubmit("No, cancel that")}
                bookingResolved={pendingBookingIdx !== i}
                onCheckAvailability={(doctor: any) =>
                  doSubmit(`Check availability for ${doctor.name} (ID ${doctor.consultant_id})`)
                }
                onBookSession={(session: any) =>
                  setMessages(prev => [...prev, { role: "booking_form", session, resolved: false }])
                }
                currentUser={user}
                onSubmitBookingForm={(session: any, name: string, phone: string, age: string, forSelf: boolean) => {
                  setMessages(prev => prev.map((msg: any) =>
                    msg.role === "booking_form" && msg.session?.session_id === session.session_id
                      ? { ...msg, resolved: true }
                      : msg
                  ));
                  const ageNote  = age ? `, age ${age}` : "";
                  const selfNote = forSelf ? " (booking for myself)" : "";
                  doSubmit(
                    `I'd like to book session ID ${session.session_id} — ` +
                    `${session.day}, ${session.date} at ${session.start_time}. ` +
                    `Patient name: ${name}${ageNote}, phone: ${phone}${selfNote}`
                  );
                }}
              />
            ))}

            {busy && (
              <div className="thinking-row">
                <div className="avatar bot" aria-hidden="true">
                  <img src="/avatar.png" alt="" className="avatar-img" draggable="false" />
                </div>
                <div className="thinking-bubble">
                  <div className="pulse-wrap" aria-hidden="true">
                    <span className="pulse" />
                    <span className="pulse" />
                    <span className="pulse" />
                  </div>
                  <span className="thinking-label">Searching policy documents and booking data…</span>
                </div>
              </div>
            )}
          </div>
        </main>

        <div className={`ev-drawer${evidenceOpen ? ' open' : ''}`} aria-hidden={!evidenceOpen}>
          <EvidencePanel
            msg={evidenceIdx != null ? messages[evidenceIdx] : null}
            onClose={() => setEvidenceOpen(false)}
          />
        </div>
      </div>

      <div className="bottom-bar">
        <div className="promptbox-wrap">
          <form ref={formRef} onSubmit={handleFormSubmit}>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
              <PromptBox
                key={resetKey}
                ref={promptRef}
                name="message"
                placeholder="Ask about doctors, appointments or channelling policy…"
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
              />
            </fieldset>
          </form>
        </div>
        <div className="bottom-footer">
          <button className="reset-btn" onClick={reset} aria-label="Start a new conversation">
            <RefreshIcon />
            New conversation
          </button>
          <span className="composer-hint">Shift+Enter for new line</span>
        </div>
      </div>
        </div>{/* chat-content */}
      </div>{/* app-body */}

      <AnimatePresence>
        {profileOpen && user && (
          <ProfileModal user={user} onClose={() => setProfileOpen(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}
