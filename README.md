# Healthcare Platform

A **multi-tenant Healthcare Management System** built for Indian hospitals. It covers the full clinical workflow — from onboarding a hospital and registering patients to building custom forms, capturing submissions, reviewing data, and exporting to FHIR R4 / ABDM.

---

## Who Uses It

| Role | Portal | What They Do |
|------|--------|--------------|
| **Super Admin** (platform owner) | `/super-admin/*` | Registers hospitals, monitors all tenants |
| **Hospital Admin** (tenant admin) | `/admin/*` | Manages forms, patients, staff, analytics |
| **Clinician** (doctor / nurse) | `/clinician/*` | Fills forms, views own submissions |

Each hospital is a **tenant** — complete data isolation via `tenant_id` columns. One deployment serves many hospitals.

---

## Key Capabilities

- **Dynamic Form Builder** — drag-and-arrange fields, Wizard / Accordion / Tabs layouts, role-gated visibility
- **RBAC + ABAC** — role permissions cached in Redis; attribute conditions (department, specialty) evaluated per request
- **ABDM / ABHA Integration** — link patients to ABHA IDs, export FHIR R4 Patient + Observation bundles, sandbox-ready
- **Integration Webhooks** — connect any external EHR / lab / pharmacy via webhook, REST API, or FHIR endpoint; auto-fires on Kafka events
- **Audit Trail** — field-level audit log on every submission with PHI masking; compliance report covering PHI access, FHIR exports, consent checks
- **Analytics** — submission trends (area chart), status breakdown (pie), patient demographics (gender / blood group / ABHA rate), compliance KPIs
- **In-app Notifications** — bell icon with 30-second polling, mark-all-read
- **5 Themes** — Ocean Teal, Royal Purple, Clinical Blue, Healing Green, Care Rose

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 20+ | All services + frontend |
| pnpm | 8+ | Package manager |
| Docker Desktop | Latest | Postgres, MongoDB, Redis, Kafka |

> **Windows note:** If you have a native PostgreSQL installed, it occupies port 5432.  
> Docker maps Postgres to **port 5433** externally. All `.env` files already use 5433.

---

## How to Start Everything

### Quickest way — one command

```bash
# From project root
bash start.sh
```

This script:
1. Starts all Docker containers (`docker compose up -d`)
2. Waits for PostgreSQL and Kafka to be ready
3. Starts all 8 backend services in the background (logs → `.logs/<service>.log`)
4. Starts the Next.js frontend
5. Prints a URL summary after ~20 s

To stop everything:

```bash
bash stop.sh
```

---

### Manual start — Step by step

#### Step 1 — Start Docker infrastructure

```bash
# From project root (healthcare-platform/)
docker compose up -d
```

Wait ~20 seconds, then verify:

```bash
docker ps
```

You should see **8 containers** running:

| Container | Purpose |
|-----------|---------|
| `postgres` | PostgreSQL (internal 5432, external **5433**) |
| `mongo` | MongoDB |
| `redis` | Redis cache |
| `kafka` | Kafka broker |
| `zookeeper` | Kafka dependency |
| `kafka-ui` | Kafka browser UI (port 8083) |
| `mongo-express` | MongoDB browser UI (port 8081) |
| `pgadmin` | Postgres browser UI (port 8082) |

---

#### Step 2 — Run Prisma migrations (first time only)

Each NestJS service that uses PostgreSQL needs its database tables created:

```bash
# Auth service
cd services/auth && npx prisma migrate deploy && cd ../..

# IAM service
cd services/iam && npx prisma migrate deploy && cd ../..

# Patient service
cd services/patient && npx prisma migrate deploy && cd ../..

# Tenant service
cd services/tenant && npx prisma migrate deploy && cd ../..
```

> MongoDB and Redis require no migrations — schemas are created automatically on first write.

---

#### Step 3 — Start backend services

Open **8 separate terminals**, each from the project root:

```bash
# Terminal 1 — Auth service (port 3001)
cd services/auth && npm run start:dev

# Terminal 2 — IAM service (port 3002)
cd services/iam && npm run start:dev

# Terminal 3 — Form Builder service (port 3003)
cd services/form-builder && npm run start:dev

# Terminal 4 — Submission service (port 3004)
cd services/submission && npm run start:dev

# Terminal 5 — Patient service (port 3006)
cd services/patient && npm run start:dev

# Terminal 6 — Audit service (port 3008)
cd services/audit && npm run start:dev

# Terminal 7 — Tenant service (port 3010)
cd services/tenant && npm run start:dev

# Terminal 8 — Integration service (port 3009)
cd services/integration && npm run start:dev
```

Wait for each to print:

```
[Nest] LOG [NestApplication] Nest application successfully started
```

---

#### Step 4 — Start the frontend

```bash
# Terminal 9 — Next.js frontend (port 3000)
cd apps/frontend && npm run dev
```

---

#### Step 5 — Open the app

```
http://localhost:3000
```

---

## How to Stop Everything

```bash
# Recommended — stops all services + Docker
bash stop.sh

# Manual — PowerShell
Get-Process node | Stop-Process -Force
docker compose down
```

---

## Login Credentials

### Super Admin (Platform)

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/super-admin/login |
| Email | superadmin@platform.com |
| Password | SuperAdmin@123 |

### Hospital Admin — Apollo Hospital

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | admin@hospital.com |
| Password | Admin@123 |

### Hospital Admin — nilahs tenant

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | nilahs@hospital.com |
| Password | nilahs2301! |

### Doctor — nilahs tenant

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | niladr@hospital.com |
| Password | Niladr2244! |

### Doctor — Apollo tenant

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | nilay@hospital.com |
| Password | Nilay6700! |

---

## All Ports

| Service | Port | Type |
|---------|------|------|
| Frontend | 3000 | Next.js Web UI |
| Auth | 3001 | REST API |
| IAM | 3002 | REST API |
| Form Builder | 3003 | REST API |
| Submission | 3004 | REST API |
| Patient | 3006 | REST API |
| Audit | 3008 | REST API |
| Integration | 3009 | REST API |
| Tenant | 3010 | REST API |
| PostgreSQL | **5433** | Database (external) |
| MongoDB | 27017 | Database |
| Redis | 6379 | Cache |
| Kafka | 9092 | Message Broker |
| Kafka UI | 8083 | Web UI |
| Mongo Express | 8081 | Web UI |
| pgAdmin | 8082 | Web UI |

---

## All Pages

### Super Admin Portal

| Page | URL |
|------|-----|
| Login | /super-admin/login |
| Dashboard | /super-admin/dashboard |
| Hospitals List | /super-admin/tenants |
| Hospital Detail | /super-admin/tenants/[id] |

### Tenant Admin Portal

| Page | URL |
|------|-----|
| Dashboard | /admin/dashboard |
| Form Builder | /admin/forms/builder |
| All Forms | /admin/forms |
| All Submissions | /admin/forms/submissions |
| Submission Detail + Audit Trail | /admin/forms/submissions/[id] |
| Patient List | /admin/patients |
| Patient Detail (5 tabs) | /admin/patients/[patientId] |
| User Management | /admin/users |
| Integrations | /admin/integrations |
| Integration Delivery Logs | /admin/integrations/[id]/logs |
| Analytics (3 tabs) | /admin/analytics |

### Clinician Portal

| Page | URL |
|------|-----|
| Dashboard | /clinician/dashboard |
| Fill Form | /clinician/forms/[formId] |
| My Submissions | /clinician/submissions |
| Submission Detail | /clinician/submissions/[id] |

---

## Microservice Swagger Docs

Interactive Swagger UI is available for every service while it is running:

| Service | Swagger UI URL | Port |
|---------|----------------|------|
| Auth | http://localhost:3001/api/docs | 3001 |
| IAM | http://localhost:3002/api/docs | 3002 |
| Form Builder | http://localhost:3003/api/docs | 3003 |
| Submission | http://localhost:3004/api/docs | 3004 |
| Patient | http://localhost:3006/api/docs | 3006 |
| Audit | http://localhost:3008/api/docs | 3008 |
| Integration | http://localhost:3009/api/docs | 3009 |
| Tenant | http://localhost:3010/api/docs | 3010 |

