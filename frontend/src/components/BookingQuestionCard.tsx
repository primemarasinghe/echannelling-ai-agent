import { useRef, useState } from "react";

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
  onBook: (name: string, phone: string, age: string, forSelf: boolean) => void;
}

function calcAge(dob?: string | null) {
  if (!dob) return "";
  const b = new Date(dob), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() - b.getMonth() < 0 ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a > 0 ? String(a) : "";
}

type Stage = "question" | "self_phone" | "other_form";

export default function BookingQuestionCard({ session: s, currentUser, resolved, onBook }: Props) {
  const [stage, setStage]     = useState<Stage>("question");
  /* for "myself" when phone is missing */
  const [phone, setPhone]     = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  /* for "someone else" */
  const [name, setName]       = useState("");
  const [otherPhone, setOtherPhone] = useState("");
  const [age, setAge]         = useState("");
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef  = useRef<HTMLInputElement>(null);

  const selfName  = currentUser?.name  ?? "";
  const selfPhone = currentUser?.phone ?? "";
  const selfAge   = calcAge(currentUser?.date_of_birth);

  const fmtDate = () =>
    new Date(s.date + "T00:00:00").toLocaleDateString("en-LK", {
      weekday: "short", day: "numeric", month: "short",
    });

  /* ── handlers ── */
  function handleForSelf() {
    if (selfPhone) {
      // All details available — fire immediately
      onBook(selfName, selfPhone, selfAge, true);
    } else {
      // Need phone — show mini input
      setStage("self_phone");
      setTimeout(() => phoneRef.current?.focus(), 60);
    }
  }

  function handleSelfPhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = phone.replace(/[\s\-().+]/g, "");
    const norm  = clean.startsWith("94") && clean.length === 11 ? "0" + clean.slice(2) : clean;
    if (!/^0\d{9}$/.test(norm)) { setPhoneErr("Enter a valid 10-digit Sri Lankan number"); return; }
    onBook(selfName, phone.trim(), selfAge, true);
  }

  function handleForOther() {
    setStage("other_form");
    setTimeout(() => nameRef.current?.focus(), 60);
  }

  function handleOtherSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!otherPhone.trim()) {
      errs.phone = "Phone is required";
    } else {
      const c = otherPhone.replace(/[\s\-().+]/g, "");
      const n = c.startsWith("94") && c.length === 11 ? "0" + c.slice(2) : c;
      if (!/^0\d{9}$/.test(n)) errs.phone = "Enter a valid 10-digit number";
    }
    if (age && (isNaN(+age) || +age < 1 || +age > 120)) errs.age = "Invalid age";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onBook(name.trim(), otherPhone.trim(), age.trim(), false);
  }

  /* ── resolved ── */
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

  /* ── session strip (shown in all stages) ── */
  const strip = (
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
  );

  /* ══════════════════════════════════════
     STAGE: question
  ══════════════════════════════════════ */
  if (stage === "question") {
    return (
      <div className="bfc">
        {strip}
        <div className="bfc-form">
          <div className="bfc-question">Is this appointment for you or for someone else?</div>
          <div className="bfq-btn-row">
            <button className="bfq-choice-btn bfq-self" type="button" onClick={handleForSelf}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              For myself
            </button>
            <button className="bfq-choice-btn bfq-other" type="button" onClick={handleForOther}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Someone else
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STAGE: self — phone missing
  ══════════════════════════════════════ */
  if (stage === "self_phone") {
    return (
      <div className="bfc">
        {strip}
        <form className="bfc-form" onSubmit={handleSelfPhoneSubmit} noValidate>
          <div className="bfc-question">Booking for <strong>{selfName}</strong> — just need your phone number:</div>
          <div className="bfc-field">
            <label className="bfc-label">Phone Number <span className="bfc-req">*</span></label>
            <input
              ref={phoneRef}
              type="tel"
              className={`bfc-input${phoneErr ? " bfc-input-err" : ""}`}
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneErr(""); }}
              placeholder="077 xxx xxxx"
            />
            {phoneErr && <div className="bfc-err">{phoneErr}</div>}
            <div className="bfc-autofill-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Save it in your profile to auto-fill next time
            </div>
          </div>
          <button type="submit" className="bfc-submit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Confirm Booking
          </button>
          <button type="button" className="bfq-back-btn" onClick={() => setStage("question")}>← Back</button>
        </form>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STAGE: other — full form
  ══════════════════════════════════════ */
  return (
    <div className="bfc">
      {strip}
      <form className="bfc-form" onSubmit={handleOtherSubmit} noValidate>
        <div className="bfc-question">Enter the patient's details:</div>

        <div className="bfc-field">
          <label className="bfc-label">Patient Name <span className="bfc-req">*</span></label>
          <input
            ref={nameRef}
            className={`bfc-input${errors.name ? " bfc-input-err" : ""}`}
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: ""})); }}
            placeholder="Full name"
          />
          {errors.name && <div className="bfc-err">{errors.name}</div>}
        </div>

        <div className="bfc-row2">
          <div className="bfc-field">
            <label className="bfc-label">Phone <span className="bfc-req">*</span></label>
            <input
              type="tel"
              className={`bfc-input${errors.phone ? " bfc-input-err" : ""}`}
              value={otherPhone}
              onChange={e => { setOtherPhone(e.target.value); setErrors(p => ({...p, phone: ""})); }}
              placeholder="077 xxx xxxx"
            />
            {errors.phone && <div className="bfc-err">{errors.phone}</div>}
          </div>
          <div className="bfc-field">
            <label className="bfc-label">Age</label>
            <input
              type="number" min={1} max={120}
              className={`bfc-input${errors.age ? " bfc-input-err" : ""}`}
              value={age}
              onChange={e => { setAge(e.target.value); setErrors(p => ({...p, age: ""})); }}
              placeholder="—"
            />
            {errors.age && <div className="bfc-err">{errors.age}</div>}
          </div>
        </div>

        <button type="submit" className="bfc-submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Confirm Booking
        </button>
        <button type="button" className="bfq-back-btn" onClick={() => setStage("question")}>← Back</button>
      </form>
    </div>
  );
}
