// Test if we can PUT body HTML directly to an automation email step
// Testing on Diabetes & CGM Email 1 (step ID: 184019933065118827, email ID: 184019981449561870)
import { readFileSync } from 'fs';
import { join } from 'path';
const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();
const key = get('MAILERLITE_API_KEY');

const emailId = '184019981449561870';
const automationId = '184019905891272350';

// Try updating with a simple test HTML that has a merge tag
const testHtml = '<p>TEST DRUG: {$subscriber.fields.drug}</p>';

const r = await fetch(`https://connect.mailerlite.com/api/automations/${automationId}/emails/${emailId}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  body: JSON.stringify({
    content: testHtml,
    type: 'html'
  })
});
console.log('PUT status:', r.status);
const d = await r.json();
console.log('Response:', JSON.stringify(d).substring(0, 500));

// Wait 2 seconds then fetch the preview to see if it stuck
await new Promise(r => setTimeout(r, 2000));
const preview = await fetch(d.data?.email?.preview_url || `https://preview.mailerlite.io/preview/2246161/emails/${emailId}`);
const html = await preview.text();
const idx = html.indexOf('TEST DRUG');
if (idx !== -1) {
  console.log('\n✅ Body HTML update WORKED!');
  console.log('snippet:', html.substring(idx, idx + 60));
} else {
  const drugIdx = html.indexOf('drug');
  console.log('\n❌ Body HTML update did NOT stick (preview still old content)');
  console.log('drug appears at:', drugIdx, drugIdx !== -1 ? html.substring(Math.max(0,drugIdx-20), drugIdx+60) : 'not found');
}
