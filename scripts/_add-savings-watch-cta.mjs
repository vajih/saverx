/**
 * _add-savings-watch-cta.mjs
 *
 * Places the Savings Watch entry points site-wide. Everything is injected HIDDEN; assets/js/savings-watch-cta.js
 * reveals it only when data/savings-watch.json has { "live": true } (and, for drug cards, the drug is in "open").
 *
 *   Drug pages  (drugs/<slug>/index.html): a card just above <section id="enroll-help">
 *   Other pages (home, directory, categories, conditions, guides, comparisons): a slim strip before the footer
 *
 * Idempotent and upgradeable: blocks are wrapped in START/END markers and are replaced in place on re-run
 * (also migrates the original Repatha-only block).
 *
 * Run:      node scripts/_add-savings-watch-cta.mjs
 * Launch:   set "live": true in data/savings-watch.json (no page rewrite needed)
 * Add drugs: add the slug to "open" there AND to PILOT_SLUGS in saverx-savings-watch/wrangler.jsonc
 * Remove:   git revert, or delete the marked blocks.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

export const START = "<!-- saverx-savings-watch-cta -->";
export const END = "<!-- /saverx-savings-watch-cta -->";
// Hidden until the switch is on. 'hidden' + inline display:none so it is hidden even if a stylesheet fails.
export const PENDING = ' hidden style="display:none" data-launch="pending"';
const DRUG_ANCHOR = '<section id="enroll-help"';
const FOOTER_ANCHOR = '<footer class="relief-footer">';
const ASSETS = '<link rel="stylesheet" href="/assets/css/savings-watch-cta.css"><script defer src="/assets/js/savings-watch-cta.js"></script>';

export const drugCardHtml = (slug) => `${START}
 <section id="savings-watch" class="drug-section" data-savings-watch-cta data-sw-drug="${slug}"${PENDING} aria-labelledby="swCtaTitle"><div class="drug-section-heading"><div><p class="drug-eyebrow">FREE · NO ACCOUNT</p><h2 id="swCtaTitle">Want us to look into your <span data-sw-brand>medication</span> savings?</h2></div></div><p>Share your mobile number and we’ll check the official programs, then text you a private link with what we found. We never put your medication name in a text.</p><a class="drug-button" data-sw-link href="/savings-watch/?drug=${slug}">Find savings for me — Free ↗</a><p class="drug-small">Message and data rates may apply. Reply STOP to opt out. Savings and eligibility are not guaranteed. <a href="/privacy.html#sms">Privacy</a></p></section>
 ${ASSETS}
${END}
 `;

export const stripHtml = () => `${START}
<aside class="sw-strip" data-savings-watch-cta${PENDING} aria-label="Savings Watch"><div><p><strong>Want a text with your savings options?</strong></p><small>Free · no account · we never put your medication name in a text · message and data rates may apply</small></div><a class="sw-cta-btn" data-sw-link href="/savings-watch/">Find savings for me — Free ↗</a></aside>
${ASSETS}
${END}
`;

/** Remove any existing block (new START/END form, or the legacy Repatha-only block that ended at its </section>). */
export function removeBlock(html) {
  const i = html.indexOf(START);
  if (i === -1) return html;
  const e = html.indexOf(END, i);
  if (e !== -1) return html.slice(0, i) + html.slice(e + END.length).replace(/^\s*\n?/, "");
  const s = html.indexOf("</section>", i);
  return html.slice(0, i) + html.slice(s + "</section>".length).replace(/^\s*\n?/, "");
}

/** Insert (or upgrade in place) a block before the anchor. Returns { html, changed, error? } */
export function upsert(html, block, anchor) {
  const cleaned = removeBlock(html);
  const i = cleaned.indexOf(anchor);
  if (i === -1) return { html, changed: false, error: "anchor not found" };
  const out = cleaned.slice(0, i) + block + cleaned.slice(i);
  return { html: out, changed: out !== html };
}
export const addDrugCard = (html, slug) => upsert(html, drugCardHtml(slug), DRUG_ANCHOR);
export const addStrip = (html) => upsert(html, stripHtml(), FOOTER_ANCHOR);

/** Pages that get the slim strip (not drug pages; not about/contact/legal/get-help/experts/admin/savings-watch itself). */
export function stripPages(root = ".") {
  const out = ["index.html", "comparisons.html", "pharmacy.html", "get-glp1.html", "mounjaro-vs-ozempic.html", "ozempic-vs-wegovy.html", "wegovy-vs-mounjaro.html"];
  const walk = (dir) => {
    if (!existsSync(`${root}/${dir}`)) return;
    for (const d of readdirSync(`${root}/${dir}`, { withFileTypes: true })) {
      const p = `${dir}/${d.name}`;
      if (d.isDirectory()) walk(p);
      else if (d.name.endsWith(".html")) out.push(p);
    }
  };
  for (const g of ["categories", "conditions", "learn"]) walk(g);
  out.push("drugs/index.html");
  // other non-slug pages directly under drugs/ (e.g. glp1-online.html)
  for (const d of readdirSync(`${root}/drugs`, { withFileTypes: true })) if (d.isFile() && d.name.endsWith(".html") && d.name !== "index.html") out.push(`drugs/${d.name}`);
  return [...new Set(out)].filter((p) => existsSync(`${root}/${p}`));
}

export function drugSlugs(root = ".") {
  return readdirSync(`${root}/drugs`, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(`${root}/drugs/${d.name}/index.html`)).map((d) => d.name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0, same = 0, errors = 0;
  const apply = (file, fn) => {
    const before = readFileSync(file, "utf8");
    const r = fn(before);
    if (r.error) { console.warn(file, r.error); errors++; return; }
    if (r.changed) { writeFileSync(file, r.html); changed++; } else same++;
  };
  for (const slug of drugSlugs()) apply(`drugs/${slug}/index.html`, (h) => addDrugCard(h, slug));
  for (const p of stripPages()) apply(p, addStrip);
  console.log(`Savings Watch CTA: ${changed} updated, ${same} unchanged, ${errors} skipped`);
}
