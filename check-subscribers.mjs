import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const key = env.split('\n').find(l => l.startsWith('MAILERLITE_API_KEY=')).split('=').slice(1).join('=').replace(/\s/g,'');
const h = { Authorization: `Bearer ${key}`, Accept: 'application/json' };

// Account stats
const statsRes = await fetch('https://connect.mailerlite.com/api/stats', { headers: h });
const stats = await statsRes.json();
console.log('Account stats:', JSON.stringify(stats, null, 2));

// Group subscriber counts (stored in the group object itself)
const groupsRes = await fetch('https://connect.mailerlite.com/api/groups', { headers: h });
const groups = await groupsRes.json();
console.log('\nGroups:');
for (const g of groups.data || []) {
  console.log(`  ${g.name}: ${g.active_count ?? g.total} active`);
}
