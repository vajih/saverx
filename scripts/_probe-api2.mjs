// Probe more specific endpoints for setting trigger and email body
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const groupId = env.match(/MAILERLITE_GROUP_DIABETES=(.+)/)?.[1].trim();

async function api(method, path, body) {
  const res = await fetch('https://connect.mailerlite.com/api' + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const list = await api('GET', '/automations?limit=25');
const auto = list.body.data.find(x => x.name.startsWith('SaveRx'));
const emailStep = auto.steps.find(s => s.type === 'email');

// Test trigger_data field
console.log('=== Test: PUT with trigger_data ===');
const t2 = await api('PUT', '/automations/' + auto.id, {
  name: auto.name,
  trigger_data: { type: 'subscriber_added_to_group', groups: [groupId] }
});
console.log('status:', t2.status, '| trigger_data:', JSON.stringify(t2.body.data?.trigger_data));

// Test /automations/{id}/emails POST with step_id
console.log('\n=== Test: POST /automations/{id}/emails with step_id ===');
const t3 = await api('POST', '/automations/' + auto.id + '/emails', {
  automation_step_id: emailStep.id,
  name: emailStep.name,
  subject: emailStep.subject,
  from: 'noreply@saverx.ai',
  from_name: 'SaveRx.ai',
  reply_to: 'noreply@saverx.ai',
  body_html: '<html><body><p>test</p></body></html>',
});
console.log('status:', t3.status, '| body:', JSON.stringify(t3.body).slice(0, 300));

// Test GET /automations/{id}/steps/{step_id}
console.log('\n=== Test: GET /automations/{id}/steps/{step_id} ===');
const t4 = await api('GET', '/automations/' + auto.id + '/steps/' + emailStep.id);
console.log('status:', t4.status, '| keys:', JSON.stringify(Object.keys(t4.body.data || {})));
console.log('complete:', t4.body.data?.complete, '| builder_type:', t4.body.data?.builder_type);

// Test PATCH on step
console.log('\n=== Test: PATCH step with body_html ===');
const t5 = await api('PATCH', '/automations/' + auto.id + '/steps/' + emailStep.id, {
  data: { body_html: '<html><body><p>patch test</p></body></html>' }
});
console.log('status:', t5.status, '| body:', JSON.stringify(t5.body).slice(0, 200));
