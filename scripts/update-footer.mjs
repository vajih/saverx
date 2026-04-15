#!/usr/bin/env node
/**
 * update-footer.mjs
 * Replaces old footer with new canonical footer on all non-drug pages.
 * Also adds the not-insurance-band above the footer if missing.
 * Run: node scripts/update-footer.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

const NEW_FOOTER = `  <div class="not-insurance-band">
    <div class="container">
      <p>SaveRx is not insurance. We help commercially insured patients find official manufacturer savings programs for brand-name medications. Eligibility and savings vary by program.</p>
    </div>
  </div>

  <footer class="footer">
    <div class="container grid">
      <div>
        <a href="/" class="nav-logo footer-logo" aria-label="SaveRx.ai home">Save<span>Rx.ai</span></a>
        <p class="footer-tagline">Official manufacturer savings for 350+ brand-name medications.<br> We are not a pharmacy.</p>
      </div>
      <div>
        <h4 class="footer-col-heading">Quick Links</h4>
        <div><a href="/">Home</a></div>
        <div><a href="/drugs/">Drugs</a></div>
        <div><a href="/comparisons.html">Comparisons</a></div>
        <div><a href="/about.html">About</a></div>
        <div><a href="/contact.html">Contact</a></div>
      </div>
      <div>
        <h4 class="footer-col-heading">Categories</h4>
        <div><a href="/categories/weight-loss/">Weight Loss &amp; GLP-1</a></div>
        <div><a href="/categories/diabetes/">Diabetes</a></div>
        <div><a href="/categories/heart-cholesterol/">Heart &amp; Cholesterol</a></div>
        <div><a href="/categories/autoimmune/">Autoimmune</a></div>
        <div><a href="/categories/migraine/">Migraine</a></div>
        <div><a href="/categories/respiratory/">Respiratory</a></div>
        <div><a href="/categories/mental-health/">Mental Health</a></div>
      </div>
      <div>
        <h4 class="footer-col-heading">Legal</h4>
        <div><a href="/privacy.html">Privacy Policy</a></div>
        <div><a href="/terms.html">Terms of Service</a></div>
        <div><a href="#" data-consent-toggle>Cookie settings</a></div>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="container" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;width:100%;">
        <span>© 2026 SaveRx.ai — All rights reserved.</span>
        <span>SaveRx is not insurance. All trademarks are property of their respective owners. Savings vary by program.</span>
      </div>
    </div>
  </footer>`;

// Pages to update (relative to ROOT), in order
const TARGETS = [
  'categories/index.html',
  'categories/weight-loss/index.html',
  'categories/diabetes/index.html',
  'categories/heart-cholesterol/index.html',
  'categories/autoimmune/index.html',
  'categories/migraine/index.html',
  'categories/respiratory/index.html',
  'categories/mental-health/index.html',
  'about.html',
  'contact.html',
  'comparisons.html',
  'privacy.html',
  'terms.html',
  'drugs/index.html',
  'get-glp1.html',
  'mounjaro-vs-ozempic.html',
  'ozempic-vs-wegovy.html',
  'wegovy-vs-mounjaro.html',
];

let updated = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const filePath = resolve(ROOT, rel);
  let html;
  try {
    html = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error(`  ✗ Could not read ${rel}: ${e.message}`);
    skipped++;
    continue;
  }

  // Match the full footer block (including any style attr on <footer>)
  // Also optionally capture a preceding not-insurance-band so we don't duplicate it
  const footerRe = /(?:[ \t]*<div class="not-insurance-band">[\s\S]*?<\/div>\s*)?[ \t]*<footer[\s\S]*?<\/footer>/;
  const match = html.match(footerRe);

  if (!match) {
    // terms.html has <footer class="site"> — handle separately
    const siteFooterRe = /[ \t]*<footer class="site"[\s\S]*?<\/footer>/;
    if (siteFooterRe.test(html)) {
      const newHtml = html.replace(siteFooterRe, NEW_FOOTER);
      writeFileSync(filePath, newHtml, 'utf8');
      console.log(`  ✓ ${rel} (replaced <footer class="site">)`);
      updated++;
      continue;
    }
    console.warn(`  ⚠ No footer found in ${rel}`);
    skipped++;
    continue;
  }

  const newHtml = html.replace(footerRe, NEW_FOOTER);
  writeFileSync(filePath, newHtml, 'utf8');
  console.log(`  ✓ ${rel}`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
