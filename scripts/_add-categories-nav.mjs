#!/usr/bin/env node
/**
 * _add-categories-nav.mjs
 *
 * Adds a "Categories" link to the primary nav and mobile drawer in all drug
 * pages under drugs/{slug}/index.html.
 *
 * Insertion point: AFTER the "Drugs" link, BEFORE "Comparisons".
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

// These patterns match the Drugs link with surrounding context in the nav.
// We insert the Categories link immediately after the Drugs link.
// Drug pages use aria-current="page" on the Drugs link.
const NAV_SEARCH = `<a href="/drugs/" aria-current="page">Drugs</a>
        <a href="/comparisons.html">Comparisons</a>`;

const NAV_REPLACE = `<a href="/drugs/" aria-current="page">Drugs</a>
        <a href="/categories/">Categories</a>
        <a href="/comparisons.html">Comparisons</a>`;

// Fallback: pages without aria-current
const NAV_SEARCH_PLAIN = `<a href="/drugs/">Drugs</a>
        <a href="/comparisons.html">Comparisons</a>`;

const NAV_REPLACE_PLAIN = `<a href="/drugs/">Drugs</a>
        <a href="/categories/">Categories</a>
        <a href="/comparisons.html">Comparisons</a>`;

// Mobile drawer: drug pages typically only have Home, About, Contact
// (no Drugs link in drawer). Skip drawer updates.
const DRAWER_SEARCH = null;
const DRAWER_REPLACE = null;
const DRAWER_SEARCH_ALT = null;
const DRAWER_REPLACE_ALT = null;

let modified = 0;
let skipped = 0;
let alreadyDone = 0;

function processFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.error(`  [ERROR] Cannot read ${filePath}`);
    return;
  }

  // Skip if already has the Categories link in nav
  if (content.includes('<a href="/categories/">Categories</a>')) {
    alreadyDone++;
    return;
  }

  // Skip if this page doesn't have the standard nav pattern
  if (!content.includes('<a href="/drugs/">Drugs</a>')) {
    skipped++;
    return;
  }

  let updated = content;

  // 1. Update primary nav (with aria-current)
  if (updated.includes(NAV_SEARCH)) {
    updated = updated.replace(NAV_SEARCH, NAV_REPLACE);
  } else if (updated.includes(NAV_SEARCH_PLAIN)) {
    // Fallback for pages without aria-current on Drugs link
    updated = updated.replace(NAV_SEARCH_PLAIN, NAV_REPLACE_PLAIN);
  }

  // 2. Drawer updates skipped — drug page drawers don't include a Drugs link

  if (updated === content) {
    // Nav pattern present but exact whitespace didn't match — log for manual review
    console.warn(`  [WARN] Could not match nav pattern in: ${filePath}`);
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
    try {
      statSync(indexPath);
      processFile(indexPath);
    } catch {
      // No index.html in this subdir — skip
    }
  }
}

console.log(`\n🔍 Scanning drug pages in: ${DRUGS_DIR}`);
console.log(DRY_RUN ? '⚠️  DRY-RUN mode — no files will be written\n' : '✍️  Writing changes\n');

walkDrugs(DRUGS_DIR);

console.log(`\n✅ Done.`);
console.log(`   Modified:    ${modified}`);
console.log(`   Already done: ${alreadyDone}`);
console.log(`   Skipped:     ${skipped}`);

if (DRY_RUN && modified > 0) {
  console.log(`\nRun without --dry-run to apply ${modified} change(s).`);
}
