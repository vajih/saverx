#!/usr/bin/env node
/**
 * _add-categories-nav.mjs
 *
 * Injects/upgrades the Categories nav entry in all drug pages under
 * drugs/{slug}/index.html.
 *
 * Pass 1 (initial): inserts plain <a> after Drugs link — already done.
 * Pass 2 (current): upgrades plain Categories <a> to dropdown markup.
 *
 * Run:
 *   node scripts/_add-categories-nav.mjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Print what would change without writing files
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const DRUGS_DIR = resolve(new URL('.', import.meta.url).pathname, '../drugs');

const DROPDOWN_HTML = `<div class="nav-dropdown" id="catDropdown">
          <button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="catDropdownMenu">Categories <span class="caret">▾</span></button>
          <div class="nav-dropdown-menu" id="catDropdownMenu" role="menu">
            <a href="/categories/weight-loss/" role="menuitem">⚖️ Weight Loss &amp; GLP-1</a>
            <a href="/categories/diabetes/" role="menuitem">💉 Diabetes</a>
            <a href="/categories/heart-cholesterol/" role="menuitem">❤️ Heart &amp; Cholesterol</a>
            <a href="/categories/autoimmune/" role="menuitem">🛡️ Autoimmune &amp; Inflammation</a>
            <a href="/categories/migraine/" role="menuitem">⚡ Migraine</a>
            <a href="/categories/respiratory/" role="menuitem">🫁 Asthma &amp; Respiratory</a>
            <a href="/categories/mental-health/" role="menuitem">🧠 Mental Health</a>
            <hr>
            <a href="/categories/" role="menuitem"><strong>View all categories →</strong></a>
          </div>
        </div>`;

const DROPDOWN_JS = `
  <script>
  /* ---- Nav dropdown ---- */
  (function(){
    var dd = document.getElementById('catDropdown');
    if (!dd) return;
    var btn = dd.querySelector('.nav-dropdown-toggle');
    var menu = dd.querySelector('.nav-dropdown-menu');
    function open() { dd.setAttribute('data-open',''); btn.setAttribute('aria-expanded','true'); }
    function close() { dd.removeAttribute('data-open'); btn.setAttribute('aria-expanded','false'); }
    btn.addEventListener('click', function(e){ e.stopPropagation(); dd.hasAttribute('data-open') ? close() : open(); });
    document.addEventListener('click', close);
    menu.addEventListener('click', function(e){ e.stopPropagation(); });
    btn.addEventListener('keydown', function(e){
      if (e.key === 'Escape') { close(); btn.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); open(); menu.querySelector('[role="menuitem"]').focus(); }
    });
  })();
  </script>`;

// ---- Patterns ----
// Case A: already has plain <a href="/categories/">Categories</a> — upgrade to dropdown
const PLAIN_LINK = `<a href="/categories/">Categories</a>`;

// Case B: already has dropdown (skip — already done)
const DROPDOWN_SENTINEL = 'class="nav-dropdown"';

// Case C: no categories link yet — insert after Drugs link
const DRUGS_LINK_ARIA      = `<a href="/drugs/" aria-current="page">Drugs</a>\n        <a href="/comparisons.html">Comparisons</a>`;
const DRUGS_LINK_ARIA_REPL = `<a href="/drugs/" aria-current="page">Drugs</a>\n        ${DROPDOWN_HTML}\n        <a href="/comparisons.html">Comparisons</a>`;

const DRUGS_LINK_PLAIN     = `<a href="/drugs/">Drugs</a>\n        <a href="/comparisons.html">Comparisons</a>`;
const DRUGS_LINK_PLAIN_REPL = `<a href="/drugs/">\n        ${DROPDOWN_HTML}\n        <a href="/comparisons.html">Comparisons</a>`;

// ---- JS injection targets ----
const BODY_CLOSE = '</body>';

let modified = 0;
let skipped = 0;
let alreadyDone = 0;

function processFile(filePath) {
  let content;
  try { content = readFileSync(filePath, 'utf8'); }
  catch { console.error(`  [ERROR] Cannot read ${filePath}`); return; }

  // Already has dropdown — skip
  if (content.includes(DROPDOWN_SENTINEL)) {
    // But may need dropdown JS if not yet injected
    if (!content.includes('catDropdown') || content.includes(DROPDOWN_JS.trim().slice(0, 30))) {
      alreadyDone++;
      return;
    }
    // Has dropdown markup but no JS — fall through to add JS
  }

  let updated = content;

  // Case A: upgrade plain link to dropdown
  if (updated.includes(PLAIN_LINK)) {
    updated = updated.replace(PLAIN_LINK, DROPDOWN_HTML);
  }
  // Case B/C: no categories link at all — insert after Drugs link
  else if (!updated.includes(DROPDOWN_SENTINEL)) {
    if (!updated.includes('<a href="/drugs/">Drugs</a>')) {
      skipped++;
      return;
    }
    if (updated.includes(DRUGS_LINK_ARIA)) {
      updated = updated.replace(DRUGS_LINK_ARIA, DRUGS_LINK_ARIA_REPL);
    } else if (updated.includes(DRUGS_LINK_PLAIN)) {
      updated = updated.replace(DRUGS_LINK_PLAIN, DRUGS_LINK_PLAIN_REPL);
    } else {
      console.warn(`  [WARN] Nav pattern not matched: ${filePath}`);
      skipped++;
      return;
    }
  }

  // Inject dropdown JS before </body> if not already present
  if (!updated.includes('catDropdown') || !updated.includes('nav-dropdown-toggle')) {
    updated = updated.replace(BODY_CLOSE, DROPDOWN_JS + '\n</body>');
  } else if (!updated.includes("dd.querySelector('.nav-dropdown-toggle')")) {
    updated = updated.replace(BODY_CLOSE, DROPDOWN_JS + '\n</body>');
  }

  if (updated === content) {
    skipped++;
    return;
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would update: ${filePath}`);
  } else {
    writeFileSync(filePath, updated, 'utf8');
    console.log(`  [OK] Updated: ${filePath}`);
  }
  modified++;
}

function walkDrugs(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subdir = join(dir, entry.name);
    const indexPath = join(subdir, 'index.html');
    try { statSync(indexPath); processFile(indexPath); }
    catch { /* No index.html — skip */ }
  }
}

console.log(`\n🔍 Scanning drug pages in: ${DRUGS_DIR}`);
console.log(DRY_RUN ? '⚠️  DRY-RUN mode\n' : '✍️  Writing changes\n');

walkDrugs(DRUGS_DIR);

console.log(`\n📊 Results: ${modified} updated, ${alreadyDone} already done, ${skipped} skipped`);

console.log(`\n✅ Done.`);
console.log(`   Modified:    ${modified}`);
console.log(`   Already done: ${alreadyDone}`);
console.log(`   Skipped:     ${skipped}`);

if (DRY_RUN && modified > 0) {
  console.log(`\nRun without --dry-run to apply ${modified} change(s).`);
}
