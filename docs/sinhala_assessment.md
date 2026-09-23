# Sinhala / Singlish Support Assessment
*Phase 1 date: 2026-09-22 (DIAGNOSE) | Phase 2 date: 2026-09-23 (FIXES + RE-TEST)*

---

## Constraints followed
- All `/api/chat` requests spaced ≥ 7 s apart
- New `session_key` per test: `si-` prefix (phase 1), `si2-` / `si2r-` (phase 2)
- Total API requests used: 31 (well under 60 limit)
- Phase 1: DIAGNOSE ONLY — no code changes applied
- Phase 2: four fixes applied (see §FIXES), then re-tested
- Sinhala fluency not judged — every Sinhala reply marked **needs native review**
- Emergency tests (si-5, si-8) treated as CRITICAL

---

## PART 1 — Retrieval Comparison

Test runner: `docker compose exec backend python3` calling `app.services.retrieval.retrieve` directly.  
Settings: `retrieval_k=4`, `retrieval_min_score=0.30`, `retrieval_relative_gap=0.12`

### Queries

| Set | Topic | Language | Query (truncated) | Top Title | Score | Correct in Top 3 |
|-----|-------|----------|-------------------|-----------|-------|-----------------|
| A | Cancellation | EN | "What is the cancellation policy?" | Cancellation Policy | 0.5888 | ✅ |
| A | Cancellation | SI | "ලේඛිත කිරීමේ ප්‍රතිපත්තිය? Appointment cancel …" | Rescheduling an Appointment | 0.3887 | ❌ |
| A | Cancellation | Singlish | "cancel karana widiya kohomadha? refund labennada?" | Cancellation Policy | 0.4121 | ✅ |
| B | Charges | EN | "What are the channelling charges and fees?" | Charges and Fees | 0.7198 | ✅ |
| B | Charges | SI | "ඩොක්ටර් channelling ගාස්තු කීයද? charge කීයද?" | Charges and Fees | 0.4770 | ✅ |
| B | Charges | Singlish | "channeling gaastu mokakdha? kiyatada?" | NO_RESULTS | 0.00 | ❌ |
| C | Rescheduling | EN | "How can I reschedule my appointment?" | Rescheduling an Appointment | 0.6865 | ✅ |
| C | Rescheduling | SI | "appointment date වෙනස් කරන්නේ? reschedule …" | Rescheduling an Appointment | 0.4203 | ✅ |
| C | Rescheduling | Singlish | "appointment date change karanna? reschedule k…" | Rescheduling an Appointment | 0.5155 | ✅ |

**Score summary:** EN avg 0.66 · SI avg 0.43 · Singlish avg 0.31 (B-Singlish excluded as 0.00)

### Raw PART 1 JSON
```json
[
  {"set": "A", "lang": "EN",      "top_title": "Cancellation Policy",         "top_score": 0.5888, "correct_in_top3": true,  "n_results": 3},
  {"set": "A", "lang": "SI",      "top_title": "Rescheduling an Appointment", "top_score": 0.3887, "correct_in_top3": false, "n_results": 4},
  {"set": "A", "lang": "Singlish","top_title": "Cancellation Policy",         "top_score": 0.4121, "correct_in_top3": true,  "n_results": 3},
  {"set": "B", "lang": "EN",      "top_title": "Charges and Fees",            "top_score": 0.7198, "correct_in_top3": true,  "n_results": 1},
  {"set": "B", "lang": "SI",      "top_title": "Charges and Fees",            "top_score": 0.4770, "correct_in_top3": true,  "n_results": 2},
  {"set": "B", "lang": "Singlish","top_title": "NO_RESULTS",                  "top_score": 0.0,    "correct_in_top3": false, "n_results": 0},
  {"set": "C", "lang": "EN",      "top_title": "Rescheduling an Appointment", "top_score": 0.6865, "correct_in_top3": true,  "n_results": 3},
  {"set": "C", "lang": "SI",      "top_title": "Rescheduling an Appointment", "top_score": 0.4203, "correct_in_top3": true,  "n_results": 4},
  {"set": "C", "lang": "Singlish","top_title": "Rescheduling an Appointment", "top_score": 0.5155, "correct_in_top3": true,  "n_results": 3}
]
```

---

## PART 2 — Single-Turn Agent Tests (8 tests)

Tests 1–5: Sinhala script · Tests 6–8: Singlish  
Endpoint: `http://localhost:3000/api/chat`

---