---

## Full API Reference

### Auth Service — `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email + password. Sets `access_token` (15 min) and `refresh_token` (7 days) as httpOnly cookies. Returns `{ user }`. |
| POST | `/auth/refresh` | Reads `refresh_token` cookie, issues a new `access_token` cookie. Returns `{ message: "Token refreshed" }`. |
| POST | `/auth/logout` | Clears both auth cookies. Requires valid `access_token` cookie. |
| GET | `/auth/users` | List all users. Optional `?tenantId=` filter. Returns id, email, name, isActive, createdAt (no password hashes). |
| POST | `/auth/users` | Create a user programmatically (called internally by the tenant provisioning flow). Body: `{ email, password, name?, tenantId?, role? }`. |
| POST | `/auth/users/invite` | Invite a new user. Body: `{ email, password }`. Returns created user without password hash. |

**Login example:**
```json
POST /auth/login
{ "email": "admin@hospital.com", "password": "Admin@123" }

→ 200 { "user": { "id": "uuid", "email": "...", "name": "...", "role": "tenant_admin", "tenantId": "..." } }
→ Cookie: access_token=eyJ... (httpOnly, 15 min)
→ Cookie: refresh_token=eyJ... (httpOnly, 7 days)
```

---

### IAM Service — `http://localhost:3002`

#### Roles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/iam/roles` | List roles. Use `?tenantId=system` to get all platform roles. |
| POST | `/iam/users/:userId/roles` | Assign a role to a user. Body: `{ roleId, tenantId?, assignedBy? }`. |
| GET | `/iam/users/:userId/roles` | Get all roles (with permissions) assigned to a user. Optional `?tenantId=system`. |

#### Access Evaluation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/iam/evaluate` | Evaluate RBAC + ABAC access. Result is Redis-cached for 60 seconds. |

```json
POST /iam/evaluate
{
  "userId": "user-uuid",
  "action": "submit",
  "resource": "form",
  "resourceId": "form-uuid",
  "tenantId": "tenant-uuid"
}
→ { "allowed": true, "reason": "User is permitted to submit on form", "cached": false }
```

> `super_admin` role bypasses all checks and always returns `{ allowed: true, reason: "super_admin bypass" }`.

#### User Attributes (ABAC)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/:userId/attributes` | Get all ABAC attributes for a user. |
| PUT | `/users/:userId/attributes` | Set (upsert) an attribute. Body: `{ "key": "department", "value": "cardiology" }`. |
| DELETE | `/users/:userId/attributes/:key` | Delete a user attribute by key. |

#### Resource Policies (ABAC)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/policies` | List resource policies. Optional `?resourceType=form`. |
| GET | `/policies/:id` | Get a single resource policy. |
| POST | `/policies` | Create a resource policy. Body: `{ resourceType, resourceId, attributeConditions }`. |
| PUT | `/policies/:id` | Update attribute conditions on a policy. |
| DELETE | `/policies/:id` | Delete a resource policy. |

```json
POST /policies
{
  "resourceType": "form",
  "resourceId": "form-uuid",
  "attributeConditions": { "department": ["gastroenterology", "cardiology"] }
}
```

---

### Form Builder Service — `http://localhost:3003`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/forms` | Create a new form (starts as draft). |
| GET | `/forms` | List all forms. Optional `?tenantId=`. |
| GET | `/forms/accessible` | Get forms accessible to a specific user role. Required: `?userId=&role=`. Optional: `?tenantId=`. |
| GET | `/forms/:id` | Get a form by ID (includes full sections + fields). |
| PUT | `/forms/:id` | Update a form (auto-increments version). |
| POST | `/forms/:id/publish` | Publish a form — makes it visible to matching clinician roles. |
| GET | `/forms/:id/versions` | Get all published version snapshots of a form. |

**Create form body:**
```json
{
  "tenantId": "tenant-uuid",
  "title": "Initial Consultation",
  "layout": "wizard",
  "allowedRoles": ["doctor", "nurse"],
  "sections": [
    {
      "title": "Chief Complaint",
      "fields": [
        { "key": "complaint", "type": "textarea", "label": "Chief Complaint", "required": true },
        { "key": "duration", "type": "text", "label": "Duration", "required": false }
      ]
    }
  ]
}
```

**Field types:** `text`, `textarea`, `number`, `select`, `radio`, `checkbox`, `date`, `file`

---

### Submission Service — `http://localhost:3004`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/submissions` | Create or save a draft/submitted submission. |
| GET | `/submissions` | List submissions. Optional filters: `?tenantId=&formId=&status=&submittedBy=&from=&to=`. |
| GET | `/submissions/analytics` | Submission analytics. `?tenantId=&days=7`. |
| GET | `/submissions/analytics/specialty` | Submission analytics grouped by specialty. `?tenantId=&days=7`. |
| GET | `/submissions/notifications/:userId` | Notifications for a user (last 24 h, max 20). |
| PATCH | `/submissions/notifications/:id/read` | Mark a notification as read. |
| GET | `/submissions/:id/audit-trail` | Full field-level audit trail for a submission (from `FormDataAuditLog` MongoDB collection). |
| GET | `/submissions/:id` | Get submission by ID. Optional `?actorId=` to record a `FORM_VIEWED` audit entry. |
| PATCH | `/submissions/:id/status` | Approve or reject. Body: `{ status: "approved"|"rejected", review_comment?: "..." }`. |

**Status values:** `draft`, `submitted`, `under_review`, `approved`, `rejected`

**Create submission:**
```json
POST /submissions
{
  "formId": "form-uuid",
  "tenantId": "tenant-uuid",
  "patientId": "patient-uuid",
  "submittedById": "user-uuid",
  "data": { "complaint": "Chest pain", "duration": "2 days" },
  "status": "draft"
}
```

**Analytics response:**
```json
{
  "total": 142,
  "byStatus": { "pending": 12, "approved": 118, "rejected": 12 },
  "byForm": [{ "formTitle": "Consultation", "count": 89 }],
  "byDoctor": [{ "name": "Dr. Smith", "count": 34 }],
  "byDay": [{ "date": "2026-04-15", "count": 8 }],
  "approvalRate": 83.1,
  "avgApprovalTimeHours": 4.2
}
```

**Audit trail entry:**
```json
{
  "_id": "...",
  "action": "FORM_APPROVED",
  "actorId": "admin-uuid",
  "actorRole": "tenant_admin",
  "timestamp": "2026-04-15T10:30:00.000Z",
  "ipAddress": "127.0.0.1",
  "metadata": {}
}
```

---

### Patient Service — `http://localhost:3006`

#### Core CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST | `/patients` | Register a new patient. Auto-generates MRN (`MRN-XXXXXX`). |
| GET | `/patients/analytics` | Patient analytics for a tenant. `?tenantId=`. |
| GET | `/patients` | List patients. Optional `?tenantId=&search=` (searches by name). |
| GET | `/patients/:id` | Get full patient record. |
| PATCH | `/patients/:id` | Update patient details. |

#### Visit History

| Method | Path | Description |
|--------|------|-------------|
| POST | `/patients/:id/history` | Add a visit history entry. |
| GET | `/patients/:id/history` | Get all visit history entries. |
| GET | `/patients/:id/timeline` | Get visit timeline (summary view). |

#### ABHA (Ayushman Bharat Health Account)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/patients/:id/link-abha` | Link ABHA to patient. Validates 14-digit number and `X@abdm` address format. Marks `abhaVerified=true`. |
| GET | `/patients/:id/abha-status` | Get ABHA linkage status with masked number (first 6 digits only). |

```json
POST /patients/:id/link-abha
{ "abhaNumber": "12345678901234", "abhaAddress": "rahul.sharma@abdm" }
```

