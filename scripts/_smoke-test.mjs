// Smoke test: POST to SAVERX_FORM_API and check MailerLite for recent subscribers
import { readFileSync } from 'fs';
const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const getEnv = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();

const FORM_URL = 'https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec';
const ML_KEY = getEnv('MAILERLITE_API_KEY');

// 1. POST test submission
console.log('--- Test 1: POST to SAVERX_FORM_API ---');
try {
  const body = new URLSearchParams({
    email: 'smoketest@saverx-test.com',
    drug: 'Repatha',
    source: 'Smoke Test CLI'
  }).toString();

  const res = await fetch(FORM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'follow'
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Final URL:', res.url.slice(0, 80));
  console.log('Body:', text.slice(0, 200));
} catch (e) {
  console.error('POST error:', e.message);
}

// 2. Check MailerLite for recent subscribers
console.log('\n--- Test 2: Recent MailerLite subscribers ---');
try {
  const mlRes = await fetch('https://connect.mailerlite.com/api/subscribers?limit=5&sort=-created_at', {
    headers: {
      Authorization: `Bearer ${ML_KEY}`,
      Accept: 'application/json',
    }
  });
  const mlJson = await mlRes.json();
  if (mlJson.data?.length) {
    console.log('Most recent subscribers:');
    mlJson.data.forEach(s => {
      console.log(` - ${s.email} | ${s.created_at} | drug: ${s.fields?.drug || '(none)'}`);
    });
  } else {
    console.log('No subscribers returned. Response:', JSON.stringify(mlJson).slice(0, 200));
  }
} catch (e) {
  console.error('MailerLite error:', e.message);
}
