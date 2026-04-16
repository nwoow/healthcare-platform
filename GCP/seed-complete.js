// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — Complete Clean Seed Script
// Deletes everything and creates fresh:
//   5 tenants × 60 users = 300 users
//   30 doctors + 20 nurses + 8 receptionists + 1 dept_admin per tenant
//   5 forms per tenant assigned to doctors
//   10 patients per tenant
//   5 submissions per tenant (doctors filling forms)
//
// Run: node seed-complete.js
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE = {
  AUTH:    'http://localhost:3001',
  IAM:     'http://localhost:3002',
  FORMS:   'http://localhost:3003',
  SUB:     'http://localhost:3004',
  PATIENT: 'http://localhost:3006',
  TENANT:  'http://localhost:3010',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(url, data) {
  const res = await axios.post(url, data, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return res.data;
}

async function get(url) {
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

async function sql(query) {
  try {
    const result = execSync(
      `sudo docker exec -i healthcare-platform-postgres-1 psql -U healthcare -d healthcare_platform -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return result;
  } catch (e) {
    return e.message;
  }
}

// ── TENANT DEFINITIONS ───────────────────────────────────────────
const TENANTS = [
  { name: 'Apollo Hospital',  subdomain: 'apollo',   adminEmail: 'admin@apollo.com',   adminName: 'Apollo Admin' },
  { name: 'Max Healthcare',   subdomain: 'max',      adminEmail: 'admin@max.com',      adminName: 'Max Admin' },
  { name: 'Fortis Hospital',  subdomain: 'fortis',   adminEmail: 'admin@fortis.com',   adminName: 'Fortis Admin' },
  { name: 'Manipal Hospital', subdomain: 'manipal',  adminEmail: 'admin@manipal.com',  adminName: 'Manipal Admin' },
  { name: 'Narayana Health',  subdomain: 'narayana', adminEmail: 'admin@narayana.com', adminName: 'Narayana Admin' },
];

// ── FORM TEMPLATES ───────────────────────────────────────────────
const FORMS = [
  {
    name: 'General OPD Consultation', specialty: 'general',
    sections: [{ id: 's1', title: 'Chief Complaint', fields: [
      { id: 'f1', type: 'textarea', label: 'Chief Complaint', required: true },
      { id: 'f2', type: 'slider',   label: 'Pain Scale (0-10)', min: 0, max: 10, required: true },
      { id: 'f3', type: 'dropdown', label: 'Severity', options: ['Mild', 'Moderate', 'Severe'], required: true },
      { id: 'f4', type: 'text',     label: 'Known Allergies', required: false },
    ]}]
  },
  {
    name: 'Gastroenterology Intake', specialty: 'gastroenterology',
    sections: [{ id: 's1', title: 'GI History', fields: [
      { id: 'f1', type: 'textarea', label: 'GI Symptoms', required: true },
      { id: 'f2', type: 'radio',    label: 'Previous Endoscopy', options: ['Yes', 'No'], required: true },
      { id: 'f3', type: 'slider',   label: 'Pain Scale', min: 0, max: 10, required: true },
      { id: 'f4', type: 'text',     label: 'Dietary History', required: false },
    ]}]
  },
  {
    name: 'Cardiology Assessment', specialty: 'cardiology',
    sections: [{ id: 's1', title: 'Cardiac History', fields: [
      { id: 'f1', type: 'textarea', label: 'Cardiac Symptoms', required: true },
      { id: 'f2', type: 'number',   label: 'Heart Rate (bpm)', required: true },
      { id: 'f3', type: 'radio',    label: 'Chest Pain', options: ['Yes', 'No'], required: true },
      { id: 'f4', type: 'dropdown', label: 'Risk Level', options: ['Low', 'Medium', 'High'], required: true },
    ]}]
  },
  {
    name: 'Nursing Assessment', specialty: 'nursing',
    sections: [{ id: 's1', title: 'Vitals', fields: [
      { id: 'f1', type: 'number',   label: 'Temperature (C)', required: true },
      { id: 'f2', type: 'number',   label: 'Pulse Rate', required: true },
      { id: 'f3', type: 'dropdown', label: 'Consciousness', options: ['Alert', 'Drowsy', 'Confused'], required: true },
      { id: 'f4', type: 'textarea', label: 'Nursing Notes', required: false },
    ]}]
  },
  {
    name: 'OPD Follow-up', specialty: 'general',
    sections: [{ id: 's1', title: 'Follow-up', fields: [
      { id: 'f1', type: 'textarea', label: 'Progress Since Last Visit', required: true },
      { id: 'f2', type: 'radio',    label: 'Medication Compliance', options: ['Yes', 'Partial', 'No'], required: true },
      { id: 'f3', type: 'slider',   label: 'Current Pain Level', min: 0, max: 10, required: true },
      { id: 'f4', type: 'dropdown', label: 'Overall Improvement', options: ['Much Better', 'Better', 'Same', 'Worse'], required: true },
    ]}]
  },
];

const PATIENT_NAMES = ['Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sunita Singh', 'Vikram Nair', 'Ananya Gupta', 'Suresh Verma', 'Meena Iyer', 'Arjun Reddy', 'Kavya Pillai'];

const SUBMISSION_DATA = [
  { f1: 'Persistent headache for 3 days, worse in the morning', f2: 6, f3: 'Moderate', f4: 'Penicillin' },
  { f1: 'Upper abdominal pain after meals, 2 weeks duration', f2: 5, f3: 'Mild', f4: 'None known' },
  { f1: 'Chest tightness on exertion, shortness of breath', f2: 7, f3: 'Severe', f4: 'Aspirin' },
  { f1: 'Fever 101F with body ache and chills since yesterday', f2: 7, f3: 'Moderate', f4: 'Sulfa drugs' },
  { f1: 'Lower back pain radiating to left leg, 1 week', f2: 5, f3: 'Moderate', f4: 'NSAIDs' },
];

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   Healthcare Platform — Complete Clean Seed Script    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // ── STEP 1: CLEAN EVERYTHING ──────────────────────────────────
  console.log('▶ Step 1: Cleaning existing data...');
  await sql('DELETE FROM refresh_tokens');
  await sql('DELETE FROM user_roles');
  await sql('DELETE FROM user_attributes');
  await sql('DELETE FROM users WHERE email NOT LIKE \'superadmin%\'');
  await sql('DELETE FROM tenant_provisioning_logs');
  await sql('DELETE FROM tenant_configs');
  await sql('DELETE FROM tenants');
  await sql('DELETE FROM patients');

  // Clean MongoDB via docker
  try {
    execSync(`sudo docker exec healthcare-platform-mongo-1 mongosh --quiet --eval "
      db.getSiblingDB('healthcare_forms').form_schemas.deleteMany({});
      db.getSiblingDB('healthcare_forms').form_versions.deleteMany({});
      db.getSiblingDB('healthcare_submissions').form_submissions.deleteMany({});
      db.getSiblingDB('healthcare_patients').patient_histories.deleteMany({});
      print('MongoDB cleaned');
    "`, { encoding: 'utf8', timeout: 30000 });
    console.log('  ✓ MongoDB cleaned');
  } catch (e) {
    console.log('  ⚠ MongoDB clean skipped:', e.message.slice(0, 50));
  }
  console.log('  ✓ PostgreSQL cleaned');

  // ── STEP 2: GET IAM ROLES ──────────────────────────────────────
  console.log('\n▶ Step 2: Fetching IAM roles...');
  const roles = await get(`${BASE.IAM}/iam/roles`);
  const roleMap = {};
  for (const r of roles) roleMap[r.name] = r.id;
  console.log('  Roles:', Object.keys(roleMap).join(', '));

  // ── STEP 3: CREATE TENANTS ─────────────────────────────────────
  console.log('\n▶ Step 3: Creating 5 tenants...');
  const createdTenants = [];

  for (const t of TENANTS) {
    try {
      const result = await post(`${BASE.TENANT}/tenants/onboard`, {
        name: t.name,
        subdomain: t.subdomain,
        adminEmail: t.adminEmail,
        adminName: t.adminName,
      });
      const tenantId = result.tenant?.id || result.id;
      const password = result.generatedPassword || 'Admin@123';
      createdTenants.push({ ...t, tenantId, adminPassword: password, adminUserId: result.adminUser?.id });
      console.log(`  ✓ ${t.name} — ${t.adminEmail} / ${password}`);
    } catch (e) {
      console.log(`  ✗ ${t.name}: ${e.response?.data?.message || e.message}`);
    }
    await sleep(1000);
  }

  if (createdTenants.length === 0) {
    console.log('  ✗ No tenants created. Stopping.');
    process.exit(1);
  }

  // ── STEP 4: CREATE USERS PER TENANT ───────────────────────────
  console.log('\n▶ Step 4: Creating users per tenant...');
  const allUsers = [];

  for (const tenant of createdTenants) {
    // Add admin
    allUsers.push({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      role: 'tenant_admin',
      tenantId: tenant.tenantId,
      name: tenant.adminName,
    });

    console.log(`  ${tenant.name}: Creating doctors...`);
    const doctorIds = [];

    // Create 30 doctors
    for (let i = 1; i <= 30; i++) {
      const email = `dr${i}@${tenant.subdomain}.com`;
      const password = `Doctor${i}@123`;
      try {
        const user = await post(`${BASE.AUTH}/auth/users`, {
          email, password,
          name: `Dr. ${tenant.subdomain.charAt(0).toUpperCase()}${tenant.subdomain.slice(1)} ${i}`,
          tenantId: tenant.tenantId,
          role: 'doctor',
        });
        // Fix tenant_id in DB directly
        await sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email = '${email}'`);
        // Assign doctor role
        if (user?.id && roleMap['doctor']) {
          await post(`${BASE.IAM}/iam/users/${user.id}/roles`, {
            roleId: roleMap['doctor'],
            tenantId: tenant.tenantId,
            assignedBy: 'system',
          }).catch(() => {});
        }
        allUsers.push({ email, password, role: 'doctor', tenantId: tenant.tenantId, userId: user?.id });
        doctorIds.push(user?.id);
      } catch {
        allUsers.push({ email, password, role: 'doctor', tenantId: tenant.tenantId });
      }
      await sleep(60);
    }

    // Create 20 nurses
    for (let i = 1; i <= 20; i++) {
      const email = `nurse${i}@${tenant.subdomain}.com`;
      const password = `Nurse${i}@123`;
      try {
        const user = await post(`${BASE.AUTH}/auth/users`, {
          email, password,
          name: `Nurse ${i}`,
          tenantId: tenant.tenantId,
          role: 'nurse',
        });
        await sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email = '${email}'`);
        if (user?.id && roleMap['nurse']) {
          await post(`${BASE.IAM}/iam/users/${user.id}/roles`, {
            roleId: roleMap['nurse'],
            tenantId: tenant.tenantId,
            assignedBy: 'system',
          }).catch(() => {});
        }
        allUsers.push({ email, password, role: 'nurse', tenantId: tenant.tenantId, userId: user?.id });
      } catch {
        allUsers.push({ email, password, role: 'nurse', tenantId: tenant.tenantId });
      }
      await sleep(60);
    }

    // Create 8 receptionists
    for (let i = 1; i <= 8; i++) {
      const email = `recep${i}@${tenant.subdomain}.com`;
      const password = `Recep${i}@123`;
      try {
        const user = await post(`${BASE.AUTH}/auth/users`, {
          email, password, name: `Receptionist ${i}`,
          tenantId: tenant.tenantId, role: 'receptionist',
        });
        await sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email = '${email}'`);
        allUsers.push({ email, password, role: 'receptionist', tenantId: tenant.tenantId });
      } catch {
        allUsers.push({ email, password, role: 'receptionist', tenantId: tenant.tenantId });
      }
      await sleep(60);
    }

    const tenantUsers = allUsers.filter(u => u.tenantId === tenant.tenantId);
    console.log(`  ✓ ${tenant.name}: ${tenantUsers.length} users created`);
  }

  // ── STEP 5: CREATE FORMS PER TENANT ───────────────────────────
  console.log('\n▶ Step 5: Creating forms per tenant...');
  const allForms = [];

  for (const tenant of createdTenants) {
    for (const formTemplate of FORMS) {
      try {
        const form = await post(`${BASE.FORMS}/forms`, {
          name: formTemplate.name,
          specialty: formTemplate.specialty,
          tenant_id: tenant.tenantId,
          sections: formTemplate.sections,
          // Assign to doctors AND nurses
          access_control: {
            roles: formTemplate.specialty === 'nursing'
              ? ['nurse', 'tenant_admin']
              : ['doctor', 'tenant_admin'],
          },
          layoutType: 'wizard',
        });
        const formId = form._id || form.id;
        await sleep(300);
        // Publish the form
        await post(`${BASE.FORMS}/forms/${formId}/publish`, {}).catch(() => {});
        allForms.push({
          formId,
          name: formTemplate.name,
          specialty: formTemplate.specialty,
          tenantId: tenant.tenantId,
        });
        await sleep(200);
      } catch (e) {
        console.log(`  ✗ ${formTemplate.name} for ${tenant.name}: ${e.response?.data?.message || e.message}`);
      }
    }
    const tenantForms = allForms.filter(f => f.tenantId === tenant.tenantId);
    console.log(`  ✓ ${tenant.name}: ${tenantForms.length} forms created`);
  }

  // ── STEP 6: CREATE PATIENTS PER TENANT ────────────────────────
  console.log('\n▶ Step 6: Creating patients per tenant...');
  const allPatients = [];

  for (const tenant of createdTenants) {
    for (let i = 0; i < 10; i++) {
      try {
        const patient = await post(`${BASE.PATIENT}/patients`, {
          tenantId: tenant.tenantId,
          name: PATIENT_NAMES[i],
          dob: `198${i}-0${(i % 9) + 1}-15`,
          gender: i % 2 === 0 ? 'male' : 'female',
          bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
          contactPhone: `+9198765${i}${i}${i}${i}`,
        });
        allPatients.push({
          patientId: patient.id || patient._id,
          name: PATIENT_NAMES[i],
          tenantId: tenant.tenantId,
        });
      } catch {}
      await sleep(150);
    }
    const tenantPatients = allPatients.filter(p => p.tenantId === tenant.tenantId);
    console.log(`  ✓ ${tenant.name}: ${tenantPatients.length} patients created`);
  }

  // ── STEP 7: CREATE SAMPLE SUBMISSIONS (DOCTORS FILLING FORMS) ──
  console.log('\n▶ Step 7: Creating sample submissions (doctors filling forms)...');
  let totalSubmissions = 0;

  for (const tenant of createdTenants) {
    const tenantDoctors = allUsers.filter(u => u.role === 'doctor' && u.tenantId === tenant.tenantId && u.userId);
    const tenantForms   = allForms.filter(f => f.tenantId === tenant.tenantId && f.specialty !== 'nursing');
    const tenantPatients = allPatients.filter(p => p.tenantId === tenant.tenantId);

    for (let i = 0; i < 5; i++) {
      const doctor  = tenantDoctors[i % Math.max(tenantDoctors.length, 1)];
      const form    = tenantForms[i % Math.max(tenantForms.length, 1)];
      const patient = tenantPatients[i % Math.max(tenantPatients.length, 1)];
      const data    = SUBMISSION_DATA[i % SUBMISSION_DATA.length];

      if (!form?.formId) continue;

      try {
        await post(`${BASE.SUB}/submissions`, {
          form_id:      form.formId,
          form_version: 1,
          tenant_id:    tenant.tenantId,
          submitted_by: doctor?.userId || 'doctor_seed',
          patient_id:   patient?.patientId || 'patient_seed',
          status:       'submitted',
          data: { f1: data.f1, f2: data.f2, f3: data.f3, f4: data.f4 },
        });
        totalSubmissions++;
      } catch {}
      await sleep(200);
    }
    console.log(`  ✓ ${tenant.name}: submissions created`);
  }

  // ── STEP 8: FIX ALL TENANT_IDs IN DB ──────────────────────────
  console.log('\n▶ Step 8: Fixing tenant_id assignments in DB...');
  for (const tenant of createdTenants) {
    const result = await sql(
      `UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email LIKE '%@${tenant.subdomain}.com' AND email != '${tenant.adminEmail}'; SELECT COUNT(*) FROM users WHERE tenant_id = '${tenant.tenantId}';`
    );
    console.log(`  ${tenant.name}: ${result.includes('rows') ? result.split('\n').find(l => /\d/.test(l))?.trim() : '?'} users`);
  }

  // ── STEP 9: SAVE FILES ─────────────────────────────────────────
  const tenantFile = createdTenants.map(t => ({
    tenantId: t.tenantId,
    name: t.name,
    subdomain: t.subdomain,
    adminEmail: t.adminEmail,
    adminPassword: t.adminPassword,
  }));

  fs.writeFileSync('tenants.json',  JSON.stringify(tenantFile, null, 2));
  fs.writeFileSync('users.json',    JSON.stringify(allUsers, null, 2));
  fs.writeFileSync('forms.json',    JSON.stringify(allForms, null, 2));
  fs.writeFileSync('patients.json', JSON.stringify(allPatients, null, 2));

  // ── FINAL SUMMARY ─────────────────────────────────────────────
  const doctors       = allUsers.filter(u => u.role === 'doctor');
  const nurses        = allUsers.filter(u => u.role === 'nurse');
  const admins        = allUsers.filter(u => u.role === 'tenant_admin');

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   SEEDING COMPLETE                                    ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`  Tenants:     ${createdTenants.length}`);
  console.log(`  Admins:      ${admins.length}`);
  console.log(`  Doctors:     ${doctors.length}`);
  console.log(`  Nurses:      ${nurses.length}`);
  console.log(`  Total Users: ${allUsers.length}`);
  console.log(`  Forms:       ${allForms.length} (${allForms.length/createdTenants.length} per tenant)`);
  console.log(`  Patients:    ${allPatients.length} (${allPatients.length/createdTenants.length} per tenant)`);
  console.log(`  Submissions: ${totalSubmissions}`);
  console.log('\n  CREDENTIALS:');
  for (const t of createdTenants) {
    console.log(`  ${t.name}:`);
    console.log(`    Admin:  ${t.adminEmail} / ${t.adminPassword}`);
    console.log(`    Doctor: dr1@${t.subdomain}.com / Doctor1@123`);
    console.log(`    Nurse:  nurse1@${t.subdomain}.com / Nurse1@123`);
  }
  console.log('\n  FILES SAVED: tenants.json, users.json, forms.json, patients.json');
  console.log('\n  NEXT: k6 run --out json=results.json load-test-realistic.js\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
