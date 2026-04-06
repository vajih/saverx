import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const BASE = 'https://connect.mailerlite.com/api';
const h = { Authorization: 'Bearer ' + key };

// Try several account/plan endpoints
const paths = ['/users/me', '/account', '/billing', '/plan', '/campaigns?limit=1'];
for (const p of paths) {
  const r = await fetch(BASE + p, { headers: h });
  const j = await r.json();
  console.log('GET ' + p + ' →', r.status, JSON.stringify(j).slice(0, 200));
}

// Full subscriber record for tosiba
const sub = await fetch(BASE + '/subscribers/tosiba7787%40kobace.com', { headers: h }).then(r => r.json());
if (sub.data) {
  const d = sub.data;
  console.log('\n=== tosiba7787@kobace.com full record ===');
  console.log('  status:', d.status);
  console.log('  created_at:', d.created_at);
  console.log('  opted_in_at:', d.opted_in_at);
  console.log('  unsubscribed_at:', d.unsubscribed_at);
  console.log('  bounced_at:', d.bounced_at);
  console.log('  fields:', JSON.stringify(d.fields));
  console.log('  groups:', d.groups?.map(g => g.name).join(', '));
} else {
  console.log('\ntosiba not found:', JSON.stringify(sub));
}

// Check automation trigger group detail
const autos = await fetch(BASE + '/automations?limit=25', { headers: h }).then(r => r.json());
const auto = autos.data.find(a => a.name === 'SaveRx — General Savings');
console.log('\n=== Automation full trigger ===');
console.log(JSON.stringify(auto.triggers, null, 2));
console.log('enabled:', auto.enabled, '| complete:', auto.complete, '| broken:', auto.broken);
