import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OLD_URL = 'https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec';
const NEW_URL = 'https://script.google.com/macros/s/AKfycbxC1tTVJEWrc7LsnwqsnuCrqUNLV_FZkE4Q3AKq-PtjBN0ZNSdC-IncGa0BqjbzzIBakQ/exec';

let filesFixed = 0;
let filesSkipped = 0;

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!f.endsWith('.html')) continue;

    let html = readFileSync(full, 'utf8');
    let changed = false;

    // 1. Revert SAVERX_API to old data URL + add SAVERX_FORM_API on next line
    if (html.includes(`window.SAVERX_API = "${NEW_URL}"`)) {
      html = html.replace(
        `window.SAVERX_API = "${NEW_URL}";`,
        `window.SAVERX_API = "${OLD_URL}";\n    window.SAVERX_FORM_API = "${NEW_URL}";`
      );
      changed = true;
    }

    // 2. Add FORM_API constant after API constant (avoid double-adding)
    if (html.includes('const API = window.SAVERX_API;') && !html.includes('const FORM_API =')) {
      html = html.replace(
        'const API = window.SAVERX_API;',
        'const API = window.SAVERX_API;\n      const FORM_API = window.SAVERX_FORM_API || API;'
      );
      changed = true;
    }

    // 3. Replace sendBeacon(API, → sendBeacon(FORM_API,
    if (html.includes('navigator.sendBeacon(API,')) {
      html = html.replaceAll('navigator.sendBeacon(API,', 'navigator.sendBeacon(FORM_API,');
      changed = true;
    }

    // 4. Replace fetch(API, → fetch(FORM_API, (only form POSTs — GET uses fetch(u, not fetch(API,)
    if (html.includes('fetch(API,')) {
      html = html.replaceAll('fetch(API,', 'fetch(FORM_API,');
      changed = true;
    }

    if (changed) {
      writeFileSync(full, html, 'utf8');
      filesFixed++;
    } else {
      filesSkipped++;
    }
  }
}

walk('.');
console.log(`Fixed: ${filesFixed} files`);
console.log(`Skipped (no match): ${filesSkipped} files`);
