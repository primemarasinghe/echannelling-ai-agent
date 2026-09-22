import { useCallback, useState } from 'react'

const STORAGE_KEY = 'ech_chat_history'
const MAX_CONVS = 30

export interface StoredConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: any[]
}

function load(): StoredConversation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(convs: StoredConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVS)))
  } catch {}
}

export function useConversations() {
  const [conversations, setConversations] = useState<StoredConversation[]>(load)

  const save = useCallback((id: string, messages: any[]) => {
    if (!messages.length) return
    const title =
      messages.find((m: any) => m.role === 'user')?.content?.slice(0, 65) ?? 'Conversation'
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id)
      const now = new Date().toISOString()
      const updated: StoredConversation = {
        id,
        title,
        createdAt: idx >= 0 ? prev[idx].createdAt : now,
        updatedAt: now,
        messages,
      }
      const next =
        idx >= 0 ? prev.map((c, i) => (i === idx ? updated : c)) : [updated, ...prev]
      persist(next)
      return next.slice(0, MAX_CONVS)
    })
  }, [])

  const remove = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      persist(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setConversations([])
  }, [])

  return { conversations, save, remove, clearAll }
}
