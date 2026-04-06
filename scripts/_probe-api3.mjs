// Probe email body update - different field names and GET emails with query param
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const list = await api('GET', '/automations?limit=25');
const auto = list.body.data.find(x => x.name.startsWith('SaveRx'));
const emailStep = auto.steps.find(s => s.type === 'email');
const MINI_HTML = '<html><body><p>test</p><a href="{$unsubscribe}">Unsubscribe</a></body></html>';

// Test GET /emails with query param
console.log('=== GET /automations/{id}/emails?automation_step_id= ===');
const g1 = await api('GET', `/automations/${auto.id}/emails?automation_step_id=${emailStep.id}`);
console.log('status:', g1.status, '| keys:', JSON.stringify(Object.keys(g1.body.data || {})));
if (g1.body.data) console.log('email id:', g1.body.data.id);

// Try step PUT without data wrapper
console.log('\n=== PUT step without data wrapper (body_html at top level) ===');
const t1 = await api('PUT', `/automations/${auto.id}/steps/${emailStep.id}`, {
  name: emailStep.name,
  subject: emailStep.subject,
  from: 'noreply@saverx.ai',
  from_name: 'SaveRx.ai',
  reply_to: 'noreply@saverx.ai',
  body_html: MINI_HTML,
});
console.log('status:', t1.status, '| complete:', t1.body.data?.complete);

// Re-check step has_body after top-level attempt
const r1 = await api('GET', '/automations/' + auto.id);
const s1 = r1.body.data.steps.find(s => s.id === emailStep.id);
console.log('has_body after:', !!s1?.email?.body_html);

// Try step PUT with html field (not body_html)
console.log('\n=== PUT step data.html ===');
const t2 = await api('PUT', `/automations/${auto.id}/steps/${emailStep.id}`, {
  data: { name: emailStep.name, subject: emailStep.subject, from: 'noreply@saverx.ai',
          from_name: 'SaveRx.ai', reply_to: 'noreply@saverx.ai', html: MINI_HTML }
});
console.log('status:', t2.status, '| complete:', t2.body.data?.complete);

// Try /emails/{email_id} with PUT
const emailId = emailStep.email_id;
console.log('\n=== PUT /emails/' + emailId + ' ===');
const t3 = await api('PUT', '/emails/' + emailId, { body_html: MINI_HTML });
console.log('status:', t3.status, '| body:', JSON.stringify(t3.body).slice(0, 200));

// See if email_id lives under a different api path
console.log('\n=== GET /automations/{} then check warnings ===');
const t4 = await api('GET', '/automations/' + auto.id);
console.log('warnings:', JSON.stringify(t4.body.data?.warnings));
console.log('triggers:', JSON.stringify(t4.body.data?.triggers));
