/**
 * SaveRx.ai — Consent Banner Injection Script
 *
 * Walks every HTML file in the repo (excluding emails/, staging/, node_modules/, etc.)
 * and injects:
 *   1. Inline Consent Mode v2 defaults block  ┐  immediately before the GTM snippet
 *   2. <script src="/assets/js/consent.js">   ┘
 *   3. <div><a data-consent-toggle>Cookie settings</a></div>  after Terms of Service in footer
 *
 * Idempotent: skips any file that already has consent.js.
 *
 * Usage:
 *   node scripts/_add-consent-banner.mjs [--dry-run]
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');

const EXCLUDE_DIRS = new Set([
  'node_modules', '.venv', 'staging', 'emails', 'mockups', '.git'
]);

// ─── Snippets ────────────────────────────────────────────────────────────────

// Inline CMv2 defaults (synchronous — runs before GTM)
const CONSENT_DEFAULTS = `  <!-- Google Consent Mode v2 — defaults (before GTM) -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      analytics_storage:     'denied',
      ad_storage:            'denied',
      ad_user_data:          'denied',
      ad_personalization:    'denied',
      personalization_storage: 'denied',
      wait_for_update:       500
    });
  </script>
  <!-- Consent manager (updates defaults above after user choice) -->
  <script src="/assets/js/consent.js"></script>
  <!-- End Consent Mode setup -->`;

// GTM anchor — the end of the GTM block on the same line
const GTM_ANCHOR = `})(window,document,'script','dataLayer','GTM-MVZBBF7R');</script>`;

// Footer injection: insert cookie settings link after Terms of Service line
const TERMS_LINE = `<div><a href="/terms.html">Terms of Service</a></div>`;
const COOKIE_LINK = `<div><a href="#" data-consent-toggle>Cookie settings</a></div>`;

// ─── File walking ────────────────────────────────────────────────────────────

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && extname(entry.name) === '.html') {
      yield full;
    }
  }
}

// ─── Injection logic ─────────────────────────────────────────────────────────

function inject(html) {
  let changed = false;

  // 1. Skip if already patched
  if (html.includes('consent.js')) {
    return { html, changed: false, reason: 'already patched' };
  }

  // 2. Inject Consent Mode defaults before GTM
  if (html.includes(GTM_ANCHOR)) {
    // Replace: insert defaults immediately before the GTM comment/script block
    // Pattern: look for the GTM comment + script tag start
    html = html.replace(
      /( *)(<!-- Google Tag Manager -->)/,
      CONSENT_DEFAULTS + '\n$1$2'
    );
    changed = true;
  }

  // 3. Add "Cookie settings" to footer Legal section
  if (html.includes(TERMS_LINE) && !html.includes('data-consent-toggle')) {
    html = html.replace(TERMS_LINE, TERMS_LINE + '\n        ' + COOKIE_LINK);
    changed = true;
  }

  return { html, changed, reason: changed ? 'patched' : 'no GTM found' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let total = 0, patched = 0, skipped = 0, noGtm = 0;

  for await (const filePath of walk(ROOT)) {
    total++;
    const original = await readFile(filePath, 'utf8');
    const { html, changed, reason } = inject(original);

    if (!changed) {
      if (reason === 'already patched') skipped++;
      else noGtm++;
      continue;
    }

    if (DRY) {
      console.log('[DRY]', filePath.replace(ROOT, ''));
    } else {
      await writeFile(filePath, html, 'utf8');
    }
    patched++;
  }

  console.log(`\nDone.`);
  console.log(`  Total HTML files: ${total}`);
  console.log(`  Patched:          ${patched}`);
  console.log(`  Already patched:  ${skipped}`);
  console.log(`  No GTM found:     ${noGtm}`);
  if (DRY) console.log('\n(dry-run — no files written)');
}

main().catch((err) => { console.error(err); process.exit(1); });