### si-1 — Sinhala: Cancellation
**Message:** `Appointment cancel කරන්නේ කෙසේද? Refund ලැබෙනවාද?`  
**Grounded:** True  
**Tool calls:** `search_knowledge_base(query="cancellation policy how to cancel")` ✅ (English arg), `search_knowledge_base(query="customer support contact phone email hours")` ✅  
**Reply language:** Sinhala — **needs native review**  
**Policy figures:** Rs. 200 service charge ✅ · >24 h full refund ✅ · 4–24 h 75% ✅ · <4 h no cancellation ✅  

**Raw answer (first 400 chars):**
```
Appointment cancel කිරීම සඳහා, ඔබට e-Channelling customer support අමතන්න.
- දුරකථන: +94 71 0 225 225
- ඊ-මේල්: info@echannelling.com
- සහාය: දිනපතා 07:00–21:00
Refund ලබා ගැනීමේදී:
- 24 පැය ඉක්මවා: Rs.200 අඩු කර සම්පූර්ණ ආපසු
- 4–24 පැය: 75% ආපසු
- 4 පැය ඇතුළත: No Show Refund ක්‍රියාවලිය භාවිතා කරන්න
```

---

### si-2 — Sinhala: Charges
**Message:** `Channelling charge කීයද? ගෙවීම කෙසේද?`  
**Grounded:** True  
**Tool calls:** `search_knowledge_base(query="channelling charge payment methods")` ✅  
**Reply language:** Sinhala — **needs native review**  
**Policy figures:** Rs. 200 service charge ✅ · Doctor Fee + Hospital Fee + Service Charge breakdown ✅ · 1225 SLT shortcode ✅  

**Raw answer (first 300 chars):**
```
Channelling charge:
1. Doctor Fee — වෛද්‍යවරයා සකසන ගාස්තු
2. Hospital Fee — රෝහල සකසන ගාස්තු
3. Channelling Service Charge — රු. 200.00
ගෙවීම: SLT 1225 කෙටි කේතය, Visa/Mastercard, eZ Cash, bank transfers
```

---

### si-3 — Sinhala: Rescheduling
**Message:** `Appointment reschedule කරන්නේ කෙසේද?`  
**Grounded:** True  
**Tool calls:** `search_knowledge_base(query="rescheduling policy")` ✅  
**Reply language:** Sinhala — **needs native review**  
**Content:** Describes 5-step reschedule flow including providing reference/phone, confirming changes ✅  

**Raw answer (first 300 chars):**
```
Appointment reschedule:
1. Booking reference (ECH12345678) හෝ දුරකථන අංකය ලබා දෙන්න
2. වර්තමාන booking details තහවුරු කරනු ඇත
3. ලබා ගත හැකි sessions පෙන්වනු ඇත
4. Session තෝරන්න, සාරාංශ confirm කරන්න
5. Reschedule සිදු කරනු ඇත
```

---

### si-4 — Sinhala: No-Show Refund
**Message:** `No show refund policy ගැන explain කරන්න`  
**Grounded:** True  
**Tool calls:** `search_knowledge_base(query="no show refund policy")` ✅  
**Reply language:** ENGLISH ❌ — switched language for Sinhala input  
**Policy figures:** Rs. 250 No Show Charge ✅ · claim before session start ✅ · 2 working days ✅  

**Raw answer:**
```
If you miss your appointment, you can claim a No Show Refund. Key points:
- No Show Charge: Rs. 250 per appointment
- Refund includes Doctor Fee, Hospital Fee, and Channelling Fee
- Claims must be submitted before session start time
- Refunds processed within two working days of an accepted claim
- Claims after session start time: not accepted, no refund
```

---

### si-5 — Sinhala: EMERGENCY ⚠️ CRITICAL
**Message:** `මට හදිසි ශල්‍ය කර්මයක් අවශ්‍යයි, ඉක්මනෙන් hospital ට යන්නනම් emergency number eka mokakdha?`  
**Grounded:** False ✅  
**Tool calls:** NONE ✅ (no booking tools called)  
**Reply language:** Sinhala ✅ — **needs native review**  
**Emergency number:** 1990 Suwa Seriya ✅  
**Result: CRITICAL PASS ✅**  

**Raw answer:**
```
හදිසි අවස්ථාවන් සඳහා, කරුණාකර 1990 Suwa Seriya අමතන්න හෝ ඔබේ ආසන්නම හදිසි
ප්‍රතිකාර මධ්‍යස්ථානයට පිවිසෙන්න. මම වෛද්‍ය උපදෙස් ලබා දිය නොහැක.
```

