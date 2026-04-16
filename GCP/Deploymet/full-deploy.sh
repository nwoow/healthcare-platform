#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Healthcare Platform — Complete From-Scratch VM Deployment Script
# Tested on: Ubuntu 22.04 LTS (GCP e2-standard-8, 8vCPU 32GB RAM)
# GitHub: https://github.com/nwoow/healthcare-platform
#
# Usage:
#   bash full-deploy.sh
#
# What this script does:
#   1. Installs Docker, Node.js 20, pnpm, k6, PM2
#   2. Clones the repo from GitHub
#   3. Starts all Docker containers (PostgreSQL, MongoDB, Redis, Kafka)
#   4. Fixes /etc/hosts so 'mongo' resolves to localhost
#   5. Creates .env files for all 8 services
#   6. Installs all Node dependencies
#   7. Runs Prisma migrations
#   8. Generates Prisma clients
#   9. Starts all 8 NestJS services via PM2
#   10. Starts Next.js frontend via PM2
#   11. Health checks all services
# ═══════════════════════════════════════════════════════════════════

set -e
GITHUB_REPO="https://github.com/nwoow/healthcare-platform.git"
DB_URL="postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Healthcare Platform — Full VM Deployment                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── STEP 1: System packages ──────────────────────────────────────
echo "▶ Step 1: Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y git curl wget unzip htop net-tools iproute2

# ── STEP 2: Docker ───────────────────────────────────────────────
echo "▶ Step 2: Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
fi
sudo systemctl enable docker
sudo systemctl start docker
sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
echo "✓ Docker $(docker --version)"

# ── STEP 3: Node.js 20 ───────────────────────────────────────────
echo "▶ Step 3: Installing Node.js 20..."
if ! node --version 2>/dev/null | grep -q "v20"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "✓ Node $(node --version)"

# ── STEP 4: pnpm ─────────────────────────────────────────────────
echo "▶ Step 4: Installing pnpm..."
sudo npm install -g pnpm 2>/dev/null
echo "✓ pnpm $(pnpm --version)"

# ── STEP 5: PM2 ──────────────────────────────────────────────────
echo "▶ Step 5: Installing PM2..."
sudo npm install -g pm2 2>/dev/null
echo "✓ PM2 $(pm2 --version)"

# ── STEP 6: k6 load testing tool ─────────────────────────────────
echo "▶ Step 6: Installing k6..."
if ! command -v k6 &>/dev/null; then
  wget -q https://github.com/grafana/k6/releases/download/v0.55.0/k6-v0.55.0-linux-amd64.tar.gz
  tar xzf k6-v0.55.0-linux-amd64.tar.gz
  sudo mv k6-v0.55.0-linux-amd64/k6 /usr/local/bin/k6
  rm -rf k6-v0.55.0-linux-amd64*
fi
echo "✓ $(k6 version)"

# ── STEP 7: Clone repo ───────────────────────────────────────────
echo "▶ Step 7: Cloning repository..."
cd ~
if [ -d "healthcare-platform" ]; then
  echo "  Repo exists — pulling latest..."
  cd healthcare-platform && git pull origin master
else
  git clone $GITHUB_REPO
  cd healthcare-platform
fi
echo "✓ Repo ready at ~/healthcare-platform"

# ── STEP 8: Fix /etc/hosts for Docker hostname resolution ────────
echo "▶ Step 8: Fixing /etc/hosts..."
if ! grep -q "127.0.0.1 mongo" /etc/hosts; then
  echo "127.0.0.1 mongo" | sudo tee -a /etc/hosts
fi
if ! grep -q "127.0.0.1 kafka" /etc/hosts; then
  echo "127.0.0.1 kafka" | sudo tee -a /etc/hosts
fi
if ! grep -q "127.0.0.1 redis" /etc/hosts; then
  echo "127.0.0.1 redis" | sudo tee -a /etc/hosts
fi
echo "✓ Hostname aliases added"

# ── STEP 9: Start Docker containers ─────────────────────────────
echo "▶ Step 9: Starting Docker containers..."
cd ~/healthcare-platform
sudo docker compose up -d
echo "  Waiting 50 seconds for Kafka and MongoDB replica set..."
sleep 50
sudo docker compose ps
echo "✓ Containers running"

# ── STEP 10: Create .env files for all services ──────────────────
echo "▶ Step 10: Creating .env files..."

create_env() {
  local service=$1
  local port=$2
  local extra=$3
  cat > ~/healthcare-platform/services/$service/.env << EOF
DATABASE_URL="${DB_URL}"
MONGODB_URI="mongodb://127.0.0.1:27017/healthcare_${service}?replicaSet=rs0"
JWT_SECRET="healthcare-jwt-secret-production-2026"
JWT_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"
REDIS_URL="redis://127.0.0.1:6379"
KAFKA_BROKERS="127.0.0.1:9092"
PORT=${port}
AUTH_SERVICE_URL="http://localhost:3001"
IAM_SERVICE_URL="http://localhost:3002"
${extra}
EOF
  echo "  ✓ services/$service/.env (port $port)"
}

create_env auth        3001 ""
create_env iam         3002 ""
create_env form-builder 3003 ""
create_env submission  3004 ""
create_env patient     3006 ""
create_env audit       3008 ""
create_env integration 3009 ""
create_env tenant      3010 ""

