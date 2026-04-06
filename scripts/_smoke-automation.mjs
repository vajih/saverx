import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

const BASE = 'https://connect.mailerlite.com/api';

async function api(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + key } });
  return r.json();
}

// 1. Check automation stats
const list = await api('/automations?limit=25');
const auto = list.data.find(a => a.name === 'SaveRx — General Savings');
console.log('=== Automation Stats ===');
console.log('Status enabled:', auto.enabled);
console.log('Stats:', JSON.stringify(auto.stats));

// 2. Check subscriber status
const sub1 = await api('/subscribers/tosiba7787@kobace.com');
console.log('\n=== Subscriber tosiba7787@kobace.com ===');
if (sub1.data) {
  console.log('Status:', sub1.data.status);
  console.log('Groups:', sub1.data.groups?.map(g => g.name).join(', '));
} else {
  console.log('Not found:', JSON.stringify(sub1));
}

const sub2 = await api('/subscribers/vajihkhan@gmail.com');
console.log('\n=== Subscriber vajihkhan@gmail.com ===');
if (sub2.data) {
  console.log('Status:', sub2.data.status);
  console.log('Groups:', sub2.data.groups?.map(g => g.name).join(', '));
}

// 3. Check automation activity (filter.status required)
const activityUrl = '/automations/' + auto.id + '/activity?filter[status]=active&limit=10';
const activityUrl2 = '/automations/' + auto.id + '/activity?filter[status]=completed&limit=10';
const [actActive, actCompleted] = await Promise.all([api(activityUrl), api(activityUrl2)]);
console.log('\n=== Automation Activity (active) ===');
if (actActive.data?.length) {
  actActive.data.forEach(a => console.log(`  ${a.subscriber?.email} | step: ${a.step?.name || '-'} | started: ${a.started_at}`));
} else {
  console.log('None.', actActive.message || '');
}
console.log('\n=== Automation Activity (completed) ===');
if (actCompleted.data?.length) {
  actCompleted.data.forEach(a => console.log(`  ${a.subscriber?.email} | step: ${a.step?.name || '-'} | started: ${a.started_at}`));
} else {
  console.log('None.', actCompleted.message || '');
}

// 4. Check account info / plan
const account = await api('/me');
console.log('\n=== Account Info ===');
console.log(JSON.stringify(account, null, 2));