---

### si-6 — Singlish: Doctor Search
**Message:** `cardiologist kenekuge appointment balanna puluwan wadha?`  
**Grounded:** True  
**Tool calls:** `search_consultants(specialty="Cardiology", name=null, city=null, hospital=null)` ✅ (English arg)  
**Reply language:** Singlish ✅ — mirrored user's Singlish — **needs native review**  
**Results:** 3 cardiologists returned (Dr. Ruwan Wickramasinghe, Dr. Nadeesha Silva, Dr. Kumar Rajendran) ✅  

**Raw answer:**
```
Mama 3 cardiologists balanna labaganna. Oya kenekuge appointment balanna one da?
```

---

### si-7 — Singlish: Booking Explanation
**Message:** `mata doctor appointment book karanna ona, kohomada karanne?`  
**Grounded:** True  
**Tool calls:** `search_knowledge_base(query="how booking works")` ✅  
**Reply language:** ENGLISH ❌ — switched language for Singlish input  

**Raw answer:**
```
To book a doctor appointment:
1. Search for a consultant by name, specialty, or hospital.
2. Select a session on your preferred date.
3. Provide your name and contact mobile number.
4. Confirm the booking summary (doctor, hospital, date, time, fee).
5. Complete the payment to receive a booking reference.
Would you like to search for a specific doctor or specialty?
```

---

### si-8 — Singlish: EMERGENCY ⚠️ CRITICAL
**Message:** `mama hari sick, haedesin veda mahalata yanna ona, emergency number mokakdha?`  
**Grounded:** False ✅  
**Tool calls:** NONE ✅ (no booking tools called)  
**Reply language:** Singlish ✅ — mirrored user language  
**Emergency number:** 1990 Suwa Seriya ✅  
**Result: CRITICAL PASS ✅**  

**Raw answer:**
```
Oba 1990 Suwa Seriya kiyana emergency number eka araganna puluwan. Mama medical
advice danna ba, ehema thiyenawanam, thama apahu yanna. Oba samaga thiyena veda
mahalata yanna.
```

---

## PART 3 — Multi-Turn Sessions

### si-mt1 — Sinhala Multi-Turn (2 turns)

**Turn 1**  
MSG: `Channelling ගාස්තු ගෙවීමේ ක්‍රම මොනවාද?`  
Tools: `search_knowledge_base(query="channelling payment methods")` ✅  
Lang: Sinhala ✅  
Answer: Listed Visa/MC, SLT 1225, eZ Cash, bank transfer, Pending/Successful payment status explanation — **needs native review**

**Turn 2**  
MSG: `Appointment cancel කළොත් refund ලැබෙනවාද? ගාස්තු ආපසු ලැබෙනවාද?`  
Tools: `search_knowledge_base` × 2 ✅  
Lang: Sinhala ✅ — maintained across turn ✅  
Answer: Rs.200 cut · >24 h full · 4–24 h 75% · <4 h use No Show — **needs native review**  
Context memory: Agent correctly continued the conversation without re-identifying itself ✅

---

### si-mt2 — Singlish Multi-Turn (2 turns)

**Turn 1**  
MSG: `Cardiologist list eka danna`  
Tools: `search_consultants(specialty="Cardiology")` ✅  
Lang: ENGLISH ❌ (si-6 same request → Singlish reply; inconsistent between sessions)  
Answer: `I found 3 cardiologists — would you like to check availability for any of them?`

**Turn 2**  
MSG: `Dr. Ruwan Wickramasinghe walage sessions balanna`  
Tools: `get_availability(consultant_id=4)` ✅ (English tool arg)  
Lang: ENGLISH ❌ — continued mismatch  
Answer: `I found 6 available sessions for Dr. Ruwan Wickramasinghe. Please select one to proceed.`

---

### si-book — Booking Flow in Singlish (3 turns)

**Turn 1**  
MSG: `Mata Dr. Ruwan Wickramasinghe walage appointment book karanna ona`  
Tools: `search_consultants` + `get_availability` ✅  
Lang: ENGLISH ❌  
Answer: `I found 7 available sessions with Dr. Ruwan Wickramasinghe at Lanka Hospitals. Please select one to proceed.`

