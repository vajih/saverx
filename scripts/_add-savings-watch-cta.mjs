/**
 * _add-savings-watch-cta.mjs
 *
 * Injects the "Find savings for me — Free" Savings Watch card into drug pages, just above the
 * #enroll-help section. Idempotent via the <!-- saverx-savings-watch-cta --> marker.
 *
 * Run:        node scripts/_add-savings-watch-cta.mjs            (pilot slugs only)
 * Roll out:   node scripts/_add-savings-watch-cta.mjs --all      (every drugs/<slug>/index.html; only
 *             after the pilot test passes and the Worker allows those slugs via PILOT_SLUGS)
 * Remove:     git revert, or delete the marked block.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

export const PILOT_SLUGS = ["repatha"];
export const MARKER = "<!-- saverx-savings-watch-cta -->";
const ANCHOR = '<section id="enroll-help"';

export const cardHtml = (slug) => `${MARKER}
 <section id="savings-watch" class="drug-section" aria-labelledby="swCtaTitle"><div class="drug-section-heading"><div><p class="drug-eyebrow">FREE · NO ACCOUNT</p><h2 id="swCtaTitle">Want us to look into your savings?</h2></div></div><p>Share your mobile number and we’ll check the official programs, then text you a private link with what we found. We never put your medication name in a text.</p><a class="drug-button" data-savings-watch-cta href="/savings-watch/?drug=${slug}">Find savings for me — Free ↗</a><p class="drug-small">Message and data rates may apply. Savings and eligibility are not guaranteed.</p></section>
 `;

export function addCta(html, slug) {
  if (html.includes(MARKER)) return { html, changed: false };
  const i = html.indexOf(ANCHOR);
  if (i === -1) return { html, changed: false, error: "anchor not found" };
  return { html: html.slice(0, i) + cardHtml(slug) + html.slice(i), changed: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = process.argv.includes("--all");
  const slugs = all ? readdirSync("drugs", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : PILOT_SLUGS;
  let changed = 0, skipped = 0;
  for (const slug of slugs) {
    const file = `drugs/${slug}/index.html`;
    if (!existsSync(file)) { console.warn("missing", file); continue; }
    const r = addCta(readFileSync(file, "utf8"), slug);
    if (r.error) { console.warn(slug, r.error); skipped++; continue; }
    if (r.changed) { writeFileSync(file, r.html); changed++; } else skipped++;
  }
  console.log(`Savings Watch CTA: ${changed} updated, ${skipped} unchanged/skipped`);
}
