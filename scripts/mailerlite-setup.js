#!/usr/bin/env node
/**
 * SaveRx.ai — MailerLite Setup Script
 *
 * Run this ONCE to:
 *   1. Verify your API key works
 *   2. Create the 5 subscriber groups
 *   3. Create the 3 custom fields (drug, source, drug_category)
 *   4. Print group IDs to paste into your .env and Apps Script
 *
 * Usage:
 *   node scripts/mailerlite-setup.js
 *
 * Requires: MAILERLITE_API_KEY in .env
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env manually (no dotenv dependency needed)
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

const API_KEY = process.env.MAILERLITE_API_KEY;
if (!API_KEY) {
  console.error('❌  MAILERLITE_API_KEY not set. Add it to your .env file.');
  process.exit(1);
}

const BASE_URL = 'https://connect.mailerlite.com/api';
const HEADERS = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

// ─── Step 1: Verify API key ───────────────────────────────────────────────────
async function verifyKey() {
  console.log('\n🔑  Verifying API key...');
  const res = await api('GET', '/subscribers?limit=1');
  if (res.status === 401) {
    console.error('❌  Invalid API key. Check your MAILERLITE_API_KEY in .env');
    console.error('    Make sure you\'re using the NEW MailerLite API token');
    console.error('    (it starts with "eyJ..." — get it from app.mailerlite.com → Integrations → API)');
    process.exit(1);
  }
  if (res.status !== 200) {
    console.error(`❌  Unexpected response (${res.status}):`, res.data);
    process.exit(1);
  }
  console.log('✅  API key valid');
}

// ─── Step 2: Create groups ────────────────────────────────────────────────────
const GROUPS_TO_CREATE = [
  { key: 'MAILERLITE_GROUP_GLP1',     name: 'GLP-1 Users' },
  { key: 'MAILERLITE_GROUP_CARDIO',   name: 'Cardiovascular' },
  { key: 'MAILERLITE_GROUP_DIABETES', name: 'Diabetes & CGM' },
  { key: 'MAILERLITE_GROUP_GENERAL',  name: 'General Savings' },
  { key: 'MAILERLITE_GROUP_ALL',      name: 'All SaveRx Leads' },
];

async function createGroups() {
  console.log('\n📁  Creating subscriber groups...');

  // Get existing groups first to avoid duplicates
  const existing = await api('GET', '/groups?limit=100');
  const existingNames = {};
  if (existing.data?.data) {
    for (const g of existing.data.data) {
      existingNames[g.name] = g.id;
    }
  }

  const groupIds = {};
  for (const { key, name } of GROUPS_TO_CREATE) {
    if (existingNames[name]) {
      console.log(`  ⚠️   "${name}" already exists — using existing (ID: ${existingNames[name]})`);
      groupIds[key] = existingNames[name];
      continue;
    }
    const res = await api('POST', '/groups', { name });
    if (res.status === 201 && res.data?.data?.id) {
      console.log(`  ✅  Created "${name}" (ID: ${res.data.data.id})`);
      groupIds[key] = res.data.data.id;
    } else {
      console.error(`  ❌  Failed to create "${name}":`, res.data);
    }
  }
  return groupIds;
}

// ─── Step 3: Create custom fields ────────────────────────────────────────────
const FIELDS_TO_CREATE = [
  { name: 'Drug',        key: 'drug',         type: 'text' },
  { name: 'Lead Source', key: 'lead_source',  type: 'text' },
  { name: 'Drug Category', key: 'drug_category', type: 'text' },
];

async function createFields() {
  console.log('\n🏷️   Creating custom fields...');

  // Get existing fields
  const existing = await api('GET', '/fields?limit=100');
  const existingKeys = {};
  if (existing.data?.data) {
    for (const f of existing.data.data) {
      existingKeys[f.key] = f.id;
    }
  }

  for (const { name, key, type } of FIELDS_TO_CREATE) {
    if (existingKeys[key]) {
      console.log(`  ⚠️   Field "${key}" already exists — skipping`);
      continue;
    }
    const res = await api('POST', '/fields', { name, key, type });
    if (res.status === 201) {
      console.log(`  ✅  Created field "${key}" (${type})`);
    } else {
      console.error(`  ❌  Failed to create field "${key}":`, res.data);
    }
  }
}

// ─── Step 4: Print results ────────────────────────────────────────────────────
function printEnvBlock(groupIds) {
  console.log('\n' + '═'.repeat(60));
  console.log('📋  COPY THESE INTO YOUR .env FILE:');
  console.log('═'.repeat(60));
  for (const [key, id] of Object.entries(groupIds)) {
    console.log(`${key}=${id}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋  COPY THESE INTO Apps Script (Code.gs):');
  console.log('═'.repeat(60));
  console.log('const MAILERLITE_GROUPS = {');
  const keyMap = {
    MAILERLITE_GROUP_GLP1:     'glp1',
    MAILERLITE_GROUP_CARDIO:   'cardiovascular',
    MAILERLITE_GROUP_DIABETES: 'diabetes',
    MAILERLITE_GROUP_GENERAL:  'general',
    MAILERLITE_GROUP_ALL:      'all',
  };
  for (const [envKey, id] of Object.entries(groupIds)) {
    console.log(`  ${keyMap[envKey]}: '${id}',`);
  }
  console.log('};');
  console.log('═'.repeat(60) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀  SaveRx.ai MailerLite Setup');
  console.log('─'.repeat(40));

  await verifyKey();
  const groupIds = await createGroups();
  await createFields();
  printEnvBlock(groupIds);

  console.log('✅  Setup complete! Next steps:');
  console.log('   1. Copy the .env values above into your .env file');
  console.log('   2. Copy the MAILERLITE_GROUPS block into Code.gs');
  console.log('   3. Run: node scripts/mailerlite-import.js --csv data/saverx-leads.csv');
  console.log('   4. Deploy the updated Apps Script (new version)');
})();
