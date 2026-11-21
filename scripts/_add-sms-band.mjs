/**
 * _add-sms-band.mjs
 *
 * Adds the text-alerts waitlist band (medication + phone, with type-ahead and quick-pick chips, plus the slim sticky bar) to the
 * content pages that sit between search and a drug page: condition pages, category pages, learn articles, comparison pages, the
 * medication directory, pharmacy, get-glp1 and request-medication. It is the homepage band (scripts/_add-sms-home.mjs) with a
 * distinct surface ("content") so signups can be told apart; the consent wording is taken from the homepage band so it cannot drift.
 *
 * Ships HIDDEN; assets/js/sms-interest.js reveals it only while data/savings-watch.json has { interest: true, live: false }.
 * Idempotent (START/END markers). Run: node scripts/_add-sms-band.mjs
 * Deliberately NOT added: about, contact, experts, privacy, terms, get-help, savings-watch, dashboard/admin, drug pages (own card).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { bandHtml as homeBandHtml, PENDING } from "./_add-sms-home.mjs";

export const START = "<!-- saverx-sms-band -->";
export const END = "<!-- /saverx-sms-band -->";
const SW_STRIP = "<!-- saverx-savings-watch-cta -->";
const FOOTER = '<footer class="relief-footer">';
const ASSETS = '<link rel="stylesheet" href="/assets/css/sms-interest.css"><script defer src="/assets/js/sms-interest.js"></script>';
export const DEFAULT_CHIPS = ["Repatha", "Ozempic", "Wegovy", "Dupixent", "Mounjaro"];
export const GLP1_CHIPS = ["Ozempic", "Wegovy", "Mounjaro", "Zepbound", "Trulicity"];

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Same consent paragraph as the homepage band (single source of truth).
export const CONSENT_P = homeBandHtml().match(/<p class="si-consent"[\s\S]*?<\/p>/)[0];

export const bandHtml = (chips) => `${START}
<section id="sms-band" class="sw-interest sw-home" data-sms-interest data-si-home data-si-surface="content" data-sw-drug="content" data-si-consent-version="2026-11-21-home-v1"${PENDING} aria-labelledby="siBandTitle">
 <div data-si-main><p class="si-eyebrow">FREE TEXT ALERTS · LAUNCHING SOON</p><h2 id="siBandTitle" data-si-headline>Get a text when your medication’s savings change</h2>
  <p class="si-sub">Tell us your medication and mobile number, and you’ll be first to know when there’s news on manufacturer savings. No account needed.</p>
  <form class="si-form si-home-form" data-si-phone-form novalidate>
   <div class="si-row"><div class="si-field"><label class="si-lbl" for="siBandDrug">Medication</label><input id="siBandDrug" type="text" name="drug" list="siBandDrugs" autocomplete="off" autocapitalize="words" placeholder="e.g. Ozempic" maxlength="80" required><datalist id="siBandDrugs" data-si-drug-list></datalist></div>
   <div class="si-field"><label class="si-lbl" for="siBandPhone">Mobile number</label><input id="siBandPhone" type="tel" name="phone" autocomplete="tel-national" inputmode="tel" placeholder="(555) 555-5555" maxlength="20" required></div></div>
   <input type="text" name="website" class="si-hp" tabindex="-1" aria-hidden="true" autocomplete="off">
   <button type="submit" class="si-btn" data-si-btn>Get text alerts — free ↗</button><p class="si-msg" data-si-msg role="alert"></p>
   ${CONSENT_P}</form>
  <div class="si-chips"><span>Popular:</span>${chips.map((c) => `<button type="button" data-si-chip="${attr(c)}">${attr(c)}</button>`).join("")}</div></div>
 <div data-si-thanks hidden role="status"><h3>You’re on the list.</h3><p>We’ll text you when <span data-si-brand>your medication</span> alerts launch. The first message will ask you to reply YES to confirm. Reply STOP anytime to opt out.</p><p><a class="si-link" href="/drugs/">Want alerts for another medication? Browse drugs →</a></p></div>
 <aside class="si-bar" data-si-bar hidden role="region" aria-label="Text alerts"><span>Get a text when <b data-si-brand>your medication</b> savings change</span><button type="button" class="si-bar-go" data-si-bar-go>Add my number</button><button type="button" class="si-bar-x" data-si-bar-x aria-label="Dismiss">×</button></aside>
</section>
${ASSETS}
${END}
`;

export function removeBlock(html) {
  const i = html.indexOf(START);
  if (i === -1) return html;
  const e = html.indexOf(END, i);
  if (e === -1) throw new Error("sms-band start marker without end marker");
  return html.slice(0, i) + html.slice(e + END.length).replace(/^\s*\n?/, "");
}
/** Insert (or upgrade in place) the band before the Savings Watch strip, else before the footer. */
export function addBand(html, chips) {
  const cleaned = removeBlock(html);
  let i = cleaned.indexOf(SW_STRIP);
  if (i === -1) i = cleaned.indexOf(FOOTER);
  if (i === -1) return { html, changed: false, error: "anchor not found" };
  const out = cleaned.slice(0, i) + bandHtml(chips) + cleaned.slice(i);
  return { html: out, changed: out !== html };
}

