interface PendingBooking {
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
  onConfirm: () => void
  onCancel:  () => void
  resolved:  boolean
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bcc-row">
      <span className="bcc-label">{label}</span>
      <span className={`bcc-value${accent ? ' bcc-accent' : ''}`}>{value}</span>
    </div>
  )
}

function fmt(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export default function BookingConfirmCard({ booking: b, onConfirm, onCancel, resolved }: Props) {
  return (
    <div className="bcc">
      <div className="bcc-header">
        <div className="bcc-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <polyline points="9 13 12 16 15 13"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
        </div>
        <div>
          <div className="bcc-header-title">Booking Preview</div>
          <div className="bcc-header-sub">Please review before confirming</div>
        </div>
      </div>

      <div className="bcc-body">
        <Row label="Doctor"   value={b.doctor} />
        <Row label="Hospital" value={b.hospital} />
        <Row label="Date"     value={`${b.day}, ${b.date}`} />
        <Row label="Time"     value={b.time} />
        <Row label="Appointment #" value={String(b.estimated_appointment_number)} />
        <div className="bcc-divider" />
        <Row label="Patient"       value={b.patient_name} />
        <Row label="Phone"         value={b.patient_phone} />
        <div className="bcc-divider" />
        <Row label="Consultation fee"     value={fmt(b.consultation_fee_lkr)} />
        <Row label="Channelling charge"   value={fmt(b.service_charge_lkr)} />
        <Row label="Total"                value={fmt(b.total_lkr)} accent />
      </div>

      <div className="bcc-actions">
        <button
          className="bcc-btn bcc-cancel"
          onClick={onCancel}
          disabled={resolved}
          aria-label="Cancel this booking"
        >
          Cancel
        </button>
        <button
          className="bcc-btn bcc-confirm"
          onClick={onConfirm}
          disabled={resolved}
          aria-label="Confirm this booking"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Confirm Booking
        </button>
      </div>
    </div>
  )
}
