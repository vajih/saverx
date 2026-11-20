/**
 * _add-sms-interest.mjs
 *
 * Injects the "text updates" demand-test card into every drug page (drugs/<slug>/index.html), just above
 * <section id="enroll-help">. Ships HIDDEN; assets/js/sms-interest.js reveals it only when
 * data/savings-watch.json has { "interest": true } and { "live" } is not true.
 *
 * Idempotent/upgradeable via START/END markers (separate from the Savings Watch card markers).
 * Run:     node scripts/_add-sms-interest.mjs
 * Remove:  git revert, or delete the marked blocks.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

export const START = "<!-- saverx-sms-interest -->";
export const END = "<!-- /saverx-sms-interest -->";
export const PENDING = ' hidden style="display:none" data-launch="pending"';
const ANCHOR = '<section id="enroll-help"';
const ASSETS = '<link rel="stylesheet" href="/assets/css/sms-interest.css"><script defer src="/assets/js/sms-interest.js"></script>';

export const interestHtml = (slug, name = "") => `${START}
 <section id="sms-interest" class="sw-interest" data-sms-interest data-sw-drug="${slug}"${name ? ` data-si-name="${name}"` : ""}${PENDING} aria-labelledby="siTitle">
  <div data-si-main><p class="si-eyebrow">TEXT ALERTS · FREE · LAUNCHING SOON</p><h2 id="siTitle" data-si-headline>Get text alerts about this medication</h2>
   <p class="si-sub">Add your mobile number and be first to know when there’s news on <span data-si-brand>this medication</span> savings. No account needed.</p>
   <form class="si-form" data-si-phone-form novalidate><label class="si-lbl" for="siPhone">Mobile number</label><input id="siPhone" type="tel" name="phone" autocomplete="tel-national" inputmode="tel" placeholder="(555) 555-5555" maxlength="20" required><input type="text" name="website" class="si-hp" tabindex="-1" aria-hidden="true" autocomplete="off"><button type="submit" class="si-btn" data-si-btn>Get text alerts — free ↗</button><p class="si-msg" data-si-msg role="alert"></p>
    <p class="si-consent" data-si-consent>By tapping “Get text alerts,” you agree to receive recurring automated text messages from SaveRx.ai about <span data-si-brand>this medication</span> savings programs and related updates at the number you entered, including a first message asking you to confirm. Consent is not a condition of any purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help. We never put medication names in a text. See our <a href="/privacy.html#sms">Privacy Policy</a> and <a href="/terms.html">Terms</a>.</p></form>
   <button type="button" class="si-link" data-si-email-toggle>Prefer email instead?</button></div>
  <div data-si-thanks hidden role="status"><h3>You’re on the list.</h3><p>We’ll text you when <span data-si-brand>this medication</span> alerts launch. The first message will ask you to reply YES to confirm. Reply STOP anytime to opt out.</p><p><a class="si-link" href="/drugs/">Want alerts for another medication? Browse drugs →</a></p></div>
  <div data-si-email hidden><h3>Get it by email instead</h3><form class="si-form" data-si-email-form novalidate><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="Your email address" required><input type="text" name="website" class="si-hp" tabindex="-1" aria-hidden="true" autocomplete="off"><label class="si-consent-row"><input type="checkbox" required><span>Email me when text alerts launch, plus medication-related savings information. I can unsubscribe anytime.</span></label><button type="submit" class="si-btn">Email me when it’s live ↗</button><p class="si-msg" data-si-email-msg role="alert"></p></form><p data-si-email-thanks hidden><strong>You’re on the list.</strong> We’ll email you when text alerts launch. You can unsubscribe anytime.</p></div>
  <aside class="si-bar" data-si-bar hidden role="region" aria-label="Text alerts"><span>Get a text when <b data-si-brand>this medication</b> savings change</span><button type="button" class="si-bar-go" data-si-bar-go>Add my number</button><button type="button" class="si-bar-x" data-si-bar-x aria-label="Dismiss">×</button></aside>
 </section>
 ${ASSETS}
${END}
 `;

export function removeBlock(html) {
  const i = html.indexOf(START);
  if (i === -1) return html;
  const e = html.indexOf(END, i);
  if (e === -1) throw new Error("sms-interest start marker without end marker");
  return html.slice(0, i) + html.slice(e + END.length).replace(/^\s*\n?/, "");
}
export function addInterest(html, slug) {
  const cleaned = removeBlock(html);
  const i = cleaned.indexOf(ANCHOR);
  if (i === -1) return { html, changed: false, error: "anchor not found" };
  const out = cleaned.slice(0, i) + interestHtml(slug) + cleaned.slice(i);
  return { html: out, changed: out !== html };
}
/**
 * Drug guide / coupon pages directly under drugs/ (no #enroll-help anchor, no drug-page-profile JSON): the card goes right
 * before the Savings Watch strip (or the footer), and carries the drug's display name itself.
 * drugs/repatha-enroll.html is a redirect page and is intentionally excluded.
 */
export const GUIDE_PAGES = {
  "drugs/ozempic.html": ["ozempic", "Ozempic"],
  "drugs/ozempic-savings-guide.html": ["ozempic", "Ozempic"],
  "drugs/zepbound-savings-card.html": ["zepbound", "Zepbound"],
  "drugs/repatha-copay-card.html": ["repatha", "Repatha"],
  "drugs/mounjaro-coupon.html": ["mounjaro", "Mounjaro"],
  "drugs/wegovy-cost-without-insurance.html": ["wegovy", "Wegovy"],
  "drugs/glp1-online.html": ["glp1", "GLP-1 medications"],
};
const SW_STRIP = "<!-- saverx-savings-watch-cta -->";
const FOOTER = '<footer class="relief-footer">';
export function addInterestGuide(html, slug, name) {
  const cleaned = removeBlock(html);
  let i = cleaned.indexOf(SW_STRIP);
  if (i === -1) i = cleaned.indexOf(FOOTER);
  if (i === -1) return { html, changed: false, error: "anchor not found" };
  const out = cleaned.slice(0, i) + interestHtml(slug, name) + cleaned.slice(i);
  return { html: out, changed: out !== html };
}
export const drugSlugs = (root = ".") => readdirSync(`${root}/drugs`, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(`${root}/drugs/${d.name}/index.html`)).map((d) => d.name);

if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0, same = 0, errors = 0;
  for (const slug of drugSlugs()) {
    const f = `drugs/${slug}/index.html`;
    const r = addInterest(readFileSync(f, "utf8"), slug);
    if (r.error) { console.warn(f, r.error); errors++; } else if (r.changed) { writeFileSync(f, r.html); changed++; } else same++;
  }
  for (const [f, [slug, name]] of Object.entries(GUIDE_PAGES)) {
    const r = addInterestGuide(readFileSync(f, "utf8"), slug, name);
    if (r.error) { console.warn(f, r.error); errors++; } else if (r.changed) { writeFileSync(f, r.html); changed++; } else same++;
  }
  console.log(`SMS interest card: ${changed} updated, ${same} unchanged, ${errors} skipped`);
}
