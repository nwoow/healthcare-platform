# Healthcare Platform — Live VM Reference
**VM IP:** 35.200.238.175  
**GitHub:** https://github.com/nwoow/healthcare-platform  
**Zone:** asia-south1-b (Mumbai)

---

## 🌐 Frontend URLs

| Page | URL |
|------|-----|
| **Login (Tenant Admin / Doctor / Nurse)** | http://35.200.238.175:3000/login |
| **Super Admin Login** | http://35.200.238.175:3000/super-admin/login |
| Admin Dashboard | http://35.200.238.175:3000/admin/dashboard |
| Form Builder | http://35.200.238.175:3000/admin/forms/builder |
| Submissions | http://35.200.238.175:3000/admin/forms/submissions |
| Patient Registry | http://35.200.238.175:3000/admin/patients |
| Integrations | http://35.200.238.175:3000/admin/integrations |
| Analytics | http://35.200.238.175:3000/admin/analytics |
| Clinician Dashboard | http://35.200.238.175:3000/clinician/dashboard |

---

## 🔑 Test Credentials

| Role | Email | Password | Login Page |
|------|-------|----------|------------|
| Super Admin | superadmin@platform.com | SuperAdmin@123 | /super-admin/login |
| Tenant Admin | admin@hospital.com | Admin@123 | /login |

---

## 📡 API Swagger Docs (All Live)

| Service | Port | Swagger URL |
|---------|------|-------------|
| Auth Service | 3001 | http://35.200.238.175:3001/api/docs |
| IAM Service | 3002 | http://35.200.238.175:3002/api/docs |
| Form Builder | 3003 | http://35.200.238.175:3003/api/docs |
| Submission Service | 3004 | http://35.200.238.175:3004/api/docs |
| Patient Service | 3006 | http://35.200.238.175:3006/api/docs |
| Audit Service | 3008 | http://35.200.238.175:3008/api/docs |
| Integration Service | 3009 | http://35.200.238.175:3009/api/docs |
| Tenant Service | 3010 | http://35.200.238.175:3010/api/docs |

---

## 🛢️ Database & Infrastructure UIs

| Tool | URL | Login |
|------|-----|-------|
| Kafka UI | http://35.200.238.175:8083 | No login |
| Mongo Express | http://35.200.238.175:8081 | admin / admin123 |
| pgAdmin | http://35.200.238.175:8082 | admin@healthcare.com / admin123 |

---

## 🔑 Key API Endpoints (Quick Test)

```bash
# Login
curl -X POST http://35.200.238.175:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"Admin@123"}'

# List tenants
curl http://35.200.238.175:3010/tenants

# List forms
curl http://35.200.238.175:3003/forms

# List submissions
curl http://35.200.238.175:3004/submissions
```

---

## 🖥️ VM Management

```bash
# SSH into VM
gcloud compute ssh healthcare-loadtest --zone=asia-south1-b

# Check all services status
pm2 status

# Check service logs
pm2 logs auth --lines 20
pm2 logs frontend --lines 20

# Restart a service
pm2 restart auth

# Restart all services
pm2 restart all

# Check Docker containers
sudo docker compose ps

# Stop VM (saves ~₹23/hour)
gcloud compute instances stop healthcare-loadtest --zone=asia-south1-b

# Start VM again
gcloud compute instances start healthcare-loadtest --zone=asia-south1-b

# After VM restart — services need to be restarted
gcloud compute ssh healthcare-loadtest --zone=asia-south1-b
cd ~/healthcare-platform
sudo docker compose up -d
sleep 40
pm2 restart all
```

---

## 🧪 Load Test Commands

```bash
# On the VM
cd ~/healthcare-platform

# Step 1: Seed test data (5 tenants, 300 users, 25 forms)
node seed-load-test.js

# Step 2: Run k6 load test (ramps to 3000 concurrent users)
k6 run --out json=results.json load-test.js

# Step 3: Download HTML report to your laptop
# Run this on LOCAL machine:
gcloud compute scp healthcare-loadtest:~/healthcare-platform/load-test-report.html . --zone=asia-south1-b
```

---

## 🚀 Deploy From Scratch on a New VM

### Step 1 — Create GCP VM

```bash
gcloud compute instances create healthcare-loadtest \
  --project=YOUR_PROJECT_ID \
  --zone=asia-south1-b \
  --machine-type=e2-standard-8 \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server

# Open firewall ports
gcloud compute firewall-rules create healthcare-ports \
  --allow=tcp:3000-3010,tcp:8081,tcp:8082,tcp:8083 \
  --target-tags=http-server
```

### Step 2 — SSH and Deploy

```bash
gcloud compute ssh healthcare-loadtest --zone=asia-south1-b

# Upload the deployment script
# (copy full-deploy.sh to the VM first)
bash full-deploy.sh
```

### What the deploy script does automatically:
1. Installs Docker, Node.js 20, pnpm, PM2, k6
2. Clones https://github.com/nwoow/healthcare-platform
3. Adds `mongo`, `kafka`, `redis` to `/etc/hosts` → resolves to 127.0.0.1
4. Starts all Docker containers (PostgreSQL on 5433, MongoDB, Redis, Kafka)
5. Creates `.env` files for all 8 services with correct ports
6. Runs `pnpm install` for all workspace packages
7. Runs Prisma migrations for auth, iam, tenant, patient, audit
8. Generates Prisma clients inside each service
9. Starts 8 NestJS services via PM2
10. Starts Next.js frontend via PM2
11. Health checks all ports and prints live URLs

**Total time: ~8-10 minutes**

---

## ⚠️ Known Issues & Fixes

| Issue | Fix |
|-------|-----|
| Services can't connect to MongoDB | `echo "127.0.0.1 mongo" \| sudo tee -a /etc/hosts` |
| Prisma client not initialized | `cd services/auth && DATABASE_URL="..." npx prisma generate` |
| Port already in use | Check PORT in each service .env file |
| PM2 not picking up new .env | `pm2 delete SERVICE && pm2 start ... --cwd PATH` |
| Frontend not starting | Must point `--cwd` to `apps/frontend` not repo root |
| docker compose not found | `sudo apt-get install docker-compose-plugin` |
| k6 gpg error | Download binary directly from GitHub releases |

---

## 📊 Architecture Summary

```
PostgreSQL (port 5433) ← Auth, IAM, Tenant, Patient, Audit
MongoDB    (port 27017) ← Forms, Submissions, Integration, Patient histories
Redis      (port 6379)  ← IAM permission cache (60s TTL)
Kafka      (port 9092)  ← 9 topics, all partitioned by tenant_id

Services:
  3000 Frontend (Next.js 15 + MUI)
  3001 Auth     (JWT, bcrypt, refresh tokens)
  3002 IAM      (RBAC + ABAC, CASL, Redis cache)
  3003 Forms    (MongoDB schemas, versioning)
  3004 Submission (fills, approvals, audit trail)
  3006 Patient  (registry, ABHA, FHIR R4, consent)
  3008 Audit    (append-only Kafka consumer)
  3009 Integration (webhooks, retry, delivery logs)
  3010 Tenant   (hospital onboarding, ABDM config)
```

---

*Healthcare Platform · github.com/nwoow/healthcare-platform*
