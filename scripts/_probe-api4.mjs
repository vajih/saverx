// Final probe: try builder_type + body_html together, and probe trigger endpoint
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

const MINI = '<html><body><p>Hello {$subscriber.name}!</p><a href="{$unsubscribe}">Unsubscribe</a></body></html>';

// Try with builder_type: 'html'
console.log('=== PUT step with builder_type: html ===');
const t1 = await api('PUT', `/automations/${auto.id}/steps/${emailStep.id}`, {
  data: { name: emailStep.name, subject: emailStep.subject, from: 'noreply@saverx.ai',
          from_name: 'SaveRx.ai', reply_to: 'noreply@saverx.ai',
          body_html: MINI, builder_type: 'html' }
});
console.log('status:', t1.status);
const step1 = t1.body.data;
console.log('complete:', step1?.complete, '| builder_type:', step1?.builder_type, '| is_designed:', step1?.email?.is_designed);

// Check automation complete status
const check1 = await api('GET', '/automations/' + auto.id);
console.log('automation complete:', check1.body.data?.complete);

// Try /automations/{id}/triggers endpoint
console.log('\n=== GET/POST /automations/{id}/triggers ===');
const gt = await api('GET', `/automations/${auto.id}/triggers`);
console.log('GET status:', gt.status, '| body:', JSON.stringify(gt.body).slice(0, 200));

const pt = await api('POST', `/automations/${auto.id}/triggers`, {
  type: 'subscriber_added_to_group', groups: [groupId]
});
console.log('POST status:', pt.status, '| body:', JSON.stringify(pt.body).slice(0, 200));
