/**
 * Deduplicates saverx-leads.csv by email+drug combo.
 * Preserves rows where same email has different drugs (multi-group).
 * Usage: node scripts/dedup-csv.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT  = join(__dirname, '..', 'data', 'saverx-leads.csv');
const OUTPUT = join(__dirname, '..', 'data', 'saverx-leads-deduped.csv');

function parseCSV(content) {
  const lines  = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  return { header: lines[0], rows: lines.slice(1).map(line => {
    const fields = [];
    let current = '', inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return Object.fromEntries(header.map((h, i) => [h, fields[i] || '']));
  })};
}

const content = readFileSync(INPUT, 'utf8');
const { header, rows } = parseCSV(content);
const total = rows.length;

// Keep unique email+drug combos (case-insensitive), preserve original casing
const seen = new Set();
const deduped = rows.filter(row => {
  const email = (row.email || '').trim().toLowerCase();
  const drug  = (row.drug  || '').trim().toLowerCase();
  if (!email.includes('@')) return false; // skip non-emails
  const key = email + '||' + drug;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Stats
const removed = total - deduped.length;
const byEmail = {};
deduped.forEach(r => {
  const e = (r.email || '').toLowerCase();
  byEmail[e] = byEmail[e] || [];
  byEmail[e].push(r.drug);
});
const multiDrug = Object.entries(byEmail).filter(([, d]) => d.length > 1);

console.log('=== CSV Deduplication ===');
console.log(`  Input rows:        ${total}`);
console.log(`  After dedup:       ${deduped.length}`);
console.log(`  Duplicates removed:${removed}`);
console.log(`  Unique emails:     ${Object.keys(byEmail).length}`);
console.log(`  Multi-drug emails: ${multiDrug.length} (will join multiple groups)`);
if (multiDrug.length) {
  multiDrug.forEach(([e, d]) => console.log(`    ${e} → ${d.join(', ')}`));
}

// Write deduped CSV (same header, escape fields with commas)
const escapeField = v => (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v;
const csvLines = [
  header,
  ...deduped.map(r => [r.timestamp, r.email, r.drug, r.source, r.useragent].map(escapeField).join(',')),
];
writeFileSync(OUTPUT, csvLines.join('\n'), 'utf8');
console.log(`\n✅  Written to data/saverx-leads-deduped.csv`);
