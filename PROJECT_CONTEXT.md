# eChannelling AI Agent — Full Project Context

> Paste this into a new Claude conversation to continue where we left off.

---

## What this project is

A **RAG-powered AI chatbot** for Sri Lanka's eChannelling service, branded for SLT MOBITEL.
Patients can find doctors, check session availability, make and reschedule appointments,
and ask about channelling policies — all through a chat interface.

This is a **prototype** running on mock data. It does not connect to any live eChannelling
or SLT systems.

---

## Repository layout

```
echannelling-rag/
├── docker-compose.yml
├── start.sh                   # one-command launcher
├── .env                       # OPENAI_API_KEY etc (not in git)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── init/01-extensions.sql  # CREATE EXTENSION vector;
│   └── app/
│       ├── main.py             # FastAPI app, CORS, health endpoint
│       ├── config.py           # pydantic-settings
│       ├── db.py               # SQLAlchemy engine + SessionLocal
│       ├── models.py           # ORM models (see below)
│       ├── schemas.py          # Pydantic request/response models
│       ├── context.py          # contextvars.ContextVar for session_key
│       ├── rate_limit.py       # sliding-window rate limiter (10/min, 100/hr per session+IP)
│       ├── routers/
│       │   ├── chat.py         # POST /api/chat, DELETE /api/chat/{key}
│       │   └── catalog.py      # GET /api/stats, /api/gaps, /api/bookings
│       ├── services/
│       │   ├── agent.py        # LangChain AgentExecutor + system prompt
│       │   ├── tools.py        # all LangChain tools + per-request TRACE ContextVar
│       │   ├── embeddings.py   # OpenAI embedding helper
│       │   ├── retrieval.py    # pgvector cosine similarity search
│       │   └── rag_chain.py    # (legacy, not used by agent)
│       ├── scripts/
│       │   ├── seed_db.py          # populates hospitals, consultants, sessions
│       │   ├── ingest_kb.py        # chunks + embeds markdown → kb_chunks
│       │   └── test_duplicates.py  # 9-case duplicate-guard test (no LLM)
│       └── seed/
│           ├── consultants.json
│           ├── hospitals.json
│           └── knowledge/      # 7 policy markdown files
└── frontend/
    ├── Dockerfile              # nginx serving pre-built Vite dist
    ├── nginx.conf              # proxies /api/ with X-Real-IP header (bind-mounted)
    ├── index.html              # Figtree + Inter Google Fonts
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx             # root component
        ├── api.js              # fetch wrappers (sendMessage, clearSession, getStats…)
        ├── styles.css          # ~1400 lines — full design system
        ├── hooks/
        │   └── useConversations.ts   # localStorage chat history hook
        └── components/
            ├── StatusBar.jsx         # top header bar
            ├── Message.jsx           # renders one chat turn
            ├── DoctorCards.tsx       # doctor result cards
            ├── SessionCards.tsx      # session availability cards
            ├── BookingConfirmCard.tsx # booking preview + confirm/cancel
            ├── ChatHistory.tsx       # left-side conversation history sidebar
            ├── EvidencePanel.tsx     # right-side sources/tool-call drawer
            └── ui/
                └── chatgpt-prompt-input.tsx  # textarea with auto-grow
```

---

## Infrastructure

### Docker Compose — 3 containers

| Container | Image / Build | Port | Role |
|---|---|---|---|
| `ech_postgres` | `pgvector/pgvector:pg16` | 5433→5432 | PostgreSQL 16 + pgvector |
| `ech_backend` | `./backend` | 127.0.0.1:8000 | FastAPI + LangChain agent (loopback-only) |
| `ech_frontend` | `./frontend` | 3000→80 | nginx serving Vite dist |

Backend port is bound to `127.0.0.1:8000` — only reachable via nginx, preventing clients from
bypassing rate-limiting by hitting the backend directly.

Backend env includes `TZ: Asia/Colombo` — all `datetime.now()` calls return Sri Lanka local time.

