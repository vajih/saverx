/**
 * update-automation-senders.mjs
 * Updates all automation email step senders to noreply@saverx.ai
 * Usage: node scripts/update-automation-senders.mjs [--dry-run]
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const env   = readFileSync(join(ROOT, '.env'), 'utf8');
const get   = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1].trim();

const API_KEY = get('MAILERLITE_API_KEY');
const BASE    = 'https://connect.mailerlite.com/api';
const DRY_RUN = process.argv.includes('--dry-run');

const NEW_FROM       = 'noreply@saverx.ai';
const NEW_FROM_NAME  = 'SaveRx.ai';
const NEW_REPLY_TO   = 'noreply@saverx.ai';

async function api(method, path, body) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`  [DRY-RUN] ${method} ${path}`);
    return { data: {} };
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log('SaveRx — Update Automation Senders');
  console.log('====================================');
  if (DRY_RUN) console.log('DRY RUN\n');

  const { data: automations } = await api('GET', '/automations?limit=25');
  const saverxAutos = automations.filter(a => a.name.startsWith('SaveRx —'));
  console.log(`Found ${saverxAutos.length} SaveRx automation(s)\n`);

  let updated = 0;
  let skipped = 0;

  for (const auto of saverxAutos) {
    console.log(`▶  ${auto.name} (${auto.id})`);
    const { data: detail } = await api('GET', `/automations/${auto.id}`);
    const emailSteps = (detail.steps || []).filter(s => s.type === 'email');

    for (const step of emailSteps) {
      if (step.from === NEW_FROM && step.reply_to === NEW_REPLY_TO) {
        console.log(`   ↳ "${step.name}" — already correct, skipping`);
        skipped++;
        continue;
      }
      await api('PUT', `/automations/${auto.id}/steps/${step.id}`, {
        data: {
          name:       step.name,
          subject:    step.subject,
          from:       NEW_FROM,
          from_name:  NEW_FROM_NAME,
          reply_to:   NEW_REPLY_TO,
          body_html:  step.email?.body_html || undefined,
        },
      });
      console.log(`   ✓ "${step.name}" updated → ${NEW_FROM}`);
      updated++;
    }
  }

  console.log(`\n✅  Done — ${updated} step(s) updated, ${skipped} already correct.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
