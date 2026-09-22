# eChannelling RAG — Project Reference

---

## File Map

| File | What it does / Why it exists |
|---|---|
| `docker-compose.yml` | Defines three containers (postgres, backend, frontend); backend port bound to `127.0.0.1:8000` (loopback-only) and `TZ: Asia/Colombo` env so naive datetime comparisons are correct |
| `start.sh` | One-command launcher: `./start.sh [stop|restart|logs|status]`; waits for health endpoint, prints live stats |
| `.env` | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`; `TZ` lives in compose, not here |
| `backend/Dockerfile` | Installs Python deps; startup cmd seeds DB + ingests KB then starts uvicorn with `--reload` |
| `backend/requirements.txt` | FastAPI 0.115, SQLAlchemy 2.0, psycopg3, pgvector 0.3.6, LangChain 0.3, langchain-openai, pydantic-settings |
| `backend/init/01-extensions.sql` | `CREATE EXTENSION IF NOT EXISTS vector;` — runs once on postgres container first boot |
| `backend/app/main.py` | FastAPI app factory; mounts CORS, health endpoint, chat + catalog routers |
| `backend/app/config.py` | pydantic-settings `Settings` — reads `.env`; single source for `OPENAI_*` vars |
| `backend/app/db.py` | SQLAlchemy engine + `SessionLocal` factory; `get_db()` dependency |
| `backend/app/models.py` | ORM: `Hospital`, `Consultant`, `Session`, `Booking`, `KBChunk` (Vector 1536), `Conversation` (+ `context_note` nullable Text), `KnowledgeGap` |
| `backend/app/schemas.py` | Pydantic I/O: `ChatRequest`, `ChatResponse` (includes `session_window`, `doctor_cards`, `session_cards`, `pending_booking`), `DoctorCard`, `SessionCard`, `PendingBooking`, `ToolCall`, `SourceChunk` |
| `backend/app/context.py` | `contextvars.ContextVar` holding the current `session_key` — lets tools log knowledge gaps without passing the key through every call |
| `backend/app/rate_limit.py` | Sliding-window limiter; 10/min + 100/hr per **both** `session_key` and client IP; IP read from `X-Real-IP` (set by nginx from TCP `$remote_addr` — not spoofable); returns HTTP 429 with `retry_after` |
| `backend/app/routers/chat.py` | `POST /api/chat` + `DELETE /api/chat/{key}`; orchestrates rate-check → history load → agent run → card extraction → `_build_context_note()` → DB write → `ChatResponse`; also computes `session_window` from `get_availability` input dates |
| `backend/app/routers/catalog.py` | Read-only admin endpoints: `/api/stats`, `/api/gaps`, `/api/bookings` |
| `backend/app/services/agent.py` | `create_tool_calling_agent` + `AgentExecutor(max_iterations=6)`; system prompt with 11 grounding rules (see below); `to_lc_history()` appends `[Context for assistant…]` note to AI messages |
| `backend/app/services/tools.py` | All 7 LangChain tools; `_TRACE` ContextVar for per-request isolation; `_PENDING_TOKENS` dict for confirmation tokens (TTL 600s, single-use, session-bound) |
| `backend/app/services/embeddings.py` | `OpenAIEmbeddings(model="text-embedding-3-small")` wrapper |
| `backend/app/services/retrieval.py` | pgvector cosine similarity query on `kb_chunks`; returns top-k with score |
| `backend/app/services/rag_chain.py` | Legacy simple RAG chain — not used by agent path; kept for reference |
| `backend/app/scripts/seed_db.py` | Populates `hospitals`, `consultants`, `sessions` from JSON seed files; idempotent (skips if `consultants` table non-empty) |
| `backend/app/scripts/ingest_kb.py` | Chunks 7 policy markdown files, embeds with `text-embedding-3-small`, upserts into `kb_chunks` |
| `backend/app/seed/consultants.json` | Mock consultant data (name, specialty, fee, languages, qualifications, hospital) |
| `backend/app/seed/hospitals.json` | Mock hospital data (name, city, address, phone) |
| `backend/app/seed/knowledge/01-no-show-refund.md` | No-show charge policy |
| `backend/app/seed/knowledge/02-cancellation.md` | Cancellation tiers + refund table; refers to `07-support.md` for contact channels |
| `backend/app/seed/knowledge/03-channelling-charges.md` | Service fee schedule |
| `backend/app/seed/knowledge/04-booking-process.md` | How to book via the platform |
| `backend/app/seed/knowledge/05-payment.md` | Accepted payment methods |
| `backend/app/seed/knowledge/06-rescheduling.md` | Reschedule rules (≥6h notice, once per booking, same consultant) |
| `backend/app/seed/knowledge/07-support.md` | Customer support contacts: +94 71 0 225 225, SLT 1225, info@echannelling.com, 7 AM–9 PM daily |
| `frontend/Dockerfile` | nginx image serving pre-built Vite `dist/`; dist and nginx.conf are bind-mounted (no bake-in) |
| `frontend/nginx.conf` | Proxies `/api/` to backend; sets `proxy_set_header X-Real-IP $remote_addr;`; bind-mounted so changes take effect with `docker compose exec frontend nginx -s reload` |
| `frontend/index.html` | Loads Figtree + Inter from Google Fonts; Vite entry point |
| `frontend/vite.config.ts` | Vite 6 + `@tailwindcss/vite` plugin |
| `frontend/package.json` | React 18, TypeScript, ReactMarkdown, Tailwind CSS v4 |
| `frontend/src/main.tsx` | React DOM render root |
| `frontend/src/App.tsx` | Root component; `sessionRef` holds session ID; manages `messages[]`, `pendingBookingIdx`, `evidenceOpen`; stores `session_window` from API response; saves to localStorage via `useConversations` |
| `frontend/src/api.js` | Fetch wrappers: `sendMessage`, `clearSession`, `getStats`, `getHealth`, `getGaps`; parses 429 `retry_after` and throws `isRateLimit=true` error |
| `frontend/src/styles.css` | ~1400-line design system: SLT MOBITEL palette (navy `#003087`, blue `#0096D6`, orange `#F7941D`), motion tokens, card styles, `.cards-caption` (11.5px muted label above card grids) |
| `frontend/src/hooks/useConversations.ts` | localStorage hook; key `ech_chat_history`, max 30 conversations; `save(id, messages)` upserts on every message change |
| `frontend/src/components/StatusBar.jsx` | Top header: history toggle → brand logo → online dot → Emergency 1990 pill → status dropdown |
| `frontend/src/components/Message.jsx` | Renders one chat turn: markdown → DoctorCards → SessionCards (with `window` prop) → BookingConfirmCard → meta row (mode badge, latency, sources button) |
| `frontend/src/components/DoctorCards.tsx` | Doctor result grid; caption "Showing N doctor(s)"; "Check Availability" button calls `doSubmit("Check availability for {name} (ID {id})")` |
| `frontend/src/components/SessionCards.tsx` | Session availability grid; caption "Showing available sessions, {window}" when `session_window` is present; slots badge color-coded (ok ≥10 / mid 5–9 / low 2–4 / urgent 1) |
| `frontend/src/components/BookingConfirmCard.tsx` | Booking preview card after `prepare_booking`; Confirm/Cancel buttons disabled once `resolved=true` |
| `frontend/src/components/ChatHistory.tsx` | Left sidebar; conversations grouped Today/Yesterday/Last 7 days/Older; click-away + Escape closes |
| `frontend/src/components/EvidencePanel.tsx` | Right drawer: Sources tab (KB chunks + scores) + Tools tab (tool call inspector) |
| `frontend/src/components/ui/chatgpt-prompt-input.tsx` | Auto-grow textarea component |

