/**
 * SaveRx.ai — Insurance Tier Accordion Injection Script
 *
 * Walks every drugs/{slug}/index.html and inserts the 3-tier insurance
 * accordion (private / government / cash-pay) immediately before the
 * footer email capture section.
 *
 * Idempotent: skips any file that already contains the accordion marker.
 *
 * Usage:
 *   node scripts/_add-insurance-accordion.mjs [--dry-run]
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';

const ROOT     = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DRUGS_DIR = join(ROOT, 'drugs');
const DRY       = process.argv.includes('--dry-run');

// ─── Idempotency marker ──────────────────────────────────────────────────────
const MARKER = 'data-saverx-insurance-accordion';

// ─── Insertion anchor ────────────────────────────────────────────────────────
// Insert just before the footer email capture section
const ANCHOR = '<!-- Footer email capture (kept as-is) -->';

// ─── Accordion HTML snippet ──────────────────────────────────────────────────
// Uses data-bind attributes that the existing page JS populates at runtime.
// data-bind="copay_price_formatted" → e.g. "$5"
// data-bind="cash_price_formatted"  → e.g. "$780"
// data-bind="brand"                 → e.g. "Repatha"
// The manufacturer URL is in window.__manufacturerUrl (set by page JS).
const ACCORDION_HTML = `
  <!-- =====================================================
       Insurance Tier Accordion (Phase 3 — Asma's design)
       ===================================================== -->
  <section class="insurance-accordion" ${MARKER} aria-labelledby="ia-title">
    <h2 class="insurance-accordion__title" id="ia-title">What will I pay?</h2>

    <!-- ── Card 1: Private / Commercial Insurance (open by default) ── -->
    <details open>
      <summary>
        <div class="ia-left">
          <span class="ia-type">Private insurance</span>
          <span class="ia-sub">Employer or marketplace plan</span>
        </div>
        <div class="ia-right">
          <span class="ia-price" data-bind="copay_price_formatted">$—</span>
          <svg class="ia-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </summary>
      <div class="ia-body">
        <div class="ia-hero-price" data-bind="copay_price_formatted">$—</div>
        <p class="ia-hero-label">per 30-day supply with copay card</p>
        <p class="ia-cash-strike">Typical cash price: <s data-bind="cash_price_formatted">$—</s>/mo</p>
        <span class="ia-savings-pill">Save up to <span data-bind="per_fill_savings">$—</span> per fill</span>
        <div>
          <a class="btn-primary-pill js-accordion-cta" href="#" target="_blank" rel="noopener" onclick="return window.__openAccordionCta(event)">
            Get <span data-bind="manufacturer">Manufacturer</span> Savings Card ↗
          </a>
        </div>
      </div>
    </details>

    <!-- ── Card 2: Government Insurance (collapsed by default) ── -->
    <details>
      <summary>
        <div class="ia-left">
          <span class="ia-type">Government insurance</span>
          <span class="ia-sub">Medicare, Medicaid, CHIP, TRICARE</span>
        </div>
        <div class="ia-right">
          <span class="ia-price--unavail">Unavailable</span>
          <svg class="ia-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </summary>
      <div class="ia-body">
        <span class="ia-warn-label">Not eligible</span>
        <div class="ia-explanation">
          <strong>Manufacturer copay cards cannot legally be used with Medicare, Medicaid, CHIP, or other government insurance.</strong>
          Federal anti-kickback regulations prohibit using these programs when any portion of the drug is paid by a federal health plan.
          <br><br>
          <strong>Options for government beneficiaries:</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px; font-size: 14px;">
            <li><a href="https://www.medicare.gov/drug-coverage-part-d" target="_blank" rel="noopener">Medicare Part D Extra Help (LIS)</a> — low-income subsidy program</li>
            <li><a href="https://www.needymeds.org/" target="_blank" rel="noopener">NeedyMeds.org</a> — patient assistance programs by drug</li>
            <li><a href="https://www.rxassist.org/" target="_blank" rel="noopener">RxAssist.org</a> — manufacturer patient assistance programs</li>
          </ul>
        </div>
      </div>
    </details>

    <!-- ── Card 3: No Insurance / Cash Pay (collapsed by default) ── -->
    <details>
      <summary>
        <div class="ia-left">
          <span class="ia-type">No insurance / cash pay</span>
          <span class="ia-sub">Self-pay patients</span>
        </div>
        <div class="ia-right">
          <span class="ia-price" style="font-size:14px;">See options</span>
          <svg class="ia-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </summary>
      <div class="ia-body">
        <p style="font-size:15px; color:var(--text); margin:16px 0 8px;">
          Without insurance, the manufacturer may offer a separate <strong>Patient Assistance Program (PAP)</strong>
          for patients who qualify based on income. These programs can provide the medication at low or no cost.
        </p>
        <div class="ia-explanation" style="background:var(--info-bg); border-left-color:var(--info);">
          <strong style="color:var(--info);">Manufacturer Patient Assistance:</strong><br>
          Many patients without insurance qualify directly through the manufacturer.
          <a class="js-accordion-cta" href="#" onclick="return window.__openAccordionCta(event)" style="color:var(--teal); font-weight:600;">
            Check <span data-bind="manufacturer">manufacturer</span> patient assistance →
          </a>
        </div>
        <p style="font-size:13px; color:var(--text-3); margin:12px 0 0;">
          Eligibility and income limits vary by program. Visit the manufacturer's official site for current terms.
        </p>
      </div>
    </details>
  </section>
  <!-- End Insurance Tier Accordion -->

`;

// Inline script injected once per page — wires the accordion CTAs to the 
// manufacturer URL already resolved by the page's load() function.
const ACCORDION_SCRIPT = `
  <!-- Accordion CTA wiring (Phase 3) -->
  <script>
    window.__openAccordionCta = function(e) {
      e.preventDefault();
      var url = window.__manufacturerUrl || '/';
      if (url && url !== '/') {
        try {
          var u = new URL(url);
          u.searchParams.set('utm_source', 'saverx.ai');
          u.searchParams.set('utm_medium', 'referral');
          u.searchParams.set('utm_campaign', 'insurance_accordion');
          window.open(u.toString(), '_blank');
        } catch (_) { window.open(url, '_blank'); }
      }
      return false;
    };
  </script>
`;

// ─── File walker ─────────────────────────────────────────────────────────────

async function* walkDrugs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    const indexPath = join(full, 'index.html');
    try {
      await stat(indexPath);
      yield indexPath;
    } catch {
      // no index.html in this subfolder — skip
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

let processed = 0, skipped = 0, failed = 0;

for await (const filePath of walkDrugs(DRUGS_DIR)) {
  let html;
  try {
    html = await readFile(filePath, 'utf8');
  } catch (err) {
    console.error(`READ ERROR ${filePath}:`, err.message);
    failed++;
    continue;
  }

  // Idempotency: skip if already injected
  if (html.includes(MARKER)) {
    skipped++;
    continue;
  }

  // Safety: only inject into pages that have the anchor
  if (!html.includes(ANCHOR)) {
    console.warn(`SKIP (no anchor): ${filePath}`);
    skipped++;
    continue;
  }

  // Inject accordion before footer email capture
  // Also inject the wiring script before </body>
  let updated = html.replace(ANCHOR, ACCORDION_HTML + ANCHOR);
  updated = updated.replace('</body>', ACCORDION_SCRIPT + '</body>');

  if (DRY) {
    console.log(`[DRY] Would update: ${filePath}`);
    processed++;
    continue;
  }

  try {
    await writeFile(filePath, updated, 'utf8');
    processed++;
    if (processed % 50 === 0) console.log(`  Processed ${processed}…`);
  } catch (err) {
    console.error(`WRITE ERROR ${filePath}:`, err.message);
    failed++;
  }
}

console.log(`\nDone. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