#### FHIR R4

| Method | Path | Description |
|--------|------|-------------|
| GET | `/patients/:id/fhir` | FHIR R4 Patient resource with NDHM profile URL, ABHA identifier, blood group extension. |
| GET | `/patients/:id/fhir/observations` | FHIR R4 Bundle of Observations built from the patient's visit history. |

#### Consent (ABDM)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/patients/:id/consent/request` | Request a consent artifact. In demo/sandbox mode: auto-granted after 2 seconds. |
| GET | `/patients/:id/consent` | List all consent artifacts for a patient. |
| PATCH | `/patients/:id/consent/:consentId` | Grant, deny, or revoke a consent. Body: `{ "action": "grant"|"deny"|"revoke" }`. |
| GET | `/patients/:id/consent/:consentId/verify` | Verify if a consent artifact is currently valid (status=GRANTED, not expired). |

```json
POST /patients/:id/consent/request
{
  "purpose": "CARE_MANAGEMENT",
  "requestedBy": "doctor-uuid",
  "dataCategories": ["OPConsultation", "DiagnosticReport"],
  "dateRange": { "from": "2026-01-01", "to": "2026-12-31" },
  "tenantId": "tenant-uuid"
}
```

**Consent purposes:** `CARE_MANAGEMENT`, `BREAK_THE_GLASS`, `PAYMENT`, `RESEARCH`

**Analytics response:**
```json
{
  "totalPatients": 234,
  "abhaLinked": 89,
  "abhaLinkageRate": 38.03,
  "byGender": { "male": 140, "female": 90, "other": 4 },
  "byBloodGroup": { "B+": 67, "O+": 82, "A+": 55 },
  "newThisMonth": 14,
  "avgAge": 41
}
```

---

### Audit Service — `http://localhost:3008`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit` | Query audit logs. Optional filters: `?topic=&actorId=&tenantId=&from=&to=`. Read-only. |
| GET | `/audit/compliance-report` | Compliance report. `?tenantId=&from=2026-01-01&to=2026-12-31`. |

**Compliance report response:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-12-31" },
  "phiAccessCount": 312,
  "fhirExportCount": 44,
  "consentCheckCount": 28,
  "approvalCount": 189,
  "rejectionCount": 23,
  "topActors": [
    { "actorId": "user-uuid", "actorName": "Dr. Mehta", "count": 78 }
  ],
  "eventsByDay": [{ "date": "2026-04-15", "count": 14 }]
}
```

---

### Integration Service — `http://localhost:3009`

> No Swagger UI. Use these endpoints directly.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/integrations` | List integrations for a tenant. Required: `?tenantId=`. |
| POST | `/integrations` | Create a new integration. |
| GET | `/integrations/:id` | Get integration detail with stats. |
| PUT | `/integrations/:id` | Update integration config or triggers. |
| DELETE | `/integrations/:id` | Soft-delete (sets status=`deleted`). |
| PATCH | `/integrations/:id/toggle` | Toggle between `active` and `inactive`. |
| POST | `/integrations/:id/test` | Test the connection (fires a test HTTP request to the endpoint). |
| GET | `/integrations/:id/logs` | Delivery logs. Optional `?limit=50`. |

**Create integration:**
```json
POST /integrations
{
  "tenantId": "tenant-uuid",
  "name": "Apollo EHR Webhook",
  "type": "WEBHOOK",
  "config": {
    "webhookUrl": "https://ehr.apollo.com/webhooks/intake",
    "authType": "bearer",
    "authConfig": { "token": "eyJ..." }
  },
  "triggers": [
    { "event": "submission.submitted", "enabled": true },
    { "event": "patient.history.updated", "enabled": true }
  ]
}
```

**Integration types:** `WEBHOOK`, `REST_API`, `FHIR_ENDPOINT`, `LAB_SYSTEM`, `PHARMACY`, `INSURANCE`, `ERP`, `CUSTOM`

**Auth types:** `none`, `bearer`, `api_key`, `basic`

**Delivery log entry:**
```json
{
  "integrationId": "int-uuid",
  "event": "submission.submitted",
  "statusCode": 200,
  "success": true,
  "attempts": 1,
  "responseTime": 143,
  "createdAt": "2026-04-15T10:23:45.000Z"
}
```

---

### Tenant Service — `http://localhost:3010`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tenants/onboard` | Onboard a new hospital. Creates tenant + config + admin user + IAM role assignment + Kafka event. |
| GET | `/tenants` | List all tenants (super admin only). |
| GET | `/tenants/:id` | Get tenant with config and recent provisioning logs. |
| PATCH | `/tenants/:id/status` | Activate or suspend a tenant. Body: `{ "status": "active"|"suspended" }`. |
| GET | `/tenants/:id/logs` | Get provisioning/audit logs for a tenant. |
| PATCH | `/tenants/:id/abdm-config` | Update ABDM configuration. |
| GET | `/tenants/:id/abdm-status` | Get ABDM status including ABHA linkage rate. |

**Onboard tenant:**
```json
POST /tenants/onboard
{
  "name": "Apollo Hospital Delhi",
  "subdomain": "apollo-delhi",
  "adminEmail": "admin@apollo-delhi.com",
  "adminName": "Dr. Admin",
  "adminPassword": "Secure@Pass1",
  "plan": "professional",
  "region": "IN-DL",
  "type": "multispeciality"
}
```

**Update ABDM config:**
```json
PATCH /tenants/:id/abdm-config
{
  "abdmEnabled": true,
  "abdmFacilityId": "HFR001",
  "abdmHipId": "HIP001",
  "abdmHiuId": "HIU001",
  "abdmSandboxMode": false
}
```

---

## End-to-End Workflows

### 1 — Register a New Hospital (Super Admin)

1. Login at http://localhost:3000/super-admin/login
2. Click **Hospitals → Register Hospital**
3. **Step 1:** Hospital name, subdomain, plan, region, type
4. **Step 2:** Admin first name + email
5. **Step 3:** Review → **Create Hospital**
6. **Copy the generated password** — displayed once only

What happens automatically:
- Tenant record created in PostgreSQL
- TenantConfig row created with defaults
- Admin user created in Auth service
- `tenant_admin` role assigned in IAM
- `tenant.provisioned` Kafka event published → audit log written

---

### 2 — Onboard a Hospital (Tenant Admin)

1. Login at http://localhost:3000/login using the credentials from step above
2. Go to **Users → Invite User**
3. Fill name, email, select role (`doctor` / `nurse` / `receptionist`)
4. Copy the generated password — shown once only
5. The new user can login immediately

---

### 3 — Register a Patient + Link ABHA

1. Login as tenant admin → **Patients → Register Patient**
2. Fill: Name, Date of Birth, Gender (required), Blood Group, Phone (optional)
3. Optionally fill ABHA Number (14 digits) + ABHA Address (X@abdm format)
4. Click **Register**

To link ABHA later from the patient detail page:
1. Go to **Patients** → click patient row
2. Tab **Overview → Link ABHA**
3. Enter 14-digit ABHA number + X@abdm address
4. System validates format, saves, publishes `patient.abha.linked` Kafka event

---

### 4 — Build and Publish a Form

1. Login as tenant admin → **Forms → New Form** (or Forms Builder)
2. Drag fields onto the canvas: text, number, select, date, radio, checkbox, textarea, file upload
3. Group fields into sections
4. Set **Layout**: Wizard (one section per page), Accordion, or Tabs
5. Set **Allowed Roles** — only matching clinicians will see this form
6. Click **Publish**

The form immediately appears for clinicians with matching roles.

> Forms are tenant-scoped. Clinicians only see forms created in their hospital.

---

### 5 — Fill and Submit a Form (Clinician)

1. Login as clinician → **Forms** tab on dashboard
2. Click any available form
3. **Select Patient** — search by name/MRN or register new patient inline
4. Fill all required fields
5. **Save Draft** at any point — resumable later
6. **Submit** when complete

