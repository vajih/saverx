import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env'), 'utf8');
const key = env.match(/MAILERLITE_API_KEY=(.+)/)?.[1].trim();

const list = await fetch('https://connect.mailerlite.com/api/automations?limit=25', {
  headers: { Authorization: 'Bearer ' + key }
}).then(r => r.json());

console.log(`Found ${list.data.length} automation(s):\n`);

for (const auto of list.data) {
  console.log(`Name: "${auto.name}" | ID: ${auto.id} | complete: ${auto.complete} | broken: ${auto.broken}`);

  const detail = await fetch('https://connect.mailerlite.com/api/automations/' + auto.id, {
    headers: { Authorization: 'Bearer ' + key }
  }).then(r => r.json());

  const steps = detail.data.steps || [];
  // Build execution order by following parent_id chain
  const rootStep = steps.find(s => !s.parent_id);
  const ordered = [];
  if (rootStep) {
    let current = rootStep;
    while (current) {
      ordered.push(current);
      current = steps.find(s => s.parent_id === current.id);
    }
  }
  const displaySteps = ordered.length === steps.length ? ordered : steps;
  console.log(`  Steps (${steps.length}) [execution order]:`);
  displaySteps.forEach((s, i) => {
    console.log(`    ${i+1}. type:${s.type} | name:${s.name || '-'} | id:${s.id} | parent:${s.parent_id || 'ROOT'}`);
  });
  console.log(`  Triggers: ${JSON.stringify(detail.data.triggers)}`);
  console.log(`  Warnings: ${JSON.stringify(auto.warnings)}\n`);
}
