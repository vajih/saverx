import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();
const gId = env.match(/MAILERLITE_GROUP_DIABETES=(.+)/)?.[1].trim();

const list = await fetch('https://connect.mailerlite.com/api/automations?limit=25', {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());
const id = list.data.find(x => x.name.startsWith('SaveRx')).id;

const types = ['group', 'subscriber_added_to_group', 'added_to_group', 'group_subscription',
               'subscriber_joined_group', 'join_group', 'subscriber_in_group', 'subscriber_group'];

for (const type of types) {
  const r = await fetch(`https://connect.mailerlite.com/api/automations/${id}/triggers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, groups: [gId] })
  });
  const j = await r.json();
  console.log(type + ':', r.status, j.message || 'SUCCESS', j.data ? JSON.stringify(j.data).slice(0, 100) : '');
}