---

## Stack Rationale

| Choice | Why |
|---|---|
| FastAPI | Async-friendly, automatic OpenAPI docs, first-class Pydantic integration |
| LangChain `create_tool_calling_agent` | Standardised tool-calling loop without custom parsing; `max_iterations=6` caps runaway chains |
| pgvector + `text-embedding-3-small` | pgvector runs in the same Postgres instance (no separate vector DB); 1536 dims, cost-effective for prototype |
| `contextvars.ContextVar` for TRACE | Per-request isolation with zero threading overhead — concurrent requests never share trace entries |
| SQLAlchemy 2.0 `mapped_column` | Type-safe ORM; `Conversation.context_note` added as nullable Text without migration tooling |
| `_PENDING_TOKENS` in-memory dict | Simple for prototype; see Known Limitations for production path |
| React 18 + Vite 6 + Tailwind v4 | Fast HMR; Tailwind v4 `@tailwindcss/vite` plugin; mostly custom CSS for fine-grained control |
| nginx bind mounts | `dist/` and `nginx.conf` bind-mounted — JS/CSS changes and nginx config changes survive container recreation without rebuilds |
| Backend loopback bind (`127.0.0.1:8000`) | Clients cannot reach backend directly to bypass the rate limiter |
| `TZ: Asia/Colombo` in compose env | Naive `datetime.now()` returns Sri Lanka local time — required for rescheduling ≥6h check |

