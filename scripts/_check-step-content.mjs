import { readFileSync } from 'fs';
const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();
const key = get('MAILERLITE_API_KEY');

// Fetch the Diabetes & CGM automation details including steps
const r = await fetch('https://connect.mailerlite.com/api/automations/184019905891272350?include=steps', {
  headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
});
const d = await r.json();
console.log('Status:', r.status);
console.log('Keys:', Object.keys(d.data || d));

// Look for body/html content
const data = d.data || d;
const steps = data.steps || [];
const emailSteps = steps.filter(s => s.type === 'email');
for (const step of emailSteps.slice(0, 1)) {  // just check Email 1
  const email = step.email;
  console.log(`\n=== Step: ${step.name} ===`);
  console.log(`  subject: ${email?.subject}`);
  console.log(`  preview_url: ${email?.preview_url}`);

  // Fetch the preview HTML to check actual body content
  if (email?.preview_url) {
    const pr = await fetch(email.preview_url);
    const html = await pr.text();
    // Search for drug-related merge tags or content
    const drugIdx = html.indexOf('drug');
    const subscriberIdx = html.indexOf('subscriber');
    console.log(`\n  preview HTML length: ${html.length}`);
    if (drugIdx !== -1) {
      console.log(`  snippet around 'drug': ...${html.substring(Math.max(0,drugIdx-80), drugIdx+120)}...`);
    } else {
      console.log(`  WARNING: 'drug' not found anywhere in preview HTML`);
    }
    if (subscriberIdx !== -1) {
      console.log(`  snippet around 'subscriber': ...${html.substring(Math.max(0,subscriberIdx-30), subscriberIdx+80)}...`);
    }
  }
}
