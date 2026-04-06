import { readFileSync } from 'fs';
const env = readFileSync('/Users/vajihkhan/Development/saverx/.env', 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();
const key = get('MAILERLITE_API_KEY');

const email = 'yalad35158@kobace.com';

const r = await fetch(`https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`, {
  headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
});
console.log('Status:', r.status);
if (r.status === 404) { console.log('❌ Subscriber NOT in MailerLite yet'); process.exit(0); }
const d = await r.json();
const s = d.data;
console.log('\n✅ Subscriber found!');
console.log('  email:', s.email);
console.log('  status:', s.status);
console.log('  fields:', JSON.stringify(s.fields));
console.log('  groups:', s.groups?.map(g => g.name));