---

## How Grounding Is Enforced

The agent system prompt has 11 numbered rules applied strictly:

1. Every fact about doctors/sessions/bookings must come from a **tool result** OR a `[Context for assistant]` note in conversation history — never invented.
2. Policy answers must use `search_knowledge_base`; if `NO_RELEVANT_KNOWLEDGE_FOUND`, say so.
3. When `search_consultants` returns results, give ONE sentence only — UI renders doctor cards automatically.
4. When `get_availability` returns results, give ONE sentence only — UI renders session cards automatically.
5. Booking flow: `get_availability` → collect name+phone → `prepare_booking` → show preview (NO token in text) → explicit "yes" → `create_booking` using token from `[Context for assistant]` note.
6. Rescheduling: `lookup_booking` → `get_availability(days_ahead=30)` → confirm → `reschedule_booking`.
7. Cancellation: no cancel tool; two-KB-search pattern (cancellation policy + customer support contact) for both general and specific-booking cases.
8. Medical emergency: advise 1990 Suwa Seriya, stop.
9. If a follow-up needs a detail not in any tool result or context note, re-call the tool — never claim lack of information about something shown to the user.
10. Negative inferences from context notes are valid (e.g. `langs Sinhala, English` → "neither speaks Tamil"); don't claim missing information when the field is present but the value is absent.
11. Never mention the `[Context for assistant]` mechanism in replies — use the data, not the label.

Rule 9 (scope qualification for comparisons) was originally a STYLE directive; it was moved to GROUNDING RULES with prescriptive examples after the soft wording failed to produce compliance in 6/6 test runs. After further testing still showed inconsistent model compliance, scope was made visible deterministically in the UI via `session_window` + `.cards-caption` rendering rather than relying on model output.

---

## Confirmation Token Flow

```
User: "Book session 42"
  ↓
Agent calls prepare_booking(session_id=42, patient_name, patient_phone)
  ↓
tools.py: generates token = secrets.token_hex(8)  # 16 chars
         stores _PENDING_TOKENS[token] = {session_id, patient_name, patient_phone,
                                           session_key, expires_at=now+600s}
         returns {status:"READY_TO_CONFIRM", confirmation_token:token, ...preview...}
  ↓
chat.py: _build_context_note() → "Pending booking: session_id 42, confirmation_token abc123..."
         stored in Conversation row (context_note column)
         NEVER placed in visible answer text
  ↓
Agent reply: booking preview (fee, date, name) — NO token shown
  ↓
User: "Yes, confirm"
  ↓
to_lc_history() appends "[Context for assistant, not shown to user: Pending booking: session_id 42, confirmation_token abc123...]" to previous AIMessage
  ↓
Agent reads token from history note, calls create_booking(confirmation_token=abc123, ...)
  ↓
tools.py: validates token exists, not expired, args match, session_key matches
         consumes token (deletes from dict — single-use)
         writes Booking row, reference = "ECH" + 8 digits
  ↓
Agent replies with reference number
```

Token security properties: 16-char random hex; single-use; 600s TTL; bound to originating `session_key` (cross-session reuse rejected with `SESSION_MISMATCH`); never appears in any visible text — travels only through `context_note`.

---

## context_note Mechanism

**Problem:** Agent replies for doctor/session searches are one sentence ("Here are some options.") — full structured data is in UI cards, not in text. On follow-up turns ("what is the fee for the second one?"), the model had no access to card data and re-ran tools or refused.

**Solution:** After each agent run, `chat.py` calls `_build_context_note(trace)` which reads `result_json` from the TRACE and builds a compact string. This is stored in the `Conversation` row (`context_note` column). On the next turn, `to_lc_history()` appends it to the corresponding `AIMessage` as:

```
[Context for assistant, not shown to user: {note}]
```

Note format (max 1500 chars per note; entries dropped from end with `(+N more not listed)` if truncation needed):
- `search_consultants` → `Doctors shown: 1. {name} (id {id}, {specialty}, {hospital}, {city}, Rs {fee}, {years}y exp, langs {languages}, {qualifications}); ...`
- `get_availability` → `Sessions shown (next {N} days only, from {from} to {to}): 1. session_id {id}, {doctor}, {hospital}, {date} ({day}) {time}, {slots} slots, Rs {fee}; ...`
- `prepare_booking` → `Pending booking: session_id {id}, confirmation_token {token}`

