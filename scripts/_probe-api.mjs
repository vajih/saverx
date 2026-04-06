// Test correct trigger field name and email body endpoint
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

async function api(method, path, body) {
  const res = await fetch('https://connect.mailerlite.com/api' + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

const list = await api('GET', '/automations?limit=25');
const auto = list.body.data.find(x => x.name.startsWith('SaveRx'));

// Get a group ID from .env
const envText = readFileSync(join(__dir, '..', '.env'), 'utf8');
const groupId = envText.match(/MAILERLITE_GROUP_DIABETES=(.+)/)?.[1].trim();

console.log('=== Test 1: PUT triggers (plural) ===');
const t1 = await api('PUT', '/automations/' + auto.id, {
  name: auto.name,
  triggers: [{ type: 'subscriber_added_to_group', groups: [groupId] }],
});
console.log('status:', t1.status);
console.log('triggers in response:', JSON.stringify(t1.body.data?.triggers));
console.log('trigger_data in response:', JSON.stringify(t1.body.data?.trigger_data));

// Re-check
const rc1 = await api('GET', '/automations/' + auto.id);
console.log('triggers after PUT:', JSON.stringify(rc1.body.data?.triggers));

// Get an email step
const emailStep = auto.steps.find(s => s.type === 'email');
console.log('\n=== Test 2: GET /emails/{email_id} ===');
const email = await api('GET', '/emails/' + emailStep.email_id);
console.log('status:', email.status);
console.log('email keys:', JSON.stringify(Object.keys(email.body.data || {})));

console.log('\n=== Test 3: Probe /automations/{id}/emails ===');
const ae = await api('GET', '/automations/' + auto.id + '/emails');
console.log('status:', ae.status, '| body:', JSON.stringify(ae.body).slice(0, 200));
