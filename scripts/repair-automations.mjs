/**
 * repair-automations.mjs
 * Fixes existing SaveRx automations:
 *   1. Sets the correct group-join trigger on each automation
 *   2. Pushes the actual HTML body into each email step
 *
 * Usage: node scripts/repair-automations.mjs [--dry-run]
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const env   = readFileSync(join(ROOT, '.env'), 'utf8');
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1].trim();

const API_KEY = getEnv('MAILERLITE_API_KEY');
const BASE    = 'https://connect.mailerlite.com/api';
const DRY_RUN = process.argv.includes('--dry-run');

// Map automation name → group ID
const GROUP_MAP = {
  'SaveRx — Diabetes & CGM': getEnv('MAILERLITE_GROUP_DIABETES'),
  'SaveRx — Cardiovascular': getEnv('MAILERLITE_GROUP_CARDIO'),
  'SaveRx — GLP-1 Users':    getEnv('MAILERLITE_GROUP_GLP1'),
  'SaveRx — General Savings':getEnv('MAILERLITE_GROUP_GENERAL'),
};

// Map step name → HTML file
const EMAIL_FILE_MAP = {
  'Email 1 — Welcome':               'emails/welcome.html',
  'Email 2 — Follow-up (day 3)':     'emails/follow-up-1.html',
  'Email 3 — Final reminder (day 10)':'emails/follow-up-2.html',
};

const FROM_EMAIL = 'noreply@saverx.ai';
const FROM_NAME  = 'SaveRx.ai';
const REPLY_TO   = 'noreply@saverx.ai';

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
  if (!res.ok) throw new Error(`${res.status} ${method} ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log('SaveRx — Repair Automations');
  console.log('============================');
  if (DRY_RUN) console.log('DRY RUN\n');

  const { data: automations } = await api('GET', '/automations?limit=25');
  const saverxAutos = automations.filter(a => GROUP_MAP[a.name]);
  console.log(`Found ${saverxAutos.length} SaveRx automation(s)\n`);

  for (const auto of saverxAutos) {
    const groupId = GROUP_MAP[auto.name];
    console.log(`▶  ${auto.name}`);

    // 1. Fix trigger
    await api('PUT', `/automations/${auto.id}`, {
      name: auto.name,
      trigger: {
        type:   'subscriber_added_to_group',
        groups: [groupId],
      },
    });
    console.log(`   ✓ Trigger set → subscriber joins group ${groupId}`);

    // 2. Fix email step bodies
    const { data: detail } = await api('GET', `/automations/${auto.id}`);
    const emailSteps = (detail.steps || []).filter(s => s.type === 'email');

    for (const step of emailSteps) {
      const htmlFile = EMAIL_FILE_MAP[step.name];
      if (!htmlFile) {
        console.log(`   ⚠  Unknown step name "${step.name}" — skipping`);
        continue;
      }
      const bodyHtml = readFileSync(join(ROOT, htmlFile), 'utf8');
      await api('PUT', `/automations/${auto.id}/steps/${step.id}`, {
        data: {
          name:       step.name,
          subject:    step.subject,
          from:       FROM_EMAIL,
          from_name:  FROM_NAME,
          reply_to:   REPLY_TO,
          body_html:  bodyHtml,
        },
      });
      console.log(`   ✓ "${step.name}" — body updated (${Math.round(bodyHtml.length / 1024)}KB)`);
    }

    console.log(`   ✓ Done\n`);
  }

  console.log('✅  All automations repaired!');
  console.log('   Next step: go to app.mailerlite.com → Automations → Activate each one.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
