import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const key = readFileSync(join(__dir, '..', '.env'), 'utf8').match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const BASE = 'https://connect.mailerlite.com/api';
const h = { Authorization: 'Bearer ' + key };
const DIABETES_ID = '184019905891272350';

// Check all activity statuses
const statuses = ['active', 'completed', 'canceled', 'failed', 'paused'];
for (const s of statuses) {
  const r = await fetch(`${BASE}/automations/${DIABETES_ID}/activity?filter[status]=${s}&limit=5`, { headers: h }).then(r => r.json());
  if (r.data?.length) {
    console.log(`Status ${s}:`, r.data.map(x => x.subscriber?.email || x.subscriber_id).join(', '));
  } else {
    console.log(`Status ${s}: 0`);
  }
}

// Check the test subscriber
const sub = await fetch(`${BASE}/subscribers/test-diabetes%40saverx.ai`, { headers: h }).then(r => r.json());
console.log('\ntest-diabetes@saverx.ai');
console.log('  status:', sub.data?.status);
console.log('  groups:', sub.data?.groups?.map(g => g.name).join(', ') || 'NONE');
console.log('  created_at:', sub.data?.created_at);
