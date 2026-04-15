#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Healthcare Platform — Stop Everything
# Run from the project root:  bash stop.sh
# ─────────────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'

log() { echo -e "${CYAN}[stop]${RESET} $*"; }
ok()  { echo -e "${GREEN}[  ok  ]${RESET} $*"; }

# ── Kill Node processes via saved PIDs ───────────────────────────────────────
for pid_file in "$LOGS"/*.pid; do
  [ -f "$pid_file" ] || continue
  label=$(basename "$pid_file" .pid)
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null && ok "Stopped $label (pid $pid)"
  fi
  rm -f "$pid_file"
done

# ── Also kill any stray node/next processes (Windows-safe fallback) ──────────
log "Cleaning up any remaining Node processes..."
pkill -f "npm run start:dev" 2>/dev/null || true
pkill -f "next dev"          2>/dev/null || true

# ── Stop Docker containers ───────────────────────────────────────────────────
log "Stopping Docker containers..."
cd "$ROOT"
docker compose down
ok "Docker containers stopped"

echo ""
echo -e "${GREEN}All services stopped.${RESET}"
