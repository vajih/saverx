import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(ROOT, '.env'), 'utf8');
const get = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1].trim();
const key = get('MAILERLITE_API_KEY');
const ids = {
  'General Savings':  '183948742309709071',
  'Diabetes & CGM':   '184019905891272350',
  'Cardiovascular':   '184022369906460254',
  'GLP-1 Users':      '184024979964167834',
};

await Promise.all(Object.entries(ids).map(async ([name, id]) => {
  const r = await fetch(`https://connect.mailerlite.com/api/automations/${id}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  const { data: a } = await r.json();
  const s = a.stats;
  console.log(`${name} | enabled:${a.enabled} | sent:${s?.sent} | in_queue:${s?.subscribers_in_queue_count} | completed:${s?.completed_subscribers_count}`);
}));
