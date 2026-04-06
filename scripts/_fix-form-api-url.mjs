// Fix SAVERX_FORM_API: currently pointing at the Repatha enrollment script (wrong).
// Restore it to the OLD URL which is the actual email capture script.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// The wrong URL that ended up as SAVERX_FORM_API by mistake (Repatha enrollment form)
const WRONG_FORM_API = 'https://script.google.com/macros/s/AKfycbxC1tTVJEWrc7LsnwqsnuCrqUNLV_FZkE4Q3AKq-PtjBN0ZNSdC-IncGa0BqjbzzIBakQ/exec';
// The correct URL — the original email capture script that wrote 252 leads to the Sheet
const CORRECT_FORM_API = 'https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec';

let fixed = 0;

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!f.endsWith('.html')) continue;

    let html = readFileSync(full, 'utf8');
    if (!html.includes(WRONG_FORM_API)) continue;

    html = html.replaceAll(WRONG_FORM_API, CORRECT_FORM_API);
    writeFileSync(full, html, 'utf8');
    fixed++;
  }
}

walk('./drugs');
// Also fix template
let tmpl = readFileSync('./templates/index.html', 'utf8');
if (tmpl.includes(WRONG_FORM_API)) {
  tmpl = tmpl.replaceAll(WRONG_FORM_API, CORRECT_FORM_API);
  writeFileSync('./templates/index.html', tmpl, 'utf8');
  fixed++;
  console.log('Fixed templates/index.html');
}
console.log(`Fixed ${fixed} files`);
