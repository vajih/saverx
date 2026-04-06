import { readFileSync } from 'fs';
import { join } from 'path';

const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();
const key = get('MAILERLITE_API_KEY');

// Check all custom fields registered in the account
const r1 = await fetch('https://connect.mailerlite.com/api/fields', {
  headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
});
const d1 = await r1.json();
console.log('=== Account Custom Fields ===');
for (const f of d1.data) {
  console.log(`  key: "${f.key}" | name: "${f.name}" | type: ${f.type}`);
}

// Check a real subscriber's field values
const r2 = await fetch('https://connect.mailerlite.com/api/subscribers/tosiba7787@kobace.com', {
  headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
});
const d2 = await r2.json();
console.log('\n=== Subscriber tosiba7787@kobace.com fields ===');
console.log(JSON.stringify(d2.data?.fields, null, 2));