All DoctorCard and SessionCard fields are carried so follow-ups like "which one speaks Tamil?", "what is the fee for the second one?", and "yes, confirm" resolve in one turn without re-querying.

---

## Rate Limiting

File: `backend/app/rate_limit.py`

- Sliding-window, in-memory (not shared across workers).
- **Dual key:** keyed on BOTH `session_key` AND client IP — both buckets checked; whichever trips first returns 429.
- Limits: 10 messages / 60s, 100 messages / 3600s.
- IP source: `X-Real-IP` header only (nginx sets from TCP `$remote_addr` — not spoofable by client headers); falls back to `request.client.host`.
- Response: HTTP 429 with `{"detail": {"message": "...", "retry_after": N}}`.
- Backend port `127.0.0.1:8000` ensures clients cannot bypass the rate limiter by hitting the backend directly.
- Rotating session keys cannot bypass the IP bucket.
- **Testing note:** space requests ≥7s apart to avoid tripping the 10/min IP limit during manual testing.

---

## Bugs Hit and Fixes

| # | Bug | Fix |
|---|---|---|
| 1 | Cancellation answers didn't surface phone number — pgvector for "how do I cancel?" only retrieved cancellation policy chunks, not support contacts | Split cancellation system prompt rule into two cases; both general and specific-booking cases now call `search_knowledge_base("customer support contact phone email hours")` as a second query when cancellation policy refers to Customer Support |
| 2 | Multi-turn memory regression — "what is the fee for the second one?" forced agent to re-run `search_consultants` | `context_note` initially only carried name/id/specialty/hospital/fee; expanded to all DoctorCard fields (city, years_experience, languages, qualifications); raised limit to 1500 chars |
| 3 | "which one speaks Tamil?" returned "I don't have information" despite `langs Sinhala, English` in context note | Added grounding rule 10: negative inferences from context notes are valid; if field is present but value absent, state that fact directly |
| 4 | "yes, confirm" turn failed — `create_booking` got `TOKEN_REQUIRED`, agent re-ran `prepare_booking`, hit `DUPLICATE_BOOKING` | `context_note` now carries `Pending booking: session_id {id}, confirmation_token {token}`; grounding rule 5 directs agent to read token from `[Context for assistant]` note |
| 5 | context_note present but model ignoring it — grounding rules too strict ("must come from a tool result") | Updated grounding rule 1 to include "OR from a `[Context for assistant]` note"; added explicit rule 6 (now rule 10 after renumbering) authorizing context notes |
| 6 | Scope qualifier ("among sessions shown") not appearing in comparative answers despite STYLE rule | Moved scope qualification to GROUNDING RULES as rule 9 with prescriptive examples; removed old STYLE line |
| 7 | Rule 9 still not producing qualifier in answers — model non-compliant in all 6 test runs | Made scope visible deterministically in UI: `session_window` field in `ChatResponse`, `.cards-caption` rendering in `SessionCards` and `DoctorCards` |
| 8 | 429 errors during test scripts — 12 requests in quick succession tripped 10/min IP limit | Space requests ≥7s apart during manual testing |
| 9 | nginx.conf changes not taking effect after `force-recreate` — conf was baked into image | Added `./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro` bind mount to `docker-compose.yml` |
| 10 | `X-Forwarded-For` header spoofable by clients | Switched nginx to `proxy_set_header X-Real-IP $remote_addr;` (TCP-level, not spoofable); rate limiter reads `X-Real-IP` only |
| 11 | `start.sh` Unicode em-dash caused Python `str.replace()` failure | Used `python3 -c` inline script with explicit UTF-8 `open()` |

---

## Four Follow-up Tests and Results

### Test 1 — Tamil language inference (negative)
**Query sequence:** search cardiologists → "which one speaks Tamil?"
**Expected:** model states neither speaks Tamil using context note `langs` field (not a tool re-call, not "I don't know")
**Result:** PASS after fix (rule 10 / negative inference clause added)

### Test 2 — Fee follow-up from context note
**Query sequence:** search consultants → "what is the fee for the second one?"
**Expected:** fee answered from context note without re-calling `search_consultants`
**Result:** PASS after expanded context_note (all DoctorCard fields) and 1500-char limit