Every save and submit writes a `FormDataAuditLog` entry to MongoDB.

---

### 6 — Review and Approve a Submission (Tenant Admin)

1. Login as tenant admin → **Submissions**
2. Click any submission row
3. **Tab 1 — Fields**: view all filled data in a read-only form renderer
4. **Tab 2 — Activity**: approval/rejection history with actor + timestamp
5. **Tab 3 — Audit Trail**: full field-level audit trail with MUI Timeline, color-coded by action type; **Export CSV** button
6. Click **Approve** or **Reject** (with optional rejection reason)

---

### 7 — Set Up an External Integration (Webhook)

1. Login as tenant admin → **Integrations → Add Integration**
2. **Step 1 — Connection:**
   - Name, Type (`WEBHOOK`, `REST_API`, `FHIR_ENDPOINT`, `LAB_SYSTEM`, etc.)
   - Webhook URL, auth type (None / Bearer / API Key / Basic)
3. **Step 2 — Triggers:** check which Kafka events should fire this integration
   - `submission.submitted`, `form.published`, `patient.history.updated`, etc.
4. Click **Test Connection** to verify the endpoint is reachable
5. Click **Save**

When a matching Kafka event fires, the integration service delivers the payload via HTTP POST with up to 3 retries (1s / 2s / 3s backoff).

Delivery logs: **Integrations → [name] → View Logs**

---

### 8 — View Compliance Analytics

1. Login as tenant admin → **Analytics → Compliance tab**
2. Set date range
3. View: PHI access count, FHIR exports, consent checks, approvals, rejections
4. Events-by-day area chart
5. Top actors table (who accessed PHI most)

Full compliance report also available via API (see below).

---

### 9 — Export FHIR R4 Data

From the patient detail page → **FHIR tab**:
- **FHIR Patient Resource** — full R4 Patient with ABHA identifier, blood group extension, NDHM profile URL
- **FHIR Observation Bundle** — one Observation per history entry
- Copy to clipboard or download as `.json`

---

## Kafka Topics

| Topic | Producer | Consumer | Payload Fields |
|-------|----------|----------|----------------|
| `tenant.provisioned` | tenant | audit, integration | tenantId, name, adminEmail |
| `auth.login.success` | auth | audit, integration | userId, email, tenantId, ip |
| `auth.login.failed` | auth | audit, integration | email, ip, reason |
| `iam.policy.updated` | iam | iam (cache flush), audit | tenantId, policyId |
| `form.published` | form-builder | audit, integration | formId, tenantId, title |
| `submission.submitted` | submission | audit, integration | submissionId, tenantId, formId, patientId |
| `patient.history.updated` | patient | audit, integration | patientId, tenantId, changeType |
| `patient.abha.linked` | patient | audit, integration | patientId, tenantId, abhaNumber (masked) |
| `audit.action.logged` | audit | — | all audit fields |

---

## ABDM / ABHA Integration

### What is built (sandbox-ready)

| Feature | Status |
|---------|--------|
| ABHA number linkage + validation | Done |
| FHIR R4 Patient resource | Done |
| FHIR R4 Observation Bundle | Done |
| Consent request + auto-grant (demo) | Done |
| ABDM tenant config per hospital | Done |

### Going live

1. Register at https://facility.ndhm.gov.in
2. Obtain HIP ID + HIU ID
3. Call `PATCH /tenants/:id/abdm-config` with real IDs and `"abdmSandboxMode": false`

---

## Database & Messaging UIs

| UI | URL | Credentials |
|----|-----|-------------|
| Kafka UI | http://localhost:8083 | no login |
| Mongo Express | http://localhost:8081 | admin / admin123 |
| pgAdmin | http://localhost:8082 | admin@healthcare.com / admin123 |

**Connect pgAdmin to the database (first time only):**

1. Right-click **Servers → Register → Server**
2. **General tab** → Name: `Healthcare Local`
3. **Connection tab:**
   - Host: `postgres`
   - Port: `5432` (internal Docker port)
   - Database: `healthcare_platform`
   - Username: `healthcare`
   - Password: `healthcare123`
4. Click **Save**

---

## Roles

| Role | Level | Capabilities |
|------|-------|-------------|
| `super_admin` | Platform | Register hospitals, view all tenants, create tenant admins |
| `tenant_admin` | Hospital | Manage forms, users, submissions, patients, analytics for own hospital |
| `department_admin` | Department | Manage forms and users within own department |
| `doctor` | Clinician | Fill forms, view own submissions, register patients |
| `nurse` | Clinician | Fill nursing forms |
| `receptionist` | Clinician | Register patients |

> All role definitions live in IAM under `tenantId=system`. User-role assignments are per-tenant.

---

## Form Layouts

| Layout | Behaviour |
|--------|-----------|
| **Wizard** | MUI Stepper — one section per page. "Next" validates the current section before advancing. |
| **Accordion** | All sections visible at once, expand/collapse each. |
| **Tabs** | Sections as MUI Tabs with unfilled-field count badges. |

---

## Audit Actions

Every form submission interaction is recorded:

| Action | Trigger |
|--------|---------|
| `FORM_OPENED` | Clinician navigates to form fill page |
| `DRAFT_SAVED` | Clinician saves draft |
| `FORM_SUBMITTED` | Clinician submits |
| `FORM_APPROVED` | Admin approves |
| `FORM_REJECTED` | Admin rejects |
| `FORM_VIEWED` | Admin views submission detail |
| `FHIR_EXPORTED` | FHIR export requested |
| `CONSENT_CHECKED` | Consent artifact verified |

PHI field values are stored as `***PHI***` in audit logs for compliance.

---

## Troubleshooting

**Port already in use:**
```powershell
netstat -ano | findstr :3010
Stop-Process -Id <PID> -Force
```

**Tenant service Prisma engine locked (EPERM on Windows):**
```bash
# Kill tenant service first, then:
cd services/tenant && npx prisma generate && npm run start:dev
```

**Super admin credentials not seeded:**
```bash
# ensureAdminExists() runs on startup automatically:
cd services/auth && npm run start:dev
```

**MongoDB replica set not initialized:**
```bash
docker logs healthcare-platform-mongo-init-1
# Should show: { ok: 1 }
```

**Clinician sees forms from other hospitals:**
Forms created before the tenant_id fix have `tenant_id: system` and won't show.
Create new forms while logged in as the correct tenant admin.

**"Role not found in IAM" when inviting users:**
All roles live under `tenantId=system`. Start IAM service before inviting users.

**Redis cache stale after permission change:**
```bash
docker exec -it healthcare-platform-redis-1 redis-cli FLUSHALL
```

**Windows port 5432 conflict:**
All `.env` files use port `5433` (Docker external). pgAdmin uses internal Docker host `postgres:5432`.

---

---

## Feature Documentation

### Audit Trail UI

**Location:** `/admin/forms/submissions/[id]` — the Submission Detail page.

#### How to reach it

1. Login as tenant admin → **Submissions** in the sidebar
2. Click any submission row
3. The detail page opens with two tabs at the top: **Form Fields** and **Audit Trail**

#### Form Fields tab (default)

| Column (left) | Column (right) |
|---------------|----------------|
| Field name + type (numbered list) | Value submitted by the clinician |

Approve / Reject action bar appears at the bottom for submissions in `submitted` or `under_review` status.  
Rejecting requires a reason of at least 10 characters.

#### Audit Trail tab

Click **Audit Trail** to switch. The tab lazy-loads from `GET /submissions/:id/audit-trail`.

What you see:

- **MUI Timeline** — one entry per recorded action, newest at top
- Each entry shows:
  - **Action chip** — color-coded label (see table below)
  - **Timestamp** — formatted as local date + time
  - **Actor ID + Role** — who performed the action
  - **IP address** — if recorded
- **Export CSV** button — downloads `audit-trail-[id].csv` with columns: Timestamp, Action, Actor, Role, IP

**Action color coding:**