Frontend has two bind mounts:
- `./frontend/dist:/usr/share/nginx/html:ro` — dist served directly; no `docker cp` needed; survives container recreation
- `./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro` — nginx config changes take effect without image rebuild

Backend startup command (inside container):
```
python -m app.scripts.seed_db && python -m app.scripts.ingest_kb && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### start.sh

```bash
./start.sh           # start all services + wait for health
./start.sh stop      # docker compose down
./start.sh restart   # down + start
./start.sh logs      # docker compose logs -f --tail=50
./start.sh status    # docker compose ps
```

### Deploy workflow

**Frontend JS/CSS changes:**
```bash
cd frontend && npm run build
# dist/ is bind-mounted — nginx picks up changes immediately on next request
# No docker cp or nginx reload needed
```

**nginx.conf changes:**
```bash
# nginx.conf is bind-mounted — no image rebuild needed, just reload nginx:
docker compose exec frontend nginx -s reload
```

**Backend changes (code only — volume-mounted, uvicorn auto-reloads):**
```bash
docker compose restart backend
```

**Full rebuild** (only needed if a Dockerfile itself changed):
```bash
docker compose up -d --force-recreate frontend   # or backend
```

---

## Backend

### Tech stack
- **FastAPI 0.115** + **uvicorn**
- **SQLAlchemy 2.0** (async-style mapped_column)
- **psycopg3** (psycopg[binary])
- **pgvector 0.3.6** + pgvector SQLAlchemy extension
- **LangChain 0.3** (`create_tool_calling_agent`, `AgentExecutor`)
- **langchain-openai** — `ChatOpenAI` + `OpenAIEmbeddings`
- **pydantic-settings** for config

### Database models (`models.py`)

```
Hospital          id, name, city, address, phone
Consultant        id, name, specialty, qualifications, years_experience,
                  consultation_fee, languages, hospital_id → Hospital
Session           id, consultant_id, session_date, start_time, end_time,
                  total_slots, booked_slots   [unique: consultant+date+time]
Booking           id, reference (ECHxxxxxxxx), session_id, patient_name,
                  patient_phone, appointment_number, status, amount,
                  rescheduled (bool), created_at
KBChunk           id, doc_id, title, source_file, content,
                  embedding Vector(1536), approved
Conversation      id, session_key, role, content, grounded,
                  tools_used, latency_ms, created_at,
                  context_note (nullable Text)
KnowledgeGap      id, query, session_key, created_at
```

### Pydantic schemas (`schemas.py`)

```python
ChatRequest       message (max 2000), session_key (max 64)
SourceChunk       doc_id, title, snippet, score
ToolCall          name, input, output_summary, result_json (optional)
DoctorCard        consultant_id, name, specialty, qualifications,
                  years_experience, consultation_fee_lkr, languages, hospital, city
PendingBooking    session_id, doctor, hospital, date, day, time,
                  estimated_appointment_number, consultation_fee_lkr,
                  service_charge_lkr, total_lkr, patient_name, patient_phone
SessionCard       session_id, doctor, hospital, date, day,
                  start_time, available_slots, fee_lkr
ChatResponse      answer, grounded, mode, sources[], tool_calls[],
                  latency_ms, session_key,
                  pending_booking?, doctor_cards[]?, session_cards[]?,
                  session_window? (e.g. "22 Sep – 6 Oct", from get_availability input)
