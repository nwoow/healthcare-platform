#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Healthcare Platform — Run Full Load Test on VM
# Run this INSIDE the GCP VM after setup-gcp-vm.sh completes
# Usage: bash run-load-test.sh
# ═══════════════════════════════════════════════════════════════

set -e
cd ~/healthcare-platform

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Healthcare Platform — Full Load Test Runner           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Check all services are running ──────────────────────────────
echo "▶ Step 1: Health checking all services..."
SERVICES=(
  "Auth:3001"
  "IAM:3002"
  "FormBuilder:3003"
  "Submission:3004"
  "Patient:3006"
  "Audit:3008"
  "Integration:3009"
  "Tenant:3010"
)

ALL_UP=true
for svc in "${SERVICES[@]}"; do
  NAME="${svc%%:*}"
  PORT="${svc##*:}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:$PORT/api/docs" --max-time 5 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
    echo "  ✓ $NAME (port $PORT)"
  else
    echo "  ✗ $NAME (port $PORT) — HTTP $HTTP_CODE — may not be running"
    ALL_UP=false
  fi
done

if [ "$ALL_UP" = false ]; then
  echo ""
  echo "  Some services are not responding. Attempting to start them..."
  for service in auth iam form-builder submission patient audit integration tenant; do
    if [ -f "services/$service/package.json" ]; then
      pm2 restart $service 2>/dev/null || true
    fi
  done
  echo "  Waiting 20 seconds for services to start..."
  sleep 20
fi

echo ""
echo "▶ Step 2: Checking Docker containers..."
sudo docker compose ps | grep -E "Up|running" | awk '{print "  ✓ "$1}' || true

# ── Seed the test data ───────────────────────────────────────────
echo ""
echo "▶ Step 3: Seeding test data (5 tenants, 300 users, 25 forms)..."
if [ -f "tenants.json" ]; then
  echo "  Seed data already exists. Skipping seed (delete *.json to re-seed)"
else
  node seed-load-test.js
fi

# ── Show VM resource status ──────────────────────────────────────
echo ""
echo "▶ Step 4: Current VM resource usage..."
echo "  RAM:"
free -h | awk '/Mem:/ {print "    Total: "$2"  Used: "$3"  Free: "$4}'
echo "  CPU cores: $(nproc)"
echo "  Disk:"
df -h / | awk 'NR==2 {print "    Total: "$2"  Used: "$3"  Free: "$4}'

# ── Run the k6 load test ─────────────────────────────────────────
echo ""
echo "▶ Step 5: Starting k6 load test..."
echo "  Profile: 0 → 100 → 500 → 1000 → 3000 VUs"
echo "  Duration: ~25 minutes total"
echo "  Output: results.json + load-test-summary.txt"
echo ""
echo "  Press Ctrl+C at any time to stop the test"
echo ""

START_TIME=$(date +%s)

k6 run \
  --out json=results.json \
  --env BASE_URL=http://localhost \
  load-test.js

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "▶ Step 6: Test complete. Duration: ${DURATION}s"

# ── Generate HTML report ─────────────────────────────────────────
echo ""
echo "▶ Step 7: Generating HTML report..."