### Test 3 — Comparison from context note (doctor)
**Query sequence:** search consultants → "who has the most experience?"
**Expected:** correct answer from context note with scope qualifier
**Result:** PASS for correctness; scope qualifier inconsistent in model text — resolved via UI caption

### Test 4 — Session comparison + scope awareness
**Query sequence:** `get_availability` → "which session has the most slots?" / "which is cheapest?"
**Sub-runs t4a–t4i across three batches**
**Expected:** correct answer + scope qualifier referencing the window
**Correctness:** PASS consistently after `get_availability` prefix includes `from {date} to {date}` in context note
**Scope qualifier:** FAIL for model-text qualifier in all 6 runs of t4g–t4i even after rule 9 rewrite
**Resolution:** `session_window` field added to `ChatResponse`; `SessionCards` renders caption "Showing available sessions, 22 Sep – 6 Oct" deterministically; model compliance no longer required for this signal

---

## session_window and Cards Caption

`session_window` is computed in `routers/chat.py` from the `get_availability` tool input:
```python
from_dt = date.fromisoformat(raw_from)
to_dt   = from_dt + timedelta(days=days)
session_window = f"{from_dt.strftime('%-d %b')} – {to_dt.strftime('%-d %b')}"
```
Returned in `ChatResponse.session_window`, stored in the message state object in `App.tsx`, passed as `window` prop to `SessionCards`. Caption rendered by `SessionCards`: `"Showing available sessions, {window}"` (or without window if absent). `DoctorCards` always shows `"Showing N doctor(s)"`. Both use `.cards-caption` CSS class (11.5px, font-weight 500, `var(--ink-3)`).

---

## Command Cheat Sheet

```bash
# Start everything
./start.sh

# Stop
./start.sh stop

# Restart backend (code changes — uvicorn hot-reloads automatically, restart only needed for env changes)
docker compose restart backend

# Rebuild frontend after JS/CSS changes (dist is bind-mounted — no docker cp needed)
cd frontend && npm run build

# Apply nginx.conf changes without image rebuild (conf is bind-mounted)
docker compose exec frontend nginx -s reload

# Full rebuild (only if Dockerfile changed)
docker compose up -d --force-recreate frontend
docker compose up -d --force-recreate backend

# View live logs
./start.sh logs

# Check health
curl localhost:3000/health

# Chat API (space requests ≥7s to avoid rate limit)
curl -s -X POST localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I need a cardiologist in Colombo","session_key":"test-1"}'

# Clear session
curl -s -X DELETE localhost:3000/api/chat/test-1

# Admin stats
curl -s localhost:3000/api/stats | python3 -m json.tool

# Knowledge gaps
curl -s localhost:3000/api/gaps | python3 -m json.tool

# Bookings
curl -s localhost:3000/api/bookings | python3 -m json.tool

# Connect to postgres
docker compose exec ech_postgres psql -U postgres -d echannelling
```

---

## Known Limitations

- **Confirmation tokens are in-memory** — lost on backend restart; user must restart booking flow; production fix: Redis or DB table.
- **Rate limiter is in-memory** — not shared across multiple uvicorn workers; multi-worker deployment multiplies the per-worker limit.
- **Chat history vs server-side history** — restoring from localStorage restores UI but not DB rows; agent treats restored session as new if DB was cleared.
- **Session keys are anonymous** — `"demo-" + random`; history persists in browser localStorage only (not cross-device).
- **Comparative answers ("most slots", "cheapest") are correct but model does not reliably state that results cover only the shown window** — UI compensates with `.cards-caption` deterministically showing window and count.
- **Grounding guarantees answers match KB, not that KB is correct** — contact details and fees must be verified against live eChannelling service before any real deployment.
- **Seed data is mock** — no connection to live eChannelling or SLT systems.

---

## Next Steps

- Replace `_PENDING_TOKENS` in-memory dict with Redis or a `pending_tokens` DB table for production reliability and multi-worker support.
- Replace in-memory rate limiter with Redis sliding window to support multiple uvicorn workers.
- Add proper auth — session keys are currently anonymous; tie to user accounts for cross-device history and booking ownership.
- Verify all contact details, fees, and policy text against the live eChannelling service before deployment.
- Add `ingest_kb` fingerprinting so unchanged documents aren't re-embedded on every container start.
- Add e2e tests covering the full booking flow: `search_consultants` → `get_availability` → `prepare_booking` → "yes, confirm" → `create_booking`.