```

### LangChain Agent (`services/agent.py`)

- Model: `ChatOpenAI` — configurable via `OPENAI_CHAT_MODEL` env var (default `gpt-4o-mini`)
- Pattern: `create_tool_calling_agent` → `AgentExecutor(max_iterations=6)`
- Conversation memory: last 8 turns loaded from `conversations` table as `HumanMessage`/`AIMessage`
- Per-request trace via `_TRACE` ContextVar in `tools.py` — isolated per request thread

**Context note mechanism** — fixes multi-turn memory for card-only results:
When `search_consultants`, `get_availability`, `prepare_booking`, or `create_booking` runs,
the assistant's text reply is a single sentence (doctor/session details are shown as cards,
not in text). To preserve that structured data across turns, `routers/chat.py` builds a compact
`context_note` string from the trace and stores it in the `Conversation` row. `to_lc_history()`
appends it to the AI message as `\n\n[Context for assistant, not shown to user: {note}]`. This
lets follow-up questions like "what is the fee for the second one?" or "yes, confirm" resolve
without re-calling tools. The confirmation_token for `create_booking` travels exclusively
through `context_note` — it never appears in any visible answer text.

Note format (max 1500 chars; whole entries dropped from the end with `(+N more not listed)` if needed):
- `search_consultants` → `Doctors shown: 1. {name} (id {id}, {specialty}, {hospital}, {city}, Rs {fee}, {years}y exp, langs {languages}, {qualifications}); ...`
- `get_availability` → `Sessions shown (next {N} days only, from {from} to {to}): 1. session_id {id}, {doctor}, {hospital}, {date} ({day}) {time}, {slots} slots, Rs {fee}; ...`
- `prepare_booking` → `Pending booking: session_id {id}, confirmation_token {token}`
- `create_booking` → `Booked: reference {ref}, session_id {id}, {doctor}, {date} {time}, phone {normalised_phone}`

The "Booked:" note lets a follow-up like "book the same session again" resolve to the
correct session_id and triggers the duplicate guard at prepare_booking.

**System prompt key rules (enforce strictly):**
1. Every fact about doctors/sessions/bookings must come from a tool result OR a `[Context for assistant]` note in history — never invented
2. Policy answers must use `search_knowledge_base` — if `NO_RELEVANT_KNOWLEDGE_FOUND`, say so
3. **DOCTOR RESULTS**: when `search_consultants` returns results, UI renders doctor cards automatically. Agent must give ONE sentence only — no listing
4. **SESSION RESULTS**: when `get_availability` returns results, UI renders session cards automatically. Agent must give ONE sentence only — no listing
5. Booking flow: `get_availability` → collect name+phone → `prepare_booking` → show preview (NO token in text) → explicit "yes" → `create_booking` using token from `[Context for assistant]` history note. If either prepare_booking or create_booking returns DUPLICATE_BOOKING, quote the existing reference and stop — do not retry or offer a new preview.
6. Rescheduling: `lookup_booking` → `get_availability(days_ahead=30)` → confirm → `reschedule_booking(reference, new_date YYYY-MM-DD, new_time HH:MM)`
7. Cancellation: agent has NO cancel tool. For general "how do I cancel?" questions: calls `search_knowledge_base("cancellation policy how to cancel")`, then if cancellation policy refers to Customer Support, also calls `search_knowledge_base("customer support contact phone email hours")`, and relays only what was retrieved. For cancellation of a specific booking: asks for reference first, looks up booking, then same two-search pattern.
8. Medical emergency: advise 1990 Suwa Seriya, stop
9. If a follow-up needs a doctor/session detail not in any tool result or context note, re-call the tool — never say you lack information about something shown to the user
10. Negative inferences from context notes are valid (e.g. languages listed as "Sinhala, English" → "neither speaks Tamil"); do not claim missing information when the field is present
11. Never mention the `[Context for assistant]` mechanism in replies — use the data, not the label

### Phone normalisation (`services/tools.py`)

`normalise_phone(raw: str) -> str` strips spaces, dashes, dots, brackets; converts
`+94XXXXXXXXX` or `94XXXXXXXXX` (11 digits) to `0XXXXXXXXX`; raises `ValueError`
with `INVALID_PHONE: please provide a 10-digit Sri Lankan mobile number` if the
result is not 10 digits starting with 0. Each calling tool catches the `ValueError`
and returns the `INVALID_PHONE` string — exceptions never propagate to the agent.

Applied at the top of `prepare_booking`, `create_booking`, and `lookup_booking`
before any comparison or storage. All phones stored in the `bookings` table are
in normalised `0XXXXXXXXX` form.

### Duplicate booking guard

Three layers (defence in depth):

1. **Application check in `prepare_booking`** — before issuing a token, queries
   `bookings` for an existing CONFIRMED row with the same (session_id, normalised_phone).
   If found, returns `DUPLICATE_BOOKING: this number already has booking {ref} for
   this session on {date} at {time}.` — no token issued, no pending_booking card.

2. **Application check in `create_booking`** — same query, run *inside* the
   `SELECT ... FOR UPDATE` row lock on the session, so it sees any booking committed
   by a concurrent thread between the two prepare calls.

3. **Database-level partial unique index** — prevents any INSERT that would create a
   second CONFIRMED booking for the same (session_id, patient_phone):
   ```sql
   CREATE UNIQUE INDEX uq_booking_session_phone_confirmed
     ON bookings (session_id, patient_phone)
     WHERE status = 'CONFIRMED';
   ```
   Defined in `models.py` as `Booking.__table_args__` so fresh databases get it
   automatically. `create_booking` catches `IntegrityError`, rolls back, re-queries
   for the existing booking, and returns the `DUPLICATE_BOOKING` message.

4. **Application check in `reschedule_booking`** — after acquiring a `SELECT ... FOR
   UPDATE` lock on the target session (note: acquired as a separate plain `select()`,
   because PostgreSQL forbids `FOR UPDATE` on the nullable side of a LEFT OUTER JOIN
   that `joinedload` generates), queries for an existing CONFIRMED booking for
   (new_session_id, b.patient_phone). If found, returns
   `DUPLICATE_BOOKING: this number already has booking {ref} in that session.` —
   old and new `booked_slots` are left unchanged. `db.commit()` is also wrapped in
   `try/except IntegrityError` as defence-in-depth for concurrent rescheduling.

### Slot race protection

`create_booking` loads the `Session` row with `SELECT ... FOR UPDATE` before
checking `available_slots` and incrementing `booked_slots`. This serialises
concurrent confirmation requests for the same session — the second thread waits
for the first to commit, then sees the already-committed booking via the
application-level duplicate check.

### Tools (`services/tools.py`)

| Tool | Key behaviour |
|---|---|
| `search_knowledge_base(query)` | pgvector cosine similarity on `kb_chunks`; logs to `knowledge_gaps` on miss; returns `NO_RELEVANT_KNOWLEDGE_FOUND` |
| `search_consultants(specialty, name, city, hospital)` | SELECT with ILIKE filters; returns JSON; sets `result_json={"doctors": [...]}` in TRACE |
| `get_availability(consultant_id, consultant_name, from_date, days_ahead)` | Returns sessions with `available_slots > 0`; sets `result_json={"sessions": [...]}` in TRACE |
| `prepare_booking(session_id, patient_name, patient_phone)` | Normalises phone; duplicate check; validates + previews; generates a 16-char `confirmation_token` stored in `_PENDING_TOKENS` (10 min TTL); sets `result_json={status:"READY_TO_CONFIRM", ...}` in TRACE; does NOT write to DB |
| `create_booking(confirmation_token, session_id, patient_name, patient_phone)` | Normalises phone; validates token; `SELECT Session FOR UPDATE`; duplicate check; consumes token (single-use); writes Booking row; catches IntegrityError; sets `result_json={reference, session_id, doctor, date, time, patient_phone}` in TRACE |
| `lookup_booking(reference, phone)` | Normalises phone if provided; returns bookings with `consultant_id` (needed for rescheduling) |
| `reschedule_booking(reference, new_date, new_time)` | Enforces: same consultant, ≥6h before original session (naive local time), one reschedule per booking, slots available; adjusts fee diff |

**TRACE mechanism (per-request ContextVar):**
```python
# In tools.py
_TRACE: ContextVar[list[dict] | None] = ContextVar("trace", default=None)