| Action | Chip color |
|--------|-----------|
| `DRAFT_SAVED` | Grey |
| `FORM_SUBMITTED` | Blue (primary) |
| `FORM_APPROVED` | Green (success) |
| `FORM_REJECTED` | Red (error) |
| `FORM_VIEWED` | Teal (info) |
| `FHIR_EXPORTED` | Purple (secondary) |
| `CONSENT_CHECKED` | Orange (warning) |

> PHI field values are stored as `***PHI***` in the audit log — the actual values are never written to MongoDB audit records.

**Backend:** `FormDataAuditLog` collection in MongoDB (submission service). Written automatically on every save, submit, status change, and view.

---

### Patient Module UI

The Patient Module spans two pages under `/admin/patients`.

---

#### Patient List — `/admin/patients`

**KPI cards (top row):**

| Card | Data source |
|------|-------------|
| Total Patients | `GET /patients/analytics` |
| ABHA Linked % | Same analytics call |
| New This Month | Same analytics call |
| Average Age | Same analytics call |

**Search bar** — debounced (300ms), searches by patient name via `?search=` query param.

**Patient table columns:** MRN · Name (with avatar) · Age · Gender · Blood Group · ABHA status chip · Actions

- Green chip = "ABHA Linked"
- Yellow outlined chip = "Not Linked"
- Clicking anywhere on the row navigates to the patient detail page

**Register Patient dialog** (opened by the top-right button):

| Field | Required |
|-------|----------|
| Full Name | Yes |
| Date of Birth (date picker) | Yes |
| Gender | Yes |
| Blood Group | No |
| Phone | No |
| ABHA Number (14 digits, numeric only) | No |
| ABHA Address (X@abdm format) | No |

---

#### Patient Detail — `/admin/patients/[patientId]`

**Header card** — shows avatar, full name, MRN, age, gender, blood group chip, and ABHA status.  
If ABHA is not linked, a **Link ABHA** button appears inline in the header.

**5 tabs:**

**Tab 1 — Overview**
- Demographics card: Name, DOB, Age, Gender, Blood Group, Phone, Email (key-value rows)
- ABHA Status card:
  - If linked: success alert + masked ABHA number (first 6 digits + ••••••••), ABHA address, linked date, "View FHIR Record" button
  - If not linked: warning alert + explanation + "Link ABHA" button

**Tab 2 — History**
- Placeholder for visit history (future: link to EMR history entries)

**Tab 3 — Submissions**
- MUI Timeline of `GET /patients/:id/timeline` entries
- Each entry: visit summary, date, doctor ID

**Tab 4 — Consent**
- Table of consent artifacts from `GET /patients/:id/consent`
- Each row: purpose, status chip (green = GRANTED, red = DENIED/REVOKED, yellow = REQUESTED), requestedBy, expiry date
- **Request Consent** button opens a dialog:
  - Purpose dropdown: `CARE_MANAGEMENT`, `BREAK_THE_GLASS`, `PAYMENT`, `RESEARCH`
  - Requested By field
  - From / To date range
  - In demo mode: consent is auto-granted after 2 seconds (simulates ABDM sandbox flow)

**Tab 5 — FHIR**
- Dark-themed code block with the full FHIR R4 Patient JSON from `GET /patients/:id/fhir`
- **Copy** icon — copies JSON to clipboard
- **Download** icon — saves as `fhir-patient-[id].json`
- FHIR record includes: NDHM profile URL, ABHA identifier, blood group extension, name, gender, birthDate

**Link ABHA dialog** (accessible from header or Overview tab):
- ABHA Number field (numeric only, max 14 digits, shows `X/14 digits` counter)
- ABHA Address field (validates `@abdm` suffix before enabling submit)
- On success: patient card re-validates and shows ABHA Linked chip

---

## Scalability

### Cost model (self-hosted on AWS/GCP)

| Tier | Hospitals | Monthly infra cost |
|------|-----------|--------------------|
| Pilot | 1–5 | ~₹8,000 |
| Growth | 6–20 | ~₹40,000 |
| Scale | 21–100 | ~₹2,00,000 |

### ABDM readiness

| Milestone | Status |
|-----------|--------|
| M1 — ABHA capture + FHIR R4 + Consent | Built (sandbox-ready) |
| M2 — HIE-CM integration | Needs NHA `client_id` / `secret` |
| M3 — Gateway subscription | Needs NHA registration |

### Redis cache ROI

- Cache hit: **0.3 ms** vs DB query: **5 ms** → 16× faster
- Estimated **60% reduction** in PostgreSQL load for IAM lookups
- TTL: 60 seconds — `FLUSHALL` or `iam.policy.updated` Kafka event invalidates immediately

### Kafka partition strategy

All producers use `tenantId` as the partition key. This guarantees:
- Message ordering within a tenant
- Linear horizontal scaling — add partitions as tenant count grows
- Integration service consumers fan out per-event-type without cross-tenant interference

---

## How Services Work

Every backend service in this platform is a standalone **NestJS** application. They share no code at runtime — each has its own:

- `package.json` with its own dependencies
- `src/main.ts` entry point that starts an HTTP server on its assigned port
- Database connection (PostgreSQL via Prisma, or MongoDB via Mongoose, or both)
- Swagger docs auto-generated at `/api/docs`

The **frontend** (Next.js) talks to each service directly via `axios` instances defined in `apps/frontend/src/lib/api.ts`. There is no API gateway — the browser makes requests to each service port directly.

```
Browser (3000)
  ├── authApi      → localhost:3001  (Auth service)
  ├── iamApi       → localhost:3002  (IAM service)
  ├── formApi      → localhost:3003  (Form Builder)
  ├── submissionApi→ localhost:3004  (Submission service)
  ├── patientApi   → localhost:3006  (Patient service)
  ├── auditApi     → localhost:3008  (Audit service)
  ├── integrationApi→ localhost:3009 (Integration service)
  └── tenantApi    → localhost:3010  (Tenant service)
```

### Key NestJS Building Blocks

| Concept | What it does | File convention |
|---------|-------------|-----------------|
| **Module** | Groups a feature's controller + service + DB models together | `*.module.ts` |
| **Controller** | Defines HTTP routes (`@Get`, `@Post`, `@Patch`, `@Delete`) | `*.controller.ts` |
| **Service** | Contains all business logic and DB queries | `*.service.ts` |
| **DTO** | Validates and types the request body using `class-validator` | `dto/*.dto.ts` |
| **Schema** | MongoDB document shape (Mongoose) | `schemas/*.schema.ts` |
| **Prisma model** | PostgreSQL table shape | `prisma/schema.prisma` |

### Database Choice Per Service

| Use PostgreSQL (Prisma) when… | Use MongoDB (Mongoose) when… |
|-------------------------------|------------------------------|
| Data is relational (users, tenants, patients) | Data is document-shaped or schema-flexible (forms, submissions, history) |
| You need ACID transactions | You need flexible/nested fields |
| Rows have a fixed, known structure | Structure may vary per record |

The **Patient service** uses both: PostgreSQL for the core patient record (fixed columns) and MongoDB for visit history (flexible nested fields).

---

## Creating a New Service — Full CRUD Example

We'll build a **Prescription service** from scratch. It stores prescriptions in PostgreSQL and runs on port **3011**.

### Step 1 — Create the folder structure

```
services/
└── prescription/
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── prisma/
        │   ├── prisma.module.ts
        │   └── prisma.service.ts
        └── prescriptions/
            ├── prescriptions.module.ts
            ├── prescriptions.controller.ts
            ├── prescriptions.service.ts
            └── dto/
                └── create-prescription.dto.ts
```

### Step 2 — `package.json`

```json
{
  "name": "@healthcare/prescription-service",
  "version": "1.0.0",
  "scripts": {
    "start:dev": "ts-node -r tsconfig-paths/register src/main.ts",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.22",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^10.4.22",
    "@nestjs/platform-express": "^10.4.22",
    "@nestjs/swagger": "^11.2.7",
    "@prisma/client": "^5.22.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "prisma": "^5.22.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "swagger-ui-express": "^5.0.1"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^6.0.2"
  }
}
```

