#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Healthcare Platform — GCP VM Setup Script
# Run this on your LOCAL machine (not the VM)
# Prerequisites: gcloud CLI installed and authenticated
# ═══════════════════════════════════════════════════════════════

set -e

# ── CONFIG — change these if needed ─────────────────────────────
PROJECT_ID="$(gcloud config get-value project)"
VM_NAME="healthcare-loadtest"
ZONE="asia-south1-a"          # Mumbai — closest to India
MACHINE_TYPE="e2-standard-8"  # 8 vCPU, 32GB RAM — enough for full stack + 3000 VU test
DISK_SIZE="50GB"
GITHUB_REPO="https://github.com/nwoow/healthcare-platform.git"
# ────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Healthcare Platform — GCP VM Deployment               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Project:  $PROJECT_ID"
echo "VM Name:  $VM_NAME"
echo "Zone:     $ZONE"
echo "Machine:  $MACHINE_TYPE (8 vCPU, 32GB RAM)"
echo ""

# ── STEP 1: Create the VM ────────────────────────────────────────
echo "▶ Step 1: Creating GCP VM..."
gcloud compute instances create $VM_NAME \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --boot-disk-size=$DISK_SIZE \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=true

echo "✓ VM created"

# ── STEP 2: Open firewall ports ──────────────────────────────────
echo ""
echo "▶ Step 2: Opening firewall ports..."
gcloud compute firewall-rules create healthcare-ports \
  --project=$PROJECT_ID \
  --allow=tcp:3000-3010,tcp:8081,tcp:8082,tcp:8083 \
  --target-tags=http-server \
  --description="Healthcare platform service ports" \
  2>/dev/null || echo "  (firewall rule already exists, skipping)"

echo "✓ Ports opened: 3000-3010, 8081, 8082, 8083"

# ── STEP 3: Wait for VM to be ready ─────────────────────────────
echo ""
echo "▶ Step 3: Waiting for VM to be ready..."
sleep 20

# ── STEP 4: Install everything on the VM ────────────────────────
echo ""
echo "▶ Step 4: Installing Docker, Node.js, pnpm, k6 on VM..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
set -e
echo '--- Installing system packages ---'
sudo apt-get update -qq
sudo apt-get install -y git curl wget unzip htop

echo '--- Installing Docker ---'
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker \$USER
sudo systemctl enable docker
sudo systemctl start docker

echo '--- Installing Docker Compose plugin ---'
sudo apt-get install -y docker-compose-plugin
docker compose version

echo '--- Installing Node.js 20 ---'
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version

echo '--- Installing pnpm ---'
sudo npm install -g pnpm
pnpm --version

echo '--- Installing k6 ---'
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update -qq
sudo apt-get install -y k6
k6 version

echo '--- All tools installed successfully ---'
"

echo "✓ All tools installed"

# ── STEP 5: Clone the repo ───────────────────────────────────────
echo ""
echo "▶ Step 5: Cloning healthcare-platform repository..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
cd ~
if [ -d healthcare-platform ]; then
  echo 'Repo already exists, pulling latest...'
  cd healthcare-platform && git pull
else
  git clone $GITHUB_REPO
fi
echo 'Repo ready'
ls ~/healthcare-platform/
"

echo "✓ Repository cloned"

# ── STEP 6: Create production .env files ────────────────────────
echo ""
echo "▶ Step 6: Creating .env files for all services..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
cd ~/healthcare-platform

# Auth service
cat > services/auth/.env << 'EOF'
DATABASE_URL=\"postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform\"
JWT_SECRET=\"healthcare-jwt-secret-production-2026\"
JWT_EXPIRY=\"15m\"
REFRESH_TOKEN_EXPIRY=\"7d\"
PORT=3001
KAFKA_BROKERS=\"localhost:9092\"
EOF

# IAM service
cat > services/iam/.env << 'EOF'
DATABASE_URL=\"postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform\"
REDIS_URL=\"redis://localhost:6379\"
PORT=3002
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Form builder service
cat > services/form-builder/.env << 'EOF'
MONGODB_URI=\"mongodb://localhost:27017/healthcare_forms?replicaSet=rs0\"
PORT=3003
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Submission service
cat > services/submission/.env << 'EOF'
MONGODB_URI=\"mongodb://localhost:27017/healthcare_submissions?replicaSet=rs0\"
PORT=3004
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Patient service
cat > services/patient/.env << 'EOF'
DATABASE_URL=\"postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform\"
MONGODB_URI=\"mongodb://localhost:27017/healthcare_patients?replicaSet=rs0\"
PORT=3006
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Audit service
cat > services/audit/.env << 'EOF'
DATABASE_URL=\"postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform\"
PORT=3008
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Integration service
cat > services/integration/.env << 'EOF'
MONGODB_URI=\"mongodb://localhost:27017/healthcare_integrations?replicaSet=rs0\"
PORT=3009
KAFKA_BROKERS=\"localhost:9092\"
EOF

# Tenant service
cat > services/tenant/.env << 'EOF'
DATABASE_URL=\"postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform\"
PORT=3010
KAFKA_BROKERS=\"localhost:9092\"
AUTH_SERVICE_URL=\"http://localhost:3001\"
IAM_SERVICE_URL=\"http://localhost:3002\"
EOF

echo 'All .env files created'
"

echo "✓ Environment files created"

