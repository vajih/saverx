import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

const list = await fetch('https://connect.mailerlite.com/api/automations?limit=25', {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());

const auto = list.data.find(x => x.name === 'SaveRx — General Savings');
console.log('Automation ID:', auto.id);
console.log('Complete:', auto.complete, '| Broken:', auto.broken);
console.log('Warnings:', JSON.stringify(auto.warnings));

const detail = await fetch('https://connect.mailerlite.com/api/automations/' + auto.id, {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());

console.log('\nAll steps (' + detail.data.steps.length + ' total):');
detail.data.steps.forEach((s, i) => {
  console.log(`  ${i+1}. [${s.id}] type:${s.type} | name:${s.name || '-'} | complete:${s.complete} | parent_id:${s.parent_id}`);
});
