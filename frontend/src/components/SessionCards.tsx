interface SessionSlot {
  session_id: number
  doctor: string
  hospital: string
  date: string       // "2026-09-22"
  day: string        // "Tuesday"
  start_time: string // "06:00 PM"
  available_slots: number
  fee_lkr: number
}

interface Props {
  sessions: SessionSlot[]
  onBook: (session: SessionSlot) => void
  window?: string
}

function parseDateParts(dateStr: string) {
  const [, mm, dd] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return { num: dd, month: months[parseInt(mm, 10) - 1] }
}

function slotClass(n: number) {
  if (n >= 10) return 'sc-slots-ok'
  if (n >= 5)  return 'sc-slots-mid'
  if (n >= 2)  return 'sc-slots-low'
  return 'sc-slots-urgent'
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function SessionCard({ s, onBook }: { s: SessionSlot; onBook: (s: SessionSlot) => void }) {
  const { num, month } = parseDateParts(s.date)
  const dayAbbr = s.day.slice(0, 3).toUpperCase()
  const fee = `Rs. ${s.fee_lkr.toLocaleString('en-LK')}`

  return (
    <div className="sc-card">
      {/* Date block — left */}
      <div className="sc-date-block" aria-label={`${s.day}, ${s.date}`}>
        <span className="sc-day-abbr">{dayAbbr}</span>
        <span className="sc-date-num">{num}</span>
        <span className="sc-month">{month}</span>
      </div>

      {/* Body — right */}
      <div className="sc-body">
        <div className="sc-time-row">
          <span className="sc-time">{s.start_time}</span>
          <span className={`sc-slots-badge ${slotClass(s.available_slots)}`}>
            {s.available_slots} slot{s.available_slots !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="sc-hospital">{s.hospital}</div>

        <div className="sc-meta-row">
          <span className="sc-fee">{fee}</span>
          <button
            className="sc-book-btn"
            onClick={() => onBook(s)}
            aria-label={`Book session on ${s.day} ${s.date} at ${s.start_time}`}
          >
            <CalendarIcon />
            Book
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SessionCards({ sessions, onBook, window }: Props) {
  if (!sessions.length) return null
  const caption = window
    ? `Showing available sessions, ${window}`
    : 'Showing available sessions'
  return (
    <>
      <p className="cards-caption">{caption}</p>
      <div className="sc-grid" role="list" aria-label="Available sessions">
        {sessions.map((s, i) => (
          <div key={s.session_id} role="listitem" style={{ animationDelay: `${i * 60}ms` }}>
            <SessionCard s={s} onBook={onBook} />
          </div>
        ))}
      </div>
    </>
  )
}
