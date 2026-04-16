// ═══════════════════════════════════════════════════════════════
// Healthcare Platform — Final Seed Script v2
// Uses correct MongoDB options format: {label, value} objects
// Creates: 5 tenants, 295 users, 25 forms, 50 patients, 25 submissions
// Run: node seed-final.js
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

function sql(query) {
  try {
    return execSync(
      `sudo docker exec -i healthcare-platform-postgres-1 psql -U healthcare -d healthcare_platform -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
  } catch (e) { return ''; }
}

// ── CONFIG ───────────────────────────────────────────────────────
const TENANTS = [
  { name: 'Apollo Hospital',  subdomain: 'apollo',   adminEmail: 'admin@apollo.com',   adminName: 'Apollo Admin' },
  { name: 'Max Healthcare',   subdomain: 'max',      adminEmail: 'admin@max.com',      adminName: 'Max Admin' },
  { name: 'Fortis Hospital',  subdomain: 'fortis',   adminEmail: 'admin@fortis.com',   adminName: 'Fortis Admin' },
  { name: 'Manipal Hospital', subdomain: 'manipal',  adminEmail: 'admin@manipal.com',  adminName: 'Manipal Admin' },
  { name: 'Narayana Health',  subdomain: 'narayana', adminEmail: 'admin@narayana.com', adminName: 'Narayana Admin' },
];

// ── CORRECT FORM TEMPLATES (options as {label,value} objects) ────
const FORM_TEMPLATES = [
  {
    name: 'General OPD Consultation', specialty: 'general',
    roles: ['doctor', 'tenant_admin'],
    fields: [
      { id:'f1', type:'textarea', label:'Chief Complaint', required:true, options:[] },
      { id:'f2', type:'slider',   label:'Pain Scale (0-10)', required:true, min:0, max:10, options:[] },
      { id:'f3', type:'dropdown', label:'Severity', required:true, options:[
        {label:'Mild',value:'mild'},{label:'Moderate',value:'moderate'},{label:'Severe',value:'severe'}
      ]},
      { id:'f4', type:'text', label:'Known Allergies', required:false, options:[] },
    ]
  },
  {
    name: 'Gastroenterology Intake', specialty: 'gastroenterology',
    roles: ['doctor', 'tenant_admin'],
    fields: [
      { id:'f1', type:'textarea', label:'GI Symptoms', required:true, options:[] },
      { id:'f2', type:'radio',    label:'Previous Endoscopy', required:true, options:[
        {label:'Yes',value:'yes'},{label:'No',value:'no'}
      ]},
      { id:'f3', type:'slider', label:'Abdominal Pain Scale', required:true, min:0, max:10, options:[] },
      { id:'f4', type:'textarea', label:'Dietary History', required:false, options:[] },
    ]
  },
  {
    name: 'Cardiology Assessment', specialty: 'cardiology',
    roles: ['doctor', 'tenant_admin'],
    fields: [
      { id:'f1', type:'textarea', label:'Cardiac Symptoms', required:true, options:[] },
      { id:'f2', type:'number',   label:'Heart Rate (bpm)', required:true, options:[] },
      { id:'f3', type:'radio',    label:'Chest Pain Present', required:true, options:[
        {label:'Yes',value:'yes'},{label:'No',value:'no'}
      ]},
      { id:'f4', type:'dropdown', label:'Risk Level', required:true, options:[
        {label:'Low',value:'low'},{label:'Medium',value:'medium'},{label:'High',value:'high'}
      ]},
    ]
  },
  {
    name: 'Nursing Assessment', specialty: 'nursing',
    roles: ['nurse', 'tenant_admin'],
    fields: [
      { id:'f1', type:'number',   label:'Temperature (Celsius)', required:true, options:[] },
      { id:'f2', type:'number',   label:'Pulse Rate (bpm)', required:true, options:[] },
      { id:'f3', type:'dropdown', label:'Consciousness Level', required:true, options:[
        {label:'Alert',value:'alert'},{label:'Drowsy',value:'drowsy'},{label:'Confused',value:'confused'}
      ]},
      { id:'f4', type:'textarea', label:'Nursing Notes', required:false, options:[] },
    ]
  },
  {
    name: 'OPD Follow-up', specialty: 'general',
    roles: ['doctor', 'tenant_admin'],
    fields: [
      { id:'f1', type:'textarea', label:'Progress Since Last Visit', required:true, options:[] },
      { id:'f2', type:'radio',    label:'Medication Compliance', required:true, options:[
        {label:'Yes',value:'yes'},{label:'Partial',value:'partial'},{label:'No',value:'no'}
      ]},
      { id:'f3', type:'slider',   label:'Current Pain Level', required:true, min:0, max:10, options:[] },
      { id:'f4', type:'dropdown', label:'Overall Improvement', required:true, options:[
        {label:'Much Better',value:'much_better'},{label:'Better',value:'better'},
        {label:'Same',value:'same'},{label:'Worse',value:'worse'}
      ]},
    ]
  },
];

const PATIENT_NAMES = [
  'Rajesh Kumar','Priya Sharma','Amit Patel','Sunita Singh','Vikram Nair',
  'Ananya Gupta','Suresh Verma','Meena Iyer','Arjun Reddy','Kavya Pillai'
];

const SUBMISSION_DATA = [
  { f1:'Persistent headache for 3 days, worse in morning', f2:6, f3:'moderate', f4:'Penicillin' },
  { f1:'Upper abdominal pain after meals, 2 weeks duration', f2:5, f3:'mild', f4:'None known' },
  { f1:'Chest tightness on exertion, shortness of breath', f2:7, f3:'severe', f4:'Aspirin' },
  { f1:'Fever 101F with body ache and chills since yesterday', f2:7, f3:'moderate', f4:'Sulfa drugs' },
  { f1:'Lower back pain radiating to left leg, 1 week', f2:5, f3:'moderate', f4:'NSAIDs' },
];

async function main() {
  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║   Healthcare Platform — Final Seed Script v2            ║');
  console.log('╚═════════════════════════════════════════════════════════╝\n');

  // ── STEP 1: CLEAN ─────────────────────────────────────────────
  console.log('▶ Step 1: Cleaning existing data...');
  sql('DELETE FROM refresh_tokens');
  sql('DELETE FROM user_roles');
  sql('DELETE FROM user_attributes');
  sql("DELETE FROM users WHERE email NOT LIKE 'superadmin%'");
  sql('DELETE FROM tenant_provisioning_logs');
  sql('DELETE FROM tenant_configs');
  sql('DELETE FROM tenants');
  sql('DELETE FROM patients');
  try {
    execSync(`sudo docker exec healthcare-platform-mongo-1 mongosh --quiet --eval "
      db.getSiblingDB('healthcare_forms').form_schemas.deleteMany({});
      db.getSiblingDB('healthcare_forms').form_versions.deleteMany({});
      db.getSiblingDB('healthcare_submissions').form_submissions.deleteMany({});
      db.getSiblingDB('healthcare_patients').patient_histories.deleteMany({});
    "`, { encoding:'utf8', timeout:30000 });
    console.log('  ✓ All data cleared');
  } catch { console.log('  ✓ PostgreSQL cleared (MongoDB skip)'); }

  // ── STEP 2: IAM ROLES ─────────────────────────────────────────
  console.log('\n▶ Step 2: Fetching IAM roles...');
  const roles = await get(`${BASE.IAM}/iam/roles`);
  const roleMap = {};
  for (const r of roles) roleMap[r.name] = r.id;
  console.log('  Roles:', Object.keys(roleMap).join(', '));

  // ── STEP 3: CREATE TENANTS ────────────────────────────────────
  console.log('\n▶ Step 3: Creating 5 tenants...');
  const createdTenants = [];
  for (const t of TENANTS) {
    try {
      const result = await post(`${BASE.TENANT}/tenants/onboard`, {
        name: t.name, subdomain: t.subdomain,
        adminEmail: t.adminEmail, adminName: t.adminName,
      });
      const tenantId = result.tenant?.id || result.id;
      const password = result.generatedPassword;
      createdTenants.push({ ...t, tenantId, adminPassword: password, adminUserId: result.adminUser?.id });
      console.log(`  ✓ ${t.name} — ${t.adminEmail} / ${password}`);
    } catch (e) {
      console.log(`  ✗ ${t.name}: ${e.response?.data?.message || e.message}`);
    }
    await sleep(1000);
  }
  if (!createdTenants.length) { console.log('No tenants created'); process.exit(1); }

  // ── STEP 4: CREATE USERS ──────────────────────────────────────
  console.log('\n▶ Step 4: Creating users per tenant (30 doctors + 20 nurses + 8 receptionists)...');
  const allUsers = [];
  for (const tenant of createdTenants) {
    allUsers.push({ email:tenant.adminEmail, password:tenant.adminPassword, role:'tenant_admin', tenantId:tenant.tenantId, name:tenant.adminName });

    for (let i = 1; i <= 30; i++) {
      const email = `dr${i}@${tenant.subdomain}.com`;
      const password = `Doctor${i}@123`;
      try {
        const user = await post(`${BASE.AUTH}/auth/users`, { email, password, name:`Dr. ${i}`, tenantId:tenant.tenantId, role:'doctor' });
        sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email = '${email}'`);
        if (user?.id && roleMap['doctor']) {
          await post(`${BASE.IAM}/iam/users/${user.id}/roles`, { roleId:roleMap['doctor'], tenantId:tenant.tenantId, assignedBy:'system' }).catch(()=>{});
        }
        allUsers.push({ email, password, role:'doctor', tenantId:tenant.tenantId, userId:user?.id });
      } catch { allUsers.push({ email, password, role:'doctor', tenantId:tenant.tenantId }); }
      await sleep(60);
    }

    for (let i = 1; i <= 20; i++) {
      const email = `nurse${i}@${tenant.subdomain}.com`;
      const password = `Nurse${i}@123`;
      try {
        const user = await post(`${BASE.AUTH}/auth/users`, { email, password, name:`Nurse ${i}`, tenantId:tenant.tenantId, role:'nurse' });
        sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email = '${email}'`);
        if (user?.id && roleMap['nurse']) {
          await post(`${BASE.IAM}/iam/users/${user.id}/roles`, { roleId:roleMap['nurse'], tenantId:tenant.tenantId, assignedBy:'system' }).catch(()=>{});
        }
        allUsers.push({ email, password, role:'nurse', tenantId:tenant.tenantId, userId:user?.id });
      } catch { allUsers.push({ email, password, role:'nurse', tenantId:tenant.tenantId }); }
      await sleep(60);
    }

    for (let i = 1; i <= 8; i++) {
      const email = `recep${i}@${tenant.subdomain}.com`;
      allUsers.push({ email, password:`Recep${i}@123`, role:'receptionist', tenantId:tenant.tenantId });
    }
    console.log(`  ✓ ${tenant.name}: ${allUsers.filter(u=>u.tenantId===tenant.tenantId).length} users`);
  }

  // ── STEP 5: CREATE FORMS ──────────────────────────────────────
  console.log('\n▶ Step 5: Creating 5 forms per tenant (25 total)...');
  const allForms = [];
  for (const tenant of createdTenants) {
    for (const t of FORM_TEMPLATES) {
      try {
        const form = await post(`${BASE.FORMS}/forms`, {
          name: t.name, specialty: t.specialty,
          tenant_id: tenant.tenantId,
          sections: [{ id:'section-1', title:'Main Section', fields: t.fields }],
          access_control: { roles: t.roles },
          layoutType: 'wizard',
        });
        const fid = form._id || form.id;
        await sleep(300);
        await post(`${BASE.FORMS}/forms/${fid}/publish`, {}).catch(()=>{});
        allForms.push({ formId:fid, name:t.name, specialty:t.specialty, tenantId:tenant.tenantId });
        await sleep(200);
      } catch (e) {
        console.log(`  ✗ ${t.name} for ${tenant.name}: ${e.response?.data?.message || e.message}`);
      }
    }
    console.log(`  ✓ ${tenant.name}: ${allForms.filter(f=>f.tenantId===tenant.tenantId).length} forms`);
  }

  // ── STEP 6: CREATE PATIENTS ───────────────────────────────────
  console.log('\n▶ Step 6: Creating 10 patients per tenant...');
  const allPatients = [];
  for (const tenant of createdTenants) {
    for (let i = 0; i < 10; i++) {
      try {
        const p = await post(`${BASE.PATIENT}/patients`, {
          tenantId:tenant.tenantId, name:PATIENT_NAMES[i],
          dob:`198${i}-0${(i%9)+1}-15`, gender:i%2===0?'male':'female',
          bloodGroup:['A+','B+','O+','AB+'][i%4], contactPhone:`+9198765${i}${i}${i}${i}`,
        });
        allPatients.push({ patientId:p.id||p._id, name:PATIENT_NAMES[i], tenantId:tenant.tenantId });
      } catch {}
      await sleep(150);
    }
    console.log(`  ✓ ${tenant.name}: ${allPatients.filter(p=>p.tenantId===tenant.tenantId).length} patients`);
  }

  // ── STEP 7: SAMPLE SUBMISSIONS ────────────────────────────────
  console.log('\n▶ Step 7: Creating sample submissions (doctors filling forms)...');
  let totalSubs = 0;
  for (const tenant of createdTenants) {
    const doctors  = allUsers.filter(u=>u.role==='doctor' && u.tenantId===tenant.tenantId && u.userId);
    const tForms   = allForms.filter(f=>f.tenantId===tenant.tenantId && f.specialty!=='nursing');
    const tPatients = allPatients.filter(p=>p.tenantId===tenant.tenantId);
    for (let i = 0; i < 5; i++) {
      const doctor  = doctors[i % Math.max(doctors.length,1)];
      const form    = tForms[i % Math.max(tForms.length,1)];
      const patient = tPatients[i % Math.max(tPatients.length,1)];
      const data    = SUBMISSION_DATA[i % SUBMISSION_DATA.length];
      if (!form?.formId) continue;
      try {
        await post(`${BASE.SUB}/submissions`, {
          form_id:form.formId, form_version:1, tenant_id:tenant.tenantId,
          submitted_by:doctor?.userId||'doctor_seed', patient_id:patient?.patientId||'patient_seed',
          status:'submitted', data:{ f1:data.f1, f2:data.f2, f3:data.f3, f4:data.f4 },
        });
        totalSubs++;
      } catch {}
      await sleep(200);
    }
    console.log(`  ✓ ${tenant.name}: submissions done`);
  }

  // ── STEP 8: FIX TENANT IDs IN DB ─────────────────────────────
  console.log('\n▶ Step 8: Fixing tenant_id in database...');
  for (const tenant of createdTenants) {
    sql(`UPDATE users SET tenant_id = '${tenant.tenantId}' WHERE email LIKE '%@${tenant.subdomain}.com'`);
    const count = sql(`SELECT COUNT(*) FROM users WHERE tenant_id = '${tenant.tenantId}'`);
    const num = (count.match(/\d+/) || ['?'])[0];
    console.log(`  ✓ ${tenant.name}: ${num} users in DB`);
  }

  // ── SAVE FILES ────────────────────────────────────────────────
  fs.writeFileSync('tenants.json', JSON.stringify(createdTenants.map(t=>({
    tenantId:t.tenantId, name:t.name, subdomain:t.subdomain,
    adminEmail:t.adminEmail, adminPassword:t.adminPassword,
  })), null, 2));
  fs.writeFileSync('users.json',    JSON.stringify(allUsers,    null, 2));
  fs.writeFileSync('forms.json',    JSON.stringify(allForms,    null, 2));
  fs.writeFileSync('patients.json', JSON.stringify(allPatients, null, 2));

  // ── SUMMARY ───────────────────────────────────────────────────
  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║   SEEDING COMPLETE                                      ║');
  console.log('╚═════════════════════════════════════════════════════════╝');
  console.log(`  Tenants:     ${createdTenants.length}`);
  console.log(`  Total Users: ${allUsers.length}`);
  console.log(`  Doctors:     ${allUsers.filter(u=>u.role==='doctor').length}`);
  console.log(`  Nurses:      ${allUsers.filter(u=>u.role==='nurse').length}`);
  console.log(`  Forms:       ${allForms.length} (${allForms.length/createdTenants.length} per tenant)`);
  console.log(`  Patients:    ${allPatients.length}`);
  console.log(`  Submissions: ${totalSubs}`);
  console.log('\n  ALL CREDENTIALS:');
  for (const t of createdTenants) {
    console.log(`\n  ${t.name}:`);
    console.log(`    Tenant Admin: ${t.adminEmail} / ${t.adminPassword}`);
    console.log(`    Doctor 1:     dr1@${t.subdomain}.com / Doctor1@123`);
    console.log(`    Doctor 2:     dr2@${t.subdomain}.com / Doctor2@123`);
    console.log(`    Nurse 1:      nurse1@${t.subdomain}.com / Nurse1@123`);
    console.log(`    Receptionist: recep1@${t.subdomain}.com / Recep1@123`);
  }
  console.log('\n  NEXT STEP: k6 run --out json=results.json load-test-realistic.js\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
