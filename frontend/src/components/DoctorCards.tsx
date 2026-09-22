interface Doctor {
  consultant_id: number
  name: string
  specialty: string
  qualifications: string
  years_experience: number
  consultation_fee_lkr: number
  languages: string
  hospital: string
  city: string
}

interface Props {
  doctors: Doctor[]
  onCheckAvailability: (doctor: Doctor) => void
}

function HospitalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function fmt(n: number) {
  return `Rs. ${n.toLocaleString('en-LK')}`
}

function DoctorCard({ doctor: d, onCheckAvailability }: { doctor: Doctor; onCheckAvailability: (d: Doctor) => void }) {
  const initials = d.name
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="dc-card">
      {/* Header */}
      <div className="dc-header">
        <div className="dc-avatar" aria-hidden="true">{initials}</div>
        <div className="dc-header-text">
          <div className="dc-name">{d.name}</div>
          <div className="dc-specialty">{d.specialty}</div>
        </div>
        <div className="dc-specialty-badge">{d.specialty.split(' ')[0]}</div>
      </div>

      {/* Hospital */}
      <div className="dc-hospital">
        <HospitalIcon />
        <span>{d.hospital}</span>
        <span className="dc-city">{d.city}</span>
      </div>

      {/* Stats row */}
      <div className="dc-stats">
        <div className="dc-stat">
          <span className="dc-stat-val">{fmt(d.consultation_fee_lkr)}</span>
          <span className="dc-stat-lbl">Consultation</span>
        </div>
        <div className="dc-stat-divider" />
        <div className="dc-stat">
          <span className="dc-stat-val">{d.years_experience} yrs</span>
          <span className="dc-stat-lbl">Experience</span>
        </div>
        <div className="dc-stat-divider" />
        <div className="dc-stat">
          <span className="dc-stat-val">{d.languages.split(',').map(l => l.trim().slice(0,2)).join(' · ')}</span>
          <span className="dc-stat-lbl">Languages</span>
        </div>
      </div>

      {/* Qualifications */}
      <div className="dc-quals">{d.qualifications}</div>

      {/* Action */}
      <button
        className="dc-avail-btn"
        onClick={() => onCheckAvailability(d)}
        aria-label={`Check availability for ${d.name}`}
      >
        <CalendarIcon />
        Check Availability
        <ChevronRight />
      </button>
    </div>
  )
}

export default function DoctorCards({ doctors, onCheckAvailability }: Props) {
  if (!doctors.length) return null
  const n = doctors.length
  return (
    <>
      <p className="cards-caption">Showing {n} doctor{n !== 1 ? 's' : ''}</p>
      <div className="dc-grid" role="list" aria-label="Doctor results">
        {doctors.map(d => (
          <div key={d.consultant_id} role="listitem">
            <DoctorCard doctor={d} onCheckAvailability={onCheckAvailability} />
          </div>
        ))}
      </div>
    </>
  )
}
