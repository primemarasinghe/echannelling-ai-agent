import { useState } from 'react'
import BodyMap, { type BodyRegion, REGION_META, type BodyFocus } from '../components/BodyMap'
import SandboxPaymentSheet from '../components/SandboxPaymentSheet'
import { useAuth } from '../context/AuthContext'
import { getSymptomQuestions, analyzeSymptoms } from '../api'

/* ── Symptom → body focus map (view, zoom, SVG y-centre 0-1500) ── */
const SYMPTOM_FOCUS: Record<string, BodyFocus> = {
  'Headache':                { view: 'front', zoom: 1.0, cy: 140 },
  'Dizziness':               { view: 'front', zoom: 1.0, cy: 140 },
  'Eye redness':             { view: 'front', zoom: 1.0, cy: 100 },
  'Runny / Stuffy nose':     { view: 'front', zoom: 1.0, cy: 120 },
  'Sore throat':             { view: 'front', zoom: 1.0, cy: 252 },
  'Swollen lymph nodes':     { view: 'front', zoom: 1.0, cy: 260 },
  'Cough':                   { view: 'front', zoom: 1.0, cy: 390 },
  'Shortness of breath':     { view: 'front', zoom: 1.0, cy: 390 },
  'Chest pain':              { view: 'front', zoom: 1.0, cy: 390 },
  'Loss of appetite':        { view: 'front', zoom: 1.0, cy: 450 },
  'Nausea / Vomiting':       { view: 'front', zoom: 1.0, cy: 580 },
  'Abdominal pain':          { view: 'front', zoom: 1.0, cy: 590 },
  'Diarrhea':                { view: 'front', zoom: 1.0, cy: 660 },
  'Frequent urination':      { view: 'front', zoom: 1.0, cy: 710 },
  'Back pain':               { view: 'back',  zoom: 1.0, cy: 460 },
  'Numbness / Tingling':     { view: 'front', zoom: 1.0, cy: 750 },
  'Skin rash / Itching':     { view: 'front', zoom: 1.0, cy: 750 },
  'Body aches / Joint pain': { view: 'front', zoom: 1.0, cy: 750 },
  'Fatigue / Weakness':      { view: 'front', zoom: 1.0, cy: 750 },
  'Fever / Chills':          { view: 'front', zoom: 1.0, cy: 750 },
  'Body pain':               { view: 'front', zoom: 1.0, cy: 750 },
}

/* ── Symptom list ──────────────────────────────────────────── */
const SYMPTOMS = [
  { en: 'Headache',                    si: 'ඔලුව කැක්කුම'                       },
  { en: 'Fever / Chills',              si: 'උණ'                                  },
  { en: 'Body aches / Joint pain',     si: 'සන්ධි වේදනාව'                        },
  { en: 'Fatigue / Weakness',          si: 'තෙහෙට්ටුව'                           },
  { en: 'Cough',                       si: 'කැස්ස'                                },
  { en: 'Sore throat',                 si: 'උගුරේ අමාරුව'                        },
  { en: 'Runny / Stuffy nose',         si: 'සෙම්ප්‍රතිශ්‍යාව'                   },
  { en: 'Shortness of breath',         si: 'හුස්ම ගැනීමේ අපහසුව'                },
  { en: 'Chest pain',                  si: 'පපුවේ අමාරුව'                        },
  { en: 'Nausea / Vomiting',           si: 'ඔක්කාරය / වමනය'                      },
  { en: 'Diarrhea',                    si: 'පාචනය'                               },
  { en: 'Abdominal pain',              si: 'බඩේ අමාරුව'                          },
  { en: 'Loss of appetite',            si: 'ආහාර අරුචිය'                         },
  { en: 'Dizziness',                   si: 'කරකැවිල්ල'                           },
  { en: 'Skin rash / Itching',         si: 'සමේ කැසීම'                           },
  { en: 'Back pain',                   si: 'කොන්දේ අමාරුව'                       },
  { en: 'Frequent urination',          si: 'නිතර මුත්‍රා'                        },
  { en: 'Swollen lymph nodes',         si: 'වසා ගැටිති ඉදිමීම'                   },
  { en: 'Eye redness',                 si: 'ඇස් රතු වීම'                         },
  { en: 'Numbness / Tingling',         si: 'හිරිවැටීම'                           },
  { en: 'Body pain',                   si: 'ඇඟේ අමාරුව'                          },
]

