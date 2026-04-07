// Full end-to-end test: Sheet write + MailerLite automation trigger
import { readFileSync } from 'fs';
const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const getEnv = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();

const FORM_URL = 'https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec';
const ML_KEY = getEnv('MAILERLITE_API_KEY');
const ML_GROUP_CARDIO = getEnv('MAILERLITE_GROUP_CARDIO');
const ML_GROUP_ALL = getEnv('MAILERLITE_GROUP_ALL');

const TEST_EMAIL = 'nosomol413@nazisat.com';
const TEST_DRUG = 'Repatha';

// Step 1: POST to Apps Script (writes to Google Sheet)
console.log('--- Step 1: POST to Apps Script (Google Sheet write) ---');
try {
  const body = new URLSearchParams({
    email: TEST_EMAIL,
    drug: TEST_DRUG,
    source: 'Drug Page Modal'
  }).toString();
  const res = await fetch(FORM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'follow'
  });
  console.log('Status:', res.status, '— Sheet write', res.status === 200 ? '✅' : '⚠️');
} catch (e) {
  console.error('POST error:', e.message);
}

// Step 2: Add to MailerLite cardiovascular group (triggers automation)
console.log('\n--- Step 2: Add to MailerLite (cardiovascular + all groups) ---');
console.log('Groups → cardiovascular:', ML_GROUP_CARDIO, '| all:', ML_GROUP_ALL);
try {
  const payload = {
    email: TEST_EMAIL,
    fields: {
      drug: TEST_DRUG,
      lead_source: 'Drug Page Modal',
      drug_category: 'cardiovascular'
    },
    groups: [ML_GROUP_CARDIO, ML_GROUP_ALL],
    status: 'active'
  };
  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ML_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (res.status === 200 || res.status === 201) {
    console.log('✅ Added to MailerLite');
    console.log('   Subscriber ID:', json.data?.id);
    console.log('   Email:', json.data?.email);
    console.log('   Groups:', json.data?.groups?.map(g => g.name).join(', ') || '(check MailerLite)');
    console.log('   Status:', json.data?.status);
  } else {
    console.log('❌ MailerLite error:', res.status, JSON.stringify(json).slice(0, 300));
  }
} catch (e) {
  console.error('MailerLite error:', e.message);
}

// Step 3: Verify subscriber is in MailerLite
console.log('\n--- Step 3: Verify in MailerLite ---');
try {
  const checkRes = await fetch(`https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(TEST_EMAIL)}`, {
    headers: { Authorization: `Bearer ${ML_KEY}`, Accept: 'application/json' }
  });
  const checkJson = await checkRes.json();
  if (checkRes.status === 200) {
    console.log('✅ Subscriber confirmed in MailerLite');
    console.log('   Email:', checkJson.data?.email);
    console.log('   Drug field:', checkJson.data?.fields?.drug);
    console.log('   Category:', checkJson.data?.fields?.drug_category);
    console.log('   Groups:', checkJson.data?.groups?.map(g => g.name).join(', '));
  } else {
    console.log('❌ Not found:', checkRes.status);
  }
} catch (e) {
  console.error('Verify error:', e.message);
}