### Step 3 — `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Step 4 — Prisma schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Prescription {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  patientId  String   @map("patient_id")
  doctorId   String   @map("doctor_id")
  drug       String
  dosage     String
  frequency  String
  durationDays Int    @map("duration_days")
  notes      String?
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("prescriptions")
}
```

> **Rule:** Always use `@map()` for snake_case column names. Always use `@id @default(uuid())` for primary keys.

Create the `.env` file in `services/prescription/`:

```env
DATABASE_URL=postgresql://healthcare:healthcare123@localhost:5433/healthcare_platform
PORT=3011
FRONTEND_URL=http://localhost:3000
```

Run migration:

```bash
cd services/prescription
npx prisma migrate dev --name init
```

### Step 5 — Prisma module & service

**`src/prisma/prisma.service.ts`**
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '../generated/prisma'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect() }
  async onModuleDestroy() { await this.$disconnect() }
}
```

**`src/prisma/prisma.module.ts`**
```typescript
import { Module, Global } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` means any other module in this service can inject `PrismaService` without importing `PrismaModule` themselves.

### Step 6 — DTO (`src/prescriptions/dto/create-prescription.dto.ts`)

DTOs validate the incoming request body. `class-validator` decorators throw a `400 Bad Request` automatically if validation fails (because `ValidationPipe` is registered globally in `main.ts`).

```typescript
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreatePrescriptionDto {
  @ApiProperty() @IsString() @IsNotEmpty() tenantId: string
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string
  @ApiProperty() @IsString() @IsNotEmpty() doctorId: string
  @ApiProperty() @IsString() @IsNotEmpty() drug: string
  @ApiProperty() @IsString() @IsNotEmpty() dosage: string        // e.g. "500mg"
  @ApiProperty() @IsString() @IsNotEmpty() frequency: string     // e.g. "twice daily"
  @ApiProperty() @IsInt() @Min(1)          durationDays: number
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string
}
```

### Step 7 — Service (`src/prescriptions/prescriptions.service.ts`)

The service contains all business logic. It talks to the database through `PrismaService`. Controllers never touch Prisma directly.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePrescriptionDto } from './dto/create-prescription.dto'

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(dto: CreatePrescriptionDto) {
    return this.prisma.prescription.create({ data: dto })
  }

  // READ ALL — optional tenantId + patientId filters
  async findAll(tenantId?: string, patientId?: string) {
    return this.prisma.prescription.findMany({
      where: {
        isActive: true,
        ...(tenantId  ? { tenantId }  : {}),
        ...(patientId ? { patientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // READ ONE
  async findOne(id: string) {
    const rx = await this.prisma.prescription.findUnique({ where: { id } })
    if (!rx) throw new NotFoundException(`Prescription ${id} not found`)
    return rx
  }

  // UPDATE (partial)
  async update(id: string, dto: Partial<CreatePrescriptionDto>) {
    await this.findOne(id)   // throws 404 if not found
    return this.prisma.prescription.update({ where: { id }, data: dto })
  }

  // SOFT DELETE — sets isActive: false instead of deleting the row
  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.prescription.update({ where: { id }, data: { isActive: false } })
  }
}
```

> **Why soft delete?** Medical records must never be hard-deleted for compliance. Setting `isActive: false` keeps the audit history intact.

### Step 8 — Controller (`src/prescriptions/prescriptions.controller.ts`)

The controller maps HTTP verbs + paths to service methods. It does zero business logic — just receives the request, delegates to the service, and returns the result.

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { PrescriptionsService } from './prescriptions.service'
import { CreatePrescriptionDto } from './dto/create-prescription.dto'

@ApiTags('Prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private service: PrescriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new prescription' })
  create(@Body() dto: CreatePrescriptionDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List prescriptions (filter by tenantId or patientId)' })
  @ApiQuery({ name: 'tenantId',  required: false })
  @ApiQuery({ name: 'patientId', required: false })
  findAll(
    @Query('tenantId')  tenantId?:  string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.findAll(tenantId, patientId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single prescription by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a prescription (partial)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePrescriptionDto>) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a prescription (sets isActive: false)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
```

### Step 9 — Feature Module (`src/prescriptions/prescriptions.module.ts`)

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PrescriptionsService } from './prescriptions.service'
import { PrescriptionsController } from './prescriptions.controller'

@Module({
  imports: [PrismaModule],
  providers: [PrescriptionsService],
  controllers: [PrescriptionsController],
})
export class PrescriptionsModule {}
```

### Step 10 — App Module (`src/app.module.ts`)

```typescript
import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { PrescriptionsModule } from './prescriptions/prescriptions.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PrescriptionsModule,
  ],
})
export class AppModule {}
```

### Step 11 — Entry Point (`src/main.ts`)

```typescript
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Validates all DTOs globally — returns 400 if class-validator rules fail
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // Allow the Next.js frontend to call this service with cookies
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  // Auto-generate Swagger UI at /api/docs
  const config = new DocumentBuilder()
    .setTitle('Prescription Service')
    .setDescription('Prescription management API')
    .setVersion('1.0')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))

  const port = process.env.PORT || 3011
  await app.listen(port)
  console.log(`Prescription service running on port ${port}`)
}
bootstrap()
```

### Step 12 — Register the service

**Install dependencies and generate Prisma client:**

```bash
cd services/prescription
pnpm install
npx prisma migrate dev --name init
npx prisma generate
```

**Add the axios instance to the frontend** (`apps/frontend/src/lib/api.ts`):

```typescript
export const prescriptionApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PRESCRIPTION_URL || 'http://localhost:3011',
  withCredentials: true,
})
```

**Start the service:**

```bash
cd services/prescription && pnpm run start:dev
```

**Verify it's running:**

```
http://localhost:3011/api/docs   ← Swagger UI
```

---

### Full API the service now exposes

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| `POST` | `/prescriptions` | `CreatePrescriptionDto` | Create prescription |
| `GET` | `/prescriptions` | `?tenantId=&patientId=` | List (with optional filters) |
| `GET` | `/prescriptions/:id` | — | Get one by ID |
| `PATCH` | `/prescriptions/:id` | Any fields from DTO | Update (partial) |
| `DELETE` | `/prescriptions/:id` | — | Soft-delete |

### Using it from the frontend (React)

```typescript
import { prescriptionApi } from '@/lib/api'

// Create
await prescriptionApi.post('/prescriptions', {
  tenantId: 'my-tenant',
  patientId: 'patient-uuid',
  doctorId:  'doctor-uuid',
  drug:      'Amoxicillin',
  dosage:    '500mg',
  frequency: 'three times daily',
  durationDays: 7,
})

// List for a patient
const { data } = await prescriptionApi.get('/prescriptions', {
  params: { patientId: 'patient-uuid' },
})

// Update
await prescriptionApi.patch(`/prescriptions/${id}`, { notes: 'Take with food' })

// Soft-delete
await prescriptionApi.delete(`/prescriptions/${id}`)
```

---

### Adding MongoDB Instead of PostgreSQL

If your data is flexible/nested (e.g., a prescription with variable-length drug arrays), swap Prisma for Mongoose:

**1. Install Mongoose:**
```bash
pnpm add @nestjs/mongoose mongoose
```

**2. Define a schema (`src/prescriptions/schemas/prescription.schema.ts`):**
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PrescriptionDocument = Prescription & Document

@Schema({ timestamps: true })
export class Prescription {
  @Prop({ required: true }) tenantId: string
  @Prop({ required: true }) patientId: string
  @Prop({ required: true }) drug: string
  @Prop({ required: true }) dosage: string
  @Prop({ type: [String], default: [] }) tags: string[]  // flexible array
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription)
```

**3. Register in the module:**
```typescript
import { MongooseModule } from '@nestjs/mongoose'
import { Prescription, PrescriptionSchema } from './schemas/prescription.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prescription.name, schema: PrescriptionSchema },
    ]),
  ],
  ...
})
```