def reset_trace() -> None:
    _TRACE.set([])

def get_trace() -> list[dict]:
    return _TRACE.get() or []

def _trace(name, args, summary, result_json=None) -> None:
    # appends to per-request list — concurrent requests never share entries
```

**Confirmation token store:**
```python
# In tools.py — in-memory dict, lost on restart
# NOTE: use Redis or a DB table in a multi-worker/production deployment
_PENDING_TOKENS: dict[str, dict] = {}  # token → {session_id, patient_name, patient_phone, session_key, expires_at}
_TOKEN_TTL = 600  # seconds
```
Token is bound to the `session_key` of the request that called `prepare_booking`.
`create_booking` rejects the token with `SESSION_MISMATCH` if called from a different session,
preventing cross-session token reuse even if a token leaks.

### Chat router (`routers/chat.py`)

`POST /api/chat` flow:
1. Rate-limit check (10/min, 100/hr per **both** session_key **and** client IP)
2. Set `session_key_var` ContextVar for tools to use in gap logging
3. Load last 8 conversation rows as history
4. `agent_svc.run(message, history)` → gets answer + trace via `get_trace()`
5. Re-run retrieval for source cards (UI display only)
6. Extract `doctor_cards` from trace `result_json.doctors` (search_consultants)
7. Extract `pending_booking` from trace `result_json` (prepare_booking, status == READY_TO_CONFIRM)
8. Extract `session_cards` from trace `result_json.sessions` (get_availability)
9. `_build_context_note(trace)` — builds compact note for search_consultants / get_availability / prepare_booking / create_booking trace entries; stored in Conversation row
10. Write user + assistant rows to `conversations`
11. Return `ChatResponse` with all extracted card data

**Mode logic:**
- `knowledge_base` — only KB tool used
- `structured_data` — only DB tools used
- `mixed` — both used
- `from_context` — no tools, but history exists
- `no_source` — no tools, no history

### Rate limiter (`rate_limit.py`)

In-memory sliding window, keyed on **both** `session_key` and **client IP** (whichever trips first):
- 10 messages per 60 seconds
- 100 messages per 3600 seconds
- Returns HTTP 429 with `retry_after` seconds in body
- IP read from `X-Real-IP` header (nginx sets this from the TCP `$remote_addr` — not spoofable by client-supplied headers), falls back to `request.client.host`
- Rotating session keys cannot bypass the limit; the IP bucket catches it
- Backend port bound to `127.0.0.1:8000` — clients cannot reach the backend directly to bypass the limiter

### Knowledge base

7 policy documents in `backend/app/seed/knowledge/`:
1. `01-no-show-refund.md` — no-show charges
2. `02-cancellation.md` — cancellation tiers + refund table; refers to Customer Support policy for contact channels
3. `03-channelling-charges.md` — service fees
4. `04-booking-process.md` — how to book
5. `05-payment.md` — payment methods
6. `06-rescheduling.md` — reschedule rules
7. `07-support.md` — support contacts (+94 71 0 225 225, 1225, info@echannelling.com)

Ingested as chunks with `text-embedding-3-small` (1536 dims) into `kb_chunks`.
Cancellation guidance in `02-cancellation.md` refers to `07-support.md` for contact channels. Contact details live in `07-support.md` only: +94 71 0 225 225, 1225 (SLT), info@echannelling.com, echannelling.com, hours 7:00 AM–9:00 PM daily.

### API endpoints

```
GET  /                     root info
GET  /health               postgres, pgvector, model names, key present
POST /api/chat             main chat endpoint
DELETE /api/chat/{key}     clear session history
GET  /api/stats            kb_chunks, consultants, sessions, bookings, messages_logged
GET  /api/gaps             knowledge gap queries
GET  /api/bookings         all bookings (admin view)
GET  /docs                 FastAPI Swagger UI
```

---

## Frontend

### Tech stack
- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin) — utility classes available but mostly using custom CSS
- **ReactMarkdown** — renders bot responses as markdown
- **Google Fonts**: Figtree (headings/brand) + Inter (body), loaded in `index.html`

### Design system (`styles.css`)

**Brand palette (SLT MOBITEL):**
```css
--slt-navy:    #003087   /* primary dark — headings, avatars, buttons */
--slt-navy-dk: #001F5C   /* hover state */
--slt-navy-lt: #EEF3FF   /* light tint */
--slt-blue:    #0096D6   /* cerulean — accents, links, focus rings */
--slt-blue-lt: #E0F4FC
--slt-orange:  #F7941D   /* accent only */
```

**Surfaces (white-first):**
```css
--bg:       #F5F7FA   /* page shell */
--bg-chat:  #FFFFFF   /* chat area */
--surface:  #FFFFFF
--surf-2:   #F8FAFC
--surf-3:   #F0F4F8
```

**Motion tokens:**
```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)    /* expo-out — message enter */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* spring — button press */
```

**No gradients** — all backgrounds are solid colors. `@media (prefers-reduced-motion: reduce)` disables all animations.

### Components

#### `App.tsx`
- `sessionRef` (`useRef`) — holds current session ID (`"demo-" + random`), updated on "New conversation"
- State: `messages[]`, `busy`, `evidenceOpen`, `evidenceIdx`, `historyOpen`, `pendingBookingIdx`
- Auto-saves messages to localStorage via `useConversations` hook on every messages change
- `doSubmit(text)` — sends message, appends user+assistant rows, auto-opens evidence drawer
- `reset()` — clears backend session, generates new session ID, clears state
- `loadConversation(conv)` — restores a past conversation from localStorage
- 4 feature cards on empty state: Find Doctors, Check Slots, My Booking, Policy & Fees
- 4 starter chips: miss appointment, dermatologist Colombo, service charge, reschedule

#### `StatusBar.jsx`
Props: `health`, `stats`, `onHistoryToggle`, `historyOpen`

Left to right: **history toggle button** → **brand logo + "AI Assistant" tag** → spacer → **online dot** → **Emergency 1990 pill** → **Status dropdown**

#### `Message.jsx`
Renders in order: markdown text → DoctorCards → SessionCards → BookingConfirmCard → meta row (mode badge, latency, sources button).

#### `DoctorCards.tsx`
"Check Availability" fires: `doSubmit("Check availability for {name} (ID {id})")`

#### `SessionCards.tsx`
Slots badge: ok (≥10), mid (5–9), low (2–4), urgent (1).
"Book" fires: `doSubmit("I'd like to book session ID {id} — {day}, {date} at {start_time}")`

#### `BookingConfirmCard.tsx`
Shown after `prepare_booking` runs. Confirm/Cancel buttons disabled once `resolved=true`.

#### `ChatHistory.tsx`
Left sidebar. Conversations grouped: Today / Yesterday / Last 7 days / Older. Click-away + Escape closes. Hover to reveal delete button.

#### `useConversations.ts` (hook)
localStorage key: `ech_chat_history`, max 30 conversations. `save(id, messages)` upserts on every message change.

#### `EvidencePanel.tsx`
Right-side drawer: Sources tab (KB chunks + scores) + Tools tab (tool call inspector).

### `api.js`

```javascript
sendMessage(message, sessionKey)  → POST /api/chat
clearSession(sessionKey)          → DELETE /api/chat/{key}
getStats()                        → GET /api/stats
getHealth()                       → GET /health
getGaps()                         → GET /api/gaps
```

Rate limit 429 handling: parses `detail.message` and `detail.retry_after`, throws enriched error with `isRateLimit=true`.

---

## Data flow: how a message becomes cards

```
User types → doSubmit() → POST /api/chat
  ↓
