/**
 * _fix-static-seo.mjs — static SEO fixes (idempotent; safe to re-run).
 *
 * The page template leaves <link rel="canonical"> and og:url EMPTY and fills them with JavaScript at load. Google renders
 * JS, but Facebook's link crawler and other non-rendering crawlers read the raw HTML, so they saw blanks. This writes the real
 * values into the HTML (identical to what the JS computes).
 *
 *   1. canonical + og:url on every drugs/<slug>/index.html, drugs/index.html and privacy.html
 *   2. drugs/repatha/index.html: real title / description / og tags (it still had the template placeholder "Drug Savings")
 *   3. index.html: title shortened (was 128 chars; Google shows ~60)
 *   4. legacy pages: drugs/ozempic.html canonical -> /drugs/ozempic/ (duplicate of that page); stale vajih.github.io og:url fixed
 *   5. sitemap.xml: the guide / coupon pages that were missing
 *
 * Run: node scripts/_fix-static-seo.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const ORIGIN = "https://saverx.ai";
export const urlFor = (file) => {
  if (file === "index.html") return ORIGIN + "/";
  if (file.endsWith("/index.html")) return ORIGIN + "/" + file.slice(0, -"index.html".length);
  return ORIGIN + "/" + file;
};
export const REPATHA = {
  title: "Repatha Savings Card & Copay Program (2026) | SaveRx.ai",
  description: "Find the official Repatha (evolocumab) copay program and savings options. See eligibility, how to enroll, and pharmacy price tips from SaveRx.ai.",
  ogDescription: "Official Repatha savings link, potential copay, and simple guidance.",
};
export const HOME_TITLE = "Lower Your Out-of-Pocket on Prescriptions | SaveRx.ai";
export const GUIDE_SITEMAP = ["drugs/ozempic-savings-guide.html", "drugs/zepbound-savings-card.html", "drugs/repatha-copay-card.html", "drugs/mounjaro-coupon.html", "drugs/wegovy-cost-without-insurance.html", "drugs/glp1-online.html"];

const esc = (s) => s.replace(/&/g, "&amp;");
const setCanonical = (h, u) => /<link rel="canonical" href="[^"]*"/.test(h)
  ? h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`)
  : h.replace(/<\/title>/, `</title>\n<link rel="canonical" href="${u}">`);
const setOgUrl = (h, u) => /<meta property="og:url" content="[^"]*"/.test(h)
  ? h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`) : h;

export function fixPage(file, html) {
  let h = html;
  const u = urlFor(file);
  const emptyCanon = /<link rel="canonical" href=""/.test(h), emptyOg = /<meta property="og:url" content=""/.test(h);
  if (emptyCanon) h = setCanonical(h, u);
  if (emptyOg) h = setOgUrl(h, u);
  return h;
}
export function fixRepatha(html) {
  return html
    .replace(/<title>Drug Savings \| SaveRx\.ai<\/title>/, `<title>${esc(REPATHA.title)}</title>`)
    .replace(/(<meta property="og:title" content=")Drug Savings \| SaveRx\.ai(")/, `$1${esc(REPATHA.title)}$2`)
    .replace(/(<meta property="og:description" content=")Official savings link, potential copay, and simple guidance\.(")/, `$1${REPATHA.ogDescription}$2`)
    .replace(/(<meta name="description" content=")SaveRx\.ai helps you find official manufacturer savings and lower your out-of-pocket\.(")/, `$1${REPATHA.description}$2`);
}
export const fixHome = (html) => html.replace(/<title>SaveRx\.ai — Lower your out-of-pocket on prescriptions \([^<]*\)<\/title>/, `<title>${HOME_TITLE}</title>`);
export function fixLegacy(file, html) {
  let h = html;
  if (file === "drugs/ozempic.html") {
    const u = ORIGIN + "/drugs/ozempic/";                       // duplicate of the main Ozempic page: point search engines at it
    h = /<link rel="canonical"/.test(h) ? setCanonical(h, u) : h.replace(/<\/title>/, `</title>\n<link rel="canonical" href="${u}">`);
    h = h.replace(/(<meta property="og:url" content=")https:\/\/vajih\.github\.io\/my-site\/[^"]*(")/, `$1${u}$2`);
  }
  if (file === "pharmacy.html") h = h.replace(/(<meta property="og:url" content=")https:\/\/vajih\.github\.io\/my-site\/pharmacy\.html(")/, `$1${ORIGIN}/pharmacy.html$2`);
  return h;
}
export function fixSitemap(xml, today = "2026-11-20") {
  let out = xml;
  for (const f of GUIDE_SITEMAP) {
    const loc = `${ORIGIN}/${f}`;
    if (out.includes(`<loc>${loc}</loc>`)) continue;
    out = out.replace(/\n<\/urlset>/, `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>\n</urlset>`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0;
  const write = (f, before, after) => { if (after !== before) { writeFileSync(f, after); changed++; } };
  const targets = ["drugs/index.html", "privacy.html"];
  for (const d of readdirSync("drugs", { withFileTypes: true })) if (d.isDirectory() && existsSync(`drugs/${d.name}/index.html`)) targets.push(`drugs/${d.name}/index.html`);
  for (const f of targets) { const b = readFileSync(f, "utf8"); let a = fixPage(f, b); if (f === "drugs/repatha/index.html") a = fixRepatha(a); write(f, b, a); }
  { const b = readFileSync("index.html", "utf8"); write("index.html", b, fixHome(b)); }
  for (const f of ["drugs/ozempic.html", "pharmacy.html"]) { const b = readFileSync(f, "utf8"); write(f, b, fixLegacy(f, b)); }
  { const b = readFileSync("sitemap.xml", "utf8"); write("sitemap.xml", b, fixSitemap(b)); }
  console.log(`Static SEO fixes: ${changed} files updated`);
}
