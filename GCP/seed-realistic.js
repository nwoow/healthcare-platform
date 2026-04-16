// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — Realistic Seed Script
// Creates 5 tenants × 60 users each = 300 users
// Each tenant has: 1 admin, 30 doctors, 20 nurses, 8 receptionists, 1 dept admin
// Also creates 5 forms per tenant and 10 patients per tenant
// Run: node seed-realistic.js
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');
const fs = require('fs');

const BASE = {
  AUTH:   'http://localhost:3001',
  IAM:    'http://localhost:3002',
  FORMS:  'http://localhost:3003',
  SUB:    'http://localhost:3004',
  PATIENT:'http://localhost:3006',
  TENANT: 'http://localhost:3010',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const TENANTS = [
  { tenantId: 'ba8d6dcb-d90c-440c-8df9-ceb8c66959cd', name: 'Apollo Hospital',   subdomain: 'apollo',   adminEmail: 'admin@apollo.com',   adminPassword: 'ApolloAdmin5255!' },
  { tenantId: '453a4671-9d37-49f6-b1a6-1ce049594273', name: 'Max Healthcare',    subdomain: 'max',      adminEmail: 'admin@max.com',      adminPassword: 'MaxAdmin2766!' },
  { tenantId: '5eebbb9d-7617-467d-9c54-5d4c6d16ad78', name: 'Fortis Hospital',   subdomain: 'fortis',   adminEmail: 'admin@fortis.com',   adminPassword: 'FortisAdmin4414!' },
  { tenantId: 'b5199c2c-8d00-4a5d-b5fa-febc9d5195dd', name: 'Manipal Hospital',  subdomain: 'manipal',  adminEmail: 'admin@manipal.com',  adminPassword: 'ManipalAdmin4949!' },
  { tenantId: '63246526-1b3b-4cd0-a9e9-665534d7e594', name: 'Narayana Health',   subdomain: 'narayana', adminEmail: 'admin@narayana.com', adminPassword: 'NarayanaAdmin2660!' },
];

const FORM_TEMPLATES = [
  {
    name: 'General OPD Consultation',
    specialty: 'general',
    sections: [{
      id: 's1', title: 'Chief Complaint',
      fields: [
        { id: 'f1', type: 'textarea', label: 'Chief Complaint', required: true },
        { id: 'f2', type: 'slider',   label: 'Pain Scale (0-10)', min: 0, max: 10, required: true },
        { id: 'f3', type: 'dropdown', label: 'Severity', options: ['Mild', 'Moderate', 'Severe'], required: true },
        { id: 'f4', type: 'radio',    label: 'Duration', options: ['Less than 1 day', '1 to 7 days', 'More than 1 week'], required: true },
        { id: 'f5', type: 'text',     label: 'Known Allergies', required: false },
      ]
    }]
  },
  {
    name: 'Gastroenterology Intake',
    specialty: 'gastroenterology',
    sections: [{
      id: 's1', title: 'GI History',
      fields: [
        { id: 'f1', type: 'textarea',  label: 'GI Symptoms Description', required: true },
        { id: 'f2', type: 'radio',     label: 'Previous Endoscopy', options: ['Yes', 'No'], required: true },
        { id: 'f3', type: 'slider',    label: 'Abdominal Pain Scale', min: 0, max: 10, required: true },
        { id: 'f4', type: 'checkbox',  label: 'Current Symptoms', options: ['Nausea', 'Vomiting', 'Bloating', 'Diarrhea', 'Constipation'], required: false },
        { id: 'f5', type: 'textarea',  label: 'Dietary History', required: false },
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
        { id: 'f2', type: 'number',   label: 'Resting Heart Rate (bpm)', required: true },
        { id: 'f3', type: 'number',   label: 'Blood Pressure Systolic', required: true },
        { id: 'f4', type: 'radio',    label: 'Chest Pain Present', options: ['Yes', 'No'], required: true },
        { id: 'f5', type: 'dropdown', label: 'Risk Level', options: ['Low', 'Medium', 'High'], required: true },
      ]
    }]
  },
  {
    name: 'Nursing Assessment',
    specialty: 'nursing',
    sections: [{
      id: 's1', title: 'Vitals',
      fields: [
        { id: 'f1', type: 'number',   label: 'Temperature (Celsius)', required: true },
        { id: 'f2', type: 'number',   label: 'Pulse Rate (bpm)', required: true },
        { id: 'f3', type: 'number',   label: 'Respiratory Rate', required: true },
        { id: 'f4', type: 'dropdown', label: 'Consciousness Level', options: ['Alert', 'Drowsy', 'Confused', 'Unconscious'], required: true },
        { id: 'f5', type: 'textarea', label: 'Nursing Notes', required: false },
      ]
    }]
  },
  {
    name: 'OPD Follow-up',
    specialty: 'general',
    sections: [{
      id: 's1', title: 'Follow-up',
      fields: [
        { id: 'f1', type: 'textarea', label: 'Progress Since Last Visit', required: true },
        { id: 'f2', type: 'radio',    label: 'Medication Compliance', options: ['Yes', 'Partial', 'No'], required: true },
        { id: 'f3', type: 'slider',   label: 'Current Pain Level', min: 0, max: 10, required: true },
        { id: 'f4', type: 'dropdown', label: 'Overall Improvement', options: ['Much Better', 'Better', 'Same', 'Worse'], required: true },
        { id: 'f5', type: 'textarea', label: 'Doctor Notes', required: false },
      ]
    }]
  },
];

const SAMPLE_DATA = [
  { f1: 'Patient reports persistent headache for past 3 days', f2: 6, f3: 'Moderate', f4: 'Less than 1 day', f5: 'Penicillin' },
  { f1: 'Upper abdominal pain after meals, recurring for 2 weeks', f2: 5, f3: 'Mild', f4: '1 to 7 days', f5: 'None known' },
  { f1: 'Severe chest tightness and shortness of breath', f2: 8, f3: 'Severe', f4: 'Less than 1 day', f5: 'Aspirin' },
  { f1: 'Chronic lower back pain, worsens with sitting', f2: 4, f3: 'Moderate', f4: 'More than 1 week', f5: 'None known' },
  { f1: 'Fever with body ache, onset yesterday morning', f2: 7, f3: 'Moderate', f4: 'Less than 1 day', f5: 'Sulfa drugs' },
];

async function apiPost(url, data) {
  try {
    const res = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

async function apiGet(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Healthcare Platform — Realistic Data Seeder      ║');
  console.log('║   5 tenants × 60 users = 300 doctors + nurses     ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const allUsers = [];
  const allForms = [];
  const allPatients = [];

  // Get IAM roles
  console.log('▶ Fetching IAM roles...');
  const roles = await apiGet(`${BASE.IAM}/iam/roles`) || [];
  const roleMap = {};
  for (const r of roles) roleMap[r.name] = r.id;
  console.log('  Roles found:', Object.keys(roleMap).join(', '));

  for (const tenant of TENANTS) {
    console.log(`\n▶ Processing tenant: ${tenant.name}`);

    // Add admin user
    allUsers.push({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      role: 'tenant_admin',
      tenantId: tenant.tenantId,
      name: `${tenant.name} Admin`,
    });

    // ── CREATE DOCTORS ──────────────────────────────────────────
    console.log(`  Creating 30 doctors...`);
    for (let i = 1; i <= 30; i++) {
      const email = `dr${i}@${tenant.subdomain}.com`;
      const password = `Doctor${i}@123`;
      const name = `Dr. Doctor ${i}`;
      try {
        const user = await apiPost(`${BASE.AUTH}/auth/users`, {
          email, password, name,
          tenantId: tenant.tenantId,
          role: 'doctor',
        });
        if (user?.id && roleMap['doctor']) {
          await apiPost(`${BASE.IAM}/iam/users/${user.id}/roles`, {
            roleId: roleMap['doctor'],
            tenantId: tenant.tenantId,
            assignedBy: 'system',
          }).catch(() => {});
        }
        allUsers.push({ email, password, role: 'doctor', tenantId: tenant.tenantId, userId: user?.id, name });
      } catch {
        allUsers.push({ email, password, role: 'doctor', tenantId: tenant.tenantId, name });
      }
      await sleep(80);
    }

    // ── CREATE NURSES ───────────────────────────────────────────
    console.log(`  Creating 20 nurses...`);
    for (let i = 1; i <= 20; i++) {
      const email = `nurse${i}@${tenant.subdomain}.com`;
      const password = `Nurse${i}@123`;
      const name = `Nurse ${i}`;
      try {
        const user = await apiPost(`${BASE.AUTH}/auth/users`, {
          email, password, name,
          tenantId: tenant.tenantId,
          role: 'nurse',
        });
        if (user?.id && roleMap['nurse']) {
          await apiPost(`${BASE.IAM}/iam/users/${user.id}/roles`, {
            roleId: roleMap['nurse'],
            tenantId: tenant.tenantId,
            assignedBy: 'system',
          }).catch(() => {});
        }
        allUsers.push({ email, password, role: 'nurse', tenantId: tenant.tenantId, userId: user?.id, name });
      } catch {
        allUsers.push({ email, password, role: 'nurse', tenantId: tenant.tenantId, name });
      }
      await sleep(80);
    }

    // ── CREATE RECEPTIONISTS ────────────────────────────────────
    console.log(`  Creating 8 receptionists...`);
    for (let i = 1; i <= 8; i++) {
      const email = `recep${i}@${tenant.subdomain}.com`;
      const password = `Recep${i}@123`;
      allUsers.push({ email, password, role: 'receptionist', tenantId: tenant.tenantId, name: `Receptionist ${i}` });
      await sleep(50);
    }

    // ── CREATE FORMS ────────────────────────────────────────────
    console.log(`  Creating 5 forms...`);
    for (const template of FORM_TEMPLATES) {
      try {
        const form = await apiPost(`${BASE.FORMS}/forms`, {
          name: template.name,
          specialty: template.specialty,
          tenant_id: tenant.tenantId,
          sections: template.sections,
          access_control: { roles: ['doctor', 'nurse', 'tenant_admin'] },
          layoutType: 'wizard',
        });
        const formId = form._id || form.id || form.form_id;
        await sleep(300);
        await apiPost(`${BASE.FORMS}/forms/${formId}/publish`, {}).catch(() => {});
        allForms.push({ formId, name: template.name, tenantId: tenant.tenantId });
        await sleep(200);
      } catch (e) {
        console.log(`    ✗ Form error: ${e.message}`);
      }
    }

    // ── CREATE PATIENTS ─────────────────────────────────────────
    console.log(`  Creating 10 patients...`);
    const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Ananya', 'Suresh', 'Meena', 'Arjun', 'Kavya'];
    for (let i = 0; i < 10; i++) {
      try {
        const patient = await apiPost(`${BASE.PATIENT}/patients`, {
          tenantId: tenant.tenantId,
          name: `${firstNames[i]} Kumar`,
          dob: `198${i}-0${(i % 9) + 1}-15`,
          gender: i % 2 === 0 ? 'male' : 'female',
          bloodGroup: ['A+', 'B+', 'O+', 'AB+'][i % 4],
          contactPhone: `+919876${tenant.subdomain.slice(0,2).toUpperCase()}${i}${i}${i}`,
        });
        allPatients.push({ patientId: patient.id || patient._id, tenantId: tenant.tenantId });
      } catch {}
      await sleep(150);
    }

    const doctorCount = allUsers.filter(u => u.role === 'doctor' && u.tenantId === tenant.tenantId).length;
    const formCount = allForms.filter(f => f.tenantId === tenant.tenantId).length;
    console.log(`  ✓ ${tenant.name}: ${doctorCount} doctors, ${formCount} forms, 10 patients`);
  }

  // Save all files
  fs.writeFileSync('tenants.json', JSON.stringify(TENANTS, null, 2));
  fs.writeFileSync('users.json', JSON.stringify(allUsers, null, 2));
  fs.writeFileSync('forms.json', JSON.stringify(allForms, null, 2));
  fs.writeFileSync('patients.json', JSON.stringify(allPatients, null, 2));

  const doctors = allUsers.filter(u => u.role === 'doctor');
  const nurses = allUsers.filter(u => u.role === 'nurse');

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   SEEDING COMPLETE                                  ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`  Total users:    ${allUsers.length}`);
  console.log(`  Doctors:        ${doctors.length}`);
  console.log(`  Nurses:         ${nurses.length}`);
  console.log(`  Forms:          ${allForms.length}`);
  console.log(`  Patients:       ${allPatients.length}`);
  console.log('\n  Sample doctor credentials:');
  console.log(`  ${doctors[0]?.email} / ${doctors[0]?.password}`);
  console.log(`  ${doctors[1]?.email} / ${doctors[1]?.password}`);
  console.log('\n  Run: k6 run --out json=results.json load-test-realistic.js\n');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