cat results.json | node -e "
const fs = require('fs');
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
  const lines = data.trim().split('\n');
  const metrics = {};

  // Parse k6 JSON output
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'Point' && obj.metric) {
        if (!metrics[obj.metric]) metrics[obj.metric] = [];
        metrics[obj.metric].push(obj.data?.value || 0);
      }
    } catch {}
  }

  // Calculate stats
  const pct = (arr, p) => {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length * p / 100)] || 0);
  };
  const avg = arr => arr && arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const endpointMetrics = {
    'Login': metrics['login_duration'],
    'Fetch Forms': metrics['forms_fetch_duration'],
    'Form Schema': metrics['form_schema_duration'],
    'IAM Evaluate': metrics['iam_eval_duration'],
    'Submit Form': metrics['submit_duration'],
    'Approve': metrics['approve_duration'],
  };

  const totalReqs = metrics['http_reqs']?.length || 0;
  const failedReqs = (metrics['http_req_failed'] || []).filter(v => v === 1).length;
  const errorRate = totalReqs > 0 ? ((failedReqs / totalReqs) * 100).toFixed(2) : '0.00';
  const allDurations = metrics['http_req_duration'] || [];

  const rows = Object.entries(endpointMetrics)
    .filter(([, v]) => v && v.length > 0)
    .map(([name, vals]) => \`
      <tr>
        <td>\${name}</td>
        <td>\${avg(vals)}ms</td>
        <td>\${pct(vals, 50)}ms</td>
        <td class=\"\${pct(vals, 95) > 1000 ? 'fail' : 'pass'}\">\${pct(vals, 95)}ms</td>
        <td>\${pct(vals, 99)}ms</td>
        <td>\${vals.length}</td>
      </tr>\`).join('');

  const html = \`<!DOCTYPE html>
<html>
<head>
  <meta charset='UTF-8'>
  <title>Healthcare Platform — Load Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F0F4F8; color: #1A1A2E; }
    .header { background: linear-gradient(135deg, #1B3A5C, #0E7C7B); color: white; padding: 40px; }
    .header h1 { font-size: 2rem; margin-bottom: 8px; }
    .header p { opacity: 0.8; }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .kpi { background: white; border-radius: 12px; padding: 24px; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .kpi .label { font-size: 13px; color: #5A6A7A; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi .value { font-size: 2rem; font-weight: 700; margin: 8px 0 4px; }
    .kpi .sub { font-size: 12px; color: #5A6A7A; }
    .kpi.pass .value { color: #1B6B3A; }
    .kpi.fail .value { color: #C0392B; }
    .kpi.info .value { color: #0E7C7B; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    th { background: #1B3A5C; color: white; padding: 14px 16px; text-align: left; font-size: 13px; }
    td { padding: 12px 16px; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .pass { color: #1B6B3A; font-weight: 600; }
    .fail { color: #C0392B; font-weight: 600; }
    .section-title { font-size: 1.2rem; font-weight: 600; color: #1B3A5C; margin: 32px 0 16px; }
    .footer { text-align: center; padding: 32px; color: #5A6A7A; font-size: 13px; }
  </style>
</head>
<body>
  <div class='header'>
    <h1>Healthcare Platform — Load Test Report</h1>
    <p>5 Tenants · 3000 Peak Concurrent Users · Docker Compose on GCP VM · \${new Date().toLocaleString()}</p>
  </div>
  <div class='container'>
    <div class='kpi-grid'>
      <div class='kpi info'>
        <div class='label'>Total Requests</div>
        <div class='value'>\${totalReqs.toLocaleString()}</div>
        <div class='sub'>across all endpoints</div>
      </div>
      <div class='kpi info'>
        <div class='label'>Requests / sec</div>
        <div class='value'>\${(totalReqs / Math.max((Date.now() / 1000 - 1700000000), 1)).toFixed(0)}</div>
        <div class='sub'>peak throughput</div>
      </div>
      <div class='kpi \${parseFloat(errorRate) < 5 ? 'pass' : 'fail'}'>
        <div class='label'>Error Rate</div>
        <div class='value'>\${errorRate}%</div>
        <div class='sub'>threshold: &lt; 5%</div>
      </div>
      <div class='kpi \${pct(allDurations, 95) < 1000 ? 'pass' : 'fail'}'>
        <div class='label'>p95 Response Time</div>
        <div class='value'>\${pct(allDurations, 95)}ms</div>
        <div class='sub'>threshold: &lt; 1000ms</div>
      </div>
    </div>

    <div class='section-title'>Endpoint Performance Breakdown</div>
    <table>
      <thead>
        <tr><th>Endpoint</th><th>Avg</th><th>p50 (median)</th><th>p95</th><th>p99</th><th>Samples</th></tr>
      </thead>
      <tbody>\${rows}</tbody>
    </table>

    <div class='section-title'>Threshold Results</div>
    <table>
      <thead><tr><th>Threshold</th><th>Target</th><th>Actual</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Overall p95 response time</td><td>&lt; 1000ms</td><td>\${pct(allDurations, 95)}ms</td><td class='\${pct(allDurations, 95) < 1000 ? 'pass' : 'fail'}'>\${pct(allDurations, 95) < 1000 ? '✓ PASS' : '✗ FAIL'}</td></tr>
        <tr><td>Error rate</td><td>&lt; 5%</td><td>\${errorRate}%</td><td class='\${parseFloat(errorRate) < 5 ? 'pass' : 'fail'}'>\${parseFloat(errorRate) < 5 ? '✓ PASS' : '✗ FAIL'}</td></tr>
        <tr><td>Login p95</td><td>&lt; 500ms</td><td>\${pct(metrics['login_duration'] || [], 95)}ms</td><td class='\${pct(metrics['login_duration'] || [], 95) < 500 ? 'pass' : 'fail'}'>\${pct(metrics['login_duration'] || [], 95) < 500 ? '✓ PASS' : '✗ FAIL'}</td></tr>
        <tr><td>IAM Evaluate p95</td><td>&lt; 200ms</td><td>\${pct(metrics['iam_eval_duration'] || [], 95)}ms</td><td class='\${pct(metrics['iam_eval_duration'] || [], 95) < 200 ? 'pass' : 'fail'}'>\${pct(metrics['iam_eval_duration'] || [], 95) < 200 ? '✓ PASS' : '✗ FAIL'}</td></tr>
        <tr><td>Form Submit p95</td><td>&lt; 800ms</td><td>\${pct(metrics['submit_duration'] || [], 95)}ms</td><td class='\${pct(metrics['submit_duration'] || [], 95) < 800 ? 'pass' : 'fail'}'>\${pct(metrics['submit_duration'] || [], 95) < 800 ? '✓ PASS' : '✗ FAIL'}</td></tr>
      </tbody>
    </table>
  </div>
  <div class='footer'>Generated by k6 · Healthcare Platform Load Test · github.com/nwoow/healthcare-platform</div>
</body>
</html>\`;

  fs.writeFileSync('load-test-report.html', html);
  console.log('HTML report generated: load-test-report.html');
});
" 2>/dev/null || echo "  Note: HTML report generation failed, check results.json manually"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ALL DONE                                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Results files:"
echo "  ✓ load-test-summary.txt  — text summary with p50/p95/p99"
echo "  ✓ load-test-report.html  — visual HTML report"
echo "  ✓ results.json           — full raw k6 data"
echo ""
echo "  To download the HTML report to your laptop:"
INSTANCE_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "YOUR_VM_IP")
echo "  gcloud compute scp healthcare-loadtest:~/healthcare-platform/load-test-report.html . --zone=asia-south1-a"
echo ""
echo "  To stop the VM after testing (saves cost):"
echo "  gcloud compute instances stop healthcare-loadtest --zone=asia-south1-a"
echo ""
cat load-test-summary.txt 2>/dev/null || echo "  (Run the test first to see results)"
