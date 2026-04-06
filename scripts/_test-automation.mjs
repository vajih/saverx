// Add a test subscriber to the General Savings group to trigger the automation
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const groupId = env.match(/MAILERLITE_GROUP_GENERAL=(.+)/)?.[1].trim();

const TEST_EMAIL = process.argv[2];
if (!TEST_EMAIL) {
  console.error('Usage: node scripts/_test-automation.mjs your@email.com');
  process.exit(1);
}

console.log(`Adding test subscriber: ${TEST_EMAIL} → General Savings group`);

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
if (!r.ok) {
  console.error('Failed:', JSON.stringify(j));
  process.exit(1);
}

console.log(`✅ Subscriber added (ID: ${j.data.id})`);
console.log(`   Status: ${j.data.status}`);
console.log(`\nCheck your inbox for the welcome email. It should arrive within a minute.`);
console.log(`\nTo clean up after testing, run:`);
console.log(`   node scripts/_test-automation.mjs --delete ${j.data.id}`);