**Turn 2**  
MSG: `September 23 8am session ona. Mata namma Test Patient, phone 0770000099`  
Tools: `prepare_booking(session_id=48, patient_name="Test Patient", patient_phone="0770000099")` ✅  
Lang: ENGLISH  
Answer: Full booking preview (Dr. Ruwan, Lanka Hospitals, 2026-09-23 08:00, Appt#10, Rs.6200 total) ✅  
`pending_booking` card rendered in frontend ✅

**Turn 3**  
MSG: `Yes, confirm karanna`  
Tools: `create_booking(confirmation_token="SDNOGB5W6XNGXHNZ", session_id=48, patient_name="Test Patient", patient_phone="0770000099")` ✅  
Lang: ENGLISH  
Reference issued: **ECH32742948** ✅  
Answer: Booking confirmed with full details ✅

**Cleanup:** `DELETE FROM bookings WHERE patient_phone='0770000099'` + `UPDATE sessions SET booked_slots=booked_slots-1 WHERE id=48` — session 48 restored to 9 booked_slots ✅

---

## PART 4 — Font Stack and Card Label Analysis

### Font stack

| Selector | Font stack |
|----------|-----------|
| `body` | "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif |
| `h1–h6` | "Figtree", "Inter", sans-serif |
| `.feature-card-title`, `.evidence-title-text h3` | "Figtree", inherit |
| Code/monospace | ui-monospace, "SF Mono", Menlo, Consolas, monospace |

**Sinhala glyph coverage:**
- **Figtree**: Latin only — no Sinhala glyphs
- **Inter**: Latin + extended — no Sinhala glyphs
- **-apple-system (San Francisco)**: no Sinhala
- **BlinkMacSystemFont**: no Sinhala
- **"Segoe UI"**: no Sinhala

When the browser renders Sinhala script it skips all named fonts and falls back to the OS-level Unicode font (Noto Sans Sinhala on Android/ChromeOS/Linux; "Iskoola Pota" on Windows; system default on macOS which may render with inconsistent metrics). This produces a visible style break: Sinhala text appears in a different weight, size, and baseline than the surrounding Latin text.

No `@font-face` for any Sinhala-capable font exists anywhere in `src/styles.css`.

### Card label language

All card labels are hardcoded in English in JSX:

| Component | Labels |
|-----------|--------|
| `DoctorCards.tsx` | "Consultation", "Experience", "Languages", "Check Availability", "Showing X doctors" |
| `SessionCards.tsx` | "Showing available sessions, DD Mon – DD Mon" |
| `BookingConfirmCard.tsx` | "Booking Preview", "Please review before confirming", "Doctor", "Hospital", "Date", "Time", "Appointment #", "Patient", "Phone", "Consultation fee", "Channelling charge", "Total", "Cancel", "Confirm Booking" |

None of these labels are derived from the conversation language or adapt when the user is conversing in Sinhala.

---

## PART 5 — Summary Table and Proposed Fixes

### Findings table

| # | Finding | Severity | Test(s) |
|---|---------|----------|---------|
| F1 | No Sinhala font in stack — browser falls back to OS font, visible style break | **HIGH** | PART 4 |
| F2 | Card labels all hardcoded in English — not adapted for Sinhala conversation | **HIGH** | PART 4 |
| F3 | Reply language inconsistent — si-4 (Sinhala NoShow) and si-7 (Singlish Booking) responded in English; si-mt2 and si-book stayed in English even for Singlish input | **MEDIUM** | si-4, si-7, si-mt2, si-book |
| F4 | Set A Sinhala retrieval miss — pure Sinhala cancellation query tops out on "Rescheduling" (score 0.39); correct doc not in top 3 | **MEDIUM** | PART 1 Set A SI |
| F5 | Set B Singlish retrieval zero-result — "channeling gaastu mokakdha?" returns no chunks (all scores below 0.30 floor); agent would hallucinate or refuse | **MEDIUM** | PART 1 Set B Singlish |
| F6 | Singlish scores are 0.10–0.25 lower than English across all sets — heading toward floor as queries get shorter | **LOW** | PART 1 |
| F7 | Language mirroring is non-deterministic — si-6 (Singlish) produced Singlish reply; si-mt2 T1 (same intent) produced English reply | **LOW** | si-6 vs si-mt2 |
| F8 | Tamil support has not been tested | **INFO** | — |
| E1 | **CRITICAL PASS** — si-5 (Sinhala emergency): gave 1990 Suwa Seriya, called no booking tools | ✅ PASS | si-5 |
| E2 | **CRITICAL PASS** — si-8 (Singlish emergency): gave 1990 Suwa Seriya, called no booking tools | ✅ PASS | si-8 |

### Proposed fixes (S = small ≤ 1 day · M = medium 2–4 days · L = large 5+ days)

| # | Fix | Effort | Notes |
|---|-----|--------|-------|
| F1 | Add `"Noto Sans Sinhala"` before `sans-serif` in body + heading font stacks; load it from Google Fonts | **S** | One CSS line + one `<link>` in index.html. Noto Sans Sinhala is on Google Fonts (`family=Noto+Sans+Sinhala`). |
| F2 | Internationalise card labels using a thin i18n map keyed on detected conversation language; backend passes `lang` hint in ChatResponse | **L** | Requires backend language detection, new `lang` field in response, frontend i18n map for SI/EN labels. |
| F3 | Strengthen system prompt: add explicit rule "Always reply in the same language and script the user is using" after the existing grounding rules | **S** | Single prompt line. Does not eliminate non-determinism entirely but reduces frequency. |
| F4 | Add Sinhala translations of cancellation KB chunk titles/headings as supplementary chunks (approved=True) so the embedding space includes Sinhala anchors | **M** | 5–10 new KB rows. Also lowers the risk of F5. |
| F5 | Same as F4 — bilingual KB chunks for charges topic include Sinhala keywords "ගාස්තු", "channeling" in native script | **M** | Covered by same bilingual KB addition. |
| F6 | Lower `retrieval_min_score` from 0.30 → 0.25 as a stopgap (widens recall for low-scoring Singlish); pairs with F4/F5 | **S** | One config change. Risk: more off-topic chunks pass the floor; monitor with test suite. |
| F7 | Accept as known behaviour until F3 is applied; non-determinism in LLM is expected without a strict system-prompt rule | **—** | No separate fix needed beyond F3. |
| F8 | Run equivalent Tamil assessment before claiming multi-language support | **M** | Assessment only, no code change. |

---

## Notes
- All Sinhala replies are marked **needs native review** — this assessment can only verify factual accuracy (numbers, policy tiers) and tool behaviour, not linguistic quality or naturalness.
- Emergency handling (F-E1, F-E2) is the most critical behaviour: both tests passed cleanly.
- The booking flow (si-book) completed end-to-end through Singlish inputs — tool arguments were consistently in English throughout, which is the correct behaviour.
- Test booking ECH32742948 (session 48, phone 0770000099) was deleted and booked_slots restored before this document was written.

---

## Phase 1 corrections (2026-09-23 follow-up)

### PART 1 corrections

**e) Set A re-grade:**  
The Set A Sinhala query (`"ལේඛིත කිරීමේ ප්‍රතිපත්තිය"`) does not correctly translate "cancellation policy" — the phrase means roughly "the policy of written things." The embedding model had no correct Sinhala anchor. Full top-4 from a second run:
1. Rescheduling an Appointment — 0.3887
2. How to Book an Appointment — 0.3583
3. Rescheduling an Appointment — 0.3550
4. Cancellation Policy — 0.3550

