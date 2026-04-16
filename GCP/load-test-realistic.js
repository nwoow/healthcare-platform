// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — Realistic Load Test
// Simulates real clinical workflow:
//   Doctor logs in → fetches assigned forms → selects patient
//   → fills form with realistic data → submits
//   Admin reviews → approves submission
//   Nurse logs in → fills nursing assessment
//
// 5 tenants × 60 users = 300 total users
// Ramps to 300 VUs — one VU per real user
// Run: k6 run --out json=results.json load-test-realistic.js
// ═══════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ── Load seed data ───────────────────────────────────────────────
const users    = new SharedArray('users',    () => JSON.parse(open('./users.json')));
const forms    = new SharedArray('forms',    () => JSON.parse(open('./forms.json')));
const tenants  = new SharedArray('tenants',  () => JSON.parse(open('./tenants.json')));
const patients = new SharedArray('patients', () => JSON.parse(open('./patients.json')));

// ── Custom metrics ───────────────────────────────────────────────
const loginDuration      = new Trend('login_duration',       true);
const formFetchDuration  = new Trend('forms_fetch_duration', true);
const formFillDuration   = new Trend('form_fill_duration',   true);
const submitDuration     = new Trend('submit_duration',      true);
const approveDuration    = new Trend('approve_duration',     true);
const iamDuration        = new Trend('iam_eval_duration',    true);
const errorRate          = new Rate('error_rate');
const totalRequests      = new Counter('total_requests');
const formSubmissions    = new Counter('form_submissions');
const formApprovals      = new Counter('form_approvals');

// ── Test config ──────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '2m',  target: 50  },  // Warm up — 50 VUs
    { duration: '3m',  target: 50  },  // Hold 50 VUs
    { duration: '2m',  target: 150 },  // Ramp to 150 VUs
    { duration: '3m',  target: 150 },  // Hold 150 VUs
    { duration: '2m',  target: 300 },  // Ramp to 300 VUs (full user base)
    { duration: '5m',  target: 300 },  // Hold 300 VUs — peak load
    { duration: '3m',  target: 0   },  // Ramp down
  ],
  thresholds: {
    'http_req_duration':     ['p(95)<1000', 'p(99)<3000'],
    'http_req_failed':       ['rate<0.05'],
    'error_rate':            ['rate<0.05'],
    'login_duration':        ['p(95)<500'],
    'submit_duration':       ['p(95)<1000'],
    'iam_eval_duration':     ['p(95)<100'],
    'forms_fetch_duration':  ['p(95)<300'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

const BASE = __ENV.BASE_URL || 'http://localhost';

// ── Realistic form submission data ───────────────────────────────
const FORM_DATA = [
  { f1: 'Patient reports persistent headache for 3 days', f2: 6, f3: 'Moderate', f4: 'Less than 1 day', f5: 'Penicillin' },
  { f1: 'Upper abdominal pain after meals, 2 weeks duration', f2: 5, f3: 'Mild', f4: '1 to 7 days', f5: 'None known' },
  { f1: 'Chest tightness and shortness of breath on exertion', f2: 7, f3: 'Severe', f4: 'More than 1 week', f5: 'Aspirin' },
  { f1: 'Chronic lower back pain worsening with prolonged sitting', f2: 4, f3: 'Moderate', f4: 'More than 1 week', f5: 'NSAIDs' },
  { f1: 'Fever 101F with body ache and chills since yesterday', f2: 7, f3: 'Moderate', f4: 'Less than 1 day', f5: 'Sulfonamides' },
  { f1: 'Knee pain and swelling after sports injury', f2: 6, f3: 'Moderate', f4: '1 to 7 days', f5: 'None known' },
  { f1: 'Recurrent migraine with visual aura, 3 episodes this month', f2: 8, f3: 'Severe', f4: 'More than 1 week', f5: 'Triptans' },
  { f1: 'Skin rash on forearms, itching and redness, started 2 days ago', f2: 3, f3: 'Mild', f4: '1 to 7 days', f5: 'Unknown' },
];

function headers(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': token ? `access_token=${token}` : '',
    },
    timeout: '10s',
  };
}

