/**
 * create-automations.mjs
 *
 * Creates 4 MailerLite automations (one per subscriber group):
 *   Diabetes & CGM  |  Cardiovascular  |  GLP-1 Users  |  General Savings
 *
 * Each automation is:
 *   TRIGGER: subscriber joins the group
 *       ↓
 *   EMAIL 1: Welcome / your {drug} savings are waiting  (immediate)
 *       ↓
 *   DELAY: 3 days
 *       ↓
 *   EMAIL 2: Follow-up / have you enrolled yet?
 *       ↓
 *   DELAY: 7 days
 *       ↓
 *   EMAIL 3: Final reminder / don't leave savings on the table
 *
 * Usage:
 *   node scripts/create-automations.mjs
 *
 * Dry run (no changes):
 *   node scripts/create-automations.mjs --dry-run
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');

// ── Config ───────────────────────────────────────────────────────────────────

const env = readFileSync(join(ROOT, '.env'), 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)`, 'm'));
  if (!m) throw new Error(`Missing ${key} in .env`);
  return m[1].trim();
};

const API_KEY = get('MAILERLITE_API_KEY');
const BASE    = 'https://connect.mailerlite.com/api';
const DRY_RUN = process.argv.includes('--dry-run');

const GROUPS = [
  { name: 'Diabetes & CGM',  id: get('MAILERLITE_GROUP_DIABETES') },
  { name: 'Cardiovascular',  id: get('MAILERLITE_GROUP_CARDIO')   },
  { name: 'GLP-1 Users',     id: get('MAILERLITE_GROUP_GLP1')     },
  { name: 'General Savings', id: get('MAILERLITE_GROUP_GENERAL')  },
];

// Email content for each step
const EMAILS = [
  {
    name: 'Email 1 — Welcome',
    subject: 'Your {$subscriber.fields.drug} savings are waiting — SaveRx.ai',
    preheader: "We found manufacturer savings programs for your medication.",
    file: 'emails/welcome.html',
  },
  {
    name: 'Email 2 — Follow-up (day 3)',
    subject: 'Still looking for {$subscriber.fields.drug} savings?',
    preheader: "Quick reminder — enrollment takes under 2 minutes.",
    file: 'emails/follow-up-1.html',
  },
  {
    name: 'Email 3 — Final reminder (day 10)',
    subject: "Last reminder: your {$subscriber.fields.drug} savings program",
    preheader: "Don't leave your savings on the table.",
    file: 'emails/follow-up-2.html',
  },
];

const DELAYS = [3, 7]; // days between email 1→2 and email 2→3

// Use your MailerLite-verified sender email here.
// Once you verify a custom domain (e.g. noreply@saverx.ai) in MailerLite under
// Settings → Verified domains, update these values and re-run.
const FROM_EMAIL = 'vajihkhan@gmail.com';
const FROM_NAME  = 'SaveRx.ai';
const REPLY_TO   = 'vajihkhan@gmail.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`  [DRY-RUN] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 80) : '');
    return { data: { id: 'dry-run-id' } };
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status}:`, JSON.stringify(json));
    throw new Error(`API error ${res.status}`);
  }
  return json;
}

function loadHtml(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function createAutomation(group) {
  console.log(`\n▶  Creating automation for: ${group.name} (group ${group.id})`);

  // 1. Create the shell automation
  const { data: automation } = await api('POST', '/automations', {
    name: `SaveRx — ${group.name}`,
  });
  const aid = automation.id;
  console.log(`   Automation created: ${aid}`);

  // 2. Add steps: email → delay → email → delay → email
  for (let i = 0; i < EMAILS.length; i++) {
    const email = EMAILS[i];

    // Add the email step
    const { data: step } = await api('POST', `/automations/${aid}/steps`, {
      type: 'email',
    });
    const sid = step.id;
    console.log(`   Email step created: ${sid} (${email.name})`);

    // Update with subject + HTML
    await api('PUT', `/automations/${aid}/steps/${sid}`, {
      data: {
        name:       email.name,
        subject:    email.subject,
        from:       FROM_EMAIL,
        from_name:  FROM_NAME,
        reply_to:   REPLY_TO,
        body_html:  loadHtml(email.file),
      },
    });
    console.log(`   Email step updated: "${email.subject.slice(0, 50)}..."`);

    // Add delay after emails 1 and 2 (not after the last one)
    if (i < DELAYS.length) {
      const { data: delay } = await api('POST', `/automations/${aid}/steps`, {
        type: 'delay',
        days: DELAYS[i],
      });
      console.log(`   Delay step created: ${DELAYS[i]} days (${delay.id})`);
    }
  }

  // 3. Set the group trigger via automation update
  await api('PUT', `/automations/${aid}`, {
    name: `SaveRx — ${group.name}`,
    trigger: {
      type:   'subscriber_added_to_group',
      groups: [group.id],
    },
  });
  console.log(`   Trigger set: subscriber joins "${group.name}"`);

  console.log(`   ✓ Automation complete: ${aid}`);
  return aid;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SaveRx — MailerLite Automation Setup');
  console.log('=====================================');
  if (DRY_RUN) console.log('DRY RUN — no changes will be made\n');

  // Check for existing automations
  const existing = await api('GET', '/automations?limit=25');
  if (existing.data.length > 0) {
    console.log(`\n⚠  Warning: ${existing.data.length} existing automation(s) found:`);
    existing.data.forEach(a => console.log(`   - "${a.name}" (${a.id})`));
    console.log('\nThis script will create NEW automations alongside them.');
    console.log('Delete any duplicates manually in the MailerLite dashboard afterwards.\n');
  }

  // Create automations for all groups
  const results = [];
  for (const group of GROUPS) {
    try {
      const id = await createAutomation(group);
      results.push({ group: group.name, id, status: 'created' });
    } catch (err) {
      console.error(`\n✗ Failed for ${group.name}: ${err.message}`);
      results.push({ group: group.name, id: null, status: 'failed' });
    }
  }

  // Summary
  console.log('\n\n══ Summary ════════════════════════════════');
  results.forEach(r => {
    const icon = r.status === 'created' ? '✓' : '✗';
    console.log(`  ${icon}  ${r.group} → ${r.id || 'FAILED'}`);
  });

  const failed = results.filter(r => r.status === 'failed').length;
  if (failed === 0) {
    console.log('\n✅  All automations created successfully!');
    console.log('\nNext step: go to app.mailerlite.com → Automations');
    console.log('Review each automation and click "Activate" to enable them.');
  } else {
    console.log(`\n⚠  ${failed} automation(s) failed. Check errors above.`);
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
