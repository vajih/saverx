import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const groupId = env.match(/MAILERLITE_GROUP_GENERAL=(.+)/)?.[1].trim();

const TEST_EMAIL = process.argv[2];
if (!TEST_EMAIL) { console.error('Usage: node scripts/_fresh-test.mjs email@test.com'); process.exit(1); }

// Step 1: Delete if already exists
console.log('Checking if subscriber already exists...');
const check = await fetch(`https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(TEST_EMAIL)}`, {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());

if (check.data?.id) {
  const del = await fetch(`https://connect.mailerlite.com/api/subscribers/${check.data.id}`, {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + key }
  });
  console.log(`Deleted existing subscriber (${del.status})`);
  // Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));
}

// Step 2: Add fresh
console.log(`Adding fresh subscriber: ${TEST_EMAIL}`);
const r = await fetch('https://connect.mailerlite.com/api/subscribers', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: TEST_EMAIL,
    fields: { drug: 'Dupixent', drug_category: 'General Savings' },
    groups: [groupId],
    status: 'active',
  })
});

const j = await r.json();
if (!r.ok) { console.error('Failed:', JSON.stringify(j)); process.exit(1); }

console.log(`✅ Fresh subscriber added (ID: ${j.data.id})`);
console.log(`Check inbox now — email should arrive within 1-2 minutes.`);
