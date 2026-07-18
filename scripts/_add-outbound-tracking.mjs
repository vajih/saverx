/**
 * _add-outbound-tracking.mjs
 *
 * PR0 of the Enrollment Copilot demand test (see SAVERX_ENROLLMENT_COPILOT plan).
 * For every drugs/{slug}/index.html:
 *
 *   1. Standardizes utm_source to "saverx" (was "saverx.ai" in some snippets)
 *      per docs/UTM_TRACKING_RULES.md Rule 2.
 *   2. Fires the `official_site_click` GA4 event whenever the user is sent to
 *      the manufacturer's official site (modal form, footer form, insurance
 *      accordion) — this was previously untracked.
 *   3. Includes /assets/js/track.js (central tracking util) before nav.js.
 *
 * Idempotent: files already containing /assets/js/track.js are skipped.
 * Run: node scripts/_add-outbound-tracking.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DRUGS_DIR = new URL("../drugs/", import.meta.url).pathname;
const TRACK_INCLUDE = '<script defer src="/assets/js/track.js"></script>';

const EDITS = [
  // 1) UTM standardization (both quoting variants found in templates)
  {
    find: 'u.searchParams.set("utm_source","saverx.ai");',
    replace: 'u.searchParams.set("utm_source","saverx");',
    all: true,
  },
  {
    find: "u.searchParams.set('utm_source', 'saverx.ai');",
    replace: "u.searchParams.set('utm_source', 'saverx');",
    all: true,
  },
  // 2) official_site_click on modal + footer form submits (2 occurrences/page)
  {
    find: 'window.open(href, "_blank");',
    replace:
      'window.open(href, "_blank");\n        window.__trackOfficialClick && window.__trackOfficialClick(slug, "drug_page_form");',
    all: true,
  },
  // 2b) official_site_click on insurance accordion CTA (main + catch fallback)
  {
    find: "window.open(u.toString(), '_blank');",
    replace:
      "window.open(u.toString(), '_blank');\n          window.__trackOfficialClick && window.__trackOfficialClick(null, 'insurance_accordion');",
    all: true,
  },
  {
    find: "window.open(url, '_blank');",
    replace:
      "window.open(url, '_blank');\n          window.__trackOfficialClick && window.__trackOfficialClick(null, 'insurance_accordion');",
    all: true,
  },
  // 3) include central util before nav.js
  {
    find: '<script src="/assets/js/nav.js"></script>',
    replace: TRACK_INCLUDE + '\n  <script src="/assets/js/nav.js"></script>',
    all: false,
  },
];

let touched = 0, skipped = 0, missing = 0;
const partial = [];

for (const slug of readdirSync(DRUGS_DIR).sort()) {
  const file = join(DRUGS_DIR, slug, "index.html");
  if (!existsSync(file)) { missing++; continue; }

  let html = readFileSync(file, "utf8");
  if (html.includes("/assets/js/track.js")) { skipped++; continue; }

  let applied = 0;
  for (const e of EDITS) {
    if (!html.includes(e.find)) continue;
    html = e.all ? html.split(e.find).join(e.replace) : html.replace(e.find, e.replace);
    applied++;
  }

  if (applied === 0) { partial.push(slug + " (no patterns matched)"); continue; }
  if (applied < EDITS.length) partial.push(`${slug} (${applied}/${EDITS.length} edits)`);

  writeFileSync(file, html, "utf8");
  touched++;
}

console.log(`Updated: ${touched}  Skipped (already done): ${skipped}  No index.html: ${missing}`);
if (partial.length) {
  console.log(`Partial/unmatched (${partial.length}):`);
  for (const p of partial) console.log("  - " + p);
}