/* ── Types ─────────────────────────────────────────────────── */
interface LabTest { code:string; name:string; price:number; reason:string; selected:boolean }
interface Condition { name:string; likelihood:'High'|'Medium'|'Low'; description:string }
interface AnalysisResult {
  conditions: Condition[]
  lab_tests: LabTest[]
  specialist: string
  urgency: 'Routine'|'Soon'|'Urgent'
  urgency_note: string
  disclaimer: string
}
interface Question {
  id: string
  text: string
  type: 'yesno' | 'single' | 'multi'
  options: string[]
}

interface Props { onBack: () => void }

const STEPS = ['Symptoms','Body Areas','Your Info','Questions','Results','Payment']

/* ═══════════════════════════════════════════════════════════ */
export default function SymptomChecker({ onBack }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)

  // Step 1
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  // Step 2
  const [bodyAreas,    setBodyAreas]    = useState<Record<string,BodyRegion[]>>({})
  const [symIdx,       setSymIdx]       = useState(0)
  const [hoveredReg,   setHoveredReg]   = useState<BodyRegion | null>(null)
  // Step 3
  const [patientName,  setPatientName]  = useState(user?.name ?? '')
  const [age,          setAge]          = useState('')
  const [gender,       setGender]       = useState('')
  const [duration,     setDuration]     = useState('')
  // Step 4
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [answers,      setAnswers]      = useState<Record<string,string[]>>({})
  const [potDiffs,     setPotDiffs]     = useState<string[]>([])
  const [qLoading,     setQLoading]     = useState(false)
  // Step 5
  const [result,       setResult]       = useState<AnalysisResult|null>(null)
  const [labTests,     setLabTests]     = useState<LabTest[]>([])
  const [rLoading,     setRLoading]     = useState(false)
  const [rError,       setRError]       = useState('')
  // Step 6
  const [payState,     setPayState]     = useState<'idle'|'sheet'|'paid'>('idle')
  const [payRef,       setPayRef]       = useState('')

  /* helpers */
  function toggleSym(en:string) {
    setSelectedSymptoms(p => p.includes(en) ? p.filter(s=>s!==en) : [...p, en])
  }
  function toggleArea(sym:string, r:BodyRegion) {
    setBodyAreas(p => {
      const cur = p[sym]??[]
      return {...p, [sym]: cur.includes(r) ? cur.filter(x=>x!==r) : [...cur,r]}
    })
  }
  function toggleTest(code:string) {
    setLabTests(p => p.map(t => t.code===code ? {...t,selected:!t.selected} : t))
  }
  const selectedTests = labTests.filter(t=>t.selected)
  const totalPrice    = selectedTests.reduce((s,t)=>s+t.price,0)

  async function goToQuestions() {
    setQLoading(true); setStep(3); setAnswers({})
    try {
      const data = await getSymptomQuestions({
        symptoms: selectedSymptoms,
        body_areas: Object.fromEntries(Object.entries(bodyAreas).map(([k,v])=>[k,v as string[]])),
        patient_name: patientName, age, gender, duration,
      })
      setQuestions(data.questions ?? [])
      setPotDiffs(data.potential_differentials ?? [])
    } catch {
      // Fallback structured questions
      setQuestions([
        { id:'q1', text:'Did these symptoms start suddenly and severely?', type:'yesno', options:['Yes','No'] },
        { id:'q2', text:'How long have you had these symptoms?', type:'single', options:['Less than 1 day','1 to 3 days','4 to 7 days','More than 1 week','It comes and goes'] },
        { id:'q3', text:'How would you describe the severity?', type:'single', options:['Mild — barely noticeable','Moderate — affects daily activities','Severe — very difficult to manage','Fluctuates throughout the day'] },
        { id:'q4', text:'Do you have any of these as well?', type:'multi', options:['Fever','Nausea or vomiting','Fatigue','Loss of appetite','None of these'] },
        { id:'q5', text:'Has anything made the symptoms worse?', type:'multi', options:['Physical activity','Eating or drinking','Stress','Lack of sleep','Nothing clear'] },
      ])
      setPotDiffs([])
    } finally { setQLoading(false) }
  }

  async function goToResults() {
    // Serialize structured answers to plain text for the AI
    const serialized: Record<string,string> = {}
    for (const q of questions) {
      const ans = answers[q.id] ?? []
      if (ans.length > 0) serialized[q.text] = ans.join(', ')
    }
    setRLoading(true); setRError(''); setStep(4)
    try {
      const data:AnalysisResult = await analyzeSymptoms({
        symptoms: selectedSymptoms,
        body_areas: Object.fromEntries(Object.entries(bodyAreas).map(([k,v])=>[k,v as string[]])),
        patient_name: patientName, age, gender, duration, answers: serialized,
      })
      setResult(data); setLabTests(data.lab_tests)
    } catch(e:any) {
      setRError(e.message||'Analysis failed.')
    } finally { setRLoading(false) }
  }

  function handlePaid(_o:string, _e:string) {
    setPayRef('LAB'+Math.random().toString(36).slice(2,10).toUpperCase())
    setPayState('paid')
  }

  /* ── STEP 0: Symptoms ─────────────────────────────────── */
  if (step===0) return (
    <div className="sc-wrap">
      <Header onBack={onBack}/>
      <Progress step={0}/>
      <div className="sc-body">
        <div className="sc-section-head">
          <div className="sc-num">01</div>
          <div>
            <div className="sc-title">Select Your Symptoms</div>
            <div className="sc-sub">ඔබේ රෝග ලක්ෂණ තෝරන්න · Choose all that apply</div>
          </div>
        </div>
        <div className="sc-sym-grid">
          {SYMPTOMS.map(s=>(
            <button key={s.en}
              className={`sc-sym-btn${selectedSymptoms.includes(s.en)?' sc-sym-on':''}`}
              onClick={()=>toggleSym(s.en)}>
              <div className={`sc-sym-chk${selectedSymptoms.includes(s.en)?' on':''}`}>
                {selectedSymptoms.includes(s.en)&&'✓'}
              </div>
              <div>
                <div className="sc-sym-en">{s.en}</div>
                <div className="sc-sym-si">{s.si}</div>
              </div>
            </button>
          ))}
        </div>
        {selectedSymptoms.length>0&&(
          <div className="sc-sel-count">{selectedSymptoms.length} symptom{selectedSymptoms.length>1?'s':''} selected</div>
        )}
      </div>
      <Footer
        onBack={onBack} backLabel="← Home"
        onNext={()=>{setSymIdx(0);setStep(1)}}
        nextLabel="Next →"
        nextDisabled={selectedSymptoms.length===0}
      />
    </div>
  )

  /* ── STEP 1: Body Areas ───────────────────────────────── */
  if (step===1) {
    const sym    = selectedSymptoms[symIdx]
    const areas  = bodyAreas[sym]??[]
    const isLast = symIdx===selectedSymptoms.length-1

    return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(0)}/>
        <Progress step={1}/>
        <div className="sc-body">
          <div className="sc-section-center">
            <div className="sc-num">02</div>
            <div className="sc-title">Select Body Area</div>
            <div className="sc-sub">ශරීරයේ ස්ථාන සලකුණු කරන්න</div>
          </div>

          {/* symptom tabs */}
          {selectedSymptoms.length>1&&(
            <div className="sc-sym-tabs">
              {selectedSymptoms.map((s,i)=>(
                <button key={s}
                  className={`sc-sym-tab${i===symIdx?' active':''}`}
                  onClick={()=>setSymIdx(i)}>
                  {i+1}. {s.split('/')[0].trim()}
                  {(bodyAreas[s]?.length??0)>0&&<span className="sc-tab-done"> ✓</span>}
                </button>
              ))}
            </div>
          )}

          <div className="sc-body-layout">
            {/* Selected areas panel — LEFT */}
            <div className="sc-areas-col">
              <div className="sc-areas-title">
                Selected areas
                {areas.length>0&&<span className="sc-areas-count">{areas.length}</span>}
              </div>
              {areas.length===0
                ? (
                  <div className="sc-areas-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    No area selected yet
                    <span>Click the body diagram</span>
                  </div>
                ) : (
                  <div className="sc-area-cards">
                    {areas.map(a=>{
                      const meta = REGION_META.find(r=>r.id===a)
                      return (
                        <div key={a} className="sc-area-card">
                          <div className="sc-area-card-dot"/>
                          <div className="sc-area-card-body">
                            <div className="sc-area-card-name">{meta?.label??a}</div>
                            <div className="sc-area-card-si">{meta?.si}</div>
                          </div>
                          <button className="sc-area-card-rm" onClick={()=>toggleArea(sym,a)} aria-label="Remove">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              }

              {/* all symptoms overview */}
              {selectedSymptoms.length>1&&(
                <div className="sc-overview">
                  <div className="sc-overview-title">All symptoms</div>
                  {selectedSymptoms.map((s,i)=>(
                    <div key={s} className={`sc-overview-row${i===symIdx?' active':''}`}
                      onClick={()=>setSymIdx(i)} style={{cursor:'pointer'}}>
                      <span className="sc-ov-num">{i+1}</span>
                      <span className="sc-ov-name">{s}</span>
                      <span className="sc-ov-status">
                        {(bodyAreas[s]?.length??0)>0
                          ? <span className="sc-ov-done">✓ {bodyAreas[s].length} area{bodyAreas[s].length>1?'s':''}</span>
                          : <span className="sc-ov-pend">–</span>
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Body map — MIDDLE */}
            <div className="sc-map-col">
              <div className="sc-map-label">Tap a region for: <strong>{sym}</strong></div>
              <BodyMap
                selected={areas}
                onToggle={r=>toggleArea(sym,r)}
                focus={SYMPTOM_FOCUS[sym]}
                onHover={setHoveredReg}
              />
            </div>

            {/* Hover info panel — RIGHT */}
            <div className="sc-hover-col">
              <div className="sc-hover-panel">
                {hoveredReg ? (() => {
                  const m   = REGION_META.find(r => r.id === hoveredReg)
                  const sel = areas.includes(hoveredReg)
                  return (
                    <>
                      <div className={`sc-hover-indicator${sel ? ' sel' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </div>
                      <div className="sc-hover-name">{m?.label ?? hoveredReg}</div>
                      <div className="sc-hover-si">{m?.si}</div>
                      {sel
                        ? <div className="sc-hover-badge sel">✓ Selected</div>
                        : <div className="sc-hover-badge">Tap to select</div>
                      }
                    </>
                  )
                })() : (
                  <div className="sc-hover-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                      <path d="M12 8v4m0 4h.01"/>
                    </svg>
                    <span>Hover over a body region</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <Footer
          onBack={()=>{ symIdx>0 ? setSymIdx(i=>i-1) : setStep(0) }}
          backLabel="← Back"
          onNext={()=>{ isLast ? setStep(2) : setSymIdx(i=>i+1) }}
          nextLabel={isLast ? 'Next →' : `Next symptom →`}
          nextDisabled={isLast && areas.length===0}
        />
      </div>
    )
  }

  /* ── STEP 2: Patient Info ─────────────────────────────── */
  if (step===2) return (
    <div className="sc-wrap">
      <Header onBack={()=>setStep(1)}/>
      <Progress step={2}/>
      <div className="sc-body sc-body-narrow">
        <div className="sc-section-head">
          <div className="sc-num">03</div>
          <div>
            <div className="sc-title">Patient Information</div>
            <div className="sc-sub">රෝගියාගේ තොරතුරු</div>
          </div>
        </div>
        <div className="sc-form">
          <div className="sc-field">
            <label className="sc-lbl">Full Name</label>
            <input className="sc-inp" value={patientName}
              onChange={e=>setPatientName(e.target.value)} placeholder="Your full name"/>
          </div>
          <div className="sc-row2">
            <div className="sc-field">
              <label className="sc-lbl">Age</label>
              <input className="sc-inp" type="number" min="1" max="120"
                value={age} onChange={e=>setAge(e.target.value)} placeholder="e.g. 35"/>
            </div>
            <div className="sc-field">
              <label className="sc-lbl">Gender</label>
              <select className="sc-inp" value={gender} onChange={e=>setGender(e.target.value)}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
          </div>
          <div className="sc-field">
            <label className="sc-lbl">Symptom duration</label>
            <select className="sc-inp" value={duration} onChange={e=>setDuration(e.target.value)}>
              <option value="">Select duration</option>
              <option>Less than 24 hours</option>
              <option>1–3 days</option>
              <option>4–7 days</option>
              <option>1–2 weeks</option>
              <option>More than 2 weeks</option>
            </select>
          </div>
        </div>
      </div>
      <Footer onBack={()=>setStep(1)} backLabel="← Back"
        onNext={goToQuestions} nextLabel="Next →"
        nextDisabled={!patientName||!age||!gender||!duration}/>
    </div>
  )

  /* ── STEP 3: Follow-up Questions ──────────────────────── */
  if (step===3) {
    const answeredCount = questions.filter(q=>(answers[q.id]?.length??0)>0).length
    const allAnswered   = questions.length>0 && answeredCount===questions.length

    function toggleOpt(qid:string, opt:string, type:'yesno'|'single'|'multi') {
      setAnswers(prev => {
        if (type==='multi') {
          const cur = prev[qid]??[]
          return { ...prev, [qid]: cur.includes(opt) ? cur.filter(o=>o!==opt) : [...cur, opt] }
        }
        return { ...prev, [qid]: [opt] }
      })
    }

    return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(2)}/>
        <Progress step={3}/>
        <div className="sc-body sc-body-narrow">
          <div className="sc-section-head">
            <div className="sc-num">04</div>
            <div>
              <div className="sc-title">Doctor's Follow-up Questions</div>
              <div className="sc-sub">Answer naturally to help us understand your symptoms better</div>
            </div>
          </div>

          {/* Assessment summary */}
          <div className="sc-q-summary">
            <div className="sc-q-summary-row">
              <span className="sc-q-summary-lbl">Symptoms</span>
              <span className="sc-q-summary-val">{selectedSymptoms.join(', ')}</span>
            </div>
            {Object.entries(bodyAreas).some(([,v])=>v.length>0) && (
              <div className="sc-q-summary-row">
                <span className="sc-q-summary-lbl">Body areas</span>
                <span className="sc-q-summary-val">
                  {Object.entries(bodyAreas).filter(([,v])=>v.length>0).map(([sym,areas])=>{
                    const labels = areas.map(a=>REGION_META.find(m=>m.id===a)?.label??a)
                    return `${sym}: ${labels.join(', ')}`
                  }).join(' · ')}
                </span>
              </div>
            )}
            <div className="sc-q-summary-row">
              <span className="sc-q-summary-lbl">Patient</span>
              <span className="sc-q-summary-val">{patientName}, {age} yrs, {gender}</span>
            </div>
            {potDiffs.length>0 && (
              <div className="sc-q-summary-diffs">
                <div className="sc-q-summary-lbl" style={{marginBottom:6}}>Potential Differentials</div>
                <ul className="sc-q-diffs-list">
                  {potDiffs.map((d,i)=><li key={i}>{d}</li>)}
                </ul>
                <div className="sc-q-diffs-note">These are preliminary possibilities to guide follow-up questions.</div>
              </div>
            )}
          </div>

          {qLoading ? (
            <div className="sc-ai-wait">
              <div className="sc-spin"/>
              <span>AI is generating questions…</span>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="sc-q-progress">
                <div className="sc-q-progress-bar">
                  <div className="sc-q-progress-fill" style={{width: questions.length ? `${answeredCount/questions.length*100}%` : '0%'}}/>
                </div>
                <span className="sc-q-progress-txt">{answeredCount} of {questions.length} questions answered</span>
              </div>

              {/* Questions */}
              <div className="sc-qs">
                {questions.map((q,i)=>{
                  const sel = answers[q.id]??[]
                  const isAnswered = sel.length>0
                  return (
                    <div key={q.id} className={`sc-q-card${isAnswered?' answered':''}`}>
                      <div className="sc-q-card-hd">
                        <span className="sc-q-num">{i+1}</span>
                        <span className="sc-q-card-txt">{q.text}</span>
                        {isAnswered && <span className="sc-q-done-tick">✓</span>}
                      </div>

                      {q.type==='yesno' && (
                        <div className="sc-q-yesno">
                          {q.options.map(opt=>(
                            <button key={opt}
                              className={`sc-q-yn-btn${sel.includes(opt)?' sel '+(opt==='Yes'?'yes':'no'):''}`}
                              onClick={()=>toggleOpt(q.id,opt,'yesno')}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {(q.type==='single'||q.type==='multi') && (
                        <div className={`sc-q-opts${q.type==='multi'?' sc-q-multi':''}`}>
                          {q.options.map(opt=>(
                            <div key={opt}
                              className={`sc-q-opt${sel.includes(opt)?' sel':''}`}
                              onClick={()=>toggleOpt(q.id,opt,q.type as 'single'|'multi')}
                              role={q.type==='single'?'radio':'checkbox'}
                              aria-checked={sel.includes(opt)} tabIndex={0}
                              onKeyDown={e=>(e.key===' '||e.key==='Enter')&&toggleOpt(q.id,opt,q.type as 'single'|'multi')}>
                              <span className="sc-q-opt-indicator">
                                {sel.includes(opt) && (
                                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="8" height="8">
                                    <polyline points="1.5 5 4 7.5 8.5 2.5"/>
                                  </svg>
                                )}
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <Footer onBack={()=>setStep(2)} backLabel="← Back"
          onNext={goToResults} nextLabel="Analyse →"
          nextDisabled={qLoading || !allAnswered}/>
      </div>
    )
  }

  /* ── STEP 4: Results ──────────────────────────────────── */
  if (step===4) {
    if (rLoading) return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(3)}/>
        <div className="sc-ai-full">
          <div className="sc-spin-lg"/>
          <div className="sc-ai-title">Analysing symptoms…</div>
          <div className="sc-ai-hint">AI is reviewing your data</div>
        </div>
      </div>
    )
    if (rError) return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(3)}/>
        <div className="sc-body sc-body-narrow">
          <div className="sc-err-box">{rError}</div>
          <button className="sc-btn-pri" onClick={goToResults}>Retry</button>
        </div>
      </div>
    )
    if (!result) return null

    const urgKey = result.urgency==='Urgent' ? 'r' : result.urgency==='Soon' ? 'y' : 'g'

    return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(3)}/>
        <Progress step={4}/>
        <div className="sc-body sc-body-narrow">

          {/* ── Urgency Banner ── */}
          <div className={`sc-urg-banner sc-urg-${urgKey}`}>
            <div className="sc-urg-banner-icon">
              {urgKey==='r' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : urgKey==='y' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              )}
            </div>
            <div className="sc-urg-banner-body">
              <div className="sc-urg-banner-title">
                {urgKey==='r' ? 'Urgent — Seek Care Now' : urgKey==='y' ? 'See a Doctor Soon' : 'Routine Checkup Advised'}
              </div>
              <div className="sc-urg-banner-note">{result.urgency_note}</div>
            </div>
          </div>

          {/* ── Possible Conditions ── */}
          <div className="sc-res-section">
            <div className="sc-res-section-hd">
              <div className="sc-res-section-icon sc-res-icon-navy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div>
                <div className="sc-res-section-title">Possible Conditions</div>
                <div className="sc-res-section-sub">AI analysis · Not a medical diagnosis</div>
              </div>
            </div>
            <div className="sc-conds">
              {result.conditions.map((c,i)=>{
                const barW = c.likelihood==='High'?'82%':c.likelihood==='Medium'?'52%':'26%'
                const barC = c.likelihood==='High'?'#ef4444':c.likelihood==='Medium'?'#f59e0b':'#22c55e'
                const bdgC = c.likelihood==='High'?'sc-bdg-h':c.likelihood==='Medium'?'sc-bdg-m':'sc-bdg-l'
                return (
                  <div key={i} className="sc-cond">
                    <div className="sc-cond-row">
                      <span className="sc-cond-name">{c.name}</span>
                      <span className={`sc-bdg ${bdgC}`}>{c.likelihood}</span>
                    </div>
                    <div className="sc-bar-bg"><div className="sc-bar-fg" style={{width:barW,background:barC}}/></div>
                    <p className="sc-cond-desc">{c.description}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Recommended Lab Tests ── */}
          <div className="sc-res-section">
            <div className="sc-res-section-hd">
              <div className="sc-res-section-icon sc-res-icon-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/>
                </svg>
              </div>
              <div>
                <div className="sc-res-section-title">Recommended Lab Tests</div>
                <div className="sc-res-section-sub">Tap a card to select · {labTests.length} test{labTests.length!==1?'s':''} recommended</div>
              </div>
            </div>

            <div className="sc-tests-grid">
              {labTests.map(t=>(
                <div key={t.code}
                  className={`sc-test-card${t.selected?' sel':''}`}
                  onClick={()=>toggleTest(t.code)}
                  role="checkbox" aria-checked={t.selected} tabIndex={0}
                  onKeyDown={e=>(e.key===' '||e.key==='Enter')&&toggleTest(t.code)}>
                  <div className="sc-test-card-top">
                    <div className={`sc-test-card-chk${t.selected?' on':''}`}>
                      {t.selected&&(
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                          <polyline points="2 6 5 9 10 3"/>
                        </svg>
                      )}
                    </div>
                    <span className="sc-test-card-price">Rs.&nbsp;{t.price.toLocaleString()}</span>
                  </div>
                  <div className="sc-test-card-name">{t.name}</div>
                  <div className="sc-test-card-why">{t.reason}</div>
                </div>
              ))}
            </div>

            {selectedTests.length>0 && (
              <div className="sc-tests-summary">
                <span className="sc-tests-summary-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {selectedTests.length} test{selectedTests.length!==1?'s':''} selected
                </span>
                <span className="sc-tests-summary-total">Rs.&nbsp;{totalPrice.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* ── Recommended Specialist ── */}
          <div className="sc-specialist-card">
            <div className="sc-specialist-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="sc-specialist-body">
              <div className="sc-specialist-lbl">Recommended Specialist</div>
              <div className="sc-specialist-name">{result.specialist}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{color:'#9ca3af',flexShrink:0}}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>

          {/* ── Disclaimer ── */}
          <div className="sc-disclaimer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{flexShrink:0,marginTop:1}}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {result.disclaimer}
          </div>

        </div>

        <Footer onBack={()=>setStep(3)} backLabel="← Back"
          onNext={()=>setStep(5)}
          nextLabel={selectedTests.length>0 ? `Book ${selectedTests.length} Test${selectedTests.length!==1?'s':''} →` : 'Select tests to book'}
          nextDisabled={selectedTests.length===0}/>
      </div>
    )
  }

  /* ── STEP 5: Payment ──────────────────────────────────── */
  if (step===5) {
    if (payState==='paid') return (
      <div className="sc-wrap">
        <Header onBack={onBack}/>
        <div className="sc-paid-page">
          <div className="sc-paid-check">✓</div>
          <div className="sc-paid-title">Lab Tests Booked!</div>
          <div className="sc-paid-ref">Reference: <strong>{payRef}</strong></div>
          <div className="sc-paid-list">
            {selectedTests.map(t=>(
              <div key={t.code} className="sc-paid-row">
                <span>{t.name}</span><span>Rs. {t.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="sc-paid-total">
              <span>Total Paid</span><span>Rs. {totalPrice.toLocaleString()}</span>
            </div>
          </div>
          <div className="sc-paid-note">Sandbox — no real charge was made</div>
          <button className="sc-btn-pri" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    )

    return (
      <div className="sc-wrap">
        <Header onBack={()=>setStep(4)}/>
        <Progress step={5}/>
        {payState==='sheet'&&(
          <SandboxPaymentSheet
            amount={String(totalPrice)} currency="LKR"
            description={`Lab Tests — ${selectedTests.map(t=>t.code).join(', ')}`}
            defaultEmail={user?.email??''}
            onPay={handlePaid}
            onDismiss={()=>setPayState('idle')}
          />
        )}
        <div className="sc-body sc-body-narrow">
          <div className="sc-section-head">
            <div className="sc-num">06</div>
            <div>
              <div className="sc-title">Payment</div>
              <div className="sc-sub">ගෙවීම · Nawaloka Hospital</div>
            </div>
          </div>
          <div className="sc-pay-list">
            {selectedTests.map(t=>(
              <div key={t.code} className="sc-pay-row">
                <span>{t.name}</span><span>Rs. {t.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="sc-pay-total">
              <span>Total</span><span>Rs. {totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <Footer onBack={()=>setStep(4)} backLabel="← Back"
          onNext={()=>setPayState('sheet')}
          nextLabel={`Pay Rs. ${totalPrice.toLocaleString()}`}/>
      </div>
    )
  }

  return null
}

/* ── Sub-components ─────────────────────────────────────── */
function Header({ onBack }: { onBack:()=>void }) {
  return (
    <div className="sc-hdr">
      <button className="sc-hdr-back" onClick={onBack} aria-label="Back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div className="sc-hdr-text">
        <div className="sc-hdr-title">AI Symptom Analyser</div>
        <div className="sc-hdr-sub">Powered by AI · Nawaloka Hospital</div>
      </div>
      <div className="sc-hdr-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        AI
      </div>
    </div>
  )
}

function Progress({ step }: { step:number }) {
  return (
    <div className="sc-prog">
      {STEPS.map((s,i)=>(
        <div key={s} className={`sc-pg-step${i===step?' cur':i<step?' done':''}`}>
          <div className="sc-pg-dot">{i<step?'✓':i+1}</div>
          <div className="sc-pg-lbl">{s}</div>
        </div>
      ))}
    </div>
  )
}

function Footer({onBack,backLabel,onNext,nextLabel,nextDisabled}:{
  onBack:()=>void; backLabel:string
  onNext:()=>void; nextLabel:string; nextDisabled?:boolean
}) {
  return (
    <div className="sc-footer">
      <button className="sc-btn-sec" onClick={onBack}>{backLabel}</button>
      <button className="sc-btn-pri" onClick={onNext} disabled={nextDisabled}>{nextLabel}</button>
    </div>
  )
}
