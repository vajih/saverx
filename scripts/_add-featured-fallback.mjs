// Add featured-list fallback to all drug pages:
// When ?mode=drug returns null, fetch ?mode=featured and find the matching drug.
// This gives correct brand name, generic, manufacturer, manufacturerUrl, cash_price, as_low_as.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OLD = `const d = (json && json.item) ? json.item : {};`;
const NEW = `let d = (json && json.item) ? json.item : null;

          // Fallback: if no per-drug data, try featured list (has all 360 drugs + manufacturer URLs)
          if (!d) {
            try {
              const fr = await fetch(\`\${API}?mode=featured\`, { cache: 'no-cache' });
              const fj = await fr.json();
              const match = (fj.items || []).find(i => {
                const n = (i.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '');
                return n === slug;
              });
              if (match) d = {
                brand: match.name,
                generic: match.generic || '',
                manufacturer: match.manufacturer || '',
                manufacturerUrl: match.url || '',
                cash_price: match.cash_price,
                copay_price: match.as_low_as
              };
            } catch (e) { /* silent */ }
          }
          d = d || {};`;

// Fix the Google-search manufacturer fallback back to plain "/" for drugs with no URL at all
const MFURL_BAD = "window.__manufacturerUrl = d.manufacturerUrl || `https://www.google.com/search?q=${encodeURIComponent((d.brand||slug.replace(/-/g,\" \"))+\" copay card manufacturer savings program\")}`;";
const MFURL_GOOD = "window.__manufacturerUrl = d.manufacturerUrl || '/';";

let fixed = 0;

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!f.endsWith('.html')) continue;

    let html = readFileSync(full, 'utf8');
    if (!html.includes(OLD) && !html.includes(MFURL_BAD)) continue;

    if (html.includes(OLD)) html = html.replace(OLD, NEW);
    if (html.includes(MFURL_BAD)) html = html.replace(MFURL_BAD, MFURL_GOOD);

    writeFileSync(full, html, 'utf8');
    fixed++;
  }
}

walk('./drugs');
console.log(`Fixed ${fixed} drug pages`);