/** Target pages: conditions/*, categories/*, learn/*, plus the listed top-level and directory pages. */
export const EXTRA_PAGES = ["comparisons.html", "mounjaro-vs-ozempic.html", "ozempic-vs-wegovy.html", "wegovy-vs-mounjaro.html", "drugs/index.html", "pharmacy.html", "get-glp1.html", "request-medication.html"];
export function targetPages(root = ".") {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(`${root}/${dir}`)) return;
    for (const d of readdirSync(`${root}/${dir}`, { withFileTypes: true })) {
      const p = `${dir}/${d.name}`;
      if (d.isDirectory()) walk(p); else if (d.name.endsWith(".html")) out.push(p);
    }
  };
  for (const g of ["conditions", "categories", "learn"]) walk(g);
  return [...new Set([...out, ...EXTRA_PAGES])].filter((p) => existsSync(`${root}/${p}`)).sort();
}

/** Quick-pick chips for a page: drugs it already links to (conditions/categories), the compared drugs, or sensible defaults. */
export function chipsFor(file, html, drugNames) {
  const known = new Map(drugNames.map((n) => [n.slug, n.name]));
  const fill = (list, base) => { const out = [...list]; for (const c of base) if (out.length < 5 && !out.includes(c)) out.push(c); return out.slice(0, 5); };
  const vs = file.match(/^([a-z0-9]+)-vs-([a-z0-9]+)\.html$/);
  if (vs) return fill([vs[1], vs[2]].map((s) => known.get(s)).filter(Boolean), GLP1_CHIPS);
  if (file === "comparisons.html" || file === "pharmacy.html" || file === "get-glp1.html") return GLP1_CHIPS;
  if (file.startsWith("conditions/") || file.startsWith("categories/")) {
    const seen = [];
    for (const m of html.matchAll(/href="\/drugs\/([a-z0-9-]+)\/"/g)) { const n = known.get(m[1]); if (n && !seen.includes(n)) seen.push(n); if (seen.length === 5) break; }
    return fill(seen, DEFAULT_CHIPS);
  }
  return DEFAULT_CHIPS;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = JSON.parse(readFileSync("data/drugs.json", "utf8")).items.map((x) => ({ slug: x.slug, name: x.brand || x.name }));
  let changed = 0, same = 0, errors = 0;
  for (const f of targetPages()) {
    const html = readFileSync(f, "utf8");
    const r = addBand(html, chipsFor(f, html, names));
    if (r.error) { console.warn(f, r.error); errors++; } else if (r.changed) { writeFileSync(f, r.html); changed++; } else same++;
  }
  console.log(`SMS band: ${changed} updated, ${same} unchanged, ${errors} skipped (${targetPages().length} target pages)`);
}
