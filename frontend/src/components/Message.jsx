import ReactMarkdown from 'react-markdown'
import BookingConfirmCard from './BookingConfirmCard'
import BookingQuestionCard from './BookingQuestionCard'
import DoctorCards from './DoctorCards'
import SessionCards from './SessionCards'

const MODE_META = {
  knowledge_base:  { cls: 'kb',    label: 'Policy' },
  structured_data: { cls: 'data',  label: 'Database' },
  mixed:           { cls: 'mixed', label: 'Combined' },
  from_context:    { cls: 'ctx',   label: 'Context' },
  no_source:       { cls: 'none',  label: 'Unverified' },
}

function BotAvatar() {
  return (
    <div className="avatar bot" aria-hidden="true">
      <img src="/avatar.png" alt="" className="avatar-img" draggable="false" />
    </div>
  )
}

function UserAvatar() {
  return (
    <div className="avatar user" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </div>
  )
}

export default function Message({
  msg,
  active,
  onViewSources,
  onCancelBooking,
  bookingResolved,
  onCheckAvailability,
  onBookSession,
  currentUser,
  onSubmitBookingForm,
}) {
  if (msg.role === 'booking_form') {
    return (
      <div className="msg-row bot-row">
        <BotAvatar />
        <div className="msg-stack">
          <div className="msg-sender" aria-hidden="true">eChannelling AI</div>
          <BookingQuestionCard
            session={msg.session}
            currentUser={currentUser ?? null}
            resolved={msg.resolved}
            onBook={(name, phone, age, forSelf) => onSubmitBookingForm?.(msg.session, name, phone, age, forSelf)}
          />
        </div>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div className="msg-row user-row">
        <div className="msg-stack">
          <div className="bubble user">{msg.content}</div>
        </div>
        <UserAvatar />
      </div>
    )
  }

  const meta  = MODE_META[msg.mode] || { cls: 'none', label: 'Unverified' }
  const nSrc  = msg.sources?.length   || 0
  const nTool = msg.tool_calls?.length || 0
  const total = nSrc + nTool

  return (
    <div className="msg-row bot-row">
      <BotAvatar />
      <div className="msg-stack">
        <div className="msg-sender" aria-hidden="true">eChannelling AI</div>

        <div className={`bubble bot${active ? ' selected' : ''}`}>
          <div className="md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
        </div>

        {/* Doctor cards */}
        {msg.doctor_cards?.length > 0 && (
          <DoctorCards
            doctors={msg.doctor_cards}
            onCheckAvailability={onCheckAvailability}
          />
        )}

        {/* Session cards */}
        {msg.session_cards?.length > 0 && (
          <SessionCards
            sessions={msg.session_cards}
            onBook={onBookSession}
            window={msg.session_window ?? undefined}
          />
        )}

        {/* Booking confirmation card */}
        {msg.pending_booking && (
          <BookingConfirmCard
            booking={msg.pending_booking}
            onCancel={onCancelBooking}
            resolved={bookingResolved}
            currentUserEmail={currentUser?.email ?? null}
          />
        )}

        <div className="msg-meta">
          <span className={`badge ${meta.cls}`}>{meta.label}</span>

          {msg.latency_ms != null && (
            <>
              <span className="meta-sep">·</span>
              <span className="meta-pill">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {(msg.latency_ms / 1000).toFixed(1)}s
              </span>
            </>
          )}

          {total > 0 && (
            <>
              <span className="meta-sep">·</span>
              <button
                className={`view-sources-btn${active ? ' active' : ''}`}
                onClick={onViewSources}
                aria-pressed={active}
                aria-label={`${active ? 'Close' : 'View'} sources — ${total} reference${total !== 1 ? 's' : ''}`}
              >
                <svg viewBox="0 0 24 24">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                {active ? 'Hide' : `${total} source${total !== 1 ? 's' : ''}`}
                {active
                  ? <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  : <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