// ── Main VU scenario ─────────────────────────────────────────────
export default function () {
  // Each VU gets a unique user
  const user = users[(__VU - 1) % users.length];
  if (!user) { sleep(1); return; }

  const tenantForms   = forms.filter(f => f.tenantId === user.tenantId);
  const tenantPatients = patients.filter(p => p.tenantId === user.tenantId);

  let token = null;

  // ── STEP 1: Login ──────────────────────────────────────────────
  group('01_login', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE}:3001/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
    );
    loginDuration.add(Date.now() - start);
    totalRequests.add(1);

    const ok = check(res, {
      'login status 200': r => r.status === 200 || r.status === 201,
    });
    errorRate.add(!ok);

    // Extract JWT from cookie
    const cookie = res.headers['Set-Cookie'] || '';
    const match = cookie.match(/access_token=([^;]+)/);
    if (match) token = match[1];
    else if (res.status === 200) {
      try { token = JSON.parse(res.body)?.access_token || 'token'; } catch {}
    }
  });

  if (!token) { sleep(2); return; }

  sleep(0.5);

  // ── STEP 2: IAM permission check ──────────────────────────────
  group('02_iam_check', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE}:3002/iam/evaluate`,
      JSON.stringify({
        userId: user.userId || 'user',
        action: user.role === 'doctor' ? 'submit' : 'read',
        resource: 'form',
        tenantId: user.tenantId,
      }),
      { ...headers(token), timeout: '5s' }
    );
    iamDuration.add(Date.now() - start);
    totalRequests.add(1);
    check(res, { 'iam 200': r => r.status === 200 });
  });

  sleep(0.3);

  // ── STEP 3: Fetch available forms ─────────────────────────────
  group('03_fetch_forms', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE}:3003/forms?tenant_id=${user.tenantId}&status=published`,
      { ...headers(token), timeout: '8s' }
    );
    formFetchDuration.add(Date.now() - start);
    totalRequests.add(1);
    check(res, { 'forms 200': r => r.status === 200 });
  });

  sleep(0.5);

  // ── STEP 4: Doctor fills and submits form ─────────────────────
  if (user.role === 'doctor' && tenantForms.length > 0) {

    // Pick a random form for this doctor
    const form = tenantForms[Math.floor(Math.random() * tenantForms.length)];

    // Fetch form schema (simulates opening the form)
    group('04_open_form', () => {
      const start = Date.now();
      const res = http.get(
        `${BASE}:3003/forms/${form.formId}`,
        { ...headers(token), timeout: '8s' }
      );
      formFillDuration.add(Date.now() - start);
      totalRequests.add(1);
      check(res, { 'form schema 200': r => r.status === 200 });
    });

    // Simulate doctor reading the form (think time)
    sleep(Math.random() * 2 + 1);

    // Pick a patient
    const patient = tenantPatients.length > 0
      ? tenantPatients[Math.floor(Math.random() * tenantPatients.length)]
      : null;

    // Submit the form with realistic clinical data
    group('05_submit_form', () => {
      const data = FORM_DATA[Math.floor(Math.random() * FORM_DATA.length)];
      const start = Date.now();
      const res = http.post(
        `${BASE}:3004/submissions`,
        JSON.stringify({
          form_id:      form.formId,
          form_version: 1,
          tenant_id:    user.tenantId,
          submitted_by: user.userId || user.email,
          patient_id:   patient?.patientId || 'patient_load_test',
          status:       'submitted',
          data: {
            f1: data.f1,
            f2: data.f2,
            f3: data.f3,
            f4: data.f4,
            f5: data.f5,
          },
        }),
        { ...headers(token), timeout: '15s' }
      );
      submitDuration.add(Date.now() - start);
      totalRequests.add(1);
      const ok = check(res, { 'submission 201': r => r.status === 201 || r.status === 200 });
      errorRate.add(!ok);
      if (ok) formSubmissions.add(1);
    });
  }

  // ── STEP 5: Nurse fills nursing assessment ────────────────────
  if (user.role === 'nurse' && tenantForms.length > 0) {
    const nursingForm = tenantForms.find(f => f.name?.includes('Nursing')) || tenantForms[0];

    sleep(Math.random() * 1 + 0.5);

    group('05_nurse_submit', () => {
      const res = http.post(
        `${BASE}:3004/submissions`,
        JSON.stringify({
          form_id:      nursingForm.formId,
          form_version: 1,
          tenant_id:    user.tenantId,
          submitted_by: user.userId || user.email,
          patient_id:   tenantPatients[0]?.patientId || 'patient_load_test',
          status:       'submitted',
          data: {
            f1: 37.2 + Math.random() * 1.5,
            f2: 70 + Math.floor(Math.random() * 30),
            f3: 16 + Math.floor(Math.random() * 6),
            f4: 'Alert',
            f5: `Nursing assessment at ${new Date().toISOString()}`,
          },
        }),
        { ...headers(token), timeout: '15s' }
      );
      totalRequests.add(1);
      const ok = check(res, { 'nurse submit 200': r => r.status === 201 || r.status === 200 });
      if (ok) formSubmissions.add(1);
    });
  }

  // ── STEP 6: Tenant admin reviews submissions ──────────────────
  if (user.role === 'tenant_admin') {
    sleep(0.5);

    group('06_admin_review', () => {
      const start = Date.now();
      const res = http.get(
        `${BASE}:3004/submissions?tenant_id=${user.tenantId}&status=submitted&limit=10`,
        { ...headers(token), timeout: '10s' }
      );
      approveDuration.add(Date.now() - start);
      totalRequests.add(1);
      check(res, { 'submissions list 200': r => r.status === 200 });

      // Try to approve first submission in list
      try {
        const body = JSON.parse(res.body);
        const subs = Array.isArray(body) ? body : body.data || [];
        if (subs.length > 0) {
          const subId = subs[0]._id || subs[0].id;
          if (subId) {
            const approveRes = http.patch(
              `${BASE}:3004/submissions/${subId}/status`,
              JSON.stringify({ status: 'approved', reviewComment: 'Approved by admin during load test' }),
              { ...headers(token), timeout: '10s' }
            );
            if (approveRes.status === 200) formApprovals.add(1);
          }
        }
      } catch {}
    });
  }

  // ── Think time between iterations ────────────────────────────
  // Doctors think 2-4 seconds between patients (realistic)
  // Nurses think 1-2 seconds
  // Admins think 1-3 seconds
  const thinkTime = user.role === 'doctor'
    ? Math.random() * 2 + 2
    : Math.random() * 2 + 1;

  sleep(thinkTime);
}

