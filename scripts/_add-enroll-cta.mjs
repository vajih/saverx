/**
 * _add-enroll-cta.mjs
 *
 * PR2 of the Enrollment Copilot demand test.
 * Injects the two-pathway "enrollment help" card into PILOT drug pages, just
 * above the footer email-capture band:
 *
 *   Pathway A — direct, ungated link to the official manufacturer program
 *               (fires official_site_click, placement=assist_card)
 *   Pathway B — "Get guided enrollment help" → /get-help/?drug={slug}
 *               (fires assist_cta_click)
 *
 * Also fires assist_cta_view (IntersectionObserver) when the card is seen.
 * Idempotent via the <!-- saverx-enroll-cta --> marker.
 *
 * Run:            node scripts/_add-enroll-cta.mjs
 * Add a page:     append the slug to PILOT_SLUGS and re-run.
 * Remove:         git revert the commit, or delete the marked block.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PILOT_SLUGS = ["repatha", "dupixent", "stelara", "ozempic", "wegovy"];

const ANCHOR = "<!-- Footer email capture (kept as-is) -->";
const MARKER = "<!-- saverx-enroll-cta -->";

const cardHtml = (slug) => `${MARKER}
  <!-- =====================================================
       Enrollment Help — demand-validation pilot (PR2)
       Two transparent pathways; see docs/ENROLLMENT_TEST_DEPLOY.md
       ===================================================== -->
  <section class="enroll-help" id="enroll-help" aria-labelledby="ehTitle" style="max-width:900px;margin:32px auto;padding:0 16px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px;box-shadow:0 1px 3px rgba(15,23,42,.06);">
      <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--brand-600,#0b6e5c);margin:0 0 6px;">Two ways to enroll</p>
      <h2 id="ehTitle" style="font-size:22px;margin:0 0 6px;">Ready to get your <span data-bind="brand">medication</span> savings?</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 18px;">
        Enroll on your own through the manufacturer's official site — or, if you're not sure which program fits
        or you've hit a problem, a SaveRx guide can help you through it.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        <a id="eh-official" href="#footerForm" target="_blank" rel="noopener"
           style="display:block;border:2px solid #e2e8f0;border-radius:12px;padding:16px;text-decoration:none;color:inherit;">
          <b style="display:block;color:#0f172a;">Go to the official program site ↗</b>
          <small style="color:#64748b;">Free · enroll yourself on the <span data-bind="manufacturer">manufacturer</span> website</small>
        </a>
        <a id="eh-assist" href="/get-help/?drug=${slug}"
           style="display:block;border:2px solid var(--brand-600,#0b6e5c);background:#f0fdf9;border-radius:12px;padding:16px;text-decoration:none;color:inherit;">
          <b style="display:block;color:#0f172a;">Get guided enrollment help →</b>
          <small style="color:#64748b;">Early access · a real person checks which program may fit your situation and guides you through the official enrollment</small>
        </a>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:14px 0 0;">
        SaveRx is independent and not affiliated with any manufacturer. Enrollment always happens on the official program website.
      </p>
    </div>
  </section>
  <script>
    (function(){
      var card = document.getElementById('enroll-help');
      if (!card) return;
      var slug = '${slug}';
      function ev(n,p){ try{ if (typeof gtag==='function') gtag('event', n, p||{}); }catch(_){} }
      // Impression
      try {
        var seen = false;
        new IntersectionObserver(function(entries, obs){
          entries.forEach(function(en){
            if (en.isIntersecting && !seen) { seen = true; ev('assist_cta_view', { drug_slug: slug }); obs.disconnect(); }
          });
        }, { threshold: 0.4 }).observe(card);
      } catch(_){}
      // Pathway A — ungated official link (URL resolved at click time from page data)
      document.getElementById('eh-official').addEventListener('click', function(e){
        var base = String(window.__manufacturerUrl || '');
        if (!/^https?:/i.test(base)) return; // fallback: default anchor to on-page form
        e.preventDefault();
        var href = base;
        try {
          var u = new URL(base);
          u.searchParams.set('utm_source','saverx');
          u.searchParams.set('utm_medium','referral');
          u.searchParams.set('utm_campaign','assist_card_' + slug);
          href = u.toString();
        } catch(_){}
        window.__trackOfficialClick && window.__trackOfficialClick(slug, 'assist_card');
        window.open(href, '_blank');
      });
      // Pathway B — guided help
      document.getElementById('eh-assist').addEventListener('click', function(){
        ev('assist_cta_click', { drug_slug: slug });
      });
    })();
  </script>
  <!-- /saverx-enroll-cta -->
`;

let ok = 0;
for (const slug of PILOT_SLUGS) {
  const file = new URL(`../drugs/${slug}/index.html`, import.meta.url).pathname;
  if (!existsSync(file)) { console.error(`MISSING: ${file}`); continue; }
  let html = readFileSync(file, "utf8");
  if (html.includes(MARKER)) { console.log(`skip (already injected): ${slug}`); continue; }
  if (!html.includes(ANCHOR)) { console.error(`ANCHOR NOT FOUND in ${slug} — not modified`); continue; }
  html = html.replace(ANCHOR, cardHtml(slug) + "\n" + ANCHOR);
  writeFileSync(file, html, "utf8");
  console.log(`injected: ${slug}`);
  ok++;
}
console.log(`Done — ${ok}/${PILOT_SLUGS.length} pilot pages updated.`);
