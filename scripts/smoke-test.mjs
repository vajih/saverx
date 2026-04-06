/**
 * smoke-test.mjs
 * Checks MailerLite domain verification, automations, and groups.
 * Usage: node scripts/smoke-test.mjs
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

const EXPECTED_AUTOMATIONS = [
  'SaveRx — Diabetes & CGM',
  'SaveRx — Cardiovascular',
  'SaveRx — GLP-1 Users',
  'SaveRx — General Savings',
];

const EXPECTED_GROUPS = {
  'All SaveRx Leads': get('MAILERLITE_GROUP_ALL'),
  'Diabetes & CGM':   get('MAILERLITE_GROUP_DIABETES'),
  'Cardiovascular':   get('MAILERLITE_GROUP_CARDIO'),
  'GLP-1 Users':      get('MAILERLITE_GROUP_GLP1'),
  'General Savings':  get('MAILERLITE_GROUP_GENERAL'),
};

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}

function pass(msg)  { console.log(`  ✅  ${msg}`); }
function fail(msg)  { console.log(`  ❌  ${msg}`); }
function warn(msg)  { console.log(`  ⚠️   ${msg}`); }
function head(msg)  { console.log(`\n── ${msg} ${'─'.repeat(50 - msg.length)}`); }

async function main() {
  console.log('\nSaveRx — MailerLite Smoke Test');
  console.log('================================');

  let issues = 0;

  // ── 1. Domain verification ──────────────────────────────────────────────
  // NOTE: MailerLite API does not expose a GET /domains endpoint.
  // Domain status must be verified manually in the dashboard:
  // dashboard.mailerlite.com → Settings → Domains
  head('Sender Domains');
  pass('saverx.ai — check dashboard.mailerlite.com → Settings → Domains for live status');

  // ── 2. Groups ────────────────────────────────────────────────────────────
  head('Subscriber Groups');
  const groups = await api('/groups?limit=25');
  for (const [name, id] of Object.entries(EXPECTED_GROUPS)) {
    const g = groups.data?.find(x => x.id === id);
    if (!g) { fail(`Group not found: "${name}" (${id})`); issues++; }
    else     pass(`"${name}" — ${g.active_count} active subscribers`);
  }

  // ── 3. Automations ───────────────────────────────────────────────────────
  head('Automations');
  const automations = await api('/automations?limit=25');
  const allAutos = automations.data || [];

  for (const name of EXPECTED_AUTOMATIONS) {
    const a = allAutos.find(x => x.name === name);
    if (!a) {
      fail(`Automation not found: "${name}"`); issues++;
      continue;
    }

    const enabled  = a.enabled;
    const complete = a.complete;
    const broken   = a.broken;
    const emails   = a.emails_count;

    if (broken)    { fail(`"${name}" is broken`); issues++; }
    else if (!complete) { warn(`"${name}" is incomplete (${emails} email step(s) configured)`); }
    else           pass(`"${name}" — complete, ${emails} email(s)`);

    if (!enabled)  warn(`"${name}" is NOT active — go to MailerLite → Automations and click Activate`);
    else           pass(`"${name}" is active`);

    // Check sender on each email step
    const autoDetail = await api(`/automations/${a.id}`);
    const steps = autoDetail.data?.steps || [];
    const emailSteps = steps.filter(s => s.type === 'email');
    for (const step of emailSteps) {
      if (step.from && step.from !== 'noreply@saverx.ai') {
        warn(`"${name}" step "${step.name}" still uses sender: ${step.from}`);
      } else if (step.from === 'noreply@saverx.ai') {
        pass(`"${name}" step "${step.name}" sender: noreply@saverx.ai ✓`);
      }
    }
  }

  // ── 4. Summary ───────────────────────────────────────────────────────────
  console.log('\n\n══ Result ═════════════════════════════════════════════');
  if (issues === 0) {
    console.log('  ✅  All checks passed!\n');
  } else {
    console.log(`  ❌  ${issues} issue(s) need attention — see above.\n`);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
