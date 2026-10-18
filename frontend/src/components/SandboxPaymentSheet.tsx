/**
 * Simulated payment sheet for sandbox / local development.
 * Mimics a PayHere-style card form. No real gateway call —
 * swap this for window.payhere.startPayment() when live credentials are ready.
 */
import { useEffect, useRef, useState } from 'react'

interface Props {
  amount: string
  currency: string
  description: string
  defaultEmail?: string
  onPay:     (fakeOrderId: string, email: string) => void
  onDismiss: () => void
}

const TEST_CARDS = [
  { label: 'Visa',   number: '4916 2177 8734 6324', cvv: '576' },
  { label: 'Master', number: '5307 7324 3865 1244', cvv: '619' },
]

function fmt(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function fmtExpiry(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d
}

export default function SandboxPaymentSheet({ amount, currency, description, defaultEmail = '', onPay, onDismiss }: Props) {
  const [card,    setCard]    = useState('')
  const [expiry,  setExpiry]  = useState('')
  const [cvv,     setCvv]     = useState('')
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState(defaultEmail)
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState('')
  const cardRef = useRef<HTMLInputElement>(null)

  // Sync email field if the prop arrives after first mount (auth context hydration race)
  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail)
  }, [defaultEmail])

  function fill(tc: typeof TEST_CARDS[0]) {
    setCard(tc.number)
    setExpiry('12/26')
    setCvv(tc.cvv)
    setName('Test Cardholder')
    setErr('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = card.replace(/\s/g, '')
    if (digits.length < 13)      { setErr('Enter a valid card number'); return }
    if (expiry.length < 5)       { setErr('Enter expiry MM/YY'); return }
    if (cvv.length < 3)          { setErr('Enter CVV'); return }
    if (!email.trim())           { setErr('Enter your email address for the receipt'); return }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setErr('Enter a valid email address'); return }

    setBusy(true)
    setErr('')

    // Simulate gateway latency
    await new Promise(r => setTimeout(r, 1400))

    const fakeOrderId = 'SANDBOX-' + Date.now()
    onPay(fakeOrderId, email.trim())
  }

  return (
    <div className="spay-overlay" role="dialog" aria-modal="true" aria-label="Sandbox payment">
      <div className="spay-sheet">

        {/* header */}
        <div className="spay-header">
          <div className="spay-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            PayHere <span className="spay-sandbox-badge">SANDBOX</span>
          </div>
          <button className="spay-close" onClick={onDismiss} aria-label="Cancel payment" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* amount */}
        <div className="spay-amount-row">
          <span className="spay-desc">{description}</span>
          <span className="spay-amount">{currency} {Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* quick-fill test cards */}
        <div className="spay-testcards">
          <span className="spay-testcards-label">Test cards</span>
          {TEST_CARDS.map(tc => (
            <button key={tc.label} type="button" className="spay-testcard-btn" onClick={() => fill(tc)}>
              {tc.label} {tc.number.slice(-4)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="spay-field">
            <label className="spay-label">Card Number</label>
            <input
              ref={cardRef}
              className="spay-input"
              value={card}
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              onChange={e => { setCard(fmt(e.target.value)); setErr('') }}
            />
          </div>

          <div className="spay-row2">
            <div className="spay-field">
              <label className="spay-label">Expiry</label>
              <input
                className="spay-input"
                value={expiry}
                inputMode="numeric"
                placeholder="MM/YY"
                onChange={e => { setExpiry(fmtExpiry(e.target.value)); setErr('') }}
              />
            </div>
            <div className="spay-field">
              <label className="spay-label">CVV</label>
              <input
                className="spay-input"
                value={cvv}
                inputMode="numeric"
                placeholder="•••"
                maxLength={4}
                onChange={e => { setCvv(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr('') }}
              />
            </div>
          </div>

          <div className="spay-field">
            <label className="spay-label">Cardholder Name</label>
            <input
              className="spay-input"
              value={name}
              placeholder="As on card"
              onChange={e => { setName(e.target.value); setErr('') }}
            />
          </div>

          <div className="spay-field">
            <label className="spay-label">Email for confirmation receipt</label>
            <input
              type="email"
              className="spay-input"
              value={email}
              placeholder="your@email.com"
              onChange={e => { setEmail(e.target.value); setErr('') }}
            />
          </div>

          {err && <div className="spay-err" role="alert">{err}</div>}

          <button type="submit" className="spay-pay-btn" disabled={busy}>
            {busy ? (
              <><div className="spay-spinner" />Processing…</>
            ) : (
              <>Pay {currency} {Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</>
            )}
          </button>
        </form>

        <div className="spay-footer">
          🔒 Sandbox mode — no real transaction will occur
        </div>
      </div>
    </div>
  )
}