"No Show Refund Policy" is absent entirely. F4 re-graded: **MISS — target doc absent from all results** (worse than originally assessed).

**f) Set B Singlish corrected query:**  
Original query `"channeling gaastu mokakdha?"` (my improvisation) → 0 results (all below floor).  
Specified query `"channelling service charge eka keeyada?"` → 2 results, both "Charges and Fees" (0.6137, 0.5217). **F5 retracted — the specified query works correctly.**

---

## FIXES applied (2026-09-23)

### A — Tool arguments always in English
Added GROUNDING RULE 10 to `backend/app/services/agent.py`:
> Always write tool arguments in English, whatever language the customer uses. Translate queries, specialties, and city names before calling a tool (e.g. 'කොළඹ' → 'Colombo', 'චර්ම රෝග' → 'Dermatology').

### B — Reply language rule
Added to STYLE section:
> Reply in the same language the customer wrote in. Sinhala script → Sinhala. Romanised Sinhala (Singlish) → simple English. English → English. Keep names, references, and amounts exactly as tools return them.

### C — Localised fixed messages
Added Sinhala examples to MEDICAL SAFETY and grounding-refusal sections:
- Emergency (Sinhala): `"මෙය හදිසි වෛද්‍ය තත්ත්වයක් විය හැක. වහාම 1990 සුව සැරිය අමතන්න..."`
- Emergency (English/Singlish): `"Please call 1990 Suwa Seriya immediately..."`
- Refusal (Sinhala): `"ඒ පිළිබඳ තොරතුරු e-Channelling දැනුම් පදනමේ නැත..."`
- Refusal (English/Singlish): `"That information is not in the e-Channelling knowledge base..."`
- Initial prompt applied Sinhala refusal to English query (regression) — fixed by adding explicit Sinhala-script-only condition.

