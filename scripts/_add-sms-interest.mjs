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

export const interestHtml = (slug) => `${START}
 <section id="sms-interest" class="sw-interest" data-sms-interest data-sw-drug="${slug}"${PENDING} aria-labelledby="siTitle">
  <div data-si-main><p class="si-eyebrow">COMING SOON · TEXT UPDATES</p><h2 id="siTitle" data-si-headline>Want text updates about this medication?</h2><button type="button" class="si-btn" data-si-btn>Yes, I’m interested ↗</button></div>
  <div data-si-after hidden><div data-si-intro><h3>Text updates aren’t live yet.</h3><p>We’re gauging interest in text updates about <span data-si-brand>this medication</span>. Want an email the moment they are?</p></div>
   <form class="si-form" data-si-form novalidate><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-label="Your email address" required><input type="text" name="website" class="si-hp" tabindex="-1" aria-hidden="true" autocomplete="off"><label class="si-consent"><input type="checkbox" required><span>Email me when text updates launch, plus medication-related savings information. I can unsubscribe anytime.</span></label><button type="submit" class="si-btn">Email me when it’s live ↗</button><p class="si-msg" data-si-msg role="alert"></p><p class="si-fine">No phone number needed. See our <a href="/privacy.html">Privacy Policy</a>.</p></form>
   <p data-si-thanks hidden><strong>You’re on the list.</strong> We’ll email you when text updates launch. You can unsubscribe anytime.</p></div>
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
export const drugSlugs = (root = ".") => readdirSync(`${root}/drugs`, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(`${root}/drugs/${d.name}/index.html`)).map((d) => d.name);

if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0, same = 0, errors = 0;
  for (const slug of drugSlugs()) {
    const f = `drugs/${slug}/index.html`;
    const r = addInterest(readFileSync(f, "utf8"), slug);
    if (r.error) { console.warn(f, r.error); errors++; } else if (r.changed) { writeFileSync(f, r.html); changed++; } else same++;
  }
  console.log(`SMS interest card: ${changed} updated, ${same} unchanged, ${errors} skipped`);
}
