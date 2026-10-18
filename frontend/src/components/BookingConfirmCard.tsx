import { useState } from 'react'
import { initiatePayment, completePayment } from '../api'
import SandboxPaymentSheet from './SandboxPaymentSheet'

interface PendingBooking {
  confirmation_token: string
  session_id: number
  doctor: string
  hospital: string
  date: string
  day: string
  time: string
  estimated_appointment_number: number
  consultation_fee_lkr: number
  service_charge_lkr: number
  total_lkr: number
  patient_name: string
  patient_phone: string
}

interface Props {
  booking: PendingBooking
  onCancel: () => void
  resolved: boolean
  currentUserEmail?: string | null
}

type PayState = 'idle' | 'loading' | 'sheet' | 'confirming' | 'paid' | 'error'

function fmt(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bcc-row">
      <span className="bcc-label">{label}</span>
      <span className={`bcc-value${accent ? ' bcc-accent' : ''}`}>{value}</span>
    </div>
  )
}

export default function BookingConfirmCard({ booking: b, onCancel, resolved, currentUserEmail }: Props) {
  const [payState,  setPayState]  = useState<PayState>('idle')
  const [payData,   setPayData]   = useState<Record<string, string> | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [apptNum,   setApptNum]   = useState<number | null>(null)
  const [errorMsg,  setErrorMsg]  = useState<string>('')

  if (resolved && payState !== 'paid') {
    return (
      <div className="bcc bcc-dim">
        <div className="bcc-resolved-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>Booking cancelled</span>
        </div>
      </div>
    )
  }

  if (payState === 'paid' && reference) {
    return (
      <div className="bcc bcc-paid">
        <div className="bcc-paid-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div className="bcc-paid-body">
          <div className="bcc-paid-title">Booking Confirmed</div>
          <div className="bcc-paid-sub">{b.doctor} · {b.day}, {b.date} at {b.time}</div>
          <div className="bcc-paid-ref">
            <span className="bcc-paid-ref-label">Reference</span>
            <span className="bcc-paid-ref-value">{reference}</span>
          </div>
          {apptNum && (
            <div className="bcc-paid-ref">
              <span className="bcc-paid-ref-label">Appointment #</span>
              <span className="bcc-paid-ref-value">{apptNum}</span>
            </div>
          )}
          <div className="bcc-paid-note">Sandbox payment — no real charge was made</div>
        </div>
      </div>
    )
  }

  async function handlePay() {
    setPayState('loading')
    setErrorMsg('')
    try {
      const data = await initiatePayment(b.confirmation_token, b.patient_name)
      setPayData(data)
      setPayState('sheet')
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not start payment. Please try again.')
      setPayState('error')
    }
  }

  async function handleSheetPay(fakeOrderId: string, email: string) {
    setPayState('confirming')
    try {
      const result = await completePayment(b.confirmation_token, fakeOrderId, null, email || null)
      setReference(result.reference)
      setApptNum(result.appointment_number ?? null)
      setPayState('paid')
    } catch (err: any) {
      setErrorMsg(err.message || 'Booking confirmation failed. Please contact support.')
      setPayState('error')
    }
  }

  const isActive = payState === 'idle' || payState === 'error'

  return (
    <>
      {payState === 'sheet' && payData && (
        <SandboxPaymentSheet
          amount={payData.amount}
          currency={payData.currency}
          description={payData.items}
          defaultEmail={currentUserEmail ?? ''}
          onPay={handleSheetPay}
          onDismiss={() => setPayState('idle')}
        />
      )}

      <div className="bcc">
        <div className="bcc-header">
          <div className="bcc-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="9 13 12 16 15 13"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
          </div>
          <div>
            <div className="bcc-header-title">Booking Preview</div>
            <div className="bcc-header-sub">Review your appointment details before paying</div>
          </div>
        </div>

        <div className="bcc-body">
          <Row label="Doctor"   value={b.doctor} />
          <Row label="Hospital" value={b.hospital} />
          <Row label="Date"     value={`${b.day}, ${b.date}`} />
          <Row label="Time"     value={b.time} />
          <Row label="Appointment #" value={String(b.estimated_appointment_number)} />
          <div className="bcc-divider" />
          <Row label="Patient"  value={b.patient_name} />
          <Row label="Phone"    value={b.patient_phone} />
          <div className="bcc-divider" />
          <Row label="Consultation fee"   value={fmt(b.consultation_fee_lkr)} />
          <Row label="Channelling charge" value={fmt(b.service_charge_lkr)} />
          <Row label="Total"              value={fmt(b.total_lkr)} accent />
        </div>

        {payState === 'error' && errorMsg && (
          <div className="bcc-error-banner" role="alert">{errorMsg}</div>
        )}

        {payState === 'confirming' && (
          <div className="bcc-status-banner">
            <div className="bcc-spinner" aria-hidden="true" />
            Confirming your booking…
          </div>
        )}

        <div className="bcc-actions">
          <button
            className="bcc-btn bcc-cancel"
            onClick={onCancel}
            disabled={!isActive}
          >
            Cancel
          </button>
          <button
            className="bcc-btn bcc-pay"
            onClick={handlePay}
            disabled={!isActive || payState === 'confirming' || payState === 'loading'}
          >
            {payState === 'loading' ? (
              <><div className="bcc-btn-spinner" aria-hidden="true" />Preparing…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Pay &amp; Book
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