# ── STEP 7: Start Docker Compose ────────────────────────────────
echo ""
echo "▶ Step 7: Starting Docker Compose (databases + Kafka)..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
cd ~/healthcare-platform

# Update docker-compose to use correct port mapping for the VM
# PostgreSQL on 5433 externally, 5432 internally
sudo docker compose up -d postgres mongo mongo-init redis zookeeper kafka kafka-ui

echo 'Waiting 45 seconds for Kafka and MongoDB to be ready...'
sleep 45

echo 'Adding Mongo Express and pgAdmin...'
sudo docker compose up -d mongo-express pgadmin 2>/dev/null || true

echo 'Container status:'
sudo docker compose ps
"

echo "✓ Docker Compose started"

# ── STEP 8: Install dependencies for all services ───────────────
echo ""
echo "▶ Step 8: Installing Node dependencies for all services..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
cd ~/healthcare-platform

echo 'Installing root dependencies...'
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo 'Installing per-service dependencies...'
for service in auth iam form-builder submission patient audit integration tenant; do
  if [ -d \"services/\$service/package.json\" ] || [ -f \"services/\$service/package.json\" ]; then
    echo \"  Installing \$service...\"
    cd ~/healthcare-platform/services/\$service
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    cd ~/healthcare-platform
  fi
done

echo 'All dependencies installed'
"

echo "✓ Dependencies installed"

# ── STEP 9: Run Prisma migrations ───────────────────────────────
echo ""
echo "▶ Step 9: Running Prisma migrations..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
echo 'Waiting for PostgreSQL to be ready...'
sleep 10

for service in auth iam tenant patient audit; do
  svcdir=\"\$HOME/healthcare-platform/services/\$service\"
  if [ -f \"\$svcdir/prisma/schema.prisma\" ]; then
    echo \"  Running migration for \$service...\"
    cd \$svcdir
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --force-reset 2>/dev/null || echo \"  Warning: migration for \$service had issues\"
    npx prisma generate 2>/dev/null || true
    cd ~
  fi
done

echo 'Migrations complete'
"

echo "✓ Prisma migrations done"

# ── STEP 10: Start all NestJS services ──────────────────────────
echo ""
echo "▶ Step 10: Starting all NestJS services with PM2..."

gcloud compute ssh $VM_NAME --zone=$ZONE --command="
sudo npm install -g pm2

cd ~/healthcare-platform

# Start each service with PM2
for service in auth iam form-builder submission patient audit integration tenant; do
  svcdir=\"\$HOME/healthcare-platform/services/\$service\"
  if [ -f \"\$svcdir/package.json\" ]; then
    echo \"  Starting \$service...\"
    cd \$svcdir
    pm2 start 'pnpm run start:prod' --name \$service 2>/dev/null || \
    pm2 start 'pnpm run start' --name \$service 2>/dev/null || \
    pm2 start 'node dist/main.js' --name \$service 2>/dev/null || \
    pm2 start 'pnpm run start:dev' --name \$service --name \$service
    cd ~/healthcare-platform
  fi
done

echo 'Waiting 30 seconds for services to boot...'
sleep 30

pm2 status
"

echo "✓ All services started"

# ── STEP 11: Copy load test scripts to VM ───────────────────────
echo ""
echo "▶ Step 11: Copying load test scripts to VM..."

EXTERNAL_IP=$(gcloud compute instances describe $VM_NAME \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

gcloud compute scp seed-load-test.js $VM_NAME:~/healthcare-platform/ --zone=$ZONE 2>/dev/null || true
gcloud compute scp load-test.js $VM_NAME:~/healthcare-platform/ --zone=$ZONE 2>/dev/null || true
gcloud compute scp parse-results.js $VM_NAME:~/healthcare-platform/ --zone=$ZONE 2>/dev/null || true

# ── FINAL OUTPUT ─────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   DEPLOYMENT COMPLETE                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "VM External IP: $EXTERNAL_IP"
echo ""
echo "SERVICE URLs:"
echo "  Frontend:      http://$EXTERNAL_IP:3000"
echo "  Auth API:      http://$EXTERNAL_IP:3001/api/docs"
echo "  IAM API:       http://$EXTERNAL_IP:3002/api/docs"
echo "  Form Builder:  http://$EXTERNAL_IP:3003/api/docs"
echo "  Submission:    http://$EXTERNAL_IP:3004/api/docs"
echo "  Tenant:        http://$EXTERNAL_IP:3010/api/docs"
echo "  Kafka UI:      http://$EXTERNAL_IP:8083"
echo "  Mongo Express: http://$EXTERNAL_IP:8081  (admin/admin123)"
echo "  pgAdmin:       http://$EXTERNAL_IP:8082  (admin@healthcare.com/admin123)"
echo ""
echo "SSH INTO VM:"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE"
echo ""
echo "NEXT STEPS:"
echo "  1. SSH into the VM"
echo "  2. cd ~/healthcare-platform"
echo "  3. node seed-load-test.js      # seed 5 tenants + 300 users"
echo "  4. k6 run load-test.js         # run 3000 VU test"
echo "  5. node parse-results.js       # generate report"
echo ""
echo "ESTIMATED COST: ~\$0.50-1.00/hour for e2-standard-8"
echo "Remember to stop the VM after testing:"
echo "  gcloud compute instances stop $VM_NAME --zone=$ZONE"
