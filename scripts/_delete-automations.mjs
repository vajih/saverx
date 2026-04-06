import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

const list = await fetch('https://connect.mailerlite.com/api/automations?limit=25', {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());

const saverx = list.data.filter(a => a.name.startsWith('SaveRx'));
console.log(`Deleting ${saverx.length} SaveRx automations...`);

for (const a of saverx) {
  const r = await fetch('https://connect.mailerlite.com/api/automations/' + a.id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + key }
  });
  console.log(`  ${r.status === 204 ? '✓ Deleted' : '✗ Failed ' + r.status}: ${a.name} (${a.id})`);
}

console.log('\nDone. All SaveRx automations deleted.');
