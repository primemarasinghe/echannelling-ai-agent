import type { StoredConversation } from '../hooks/useConversations'
import type { AuthUser } from '../context/AuthContext'

interface Props {
  conversations: StoredConversation[]
  activeId: string
  onSelect: (conv: StoredConversation) => void
  onNew: () => void
  onDelete: (id: string) => void
  onHome?: () => void
  onOpenProfile?: () => void
  user?: AuthUser | null
}

function groupConversations(convs: StoredConversation[]) {
  const now = new Date()
  const todayStr = now.toDateString()
  const yday = new Date(now); yday.setDate(yday.getDate() - 1)
  const ydayStr = yday.toDateString()
  const week = new Date(now); week.setDate(week.getDate() - 7)

  const groups: { label: string; items: StoredConversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const c of convs) {
    const d = new Date(c.updatedAt)
    if (d.toDateString() === todayStr) groups[0].items.push(c)
    else if (d.toDateString() === ydayStr) groups[1].items.push(c)
    else if (d >= week) groups[2].items.push(c)
    else groups[3].items.push(c)
  }

  return groups.filter(g => g.items.length > 0)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ChatHistory({
  conversations, activeId, onSelect, onNew, onDelete, onHome, onOpenProfile, user,
}: Props) {
  const groups = groupConversations(conversations)
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'doctor' ? 'Doctor' : 'Patient'

  return (
    <aside className="chat-sidebar" aria-label="Navigation and conversation history">

      {/* ── Back to home ── */}
      {onHome && (
        <div className="chat-sb-back-wrap">
          <button className="hp-sidebar-link chat-sb-back-btn" onClick={onHome} aria-label="Back to home">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Home
          </button>
        </div>
      )}

      {/* ── Profile card — matches homepage sidebar ── */}
      <div className="hp-sidebar-profile chat-sb-profile">
        <button
          className="chat-sb-avatar-btn"
          onClick={onOpenProfile}
          title="Edit profile"
          aria-label="Edit profile"
        >
          {user?.picture
            ? <img src={user.picture} alt={user?.name ?? 'Profile'} className="hp-sidebar-avatar" referrerPolicy="no-referrer" />
            : <div className="hp-sidebar-avatar hp-sidebar-avatar-fallback">{user?.name?.[0]?.toUpperCase() ?? '?'}</div>
          }
        </button>
        <div className="hp-sidebar-name">{user?.name ?? 'Guest'}</div>
        <div className="hp-sidebar-email">{user?.email ?? ''}</div>
        <span className="chat-sb-role-pill">{roleLabel}</span>
      </div>

      {/* ── New conversation ── */}
      <div className="hist-new-wrap">
        <button className="hist-new-btn" onClick={onNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New conversation
        </button>
      </div>

      {/* ── History label ── */}
      <div className="chat-sb-history-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        History
      </div>

      {/* ── Conversation list ── */}
      <div className="hist-list" role="list">
        {conversations.length === 0 ? (
          <div className="hist-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No conversations yet</p>
            <span>Your chat history will appear here</span>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="hist-group">
              <div className="hist-group-label">{group.label}</div>
              {group.items.map(conv => (
                <div
                  key={conv.id}
                  role="listitem"
                  className={`hist-item${conv.id === activeId ? ' active' : ''}`}
                >
                  <button
                    className="hist-item-btn"
                    onClick={() => onSelect(conv)}
                    title={conv.title}
                  >
                    <span className="hist-item-title">{conv.title}</span>
                    <span className="hist-item-time">{formatTime(conv.updatedAt)}</span>
                  </button>
                  <button
                    className="hist-item-delete"
                    onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
                    aria-label="Delete conversation"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* ── Footer count ── */}
      {conversations.length > 0 && (
        <div className="hist-footer">
          <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </aside>
  )
}
