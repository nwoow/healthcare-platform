#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Healthcare Platform — Start Everything
# Run from the project root:  bash start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[startup]${RESET} $*"; }
ok()   { echo -e "${GREEN}[  ok  ]${RESET} $*"; }
warn() { echo -e "${YELLOW}[ warn ]${RESET} $*"; }
die()  { echo -e "${RED}[ fail ]${RESET} $*"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Docker infrastructure
# ─────────────────────────────────────────────────────────────────────────────
log "Starting Docker containers..."
cd "$ROOT"
docker compose up -d || die "docker compose up failed"

# Wait for PostgreSQL (external port 5433)
log "Waiting for PostgreSQL on port 5433..."
for i in $(seq 1 30); do
  if docker exec "$(docker compose ps -q postgres)" pg_isready -U healthcare -q 2>/dev/null; then
    ok "PostgreSQL is ready"
    break
  fi
  [ "$i" -eq 30 ] && die "PostgreSQL did not become ready in time"
  sleep 2
done

# Wait for Kafka (port 9092)
log "Waiting for Kafka on port 9092..."
for i in $(seq 1 30); do
  if docker compose exec -T kafka kafka-topics --bootstrap-server localhost:9092 --list &>/dev/null; then
    ok "Kafka is ready"
    break
  fi
  [ "$i" -eq 30 ] && warn "Kafka not ready after 60s — services will retry on their own"
  sleep 2
done

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Helper: start a NestJS service in the background
# Usage: start_service <label> <port> <dir>
# ─────────────────────────────────────────────────────────────────────────────
start_service() {
  local label="$1"
  local port="$2"
  local dir="$3"
  local logfile="$LOGS/${label}.log"

  if [ ! -f "$dir/package.json" ]; then
    warn "$label — directory $dir not found, skipping"
    return
  fi

  log "Starting ${BOLD}$label${RESET} (port $port) → log: .logs/${label}.log"
  (cd "$dir" && npm run start:dev > "$logfile" 2>&1) &
  echo $! > "$LOGS/${label}.pid"
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. Backend microservices
# ─────────────────────────────────────────────────────────────────────────────
start_service "auth"         3001 "$ROOT/services/auth"
start_service "iam"          3002 "$ROOT/services/iam"
start_service "form-builder" 3003 "$ROOT/services/form-builder"
start_service "submission"   3004 "$ROOT/services/submission"
start_service "patient"      3006 "$ROOT/services/patient"
start_service "audit"        3008 "$ROOT/services/audit"
start_service "integration"  3009 "$ROOT/services/integration"
start_service "tenant"       3010 "$ROOT/services/tenant"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Frontend
# ─────────────────────────────────────────────────────────────────────────────
log "Starting ${BOLD}Frontend${RESET} (port 3000) → log: .logs/frontend.log"
(cd "$ROOT/apps/frontend" && npm run dev > "$LOGS/frontend.log" 2>&1) &
echo $! > "$LOGS/frontend.pid"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Wait for services to boot, then print summary
# ─────────────────────────────────────────────────────────────────────────────
log "Waiting 20 s for services to initialise..."
sleep 20

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Healthcare Platform — All services started             ${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${GREEN}Frontend${RESET}          http://localhost:3000"
echo -e "  ${GREEN}Auth${RESET}              http://localhost:3001/api/docs"
echo -e "  ${GREEN}IAM${RESET}               http://localhost:3002/api/docs"
echo -e "  ${GREEN}Form Builder${RESET}      http://localhost:3003/api/docs"
echo -e "  ${GREEN}Submission${RESET}        http://localhost:3004/api/docs"
echo -e "  ${GREEN}Patient${RESET}           http://localhost:3006/api/docs"
echo -e "  ${GREEN}Audit${RESET}             http://localhost:3008/api/docs"
echo -e "  ${GREEN}Integration${RESET}       http://localhost:3009/api/docs"
echo -e "  ${GREEN}Tenant${RESET}            http://localhost:3010/api/docs"
echo ""
echo -e "  ${CYAN}Kafka UI${RESET}          http://localhost:8083"
echo -e "  ${CYAN}Mongo Express${RESET}     http://localhost:8081  (admin / admin123)"
echo -e "  ${CYAN}pgAdmin${RESET}           http://localhost:8082  (admin@healthcare.com / admin123)"
echo ""
echo -e "  Logs → ${YELLOW}.logs/<service>.log${RESET}"
echo -e "  Stop  → ${YELLOW}bash stop.sh${RESET}  or  Ctrl+C each terminal"
echo ""

# Keep the script alive so Ctrl+C kills child processes cleanly
wait
