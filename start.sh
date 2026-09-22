#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  eChannelling AI  —  Project Start Script
#  Usage:  ./start.sh          start all services
#          ./start.sh stop     stop all services
#          ./start.sh restart  restart all services
#          ./start.sh logs     tail live logs
#          ./start.sh status   show container status
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────
ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✖${RESET}  $*"; exit 1; }
hr()   { echo -e "${DIM}──────────────────────────────────────────────────${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────
banner() {
  echo ""
  echo -e "${BOLD}${BLUE}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║       eChannelling AI — RAG Agent        ║"
  echo "  ║         by SLT MOBITEL · Sri Lanka        ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# ── Resolve project root (works wherever you call the script from) ─
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Subcommands ───────────────────────────────────────────────────
CMD="${1:-start}"

case "$CMD" in

  stop)
    banner
    echo -e "${BOLD}Stopping all services…${RESET}"
    hr
    docker compose down
    ok "All containers stopped."
    echo ""
    exit 0
    ;;

  restart)
    banner
    echo -e "${BOLD}Restarting all services…${RESET}"
    hr
    docker compose down
    exec "$0" start
    ;;

  logs)
    echo -e "${BOLD}Streaming logs  (Ctrl-C to exit)${RESET}"
    hr
    docker compose logs -f --tail=50
    exit 0
    ;;

  status)
    banner
    hr
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    exit 0
    ;;

  start) ;;   # fall through
  *)
    echo "Unknown command: $CMD"
    echo "Usage: $0 [start|stop|restart|logs|status]"
    exit 1
    ;;
esac

# ── START ─────────────────────────────────────────────────────────
banner
echo -e "${BOLD}Starting eChannelling AI…${RESET}"
hr

# 1. Docker running?
if ! docker info > /dev/null 2>&1; then
  fail "Docker is not running. Please start Docker Desktop and try again."
fi
ok "Docker is running"

# 2. .env present?
if [ ! -f ".env" ]; then
  fail ".env file not found in project root.\n     Create it with:\n     OPENAI_API_KEY=sk-..."
fi
ok ".env found"

# 3. OPENAI_API_KEY set?
source .env 2>/dev/null || true
if [ -z "${OPENAI_API_KEY:-}" ]; then
  fail "OPENAI_API_KEY is missing from .env"
fi
ok "OpenAI key present"

hr

# 4. Start containers
info "Starting containers (postgres → backend → frontend)…"
echo ""
docker compose up -d --remove-orphans 2>&1 | while IFS= read -r line; do
  echo -e "  ${DIM}${line}${RESET}"
done
echo ""

# 5. Wait for backend health
info "Waiting for backend to be ready…"
MAX=40
COUNT=0
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || true)
  if [ "$STATUS" = "200" ]; then
    break
  fi
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX ]; then
    fail "Backend did not start within ${MAX} seconds. Run './start.sh logs' to investigate."
  fi
  printf "  ${DIM}.${RESET}"
  sleep 1
done
echo ""
ok "Backend is ready"

# 6. Fetch live stats
HEALTH=$(curl -s http://localhost:8000/health 2>/dev/null || echo "{}")
STATS=$(curl -s http://localhost:8000/api/stats 2>/dev/null || echo "{}")

CHAT_MODEL=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('chat_model','?'))" 2>/dev/null || echo "?")
KB=$(echo "$STATS"   | python3 -c "import sys,json; print(json.load(sys.stdin).get('kb_chunks','?'))" 2>/dev/null || echo "?")
DOCS=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('consultants','?'))" 2>/dev/null || echo "?")
SESS=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessions','?'))" 2>/dev/null || echo "?")
BOOK=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bookings','?'))" 2>/dev/null || echo "?")

# 7. Summary
hr
echo ""
echo -e "  ${BOLD}${GREEN}All services are up!${RESET}"
echo ""
echo -e "  ${BOLD}URLs${RESET}"
echo -e "  ${CYAN}Chat UI    ${RESET}  http://localhost:3000"
echo -e "  ${CYAN}API docs   ${RESET}  http://localhost:8000/docs"
echo -e "  ${CYAN}Health     ${RESET}  http://localhost:8000/health"
echo -e "  ${CYAN}Stats      ${RESET}  http://localhost:8000/api/stats"
echo -e "  ${CYAN}KB Gaps    ${RESET}  http://localhost:8000/api/gaps"
echo -e "  ${CYAN}Bookings   ${RESET}  http://localhost:8000/api/bookings"
echo ""
echo -e "  ${BOLD}Model${RESET}        ${chat_model:-$CHAT_MODEL}"
echo ""
echo -e "  ${BOLD}Data${RESET}"
echo -e "  ${DIM}Policy chunks  ${RESET}  ${KB}"
echo -e "  ${DIM}Doctors        ${RESET}  ${DOCS}"
echo -e "  ${DIM}Sessions       ${RESET}  ${SESS}"
echo -e "  ${DIM}Bookings       ${RESET}  ${BOOK}"
echo ""
hr
echo ""
echo -e "  ${DIM}./start.sh stop      — stop all services"
echo -e "  ./start.sh restart   — restart all services"
echo -e "  ./start.sh logs      — stream live logs"
echo -e "  ./start.sh status    — container status"
echo ""
echo -e "  Frontend deploy (after any UI change):"
echo -e "    cd frontend && npm run build${RESET}"
echo ""
