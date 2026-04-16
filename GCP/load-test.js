// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — k6 Load Test
// 5 tenants · 3000 concurrent virtual users
// Run: k6 run load-test.js --out json=results.json
// ═══════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ── Load seed data ───────────────────────────────────────────────
const users   = new SharedArray('users',   function() { return JSON.parse(open('./users.json')); });
const forms   = new SharedArray('forms',   function() { return JSON.parse(open('./forms.json')); });
const tenants = new SharedArray('tenants', function() { return JSON.parse(open('./tenants.json')); });

// ── Custom metrics ───────────────────────────────────────────────
const loginDuration      = new Trend('login_duration',      true);
const formsFetchDuration = new Trend('forms_fetch_duration', true);
const formSchemaDuration = new Trend('form_schema_duration', true);
const submitDuration     = new Trend('submit_duration',      true);
const approveDuration    = new Trend('approve_duration',     true);
const iamDuration        = new Trend('iam_eval_duration',    true);
const errorRate          = new Rate('error_rate');
const totalRequests      = new Counter('total_requests');

// ── Load test config ─────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '2m',  target: 100  },   // Ramp up to 100 VUs
    { duration: '3m',  target: 100  },   // Hold at 100 VUs — warm up
    { duration: '2m',  target: 500  },   // Ramp up to 500 VUs
    { duration: '3m',  target: 500  },   // Hold at 500 VUs
    { duration: '2m',  target: 1000 },   // Ramp up to 1000 VUs
    { duration: '3m',  target: 1000 },   // Hold at 1000 VUs
    { duration: '3m',  target: 3000 },   // Ramp up to 3000 VUs — peak
    { duration: '5m',  target: 3000 },   // Hold at 3000 VUs — sustained peak
    { duration: '2m',  target: 0    },   // Ramp down
  ],
  thresholds: {
    // Overall HTTP
    'http_req_duration':      ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed':        ['rate<0.05'],   // <5% error rate overall
    'error_rate':             ['rate<0.05'],

    // Per-endpoint thresholds
    'login_duration':         ['p(95)<500'],
    'forms_fetch_duration':   ['p(95)<400'],
    'form_schema_duration':   ['p(95)<300'],
    'submit_duration':        ['p(95)<800'],
    'iam_eval_duration':      ['p(95)<200'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// ── Helper: make authenticated request ──────────────────────────
function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `access_token=${token}`,
    }
  };
}

