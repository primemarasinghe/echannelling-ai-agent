import { useEffect, useRef, useState } from "react";

interface BookingSession {
  session_id: number;
  doctor: string;
  hospital: string;
  date: string;
  day: string;
  start_time: string;
  available_slots: number;
  fee_lkr: number;
}

interface CurrentUser {
  name: string;
  phone?: string | null;
  date_of_birth?: string | null;
}

interface Props {
  session: BookingSession;
  currentUser: CurrentUser | null;
  resolved: boolean;
  onSubmit: (name: string, phone: string, age: string, forSelf: boolean) => void;
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() - birth.getMonth() < 0 ||
     (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age > 0 ? String(age) : "";
}

export default function BookingFormCard({ session: s, currentUser, resolved, onSubmit }: Props) {
  const [forSelf, setForSelf] = useState(true);

  const selfName  = currentUser?.name  ?? "";
  const selfPhone = currentUser?.phone ?? "";
  const selfAge   = calcAge(currentUser?.date_of_birth);

  const [name,   setName]   = useState(selfName);
  const [phone,  setPhone]  = useState(selfPhone);
  const [age,    setAge]    = useState(selfAge);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (forSelf) {
      setName(selfName); setPhone(selfPhone); setAge(selfAge);
    } else {
      setName(""); setPhone(""); setAge("");
      setTimeout(() => phoneRef.current?.focus(), 40);
    }
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forSelf]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Name is required";
    if (!phone.trim()) {
      e.phone = "Phone is required";
    } else {
      const c = phone.replace(/[\s\-().+]/g, "");
      const n = c.startsWith("94") && c.length === 11 ? "0" + c.slice(2) : c;
      if (!/^0\d{9}$/.test(n)) e.phone = "Enter a valid 10-digit number";
    }
    if (age && (isNaN(+age) || +age < 1 || +age > 120)) e.age = "Invalid age";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(name.trim(), phone.trim(), age.trim(), forSelf);
  }

  const fmtDate = () =>
    new Date(s.date + "T00:00:00").toLocaleDateString("en-LK", {
      weekday: "short", day: "numeric", month: "short",
    });

  if (resolved) {
    return (
      <div className="bfc bfc-resolved">
        <div className="bfc-resolved-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div className="bfc-resolved-title">Booking request sent</div>
          <div className="bfc-resolved-sub">{s.doctor} · {fmtDate()} at {s.start_time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bfc">
      {/* Session summary strip */}
      <div className="bfc-session-strip">
        <div className="bfc-session-doctor">{s.doctor}</div>
        <div className="bfc-session-meta">
          <span>{fmtDate()}</span>
          <span className="bfc-dot" />
          <span>{s.start_time}</span>
          <span className="bfc-dot" />
          <span>Rs. {s.fee_lkr.toLocaleString()}</span>
        </div>
      </div>

      <form className="bfc-form" onSubmit={handleSubmit} noValidate>
        {/* Question */}
        <div className="bfc-question">Is this appointment for you or someone else?</div>

        {/* Toggle */}
        <div className="bfc-toggle">
          <button type="button" className={`bfc-tab${forSelf  ? " active" : ""}`} onClick={() => setForSelf(true)}>
            For myself
          </button>
          <button type="button" className={`bfc-tab${!forSelf ? " active" : ""}`} onClick={() => setForSelf(false)}>
            Someone else
          </button>
        </div>

        {/* Name */}
        <div className="bfc-field">
          <label className="bfc-label">Patient Name <span className="bfc-req">*</span></label>
          <input
            className={`bfc-input${errors.name ? " bfc-input-err" : ""}${forSelf ? " bfc-input-readonly" : ""}`}
            value={name}
            readOnly={forSelf}
            onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: ""})); }}
            placeholder="Full name"
          />
          {forSelf && <div className="bfc-autofill-hint">✓ Auto-filled from your profile</div>}
          {errors.name && <div className="bfc-err">{errors.name}</div>}
        </div>

        {/* Phone + Age */}
        <div className="bfc-row2">
          <div className="bfc-field">
            <label className="bfc-label">Phone <span className="bfc-req">*</span></label>
            <input
              ref={phoneRef}
              type="tel"
              className={`bfc-input${errors.phone ? " bfc-input-err" : ""}${forSelf && !!selfPhone ? " bfc-input-readonly" : ""}`}
              value={phone}
              readOnly={forSelf && !!selfPhone}
              onChange={e => { setPhone(e.target.value); setErrors(p => ({...p, phone: ""})); }}
              placeholder="077 xxx xxxx"
            />
            {forSelf && selfPhone && <div className="bfc-autofill-hint">✓ From profile</div>}
            {errors.phone && <div className="bfc-err">{errors.phone}</div>}
          </div>
          <div className="bfc-field">
            <label className="bfc-label">Age</label>
            <input
              type="number" min={1} max={120}
              className={`bfc-input${errors.age ? " bfc-input-err" : ""}${forSelf && !!selfAge ? " bfc-input-readonly" : ""}`}
              value={age}
              readOnly={forSelf && !!selfAge}
              onChange={e => { setAge(e.target.value); setErrors(p => ({...p, age: ""})); }}
              placeholder="—"
            />
            {forSelf && selfAge && <div className="bfc-autofill-hint">✓ From DOB</div>}
            {errors.age && <div className="bfc-err">{errors.age}</div>}
          </div>
        </div>

        <button type="submit" className="bfc-submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Confirm Booking
        </button>
      </form>
    </div>
  );
}