chat.py: rate-limit (session_key + IP) → load history → agent_svc.run()
  ↓
agent.py: to_lc_history() — for assistant rows with context_note, appends
  "\n\n[Context for assistant, not shown to user: {note}]" to AIMessage content
  ↓
agent.py: reset_trace() → AgentExecutor → LLM decides tool(s)
  ↓
tools.py: executes tool → appends to _TRACE ContextVar (per-request, isolated)
  ↓
agent.py: get_trace() → returns this request's trace only
  ↓
chat.py: scans trace result_json:
  - search_consultants  → doctor_cards
  - prepare_booking     → pending_booking (+ confirmation_token stored server-side)
  - get_availability    → session_cards
  - create_booking      → "Booked: reference {ref}, session_id, doctor, date, time, phone"
  ↓
chat.py: _build_context_note(trace) → compact string for Conversation row
  (doctor list / session list / pending token / booked confirmation — max 1500 chars)
  ↓
ChatResponse returned with answer + all card data
  ↓
App.tsx: appends message with card data to messages[]
  ↓
useConversations: saves updated messages[] to localStorage
```

---

## What is fully working

- [x] Doctor search → doctor cards with "Check Availability" button
- [x] Availability check → session cards with color-coded slots + "Book" button
- [x] Full booking flow: select session → collect name+phone → preview card → confirm → reference number
- [x] Booking confirmation enforced by server-side token (prepare_booking → token → create_booking)
- [x] Duplicate booking guard (3 layers) + phone normalisation — blocks re-booking the same session/phone in any format (+94, 94-, spaces, etc.); also blocks reschedule into a session where the phone already has a booking
- [x] Multi-turn memory for card results — context_note carries doctor list, session list, confirmation_token, and "Booked:" line across turns so follow-ups like "what is the fee for the second one?" and "yes, confirm" resolve without re-querying
- [x] Rescheduling (once per booking, ≥6h notice Sri Lanka time, same consultant)
- [x] Cancellation guidance — channels retrieved from KB, not hardcoded in prompt
- [x] Knowledge base Q&A (7 policy docs, pgvector similarity search)
- [x] Knowledge gap logging (queries with no KB hit saved to DB)
- [x] Evidence panel (sources + tool call inspector)
- [x] Rate limiting (10/min, 100/hr per session AND per IP)
- [x] TRACE isolated per request via ContextVar — no cross-request bleed
- [x] Chat history sidebar (localStorage, grouped by date, load/delete)
- [x] "New conversation" starts a fresh session ID
- [x] SLT MOBITEL brand design (navy #003087, blue #0096D6, orange #F7941D)
- [x] All CSS gradients replaced with solid colors
- [x] Animations with `prefers-reduced-motion` support
- [x] start.sh launcher with health-wait and live stats
- [x] Frontend dist bind-mounted — survives container recreation, no docker cp needed
- [x] Container TZ set to Asia/Colombo

---

## Environment variables (`.env`)

```env
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini          # optional, default gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # optional
```

`TZ: Asia/Colombo` is set in `docker-compose.yml` under `backend.environment` — do not set it in `.env`.

---

## Known limitations

- **Confirmation tokens are in-memory** — lost on backend restart. If the backend restarts mid-booking after `prepare_booking` ran, `create_booking` will fail with `TOKEN_REQUIRED`. User must start the booking flow again. Would need Redis or a DB table in production.

- **Chat history vs server-side history**: restoring a conversation from localStorage restores the UI messages but does NOT restore the `conversations` table rows in PostgreSQL (unless the DB was preserved). If the DB was cleared (e.g. `docker compose down -v`), the agent loses memory of the restored session — it will treat it as a new conversation even though the UI shows old messages.

- **Session keys are anonymous** — `"demo-" + random`. Chat history persists in browser localStorage only (not cross-device, not cross-browser).

- **Seed data** is written by `seed_db.py` on startup, but only if the `consultants` table is empty (idempotent guard). Doctors and sessions survive backend restarts as long as the `pgdata` volume is intact. Wiping the volume (`docker compose down -v`) will trigger a full reseed on next start.

- **Rate limiter is in-memory** — not shared across multiple uvicorn workers. In a multi-worker deployment, a client could send `(workers × 10)` messages per minute.

- **Grounding guarantees answers match the knowledge base, not that the knowledge base is correct.** Contact details and fees must be verified against the live eChannelling service before any real deployment.

- **Comparative answers ("most slots", "cheapest") are correct but the model does not reliably state that the comparison covers only the results shown.** The UI compensates by captioning session and doctor cards with the window and count ("Showing available sessions, 22 Sep – 6 Oct", "Showing 3 doctors").
