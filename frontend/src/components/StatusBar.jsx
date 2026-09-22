import { useEffect, useRef, useState } from 'react'

function StatusRow({ label, ok, text }) {
  return (
    <div className="sb-row">
      <span className="sb-row-label">{label}</span>
      <span className={`sb-row-val${ok === undefined ? '' : ok ? ' ok' : ' bad'}`}>
        {ok === undefined ? null : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {ok
              ? <polyline points="20 6 9 17 4 12"/>
              : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            }
          </svg>
        )}
        {text}
      </span>
    </div>
  )
}

function StatRow({ label, value, accent }) {
  return (
    <div className="sb-row">
      <span className="sb-row-label">{label}</span>
      <span className={`sb-row-num${accent ? ' accent' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function StatusBar({ health, stats, onHistoryToggle, historyOpen }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const btnRef   = useRef(null)

  const ok = health?.status === 'ok'

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  return (
    <header className="statusbar">
      {/* History toggle */}
      <button
        className={`sb-hist-btn${historyOpen ? ' active' : ''}`}
        onClick={onHistoryToggle}
        aria-label="Conversation history"
        aria-expanded={historyOpen}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* Brand */}
      <div className="brand">
        <img
          src="/logo.png"
          alt="eChannelling by SLT MOBITEL"
          className="brand-logo"
          draggable="false"
        />
        <span className="brand-ai-tag">AI Assistant</span>
      </div>

      <div className="spacer" />

      {/* Online indicator */}
      <div className="stat">
        <span className={`dot ${ok ? 'ok' : 'bad'}`} />
        {ok ? 'Online' : 'Degraded'}
      </div>

      {/* Emergency call */}
      <a href="tel:1990" className="eb-pill" aria-label="Medical emergency — call 1990 Suwa Seriya">
        <span className="eb-pill-icon" aria-hidden="true">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </span>
        <span>Emergency</span>
        <strong>1990</strong>
      </a>

      {/* Status button */}
      <div className="sb-dropdown-wrap">
        <button
          ref={btnRef}
          className={`sb-status-btn${open ? ' active' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label="System status and statistics"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          Status
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {open && (
          <div ref={panelRef} className="sb-panel" role="dialog" aria-label="System status panel">

            {/* Section: System */}
            <div className="sb-section-head">System</div>
            <StatusRow label="Database"     ok={health?.postgres}  text={health?.postgres  ? 'Connected' : 'Unreachable'} />
            <StatusRow label="Vector search" ok={health?.pgvector}  text={health?.pgvector  ? 'Enabled'   : 'Unavailable'} />
            <StatusRow label="OpenAI key"   ok={health?.openai_key_present} text={health?.openai_key_present ? 'Present' : 'Missing'} />

            <div className="sb-divider" />

            {/* Section: Models */}
            <div className="sb-section-head">Models</div>
            <StatusRow label="Chat"      text={health?.chat_model       ?? '—'} />
            <StatusRow label="Embedding" text={health?.embedding_model  ?? '—'} />

            <div className="sb-divider" />

            {/* Section: Data */}
            <div className="sb-section-head">Data</div>
            <StatRow label="Policy chunks" value={stats?.kb_chunks}   accent />
            <StatRow label="Doctors"       value={stats?.consultants} accent />
            <StatRow label="Sessions"      value={stats?.sessions}    accent />
            <StatRow label="Bookings"      value={stats?.bookings} />
            <StatRow label="Messages logged" value={stats?.messages_logged} />
          </div>
        )}
      </div>
    </header>
  )
}
