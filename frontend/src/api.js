const BASE = import.meta.env.VITE_API_BASE || ''

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data?.detail?.message || 'Too many messages. Please wait a moment.')
    err.isRateLimit = true
    err.retryAfter  = data?.detail?.retry_after ?? 60
    throw err
  }

  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

export const sendMessage = (message, sessionKey) =>
  req('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_key: sessionKey }),
  })

export const clearSession = (sessionKey) =>
  req(`/api/chat/${sessionKey}`, { method: 'DELETE' })

export const getStats  = () => req('/api/stats')
export const getHealth = () => req('/health')
export const getGaps   = () => req('/api/gaps')