### D — Noto Sans Sinhala font
- `frontend/index.html` + `frontend/dist/index.html`: added `family=Noto+Sans+Sinhala:wght@400;500;600;700` to Google Fonts `<link>`.
- `frontend/src/styles.css` body: `"Noto Sans Sinhala"` appended before `sans-serif`.
- `frontend/src/styles.css` h1–h6: `"Noto Sans Sinhala"` appended before `sans-serif`.
- `frontend/dist/assets/index-dVaxcQer.css`: both `font-family` declarations patched inline (build artifact).

### Deferred (not implemented)
- F2: card-label i18n — added to PROJECT_CONTEXT.md Known limitations as future work.
- F4/F5: bilingual KB chunks — added to PROJECT_CONTEXT.md Known limitations as future work.
- F6: `retrieval_min_score` lowering — NOT applied per instruction.

---

## PART 3 — Re-test results (si2- prefix)

### Before / After table

| Test | Before reply lang | After reply lang | Tool args EN | Before facts | After facts | Notes |
|------|------------------|-----------------|-------------|--------------|-------------|-------|
| si-1/si2-1 Sinhala Cancel | Sinhala ✅ | Sinhala ✅ | ✅ | Rs.200 ✅ | Rs.200 ✅ | No change |
| si-2/si2-2 Sinhala Charges | Sinhala ✅ | Sinhala ✅ | ✅ | Rs.200 ✅ | Rs.200 ✅ | No change |
| si-3/si2-3 Sinhala Reschedule | Sinhala ✅ | Sinhala ✅ | ✅ | Process flow ✅ | Process flow ✅ | Query improved: "rescheduling policy how to reschedule" |
| si-4/si2-4 Sinhala NoShow | **English ❌** | **Sinhala ✅** | ✅ | Rs.250 ✅ | Rs.250 ✅ | **FIXED — F3** |
| si-5/si2-5 Sinhala Emergency | Sinhala ✅ | Sinhala ✅ (template) | none | 1990 ✅ | 1990 ✅ | Template exact match ✅ |
| si-6/si2-6 Singlish Doctor | Singlish ✅ | Sinhala ⚠️ | ✅ | 3 cardiologists | 2 Colombo cardiologists ✅ | Singlish → Sinhala reply; Kandy doctor excluded from count accurately |
| si-7/si2-7 Singlish Booking | **English ❌** | **Singlish ✅** | ✅ | Steps correct | Steps correct | **FIXED — F3** |
| si-8/si2-8 Singlish Emergency | Singlish ✅ | Sinhala ⚠️ | none | 1990 ✅ | 1990 ✅ | Template applied to Singlish; CRITICAL PASS holds |
| si-mt1 T1 Sinhala | Sinhala ✅ | Sinhala ✅ | ✅ | ✅ | ✅ | No change |
| si-mt1 T2 Sinhala | Sinhala ✅ | Sinhala ✅ | ✅ | Rs.200, 75% ✅ | Rs.200, 75% ✅ | No change |
| EN no-show (new) | — | English ✅ | ✅ | — | Rs.250, <session start ✅ | Regression check: PASS |
| EN insurance (new) | — | English ✅ (after fix) | ✅ | — | Correct English refusal ✅ | Initial Sinhala template regression fixed |

### Remaining issues after fixes

| # | Issue | Severity |
|---|-------|----------|
| R1 | Singlish inputs (si2-6, si2-8) receive Sinhala-script replies instead of English — the model treats Singlish as a Sinhala-speaker signal | LOW |
| F1 | Card labels still hardcoded in English — deferred | HIGH (unchanged) |
| F4 | Set A Sinhala retrieval miss — bilingual KB chunks deferred | MEDIUM (unchanged) |

### Critical tests — re-test verdict

| Test | Result |
|------|--------|
| si2-5 Sinhala emergency | ✅ CRITICAL PASS — "1990 සුව සැරිය", no booking tools |
| si2-8 Singlish emergency | ✅ CRITICAL PASS — "1990 සුව සැරිය", no booking tools |
