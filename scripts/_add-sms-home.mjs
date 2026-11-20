/**
 * _add-sms-home.mjs
 *
 * Adds the text-alerts waitlist band to the homepage (index.html), directly under the hero, plus a small hero link that
 * scrolls to it. Both ship HIDDEN; assets/js/sms-interest.js reveals them only when data/savings-watch.json has
 * { "interest": true } and { "live" } is not true (same switch as the drug-page card).
 * The visitor types their medication (type-ahead from /data/drugs.json; unlisted drugs are kept as "custom-<text>").
 *
 * Idempotent/upgradeable via START/END markers.   Run: node scripts/_add-sms-home.mjs
 * Remove: git revert, or delete the marked blocks.
 */
import { readFileSync, writeFileSync } from "node:fs";

export const START = "<!-- saverx-sms-home -->";
export const END = "<!-- /saverx-sms-home -->";
export const LINK_START = "<!-- saverx-sms-home-link -->";
export const LINK_END = "<!-- /saverx-sms-home-link -->";
export const PENDING = ' hidden style="display:none" data-launch="pending"';
const BAND_ANCHOR = '<div class="trustbar">';
const LINK_ANCHOR = "<span>✓ No insurance details to search</span></div>";
const ASSETS = '<link rel="stylesheet" href="/assets/css/sms-interest.css"><script defer src="/assets/js/sms-interest.js"></script>';

export const bandHtml = () => `${START}
<section id="sms-home" class="sw-interest sw-home" data-sms-interest data-si-home data-sw-drug="home" data-si-consent-version="2026-11-21-home-v1"${PENDING} aria-labelledby="siHomeTitle">
 <div data-si-main><p class="si-eyebrow">FREE TEXT ALERTS · LAUNCHING SOON</p><h2 id="siHomeTitle" data-si-headline>Get a text when your medication’s savings change</h2>
  <p class="si-sub">Tell us your medication and mobile number, and you’ll be first to know when there’s news on manufacturer savings. No account needed.</p>
  <form class="si-form si-home-form" data-si-phone-form novalidate>
   <div class="si-row"><div class="si-field"><label class="si-lbl" for="siHomeDrug">Medication</label><input id="siHomeDrug" type="text" name="drug" list="siHomeDrugs" autocomplete="off" autocapitalize="words" placeholder="e.g. Ozempic" maxlength="80" required><datalist id="siHomeDrugs" data-si-drug-list></datalist></div>
   <div class="si-field"><label class="si-lbl" for="siHomePhone">Mobile number</label><input id="siHomePhone" type="tel" name="phone" autocomplete="tel-national" inputmode="tel" placeholder="(555) 555-5555" maxlength="20" required></div></div>
   <input type="text" name="website" class="si-hp" tabindex="-1" aria-hidden="true" autocomplete="off">
   <button type="submit" class="si-btn" data-si-btn>Get text alerts — free ↗</button><p class="si-msg" data-si-msg role="alert"></p>
   <p class="si-consent" data-si-consent>By tapping “Get text alerts,” you agree to receive recurring automated text messages from SaveRx.ai about savings programs for the medication you entered and related updates at the number you entered, including a first message asking you to confirm. Consent is not a condition of any purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help. We never put medication names in a text. See our <a href="/privacy.html#sms">Privacy Policy</a> and <a href="/terms.html">Terms</a>.</p></form>
  <div class="si-chips"><span>Popular:</span><button type="button" data-si-chip="Repatha">Repatha</button><button type="button" data-si-chip="Ozempic">Ozempic</button><button type="button" data-si-chip="Wegovy">Wegovy</button><button type="button" data-si-chip="Dupixent">Dupixent</button><button type="button" data-si-chip="Mounjaro">Mounjaro</button></div></div>
 <div data-si-thanks hidden role="status"><h3>You’re on the list.</h3><p>We’ll text you when <span data-si-brand>your medication</span> alerts launch. The first message will ask you to reply YES to confirm. Reply STOP anytime to opt out.</p><p><a class="si-link" href="/drugs/">Want alerts for another medication? Add another above ↑</a></p></div>
</section>
${ASSETS}
${END}
`;

export const linkHtml = () => `${LINK_START}<p class="sms-hero-link" data-si-home-link${PENDING}><a href="#sms-home">Get a text when your medication’s savings change ↓</a></p>${LINK_END}`;

function strip(html, s, e) {
  const i = html.indexOf(s);
  if (i === -1) return html;
  const j = html.indexOf(e, i);
  if (j === -1) throw new Error("start marker without end marker: " + s);
  return html.slice(0, i) + html.slice(j + e.length).replace(/^\s*\n?/, "");
}
export function addSmsHome(html) {
  const cleaned = strip(strip(html, START, END), LINK_START, LINK_END);
  const b = cleaned.indexOf(BAND_ANCHOR), l = cleaned.indexOf(LINK_ANCHOR);
  if (b === -1 || l === -1) return { html, changed: false, error: "anchor not found" };
  const withLink = cleaned.slice(0, l + LINK_ANCHOR.length) + linkHtml() + cleaned.slice(l + LINK_ANCHOR.length);
  const b2 = withLink.indexOf(BAND_ANCHOR);
  const out = withLink.slice(0, b2) + bandHtml() + withLink.slice(b2);
  return { html: out, changed: out !== html };
}
export const removeSmsHome = (html) => strip(strip(html, START, END), LINK_START, LINK_END);

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = addSmsHome(readFileSync("index.html", "utf8"));
  if (r.error) { console.error("index.html:", r.error); process.exit(1); }
  if (r.changed) writeFileSync("index.html", r.html);
  console.log(`SMS home band: ${r.changed ? "updated" : "unchanged"}`);
}
