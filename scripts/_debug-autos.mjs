import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

async function api(path) {
  const r = await fetch('https://connect.mailerlite.com/api' + path, {
    headers: { Authorization: 'Bearer ' + key }
  });
  return r.json();
}

const list = await api('/automations?limit=25');
for (const a of list.data.filter(x => x.name.startsWith('SaveRx'))) {
  const detail = await api('/automations/' + a.id);
  console.log('\n=== ' + a.name + ' ===');
  console.log('complete:', a.complete, '| enabled:', a.enabled, '| broken:', a.broken);
  console.log('trigger:', JSON.stringify(detail.data?.trigger));
  for (const s of (detail.data?.steps || [])) {
    console.log(' step type:', s.type, '| name:', s.name, '| from:', s.from, '| subject:', s.subject, '| has_body:', !!s.email?.body_html);
  }
}
