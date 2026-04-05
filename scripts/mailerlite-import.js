#!/usr/bin/env node
/**
 * SaveRx.ai — MailerLite Bulk Import Script
 *
 * Imports existing SaveRx leads from a CSV into MailerLite
 * with correct group assignment and custom fields.
 *
 * Usage:
 *   node scripts/mailerlite-import.js --csv data/saverx-leads.csv
 *   node scripts/mailerlite-import.js --csv data/saverx-leads.csv --dry-run
 *   node scripts/mailerlite-import.js --csv data/saverx-leads.csv --limit 10
 *
 * CSV format expected: Timestamp, Email, Drug, Source, UserAgent
 * (matches the SaveRx Leads Google Sheet export)
 *
 * Requires: MAILERLITE_API_KEY and MAILERLITE_GROUP_* vars in .env
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Load .env ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
try {
  const envFile = readFileSync(envPath, 'utf8');
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch {
  console.log('No .env file found — using process environment variables');
}

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const csvPath  = args[args.indexOf('--csv') + 1];
const isDryRun = args.includes('--dry-run');
const limit    = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;

if (!csvPath) {
  console.error('❌  Usage: node scripts/mailerlite-import.js --csv data/saverx-leads.csv');
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.MAILERLITE_API_KEY;
if (!API_KEY) {
  console.error('❌  MAILERLITE_API_KEY not set in .env');
  process.exit(1);
}

const GROUPS = {
  glp1:           process.env.MAILERLITE_GROUP_GLP1,
  cardiovascular: process.env.MAILERLITE_GROUP_CARDIO,
  diabetes:       process.env.MAILERLITE_GROUP_DIABETES,
  general:        process.env.MAILERLITE_GROUP_GENERAL,
  all:            process.env.MAILERLITE_GROUP_ALL,
};

if (!GROUPS.all) {
  console.error('❌  MAILERLITE_GROUP_ALL not set. Run mailerlite-setup.js first.');
  process.exit(1);
}

const BASE_URL = 'https://connect.mailerlite.com/api';
const HEADERS  = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type':  'application/json',
  'Accept':        'application/json',
};

// Rate limiting: 60 requests/min on free plan → 1 req/sec to be safe
const BATCH_SIZE  = 10;
const BATCH_DELAY = 1200; // ms between batches

// ─── Drug category mapping ────────────────────────────────────────────────────
const DRUG_CATEGORIES = {
  glp1: [
    'ozempic', 'wegovy', 'mounjaro', 'trulicity', 'victoza',
    'saxenda', 'rybelsus', 'semaglutide', 'tirzepatide',
  ],
  cardiovascular: [
    'repatha', 'eliquis', 'entresto', 'jardiance', 'baqsimi',
    'corlanor', 'valsartan', 'lisinopril', 'metoprolol',
    'kevzara', 'vimpat', 'trulance',
  ],
  diabetes: [
    'freestylelibre', 'freestyle libre', 'toujeo', 'dymista',
    'xultophy', 'tresiba', 'basaglar', 'lantus', 'levemir',
    'januvia', 'farxiga', 'invokana',
  ],
};

function getDrugCategory(drug) {
  if (!drug || drug === 'N/A' || drug.trim() === '') return 'general';
  const lower = drug.toLowerCase().replace(/[®™]/g, '').trim();
  for (const [cat, drugs] of Object.entries(DRUG_CATEGORIES)) {
    if (drugs.some(d => lower.includes(d))) return cat;
  }
  return 'general';
}

// ─── Extract drug name from a referrer URL ──────────────────────────────────
function extractDrugFromReferrer(referrer) {
  if (!referrer) return '';
  const m = referrer.match(/\/drugs\/([^/]+)/);
  return m ? m[1].replace(/-enroll$/, '').replace(/-/g, ' ').trim() : '';
}

// ─── CSV parser (no dependencies) ────────────────────────────────────────────
function parseCSV(content) {
  const lines  = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const fields = [];
    let current  = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return Object.fromEntries(header.map((h, i) => [h, fields[i] || '']));
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────
const SKIP_PATTERNS = [
  /^test/i, /example\.com$/i, /spam/i, /fake/i,
  /^[a-z]{1,3}@/i,  // Very short local parts (likely test data)
];

function isValidEmail(email) {
  if (!email || !email.includes('@') || !email.includes('.')) return false;
  if (SKIP_PATTERNS.some(p => p.test(email))) return false;
  // Basic email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── MailerLite API ───────────────────────────────────────────────────────────
async function addSubscriber(email, drug, source) {
  const category = getDrugCategory(drug);
  const groupIds = [GROUPS[category], GROUPS.all].filter(Boolean);

  const body = {
    email,
    fields: {
      drug:          drug || 'N/A',
      lead_source:   source || 'unknown',
      drug_category: category,
    },
    groups: groupIds,
    status: 'active',
  };

  const res = await fetch(`${BASE_URL}/subscribers`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  return { status: res.status, data, category, groupIds };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🚀  SaveRx.ai — MailerLite Bulk Import');
  if (isDryRun) console.log('🔍  DRY RUN MODE — no API calls will be made');
  console.log('─'.repeat(50));

  // Parse CSV
  let rows;
  try {
    const content = readFileSync(join(__dirname, '..', csvPath), 'utf8');
    rows = parseCSV(content);
    console.log(`📄  Loaded ${rows.length} rows from ${csvPath}`);
  } catch (e) {
    console.error(`❌  Could not read CSV: ${e.message}`);
    process.exit(1);
  }

  // Apply limit
  if (limit) {
    rows = rows.slice(0, limit);
    console.log(`⚠️   Limited to first ${limit} rows`);
  }

  // Stats
  const stats = { total: rows.length, added: 0, skipped: 0, errors: 0 };
  const categoryCount = { glp1: 0, cardiovascular: 0, diabetes: 0, general: 0 };
  const skippedEmails = [];

  console.log('\n📧  Processing subscribers...\n');

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const email  = (row.email || '').trim().toLowerCase();
      // Support both simple format (drug col) and enrollment sheet format (referrer col)
      const drug   = (row.drug || extractDrugFromReferrer(row.referrer) || '').trim();
      const source = (row.source || (row.referrer ? 'copay-enrollment' : 'unknown')).trim();

      // Validate
      if (!isValidEmail(email)) {
        stats.skipped++;
        skippedEmails.push({ email, reason: 'invalid email' });
        continue;
      }

      if (isDryRun) {
        const cat = getDrugCategory(drug);
        console.log(`  [DRY RUN] Would add: ${email} | drug: ${drug} | category: ${cat}`);
        stats.added++;
        categoryCount[cat]++;
        continue;
      }

      // Add to MailerLite
      try {
        const result = await addSubscriber(email, drug, source);
        if (result.status === 200 || result.status === 201) {
          stats.added++;
          categoryCount[result.category]++;
          process.stdout.write(`  ✅  ${email} → ${result.category}\n`);
        } else if (result.status === 422) {
          stats.skipped++;
          skippedEmails.push({ email, reason: 'validation error' });
          process.stdout.write(`  ⚠️   ${email} — skipped (validation)\n`);
        } else {
          stats.errors++;
          process.stdout.write(`  ❌  ${email} — error ${result.status}\n`);
        }
      } catch (e) {
        stats.errors++;
        console.error(`  ❌  ${email} — ${e.message}`);
      }
    }

    // Rate limit delay between batches
    if (!isDryRun && i + BATCH_SIZE < rows.length) {
      process.stdout.write(`\n  ⏳  Batch ${Math.floor(i/BATCH_SIZE)+1} done. Waiting ${BATCH_DELAY/1000}s...\n\n`);
      await sleep(BATCH_DELAY);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊  IMPORT SUMMARY');
  console.log('═'.repeat(50));
  console.log(`  Total rows:    ${stats.total}`);
  console.log(`  ✅ Added:       ${stats.added}`);
  console.log(`  ⚠️  Skipped:    ${stats.skipped}`);
  console.log(`  ❌ Errors:      ${stats.errors}`);
  console.log('\n  By drug category:');
  for (const [cat, count] of Object.entries(categoryCount)) {
    if (count > 0) console.log(`    ${cat.padEnd(16)} ${count}`);
  }
  if (skippedEmails.length > 0) {
    console.log('\n  Skipped emails:');
    skippedEmails.forEach(({ email, reason }) =>
      console.log(`    ${email} (${reason})`)
    );
  }
  console.log('═'.repeat(50));
  console.log('\n✅  Import complete!');
  if (!isDryRun) {
    console.log('   Check your MailerLite dashboard to verify subscribers were added.');
    console.log('   Now build your automation workflows in MailerLite → Automations.');
  }
})();