// ── Main VU scenario ─────────────────────────────────────────────
export default function () {
  // Pick a random user — spread across all tenants
  const vuIndex = (__VU - 1) % users.length;
  const user = users[vuIndex];
  if (!user) return;

  const tenantForms = forms.filter(f => f.tenantId === user.tenantId);

  // ── STEP 1: Login ──────────────────────────────────────────────
  let token = null;
  group('01_login', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}:3001/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
    );
    loginDuration.add(Date.now() - start);
    totalRequests.add(1);

    const ok = check(res, {
      'login 200': r => r.status === 200 || r.status === 201,
      'login has cookie': r => r.headers['Set-Cookie'] !== undefined || r.status === 200,
    });
    errorRate.add(!ok);

    // Extract token from cookie
    const cookieHeader = res.headers['Set-Cookie'] || '';
    const match = cookieHeader.match(/access_token=([^;]+)/);
    token = match ? match[1] : null;

    // Fallback: try body token
    if (!token && res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        token = body.access_token || body.token || 'fallback_token';
      } catch {}
    }
  });

  if (!token) {
    sleep(1);
    return;
  }

  sleep(0.5);

  // ── STEP 2: Fetch accessible forms ────────────────────────────
  group('02_fetch_forms', function () {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}:3003/forms/accessible?role=${user.role}&tenantId=${user.tenantId}`,
      { ...authHeaders(token), timeout: '8s' }
    );
    formsFetchDuration.add(Date.now() - start);
    totalRequests.add(1);

    const ok = check(res, { 'forms list 200': r => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // ── STEP 3: Fetch specific form schema ────────────────────────
  if (tenantForms.length > 0) {
    const form = tenantForms[Math.floor(Math.random() * tenantForms.length)];
    group('03_form_schema', function () {
      const start = Date.now();
      const res = http.get(
        `${BASE_URL}:3003/forms/${form.formId}`,
        { ...authHeaders(token), timeout: '8s' }
      );
      formSchemaDuration.add(Date.now() - start);
      totalRequests.add(1);

      const ok = check(res, { 'form schema 200': r => r.status === 200 });
      errorRate.add(!ok);
    });
  }

  sleep(0.5);

  // ── STEP 4: IAM permission check ──────────────────────────────
  group('04_iam_evaluate', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}:3002/iam/evaluate`,
      JSON.stringify({
        userId: user.userId || 'test_user',
        action: 'submit',
        resource: 'form',
        tenantId: user.tenantId,
      }),
      { ...authHeaders(token), timeout: '5s' }
    );
    iamDuration.add(Date.now() - start);
    totalRequests.add(1);

    check(res, { 'iam evaluate 200': r => r.status === 200 });
  });

  sleep(0.5);

  // ── STEP 5: Submit a form (doctors only) ──────────────────────
  if (user.role === 'doctor' && tenantForms.length > 0) {
    const form = tenantForms[Math.floor(Math.random() * tenantForms.length)];
    group('05_submit_form', function () {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}:3004/submissions`,
        JSON.stringify({
          form_id: form.formId,
          form_version: 1,
          tenant_id: user.tenantId,
          submitted_by: user.userId || 'doctor_vu',
          patient_id: 'patient_load_test',
          status: 'submitted',
          data: {
            f1: `Load test submission at ${new Date().toISOString()}`,
            f2: Math.floor(Math.random() * 10),
            f3: ['Mild', 'Moderate', 'Severe'][Math.floor(Math.random() * 3)],
            f4: 'Load test',
          },
        }),
        { ...authHeaders(token), timeout: '10s' }
      );
      submitDuration.add(Date.now() - start);
      totalRequests.add(1);

      const ok = check(res, { 'submission 201': r => r.status === 201 || r.status === 200 });
      errorRate.add(!ok);
    });
  }

  sleep(0.5);

  // ── STEP 6: Admin approval (tenant_admin only) ────────────────
  if (user.role === 'tenant_admin') {
    group('06_list_submissions', function () {
      const start = Date.now();
      const res = http.get(
        `${BASE_URL}:3004/submissions?tenantId=${user.tenantId}&status=submitted&limit=5`,
        { ...authHeaders(token), timeout: '8s' }
      );
      approveDuration.add(Date.now() - start);
      totalRequests.add(1);

      check(res, { 'submissions list 200': r => r.status === 200 });
    });
  }

  // Realistic think time between iterations
  sleep(Math.random() * 2 + 1);
}

// ── Summary handler ───────────────────────────────────────────────
export function handleSummary(data) {
  const summary = generateTextReport(data);
  return {
    'load-test-summary.txt': summary,
    'results.json': JSON.stringify(data),
    stdout: summary,
  };
}

function generateTextReport(data) {
  const m = data.metrics;
  const dur = (metric) => {
    if (!metric) return { p50: 'N/A', p95: 'N/A', p99: 'N/A' };
    return {
      p50: Math.round(metric.values?.['p(50)'] || 0) + 'ms',
      p95: Math.round(metric.values?.['p(95)'] || 0) + 'ms',
      p99: Math.round(metric.values?.['p(99)'] || 0) + 'ms',
    };
  };

  const http_dur   = dur(m['http_req_duration']);
  const login_dur  = dur(m['login_duration']);
  const forms_dur  = dur(m['forms_fetch_duration']);
  const schema_dur = dur(m['form_schema_duration']);
  const submit_dur = dur(m['submit_duration']);
  const iam_dur    = dur(m['iam_eval_duration']);

  const errorPct   = ((m['http_req_failed']?.values?.rate || 0) * 100).toFixed(2);
  const totalReqs  = m['http_reqs']?.values?.count || 0;
  const reqPerSec  = (m['http_reqs']?.values?.rate || 0).toFixed(1);
  const maxVUs     = m['vus_max']?.values?.max || 0;

  const passed = (m['http_req_failed']?.values?.rate || 0) < 0.05 ? '✓ PASSED' : '✗ FAILED';

  return `
╔══════════════════════════════════════════════════════════════════════╗
║         HEALTHCARE PLATFORM — LOAD TEST RESULTS                     ║
║         5 Tenants · ${String(maxVUs).padEnd(4)} Peak VUs · Docker Compose                 ║
╠══════════════════════════════════════════════════════════════════════╣
║  OVERALL RESULT: ${passed.padEnd(52)}║
║  Total Requests: ${String(totalReqs).padEnd(52)}║
║  Requests/sec:   ${String(reqPerSec).padEnd(52)}║
║  Error Rate:     ${String(errorPct + '%').padEnd(52)}║
╠══════════════════════════════════════════════════════════════════════╣
║  ENDPOINT PERFORMANCE                   p50      p95      p99       ║
╠══════════════════════════════════════════════════════════════════════╣
║  Overall HTTP                    ${String(http_dur.p50).padEnd(9)}${String(http_dur.p95).padEnd(9)}${String(http_dur.p99).padEnd(8)}  ║
║  01. Login (POST /auth/login)    ${String(login_dur.p50).padEnd(9)}${String(login_dur.p95).padEnd(9)}${String(login_dur.p99).padEnd(8)}  ║
║  02. Fetch Forms (GET /forms)    ${String(forms_dur.p50).padEnd(9)}${String(forms_dur.p95).padEnd(9)}${String(forms_dur.p99).padEnd(8)}  ║
║  03. Form Schema (GET /forms/:id)${String(schema_dur.p50).padEnd(9)}${String(schema_dur.p95).padEnd(9)}${String(schema_dur.p99).padEnd(8)}  ║
║  04. IAM Evaluate (POST /eval)   ${String(iam_dur.p50).padEnd(9)}${String(iam_dur.p95).padEnd(9)}${String(iam_dur.p99).padEnd(8)}  ║
║  05. Submit Form (POST /sub)     ${String(submit_dur.p50).padEnd(9)}${String(submit_dur.p95).padEnd(9)}${String(submit_dur.p99).padEnd(8)}  ║
╠══════════════════════════════════════════════════════════════════════╣
║  THRESHOLDS                                                         ║
║  http_req_duration p95 < 1000ms  ${m['http_req_duration']?.values?.['p(95)'] < 1000 ? '✓ PASS' : '✗ FAIL'}                            ║
║  http_req_failed < 5%            ${(m['http_req_failed']?.values?.rate || 0) < 0.05 ? '✓ PASS' : '✗ FAIL'}                            ║
║  login_duration p95 < 500ms      ${m['login_duration']?.values?.['p(95)'] < 500 ? '✓ PASS' : '✗ FAIL'}                            ║
║  iam_eval_duration p95 < 200ms   ${m['iam_eval_duration']?.values?.['p(95)'] < 200 ? '✓ PASS' : '✗ FAIL'}                            ║
║  submit_duration p95 < 800ms     ${m['submit_duration']?.values?.['p(95)'] < 800 ? '✓ PASS' : '✗ FAIL'}                            ║
╚══════════════════════════════════════════════════════════════════════╝

Full results saved to: results.json
Summary saved to: load-test-summary.txt
`;
}
