# eChannelling AI Agent

AI-powered medical assistant for Sri Lanka's eChannelling platform. Combines a conversational booking chatbot with an interactive symptom checker that generates clinical intake questions and lab test recommendations — all grounded in real hospital data.

Built for **Nawaloka Hospital** as a prototype. Uses OpenAI GPT-4o-mini, pgvector RAG, and a 2D interactive body map.

---

## Features

### Chatbot
- Book doctor appointments via natural conversation
- Answers questions about doctors, specialities, hospitals, and session times
- RAG-grounded responses from PostgreSQL + pgvector
- Supports English and Sinhala (සිංහල)
- Rate-limited, session-aware chat history

### AI Symptom Checker
- Select symptoms from a categorised list
- Interactive 2D body map — click regions to mark affected areas, zoom in/out (50%–400%)
- Head region split into left/right sides (front and back views)
- AI generates 5 structured clinical intake questions specific to the reported symptoms:
  - Red flag yes/no question (e.g. thunderclap headache, crushing chest pain spreading to arm)
  - Duration, character, associated symptoms, triggers — all symptom-specific
- AI analysis returns: possible conditions with likelihood, recommended lab tests with pricing, specialist referral, urgency level (Routine / Soon / Urgent)
- Sandbox payment flow to book selected lab tests

### Other
- Google Sign-In and email/password auth with JWT
- User dashboard with booking history
- Doctor portal (session management, notifications)
- Admin panel (doctor/hospital management)
- Sandbox PayHere payment integration
- Email notifications via Gmail SMTP

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL 16 + pgvector |
| AI | OpenAI GPT-4o-mini + text-embedding-3-small |
| Auth | JWT + Google OAuth |
| Infrastructure | Docker, Docker Compose, Nginx |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — works on Mac and Windows
- An OpenAI API key — [platform.openai.com](https://platform.openai.com)
- Git

> **Windows users:** all commands below work in PowerShell or Git Bash. See the Mac vs Windows section at the bottom for differences.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/primemarasinghe/echannelling-ai-agent.git
cd echannelling-ai-agent
```

### 2. Create your environment file

**Mac / Linux:**
```bash
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in at minimum:
```
OPENAI_API_KEY=sk-...
JWT_SECRET=any-long-random-string
ADMIN_EMAILS=your@email.com
```

Everything else is optional for basic local use.

### 3. Start with Docker

```bash
docker compose up -d
```

First run takes 3–5 minutes to build images and seed the database.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### 4. Rebuild after code changes

```bash
# Rebuild a specific service after changing its code
docker compose build backend
docker compose build frontend

# Restart updated containers
docker compose up -d

# View live logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Project Structure

```
echannelling-ai-agent/
├── backend/
│   └── app/
│       ├── config.py           # All settings — read from .env
│       ├── main.py             # FastAPI app, CORS, router registration
│       ├── models.py           # SQLAlchemy ORM models
│       ├── schemas.py          # Pydantic request/response schemas
│       ├── routers/
│       │   ├── chat.py         # Chatbot endpoint
│       │   ├── doctors.py      # Doctor/hospital CRUD
│       │   ├── symptoms.py     # Symptom checker: questions + analysis
│       │   └── payment.py      # PayHere sandbox integration
│       ├── services/
│       │   ├── agent.py        # LangChain tool-calling agent
│       │   ├── tools.py        # RAG retrieval, booking tools
│       │   ├── auth_service.py # JWT + Google OAuth
│       │   └── email_svc.py    # Gmail SMTP notifications
│       └── seed/
│           ├── consultants.json
│           └── hospitals.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BodyMap.tsx             # Body region types + metadata
│   │   │   ├── BodyMapImage.tsx        # Interactive 2D body map with zoom/pan
│   │   │   ├── BookingFormModal.tsx
│   │   │   └── SandboxPaymentSheet.tsx
│   │   ├── pages/
│   │   │   ├── SymptomChecker.tsx      # Full symptom checker (6 steps)
│   │   │   ├── HomePage.tsx            # Main chatbot interface
│   │   │   ├── DoctorsPage.tsx
│   │   │   └── UserDashboard.tsx
│   │   └── api.js                      # All API calls
│   └── public/
│       └── body/                       # Body map PNG assets (front + back)
├── docker-compose.yml
├── .env.example                        # Template — copy to .env
└── .gitignore
```

---

## Environment Variables

All variables live in `.env` at the project root. **Never commit this file.**

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_CHAT_MODEL` | No | Default: `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | No | Default: `text-embedding-3-small` |
| `JWT_SECRET` | Yes | Random string for signing JWT tokens |
| `ADMIN_EMAILS` | Yes | Comma-separated admin email addresses |
| `GOOGLE_CLIENT_ID` | No | For Google Sign-In (backend) |
| `VITE_GOOGLE_CLIENT_ID` | No | Same value — used by frontend build |
| `PAYHERE_MERCHANT_ID` | No | PayHere sandbox merchant ID |
| `PAYHERE_MERCHANT_SECRET` | No | PayHere sandbox secret |
| `APP_BASE_URL` | No | Backend public URL for payment callbacks |
| `GMAIL_USER` | No | Gmail address for email notifications |
| `GMAIL_APP_PASSWORD` | No | Gmail App Password (not your regular password) |

---

## Mac vs Windows Notes

| Task | Mac / Linux | Windows |
|------|-------------|---------|
| Copy env file | `cp .env.example .env` | `Copy-Item .env.example .env` (PowerShell) |
| Line endings | LF (Unix, default) | Git may auto-convert to CRLF — run `git config core.autocrlf false` before cloning |
| Docker Desktop | Install `.dmg` | Install `.exe`, enable WSL2 backend in settings |
| Port access | Works immediately | Windows Defender may block ports — allow 3000 and 8000 in firewall rules |
| `.env` editor | Any editor | Use VS Code or Notepad++ — avoid Windows Notepad (may add BOM) |

**Windows WSL2 tip:** Clone the repo inside WSL2 (e.g. `~/projects/`) rather than on the Windows filesystem (`C:\`). Mounting Windows drives into WSL2 for Docker builds is significantly slower.

---

## Stopping and Resetting

```bash
# Stop containers but keep database data
docker compose down

# Stop and delete all data (full reset)
docker compose down -v

# Full clean rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

---

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable |
| `developer` | Active development |

---

## Disclaimer

The symptom checker is for **demonstration purposes only** and is not a medical diagnostic tool. All doctor and hospital data is mock/seed data. The payment flow is sandbox — no real charges are made.
