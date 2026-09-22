import { useEffect, useRef } from 'react'
import type { StoredConversation } from '../hooks/useConversations'

interface Props {
  open: boolean
  conversations: StoredConversation[]
  activeId: string
  onSelect: (conv: StoredConversation) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
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
  open, conversations, activeId, onSelect, onNew, onDelete, onClose,
}: Props) {
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  const groups = groupConversations(conversations)

  return (
    <>
      <div className={`hist-overlay${open ? ' open' : ''}`} aria-hidden="true" />

      <aside
        ref={sidebarRef}
        className={`hist-sidebar${open ? ' open' : ''}`}
        aria-label="Conversation history"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="hist-header">
          <div className="hist-header-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Conversations
          </div>
          <button className="hist-close-btn" onClick={onClose} aria-label="Close history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* New chat */}
        <div className="hist-new-wrap">
          <button className="hist-new-btn" onClick={() => { onNew(); onClose() }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New conversation
          </button>
        </div>

        {/* List */}
        <div className="hist-list" role="list">
          {conversations.length === 0 ? (
            <div className="hist-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
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
                      onClick={() => { onSelect(conv); onClose() }}
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

        {/* Footer */}
        {conversations.length > 0 && (
          <div className="hist-footer">
            <span>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </aside>
    </>
  )
}
