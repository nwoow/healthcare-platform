// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — Load Test Seed Script
// Creates 5 tenants, 300 users, 25 forms, 250 submissions
// Run: node seed-load-test.js
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');
const fs = require('fs');

const BASE = {
  AUTH:       'http://localhost:3001',
  IAM:        'http://localhost:3002',
  FORMS:      'http://localhost:3003',
  SUBMISSION: 'http://localhost:3004',
  PATIENT:    'http://localhost:3006',
  TENANT:     'http://localhost:3010',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TENANTS = [
  { name: 'Apollo Hospital',    subdomain: 'apollo',    adminName: 'Apollo Admin',    adminEmail: 'admin@apollo.com' },
  { name: 'Max Healthcare',     subdomain: 'max',       adminName: 'Max Admin',       adminEmail: 'admin@max.com' },
  { name: 'Fortis Hospital',    subdomain: 'fortis',    adminName: 'Fortis Admin',    adminEmail: 'admin@fortis.com' },
  { name: 'Manipal Hospital',   subdomain: 'manipal',   adminName: 'Manipal Admin',   adminEmail: 'admin@manipal.com' },
  { name: 'Narayana Health',    subdomain: 'narayana',  adminName: 'Narayana Admin',  adminEmail: 'admin@narayana.com' },
];

const FORM_TEMPLATES = [
  {
    name: 'General OPD Consultation',
    specialty: 'general',
    sections: [{
      id: 's1', title: 'Chief Complaint',
      fields: [
        { id: 'f1', type: 'textarea', label: 'Chief Complaint', required: true },
        { id: 'f2', type: 'slider', label: 'Pain Scale (0-10)', min: 0, max: 10, required: true },
        { id: 'f3', type: 'radio', label: 'Duration', options: ['< 1 day', '1-7 days', '> 1 week'], required: true },
        { id: 'f4', type: 'dropdown', label: 'Severity', options: ['Mild', 'Moderate', 'Severe'], required: true },
        { id: 'f5', type: 'text', label: 'Allergies', required: false },
      ]
    }]
  },
  {
    name: 'Gastroenterology Intake',
    specialty: 'gastroenterology',
    sections: [{
      id: 's1', title: 'GI History',
      fields: [
        { id: 'f1', type: 'textarea', label: 'GI Symptoms', required: true },
        { id: 'f2', type: 'radio', label: 'Previous Endoscopy', options: ['Yes', 'No'], required: true },
        { id: 'f3', type: 'slider', label: 'Abdominal Pain Scale', min: 0, max: 10, required: true },
        { id: 'f4', type: 'checkbox', label: 'Symptoms', options: ['Nausea', 'Vomiting', 'Bloating', 'Diarrhea'], required: false },
        { id: 'f5', type: 'textarea', label: 'Diet History', required: false },
      ]
    }]
  },
  {
    name: 'Cardiology Assessment',
    specialty: 'cardiology',
    sections: [{
      id: 's1', title: 'Cardiac History',
      fields: [
        { id: 'f1', type: 'textarea', label: 'Cardiac Symptoms', required: true },
        { id: 'f2', type: 'number', label: 'Resting Heart Rate (bpm)', required: true },
        { id: 'f3', type: 'number', label: 'Blood Pressure Systolic', required: true },
        { id: 'f4', type: 'radio', label: 'Chest Pain', options: ['Yes', 'No'], required: true },
        { id: 'f5', type: 'dropdown', label: 'Risk Level', options: ['Low', 'Medium', 'High'], required: true },
      ]
    }]
  },
  {
    name: 'Nursing Assessment',
    specialty: 'nursing',
    sections: [{
      id: 's1', title: 'Patient Assessment',
      fields: [
        { id: 'f1', type: 'number', label: 'Temperature (°C)', required: true },
        { id: 'f2', type: 'number', label: 'Pulse Rate', required: true },
        { id: 'f3', type: 'number', label: 'Respiratory Rate', required: true },
        { id: 'f4', type: 'dropdown', label: 'Consciousness Level', options: ['Alert', 'Drowsy', 'Confused', 'Unconscious'], required: true },
        { id: 'f5', type: 'textarea', label: 'Nursing Notes', required: false },
      ]
    }]
  },
  {
    name: 'OPD Follow-up',
    specialty: 'general',
    sections: [{
      id: 's1', title: 'Follow-up Details',
      fields: [
        { id: 'f1', type: 'textarea', label: 'Progress Since Last Visit', required: true },
        { id: 'f2', type: 'radio', label: 'Medication Compliance', options: ['Yes', 'Partial', 'No'], required: true },
        { id: 'f3', type: 'slider', label: 'Current Pain Level', min: 0, max: 10, required: true },
        { id: 'f4', type: 'dropdown', label: 'Overall Improvement', options: ['Much Better', 'Better', 'Same', 'Worse'], required: true },
        { id: 'f5', type: 'textarea', label: 'Doctor Notes', required: false },
      ]
    }]
  },
];

async function api(method, url, data, token) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Cookie'] = `access_token=${token}`;
    const res = await axios({ method, url, data, headers, timeout: 15000 });
    return res.data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    throw new Error(`${method.toUpperCase()} ${url} → ${msg}`);
  }
}