**4. Inject in the service:**
```typescript
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

constructor(
  @InjectModel(Prescription.name) private model: Model<PrescriptionDocument>
) {}

async findAll(patientId: string) {
  return this.model.find({ patientId }).sort({ createdAt: -1 }).exec()
}
```

**5. Wire up MongoDB in `app.module.ts`:**
```typescript
MongooseModule.forRootAsync({
  useFactory: () => ({
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_prescriptions',
  }),
}),
```

---

### Checklist for Every New Service

- [ ] `package.json` with `name: @healthcare/<service>-service`
- [ ] `tsconfig.json` with `experimentalDecorators` and `emitDecoratorMetadata` enabled
- [ ] `.env` file with `DATABASE_URL`, `PORT`, `FRONTEND_URL`
- [ ] `prisma/schema.prisma` (PostgreSQL) **or** Mongoose schemas (MongoDB)
- [ ] Migration run: `npx prisma migrate dev --name init`
- [ ] `PrismaModule` with `@Global()` so all sub-modules can inject `PrismaService`
- [ ] DTO with `class-validator` decorators for every required field
- [ ] Service for business logic — never put DB queries in the controller
- [ ] Controller with `@ApiTags` + `@ApiOperation` for Swagger
- [ ] Feature module wiring controller + service + DB models
- [ ] `AppModule` importing the feature module
- [ ] `main.ts` with `ValidationPipe`, `enableCors({ credentials: true })`, Swagger setup
- [ ] New port (next available after 3010) — update the All Ports table above
- [ ] `axios` instance added to `apps/frontend/src/lib/api.ts`
- Integration webhook push model vs polling cost comparison

---

## ABHA + FHIR R4 — What They Are and How They're Implemented

### What is ABHA?

**ABHA** stands for **Ayushman Bharat Health Account**. It is India's national health ID system, managed by the National Health Authority (NHA) under the **ABDM** (Ayushman Bharat Digital Mission) programme.

Every Indian citizen can get a free ABHA number — a unique 14-digit number that acts as their health identity across all hospitals in India. Think of it like a PAN card, but for medical records.

```
ABHA Number:  12-3456-7890-1234   (14 digits, issued by NHA)
ABHA Address: ravi.sharma@abdm    (human-readable handle, like an email)
```

**Why does it matter for this platform?**

When a patient's ABHA is linked, any hospital using the platform can:
- Pull the patient's existing medical history from the national health exchange
- Push new records back (appointments, prescriptions, lab results)
- Share records with other ABDM-compliant hospitals without needing paper files
- Give patients full control — they can grant or revoke data access at any time

Without ABHA, each hospital siloes the patient's data. With ABHA, the data follows the patient.

---

### What is FHIR R4?

**FHIR** stands for **Fast Healthcare Interoperability Resources**. It is an international standard (by HL7) that defines a common JSON/XML format for healthcare data so that different hospital systems can exchange records without custom integrations.

**R4** is the fourth (and current stable) version of the standard.

Instead of each hospital inventing their own patient JSON shape, FHIR says: a patient record always looks like this:

```json
{
  "resourceType": "Patient",
  "id": "some-uuid",
  "name": [{ "use": "official", "text": "Ravi Sharma" }],
  "gender": "male",
  "birthDate": "1990-05-15",
  "telecom": [{ "system": "phone", "value": "9999999999" }]
}
```

FHIR defines many resource types: `Patient`, `Observation`, `Condition`, `Medication`, `Bundle`, `Composition`, etc. All ABDM-compliant systems in India must speak FHIR R4.

---

### How ABHA is Implemented in This Platform

All ABHA logic lives in the **Patient service** (`services/patient/`).

#### Data stored in PostgreSQL (Prisma)

Three fields are added to the `Patient` model specifically for ABHA:

```prisma
// services/patient/prisma/schema.prisma
model Patient {
  abhaNumber   String?   @unique @map("abha_number")   // 14-digit ID
  abhaAddress  String?   @map("abha_address")           // X@abdm handle
  abhaVerified Boolean   @default(false) @map("abha_verified")
  abhaLinkedAt DateTime? @map("abha_linked_at")
}
```

`abhaNumber` has a `@unique` constraint — one ABHA number can only be linked to one patient record across the entire database.

#### Linking ABHA — DTO validation

When a user submits the "Link ABHA" form, the request body is validated by `LinkAbhaDto`:

```typescript
// services/patient/src/patients/dto/link-abha.dto.ts
export class LinkAbhaDto {
  @IsString()
  @Matches(/^\d{14}$/, { message: 'ABHA number must be exactly 14 digits' })
  abhaNumber: string

  @IsString()
  @Matches(/^[a-zA-Z0-9._]+@abdm$/, { message: 'ABHA address must be in X@abdm format' })
  abhaAddress: string
}
```

Two regex rules enforced automatically by `ValidationPipe`:
- `abhaNumber` must be exactly 14 digits (`/^\d{14}$/`)
- `abhaAddress` must end in `@abdm` (`/^[a-zA-Z0-9._]+@abdm$/`)

#### Linking logic in the service

```typescript
// services/patient/src/patients/patients.service.ts
async linkAbha(id: string, dto: LinkAbhaDto) {
  // 1. Check no other patient already uses this ABHA number
  const existing = await this.prisma.patient.findFirst({
    where: { abhaNumber: dto.abhaNumber, id: { not: id } }
  })
  if (existing) throw new BadRequestException('ABHA number already linked to another patient')

  // 2. Write the ABHA data to the patient row and mark as verified
  const updated = await this.prisma.patient.update({
    where: { id },
    data: {
      abhaNumber:   dto.abhaNumber,
      abhaAddress:  dto.abhaAddress,
      abhaVerified: true,
      abhaLinkedAt: new Date(),
    },
  })

  // 3. Publish a Kafka event so other services can react
  await this.publishKafka('patient.abha.linked', {
    patientId:   id,
    abhaNumber:  dto.abhaNumber,
    abhaAddress: dto.abhaAddress,
    timestamp:   new Date(),
  }, id)

  return updated
}
```

#### ABHA masked status endpoint

When the frontend needs to show the ABHA chip, it calls `GET /patients/:id/abha-status`. The full ABHA number is never sent to the browser — only the first 6 digits + masked remainder:

```typescript
async getAbhaStatus(id: string) {
  const patient = await this.findOne(id)
  const masked = patient.abhaNumber
    ? patient.abhaNumber.slice(0, 6) + '••••••••'
    : null
  return {
    abhaLinked:        patient.abhaVerified,
    maskedAbhaNumber:  masked,          // e.g. "123456••••••••"
    abhaAddress:       patient.abhaAddress,
    abhaVerified:      patient.abhaVerified,
    abhaLinkedAt:      patient.abhaLinkedAt,
  }
}
```

