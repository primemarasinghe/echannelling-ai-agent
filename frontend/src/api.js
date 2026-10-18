const BASE = import.meta.env.VITE_API_BASE || ''

function authHeaders() {
  const token = localStorage.getItem('ech_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...opts,
  })

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data?.detail?.message || 'Too many messages. Please wait a moment.')
    err.isRateLimit = true
    err.retryAfter  = data?.detail?.retry_after ?? 60
    throw err
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg  = body?.detail ?? `${res.status} ${res.statusText}`
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg))
  }
  if (res.status === 204) return null
  return res.json()
}

export const sendMessage = (message, sessionKey) =>
  req('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_key: sessionKey }),
  })

export const clearSession = (sessionKey) =>
  req(`/api/chat/${sessionKey}`, { method: 'DELETE' })

export const getStats    = () => req('/api/stats')
export const getHealth   = () => req('/health')
export const getGaps     = () => req('/api/gaps')
export const getBookings = () => req('/api/bookings')

export const googleSignIn = (credential) =>
  req('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })

export const registerUser = (name, email, password) =>
  req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })

export const loginUser = (email, password) =>
  req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const forgotPassword = (email) =>
  req('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const getProfile = () => req('/api/auth/me')

export const updateProfile = (data) =>
  req('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const getDoctors       = ()      => req('/api/doctors')
export const getDoctorDetail  = (id)    => req(`/api/doctors/${id}`)
export const getHospitals     = ()      => req('/api/doctors/hospitals')
export const registerDoctor   = (body)  => req('/api/doctors', { method: 'POST', body: JSON.stringify(body) })
export const getDoctorPortal        = ()         => req('/api/portal/dashboard')
export const createPortalSession    = (body)      => req('/api/portal/sessions', { method: 'POST', body: JSON.stringify(body) })
export const deletePortalSession    = (id)        => req(`/api/portal/sessions/${id}`, { method: 'DELETE' })
export const updatePortalProfile    = (body)      => req('/api/portal/profile', { method: 'PATCH', body: JSON.stringify(body) })
export const getPortalNotifications = ()          => req('/api/portal/notifications')
export const markNotificationsRead  = ()          => req('/api/portal/notifications/read-all', { method: 'PATCH' })
export const deleteDoctor     = (id)    => req(`/api/doctors/${id}`, { method: 'DELETE' })
export const updateDoctor     = (id, body) => req(`/api/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const getSymptomQuestions = (body) =>
  req('/api/symptoms/questions', { method: 'POST', body: JSON.stringify(body) })

export const analyzeSymptoms = (body) =>
  req('/api/symptoms/analyze', { method: 'POST', body: JSON.stringify(body) })

export const initiatePayment  = (confirmationToken, patientName) =>
  req('/api/payment/initiate', {
    method: 'POST',
    body: JSON.stringify({ confirmation_token: confirmationToken, patient_name: patientName }),
  })

export const completePayment  = (confirmationToken, orderId, paymentId = null, patientEmail = null) =>
  req('/api/payment/complete', {
    method: 'POST',
    body: JSON.stringify({
      confirmation_token: confirmationToken,
      order_id: orderId,
      payment_id: paymentId,
      patient_email: patientEmail,
    }),
  })
