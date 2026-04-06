// Deep inspect one automation's full API response structure
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
  return { status: res.status, body: await res.json() };
}

// Get first SaveRx automation
const list = await api('GET', '/automations?limit=25');
const auto = list.body.data.find(x => x.name.startsWith('SaveRx'));
console.log('\n--- Automation top-level fields ---');
console.log(JSON.stringify(Object.keys(auto)));

// Full detail
const detail = await api('GET', '/automations/' + auto.id);
console.log('\n--- Full automation data keys ---');
console.log(JSON.stringify(Object.keys(detail.body.data)));
console.log('\n--- trigger field ---');
console.log(JSON.stringify(detail.body.data.trigger));
console.log('\n--- steps[0] full ---');
const step0 = detail.body.data.steps?.[0];
console.log(JSON.stringify(step0, null, 2));

// Try PUT trigger and inspect response
console.log('\n--- PUT trigger response ---');
const putR = await api('PUT', '/automations/' + auto.id, {
  name: auto.name,
  trigger: { type: 'subscriber_added_to_group', groups: [list.body.data[0].id] },
});
console.log('status:', putR.status);
console.log('response keys:', JSON.stringify(Object.keys(putR.body.data || {})));
console.log('trigger in response:', JSON.stringify(putR.body.data?.trigger));

// Re-fetch to confirm
const recheck = await api('GET', '/automations/' + auto.id);
console.log('\n--- trigger after PUT ---');
console.log(JSON.stringify(recheck.body.data.trigger));