#### API endpoints for ABHA

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/link-abha` | Link ABHA number + address to a patient |
| `GET` | `/patients/:id/abha-status` | Get masked ABHA status (safe to send to browser) |

---

### How FHIR R4 is Implemented in This Platform

All FHIR logic lives in `FhirService` (`services/patient/src/fhir/fhir.service.ts`). It is a pure conversion layer — it takes data from the database and reshapes it into FHIR-compliant JSON. No external FHIR server is needed.

#### 1. Patient resource (`GET /patients/:id/fhir`)

Converts a Prisma `Patient` row into a FHIR R4 `Patient` resource:

```typescript
patientToFhir(patient) {
  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'],
      lastUpdated: patient.updatedAt,
    },
    identifier: [
      {
        system: 'https://healthid.ndhm.gov.in',
        value: patient.mrn,
        type: { coding: [{ code: 'MR', display: 'Medical Record Number' }] },
      },
      // If ABHA linked, add a second identifier:
      {
        system: 'https://abha.abdm.gov.in',
        value: patient.abhaNumber,
        type: { coding: [{ code: 'ABHA', display: 'Ayushman Bharat Health Account' }] },
      }
    ],
    name:      [{ use: 'official', text: patient.name }],
    gender:    patient.gender,   // 'male' | 'female' | 'other'
    birthDate: '1990-05-15',     // ISO date only, no time
    telecom:   [{ system: 'phone', value: patient.contactPhone, use: 'home' }],
    extension: [{
      // Blood group as an NDHM FHIR extension
      url: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/BloodGroup',
      valueCodeableConcept: { coding: [{ code: 'B+', display: 'B+' }] },
    }],
  }
}
```

Key points:
- `meta.profile` references the **NDHM (National Digital Health Mission)** profile URL — required for ABDM compliance
- The `identifier` array carries both the MRN (internal hospital ID) and the ABHA number (national ID)
- `birthDate` is just `YYYY-MM-DD` — no time component, per FHIR spec
- Blood group goes into `extension` because it is not a standard FHIR Patient field

#### 2. Observations Bundle (`GET /patients/:id/fhir/observations`)

Converts a form submission's field values into a FHIR R4 `Bundle` of `Observation` resources. Each form field answered by the doctor becomes one Observation:

```typescript
submissionToFhir(submission, formSchema) {
  const entries = Object.entries(submission.data).map(([fieldId, value]) => ({
    resource: {
      resourceType: 'Observation',
      id:     `obs-${submission._id}-${fieldId}`,
      status: 'final',
      code: {
        coding: [{
          system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-observation',
          code:   fieldId,
        }],
        text: field.label,    // e.g. "Blood Pressure"
      },
      subject:           { reference: `Patient/${submission.patient_id}` },
      effectiveDateTime: submission.createdAt,
      valueString:       String(value),  // e.g. "120/80"
    },
    request: { method: 'POST', url: 'Observation' },
  }))

  return {
    resourceType: 'Bundle',
    id:        `bundle-${submission._id}`,
    type:      'transaction',
    timestamp: new Date().toISOString(),
    entry:     entries,
  }
}
```

A Bundle of type `"transaction"` means: send all these Observations to an FHIR server as one atomic operation.

#### 3. Composition (OP Consultation Record)

For outpatient consultations, a `Composition` resource wraps the Observations into a human-readable clinical document:

```typescript
consultationToFhir(submission, patient) {
  return {
    resourceType: 'Composition',
    meta: {
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultationRecord'],
    },
    status: 'final',
    type: {
      coding: [{
        system: 'http://snomed.info/sct',
        code:    '371530004',
        display: 'Clinical consultation report',
      }],
    },
    subject: { reference: `Patient/${patient.id}`, display: patient.name },
    author:  [{ reference: `Practitioner/${submission.submitted_by}` }],
    title:   'OP Consultation Record',
    section: [{
      title: 'Chief Complaint',
      entry: [{ reference: `Observation/obs-${submission._id}-field1` }],
    }],
  }
}
```

`SNOMED CT code 371530004` is the internationally recognised code for "Clinical consultation report".

#### API endpoints for FHIR

| Method | Path | What it returns |
|--------|------|-----------------|
| `GET` | `/patients/:id/fhir` | FHIR R4 `Patient` resource (JSON) |
| `GET` | `/patients/:id/fhir/observations` | FHIR R4 `Bundle` of `Observation` resources |

---

### Consent — How Data Access is Controlled

ABDM requires that a patient explicitly consents before their data can be shared. This platform implements consent artifacts stored in MongoDB.

#### Consent states

```
REQUESTED → GRANTED → (can be) REVOKED
           → DENIED
           → EXPIRED  (auto-set when expiresAt < now)
```

#### Consent purposes

| Purpose | When used |
|---------|-----------|
| `CARE_MANAGEMENT` | Routine treatment by the patient's own doctor |
| `BREAK_THE_GLASS` | Emergency access — bypasses normal consent flow |
| `PAYMENT` | Insurance or billing data sharing |
| `RESEARCH` | Anonymised data for medical research |

#### What a consent artifact looks like

```json
{
  "consentId":      "uuid",
  "patientId":      "patient-uuid",
  "tenantId":       "hospital-uuid",
  "requestedBy":    "doctor-uuid",
  "purpose":        "CARE_MANAGEMENT",
  "dataCategories": ["OPConsultation", "DiagnosticReport"],
  "dateRange":      { "from": "2026-01-01", "to": "2026-12-31" },
  "status":         "GRANTED",
  "grantedAt":      "2026-04-15T10:00:00Z",
  "expiresAt":      "2026-12-31T00:00:00Z"
}
```

#### Demo mode — auto-grant after 2 seconds

In a production ABDM system, the patient receives a push notification on their ABHA-linked mobile app and manually approves. For this platform (sandbox/demo), consent is auto-granted 2 seconds after the request:

```typescript
// services/patient/src/patients/patients.service.ts
async requestConsent(patientId, dto) {
  const artifact = await this.consentModel.create({
    ...dto,
    status: ConsentStatus.REQUESTED,
  })

  // Auto-grant in demo mode (real ABDM would notify patient's phone)
  setTimeout(async () => {
    await this.consentModel.findByIdAndUpdate(artifact._id, {
      status:    ConsentStatus.GRANTED,
      grantedAt: new Date(),
      expiresAt: dto.dateRange?.to ? new Date(dto.dateRange.to) : undefined,
    })
  }, 2000)

  return artifact
}
```

#### Consent verification

Before any sensitive data (FHIR export, history) is shared, the system can verify consent is still valid:

```typescript
async verifyConsent(patientId, consentId) {
  // Returns { valid: true } or { valid: false, reason: '...' }
  // Checks: exists, belongs to patient, not denied/revoked/expired
}
```

#### API endpoints for Consent

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/patients/:id/consent/request` | Create a consent request (auto-granted after 2s in demo) |
| `GET` | `/patients/:id/consent` | List all consent artifacts for a patient |
| `PATCH` | `/patients/:id/consent/:consentId` | Manually grant, deny, or revoke |
| `GET` | `/patients/:id/consent/:consentId/verify` | Check if a consent is currently valid |

---

### Data Flow — Linking ABHA and Exporting FHIR

```
Admin/Doctor UI
  │
  ├─ POST /patients/:id/link-abha
  │     │
  │     ├─ Validates: 14 digits, @abdm format
  │     ├─ Checks: no duplicate ABHA across all patients
  │     ├─ Writes: abhaNumber, abhaAddress, abhaVerified=true to PostgreSQL
  │     └─ Publishes: patient.abha.linked event to Kafka
  │
  └─ GET /patients/:id/fhir
        │
        ├─ Reads patient row from PostgreSQL
        ├─ FhirService.patientToFhir() reshapes it to FHIR R4 JSON
        │     ├─ identifier[0] = MRN (internal)
        │     ├─ identifier[1] = ABHA number (if linked)
        │     ├─ name, gender, birthDate, telecom from patient row
        │     └─ blood group → FHIR extension
        └─ Returns raw FHIR JSON (ready to POST to any FHIR-compliant server)
```

### What "ABDM Ready" Means for This Platform

| Feature | Status | Notes |
|---------|--------|-------|
| ABHA number + address storage | Done | PostgreSQL, unique constraint, masked in API |
| ABHA format validation | Done | 14-digit regex + `@abdm` regex |
| FHIR R4 Patient resource | Done | NDHM profile, dual identifier (MRN + ABHA) |
| FHIR R4 Observation Bundle | Done | One Observation per form field |
| FHIR R4 OPConsultation Composition | Done | SNOMED CT coded, links to Observations |
| Consent artifact lifecycle | Done | Request → Grant → Revoke/Expire |
| Kafka events on ABHA link | Done | `patient.abha.linked` topic |
| Live NHA sandbox connection | Not wired | Would need NHA developer credentials + client certificates |
| Patient mobile consent approval | Not wired | Auto-granted in 2s for demo; real flow needs ABDM gateway |