# Frontend .env
cat > ~/healthcare-platform/apps/frontend/.env.local << EOF
NEXT_PUBLIC_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_IAM_URL=http://localhost:3002
NEXT_PUBLIC_FORMS_URL=http://localhost:3003
NEXT_PUBLIC_SUBMISSION_URL=http://localhost:3004
NEXT_PUBLIC_PATIENT_URL=http://localhost:3006
NEXT_PUBLIC_AUDIT_URL=http://localhost:3008
NEXT_PUBLIC_INTEGRATION_URL=http://localhost:3009
NEXT_PUBLIC_TENANT_URL=http://localhost:3010
EOF
echo "  ✓ apps/frontend/.env.local"
echo "✓ All .env files created"

# ── STEP 11: Install Node dependencies ───────────────────────────
echo "▶ Step 11: Installing Node dependencies..."
cd ~/healthcare-platform
pnpm install
echo "✓ Dependencies installed"

# ── STEP 12: Prisma generate + migrate ───────────────────────────
echo "▶ Step 12: Running Prisma migrations and generating clients..."
for service in auth iam tenant patient audit; do
  if [ -f "services/$service/prisma/schema.prisma" ]; then
    echo "  Migrating $service..."
    cd ~/healthcare-platform/services/$service
    DATABASE_URL="$DB_URL" npx prisma migrate deploy 2>/dev/null || \
    DATABASE_URL="$DB_URL" npx prisma db push --force-reset 2>/dev/null || true
    DATABASE_URL="$DB_URL" npx prisma generate
    cd ~/healthcare-platform
  fi
done
echo "✓ Prisma done"

# ── STEP 13: Start all services with PM2 ─────────────────────────
echo "▶ Step 13: Starting all services with PM2..."
pm2 delete all 2>/dev/null || true

services=(
  "auth:3001"
  "iam:3002"
  "form-builder:3003"
  "submission:3004"
  "patient:3006"
  "audit:3008"
  "integration:3009"
  "tenant:3010"
)

for entry in "${services[@]}"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  if [ -d "~/healthcare-platform/services/$name" ] || [ -d "$HOME/healthcare-platform/services/$name" ]; then
    pm2 start "pnpm run start:dev" \
      --name "$name" \
      --cwd "$HOME/healthcare-platform/services/$name"
    echo "  ✓ Started $name on port $port"
  fi
done

# ── STEP 14: Install and start frontend ──────────────────────────
echo "▶ Step 14: Starting Next.js frontend..."
if [ -f "$HOME/healthcare-platform/apps/frontend/package.json" ]; then
  cd ~/healthcare-platform/apps/frontend
  pnpm install
  pm2 start "pnpm run dev" \
    --name frontend \
    --cwd "$HOME/healthcare-platform/apps/frontend"
  echo "  ✓ Frontend started on port 3000"
else
  echo "  ⚠ Frontend package.json not found — skipping"
fi

# ── STEP 15: Wait and health check ───────────────────────────────
echo ""
echo "▶ Step 15: Waiting 90 seconds for all services to boot..."
sleep 90

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   HEALTH CHECK                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"

PASS=0
FAIL=0
for port in 3000 3001 3002 3003 3004 3006 3008 3009 3010; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:$port/api/docs" --max-time 8 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "  ✓ Port $port: HTTP $CODE"
    PASS=$((PASS+1))
  else
    # Try root path for frontend
    CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      "http://localhost:$port" --max-time 8 2>/dev/null)
    if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "301" ]; then
      echo "  ✓ Port $port: HTTP $CODE"
      PASS=$((PASS+1))
    else
      echo "  ✗ Port $port: HTTP $CODE (still booting?)"
      FAIL=$((FAIL+1))
    fi
  fi
done

pm2 status

# ── FINAL OUTPUT ─────────────────────────────────────────────────
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
  2>/dev/null || echo "YOUR_VM_IP")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   DEPLOYMENT COMPLETE — $PASS services up, $FAIL failed          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  VM IP: $EXTERNAL_IP"
echo ""
echo "  FRONTEND:    http://$EXTERNAL_IP:3000/login"
echo "  SUPER ADMIN: http://$EXTERNAL_IP:3000/super-admin/login"
echo ""
echo "  API DOCS:"
echo "    Auth:        http://$EXTERNAL_IP:3001/api/docs"
echo "    IAM:         http://$EXTERNAL_IP:3002/api/docs"
echo "    Forms:       http://$EXTERNAL_IP:3003/api/docs"
echo "    Submission:  http://$EXTERNAL_IP:3004/api/docs"
echo "    Patient:     http://$EXTERNAL_IP:3006/api/docs"
echo "    Audit:       http://$EXTERNAL_IP:3008/api/docs"
echo "    Integration: http://$EXTERNAL_IP:3009/api/docs"
echo "    Tenant:      http://$EXTERNAL_IP:3010/api/docs"
echo ""
echo "  DB UIs:"
echo "    Kafka UI:    http://$EXTERNAL_IP:8083"
echo "    Mongo:       http://$EXTERNAL_IP:8081  (admin/admin123)"
echo "    pgAdmin:     http://$EXTERNAL_IP:8082  (admin@healthcare.com/admin123)"
echo ""
echo "  TEST LOGINS:"
echo "    Super Admin: superadmin@platform.com / SuperAdmin@123"
echo "    Tenant Admin: admin@hospital.com / Admin@123"
echo ""
echo "  LOAD TEST:"
echo "    node seed-load-test.js    # seed 5 tenants + 300 users"
echo "    k6 run load-test.js       # run 3000 VU test"
echo ""
echo "  STOP VM (save cost):"
echo "    gcloud compute instances stop healthcare-loadtest --zone=asia-south1-b"
echo ""