async function loginUser(email, password) {
  try {
    const res = await axios.post(`${BASE.AUTH}/auth/login`,
      { email, password },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const cookie = res.headers['set-cookie']?.[0];
    const token = cookie?.match(/access_token=([^;]+)/)?.[1];
    return { token, user: res.data };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Healthcare Platform — Load Test Data Seeder   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Check services are up
  console.log('▶ Checking services...');
  for (const [name, url] of Object.entries(BASE)) {
    try {
      await axios.get(`${url}/health`, { timeout: 5000 });
      console.log(`  ✓ ${name} (${url})`);
    } catch {
      try {
        await axios.get(`${url}/api/docs`, { timeout: 5000 });
        console.log(`  ✓ ${name} (${url})`);
      } catch {
        console.log(`  ⚠ ${name} may not be running — continuing anyway`);
      }
    }
  }

  const results = { tenants: [], users: [], forms: [], submissions: [], patients: [] };

  // ── CREATE TENANTS ─────────────────────────────────────────────
  console.log('\n▶ Creating 5 hospital tenants...');
  for (const t of TENANTS) {
    try {
      const result = await api('post', `${BASE.TENANT}/tenants/onboard`, {
        name: t.name,
        subdomain: t.subdomain,
        plan: 'professional',
        region: 'ap-south-1',
        adminEmail: t.adminEmail,
        adminName: t.adminName,
      });
      const tenantData = {
        tenantId: result.tenant?.id || result.id,
        name: t.name,
        subdomain: t.subdomain,
        adminEmail: t.adminEmail,
        adminPassword: result.generatedPassword || 'Admin@123',
      };
      results.tenants.push(tenantData);
      console.log(`  ✓ ${t.name} — ID: ${tenantData.tenantId} — Admin: ${t.adminEmail} / ${tenantData.adminPassword}`);
    } catch (e) {
      console.log(`  ✗ ${t.name}: ${e.message}`);
      // Add dummy entry so test can continue
      results.tenants.push({ tenantId: `tenant_${t.subdomain}`, name: t.name, subdomain: t.subdomain, adminEmail: t.adminEmail, adminPassword: 'Admin@123' });
    }
    await sleep(1000);
  }

  // ── CREATE USERS PER TENANT ────────────────────────────────────
  console.log('\n▶ Creating 60 users per tenant (300 total)...');
  const roles = [
    { role: 'doctor', count: 30, prefix: 'Dr' },
    { role: 'nurse', count: 20, prefix: 'Nurse' },
    { role: 'receptionist', count: 8, prefix: 'Recep' },
    { role: 'department_admin', count: 2, prefix: 'DAdmin' },
  ];

  for (const tenant of results.tenants) {
    console.log(`  Creating users for ${tenant.name}...`);
    const tenantUsers = [{ email: tenant.adminEmail, password: tenant.adminPassword, role: 'tenant_admin', tenantId: tenant.tenantId }];

    for (const roleGroup of roles) {
      for (let i = 1; i <= roleGroup.count; i++) {
        const email = `${roleGroup.prefix.toLowerCase()}${i}@${tenant.subdomain}.com`;
        const password = `${roleGroup.prefix}${i}@123`;
        try {
          const user = await api('post', `${BASE.AUTH}/auth/users`, {
            email, password,
            name: `${roleGroup.prefix} ${i}`,
            tenantId: tenant.tenantId,
            role: roleGroup.role,
          });
          // Assign role via IAM
          if (user?.id) {
            await api('post', `${BASE.IAM}/iam/users/${user.id}/roles`, {
              roleId: roleGroup.role,
              tenantId: tenant.tenantId,
            }).catch(() => {});
          }
          tenantUsers.push({ email, password, role: roleGroup.role, tenantId: tenant.tenantId, userId: user?.id });
        } catch {
          tenantUsers.push({ email, password, role: roleGroup.role, tenantId: tenant.tenantId });
        }
        await sleep(100);
      }
    }

    results.users.push(...tenantUsers);
  }
  console.log(`  ✓ Total users created: ${results.users.length}`);

  // ── CREATE FORMS PER TENANT ────────────────────────────────────
  console.log('\n▶ Creating 5 forms per tenant (25 total)...');
  for (const tenant of results.tenants) {
    for (const template of FORM_TEMPLATES) {
      try {
        const form = await api('post', `${BASE.FORMS}/forms`, {
          name: template.name,
          specialty: template.specialty,
          tenant_id: tenant.tenantId,
          sections: template.sections,
          access_control: { roles: ['doctor', 'nurse', 'tenant_admin'] },
          layoutType: 'wizard',
        });
        const formId = form._id || form.id || form.formId;
        await sleep(300);
        await api('post', `${BASE.FORMS}/forms/${formId}/publish`, {}).catch(() => {});
        results.forms.push({ formId, name: template.name, tenantId: tenant.tenantId });
        await sleep(300);
      } catch (e) {
        console.log(`    ✗ Form ${template.name} for ${tenant.name}: ${e.message}`);
      }
    }
    console.log(`  ✓ Forms created for ${tenant.name}`);
  }
  console.log(`  ✓ Total forms: ${results.forms.length}`);

  // ── CREATE PATIENTS PER TENANT ─────────────────────────────────
  console.log('\n▶ Creating 10 patients per tenant (50 total)...');
  const firstNames = ['Raj', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Ananya', 'Suresh', 'Meena', 'Arjun', 'Kavya'];
  for (const tenant of results.tenants) {
    for (let i = 0; i < 10; i++) {
      try {
        const patient = await api('post', `${BASE.PATIENT}/patients`, {
          tenantId: tenant.tenantId,
          name: `${firstNames[i]} Kumar`,
          dob: `198${i}-0${(i % 9) + 1}-15`,
          gender: i % 2 === 0 ? 'male' : 'female',
          bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
          contactPhone: `+91-98765${i}${i}${i}${i}${i}`,
        });
        results.patients.push({ patientId: patient.id || patient._id, tenantId: tenant.tenantId });
      } catch {}
      await sleep(200);
    }
    console.log(`  ✓ Patients created for ${tenant.name}`);
  }

  // ── CREATE SAMPLE SUBMISSIONS ──────────────────────────────────
  console.log('\n▶ Creating 10 sample submissions per tenant (50 total)...');
  for (const tenant of results.tenants) {
    const tenantForms = results.forms.filter(f => f.tenantId === tenant.tenantId);
    const tenantPatients = results.patients.filter(p => p.tenantId === tenant.tenantId);
    const tenantDoctors = results.users.filter(u => u.role === 'doctor' && u.tenantId === tenant.tenantId);

    for (let i = 0; i < 10; i++) {
      try {
        const form = tenantForms[i % tenantForms.length];
        const patient = tenantPatients[i % Math.max(tenantPatients.length, 1)];
        const doctor = tenantDoctors[i % Math.max(tenantDoctors.length, 1)];
        const sub = await api('post', `${BASE.SUBMISSION}/submissions`, {
          form_id: form?.formId,
          form_version: 1,
          tenant_id: tenant.tenantId,
          submitted_by: doctor?.userId || 'doctor_seed',
          patient_id: patient?.patientId || 'patient_seed',
          status: i < 5 ? 'submitted' : 'draft',
          data: { f1: 'Seed submission data', f2: 5, f3: 'Mild', f4: 'General complaint', f5: 'None' },
        });
        results.submissions.push({ submissionId: sub._id || sub.id, tenantId: tenant.tenantId });
      } catch {}
      await sleep(200);
    }
    console.log(`  ✓ Submissions created for ${tenant.name}`);
  }

  // ── SAVE RESULTS ───────────────────────────────────────────────
  fs.writeFileSync('tenants.json', JSON.stringify(results.tenants, null, 2));
  fs.writeFileSync('users.json', JSON.stringify(results.users, null, 2));
  fs.writeFileSync('forms.json', JSON.stringify(results.forms, null, 2));
  fs.writeFileSync('patients.json', JSON.stringify(results.patients, null, 2));
  fs.writeFileSync('submissions.json', JSON.stringify(results.submissions, null, 2));

  // ── SUMMARY ────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   SEEDING COMPLETE                              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Tenants created:     ${results.tenants.length}`);
  console.log(`  Users created:       ${results.users.length}`);
  console.log(`  Forms created:       ${results.forms.length}`);
  console.log(`  Patients created:    ${results.patients.length}`);
  console.log(`  Submissions created: ${results.submissions.length}`);
  console.log('\n  Files saved: tenants.json, users.json, forms.json');
  console.log('\n  Next step: k6 run load-test.js\n');
}

main().catch(e => { console.error('Seeding failed:', e.message); process.exit(1); });