// ── Custom summary ────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const d = (metric, pct) => {
    const v = m[metric]?.values?.[`p(${pct})`];
    return v !== undefined ? Math.round(v) + 'ms' : 'N/A';
  };
  const rate = (metric) => {
    const v = m[metric]?.values?.rate;
    return v !== undefined ? (v * 100).toFixed(2) + '%' : 'N/A';
  };
  const count = (metric) => m[metric]?.values?.count || 0;

  const summary = `
╔══════════════════════════════════════════════════════════════════════╗
║      HEALTHCARE PLATFORM — REALISTIC CLINICAL LOAD TEST             ║
║      5 Tenants · 300 Users · Doctors Filling Forms · GCP VM         ║
╠══════════════════════════════════════════════════════════════════════╣
║  Total HTTP Requests:   ${String(count('http_reqs')).padEnd(44)}║
║  Form Submissions:      ${String(count('form_submissions')).padEnd(44)}║
║  Form Approvals:        ${String(count('form_approvals')).padEnd(44)}║
║  Error Rate:            ${String(rate('error_rate')).padEnd(44)}║
╠══════════════════════════════════════════════════════════════════════╣
║  ENDPOINT                        p50       p95       p99            ║
╠══════════════════════════════════════════════════════════════════════╣
║  01. Login                       ${String(d('login_duration',50)).padEnd(10)}${String(d('login_duration',95)).padEnd(10)}${String(d('login_duration',99)).padEnd(14)}║
║  02. IAM Evaluate                ${String(d('iam_eval_duration',50)).padEnd(10)}${String(d('iam_eval_duration',95)).padEnd(10)}${String(d('iam_eval_duration',99)).padEnd(14)}║
║  03. Fetch Forms                 ${String(d('forms_fetch_duration',50)).padEnd(10)}${String(d('forms_fetch_duration',95)).padEnd(10)}${String(d('forms_fetch_duration',99)).padEnd(14)}║
║  04. Open Form Schema            ${String(d('form_fill_duration',50)).padEnd(10)}${String(d('form_fill_duration',95)).padEnd(10)}${String(d('form_fill_duration',99)).padEnd(14)}║
║  05. Submit Form (Doctor)        ${String(d('submit_duration',50)).padEnd(10)}${String(d('submit_duration',95)).padEnd(10)}${String(d('submit_duration',99)).padEnd(14)}║
║  06. Admin Approve               ${String(d('approve_duration',50)).padEnd(10)}${String(d('approve_duration',95)).padEnd(10)}${String(d('approve_duration',99)).padEnd(14)}║
╠══════════════════════════════════════════════════════════════════════╣
║  THRESHOLDS                                                         ║
║  http_req_duration p95 < 1000ms  ${m['http_req_duration']?.values?.['p(95)'] < 1000 ? '✓ PASS' : '✗ FAIL'}                              ║
║  http_req_failed < 5%            ${(m['http_req_failed']?.values?.rate||0) < 0.05 ? '✓ PASS' : '✗ FAIL'}                              ║
║  login p95 < 500ms               ${m['login_duration']?.values?.['p(95)'] < 500 ? '✓ PASS' : '✗ FAIL'}                              ║
║  iam_eval p95 < 100ms            ${m['iam_eval_duration']?.values?.['p(95)'] < 100 ? '✓ PASS' : '✗ FAIL'}                              ║
║  submit p95 < 1000ms             ${m['submit_duration']?.values?.['p(95)'] < 1000 ? '✓ PASS' : '✗ FAIL'}                              ║
╚══════════════════════════════════════════════════════════════════════╝
`;

  return {
    'load-test-summary.txt': summary,
    'results.json': JSON.stringify(data),
    stdout: summary,
  };
}
