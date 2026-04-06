import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const BASE = 'https://connect.mailerlite.com/api';
const h = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

// Group IDs
const GROUPS = {
  'General Savings':   '183927823647377106',
  'Diabetes & CGM':    '183927823403058777',
  'Cardiovascular':    '183927823137768840',
  'GLP-1 Users':       '183927822827390173',
};

const EMAIL = process.argv[2] || 'tosiba7787@kobace.com';
const GROUP_NAME = process.argv[3] || 'Diabetes & CGM';
const DRUG = process.argv[4] || 'Ozempic';
const GROUP_ID = GROUPS[GROUP_NAME];

if (!GROUP_ID) {
  console.error('Unknown group. Valid options:', Object.keys(GROUPS).join(', '));
  process.exit(1);
}

console.log(`Testing automation for group: ${GROUP_NAME}`);
console.log(`Email: ${EMAIL} | Drug: ${DRUG}`);

// Step 1: Delete if exists
const check = await fetch(`${BASE}/subscribers/${encodeURIComponent(EMAIL)}`, { headers: h }).then(r => r.json());
if (check.data?.id) {
  const d = await fetch(`${BASE}/subscribers/${check.data.id}`, { method: 'DELETE', headers: h });
  console.log(`Deleted existing subscriber (${d.status})`);
  await new Promise(r => setTimeout(r, 2000));
} else {
  console.log('No existing subscriber found — adding fresh.');
}

// Step 2: Add fresh to target group
const r = await fetch(`${BASE}/subscribers`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({
    email: EMAIL,
    fields: { drug: DRUG, drug_category: GROUP_NAME },
    groups: [GROUP_ID],
    status: 'active',
  }),
});
const j = await r.json();
if (!r.ok) { console.error('Failed:', JSON.stringify(j)); process.exit(1); }

console.log(`\n✅ Fresh subscriber added (ID: ${j.data.id})`);
console.log(`   Status: ${j.data.status}`);
console.log(`   Groups: ${j.data.groups?.map(g => g.name).join(', ')}`);
console.log(`\nCheck inbox for the welcome email — should arrive within 1-2 minutes.`);
