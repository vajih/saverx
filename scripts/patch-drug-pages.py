#!/usr/bin/env python3
"""
patch-drug-pages.py — Injects GoodRx pharmacy price comparison into all
existing drugs/*/index.html pages.

Run from the repo root:
    python3 scripts/patch-drug-pages.py

Safe to re-run: skips pages that are already patched.
"""

import os
import sys
from pathlib import Path

# ── Repo root (two levels up from this script) ───────────────────────────────
REPO = Path(__file__).resolve().parent.parent
DRUGS_DIR = REPO / "drugs"

# ── Patch markers (used to detect already-patched files) ─────────────────────
CSS_MARKER = "/* ── Pharmacy Price Comparison (GoodRx-powered)"
HTML_MARKER = '<section class="rx-compare"'
JS_MARKER = "// ── GoodRx price comparison section"
SCRIPT_MARKER = "goodrx-publisher-widget"

# ── CSS to inject (before </style>) ──────────────────────────────────────────
CSS_SNIPPET = """
    /* ── Pharmacy Price Comparison (GoodRx-powered) ─────────────────────────── */
    .rx-compare { background: #f8fafc; border-top: 1px solid #e6eaf2; padding: 40px 0 36px; }
    .rx-compare-inner { max-width: 720px; margin: 0 auto; padding: 0 16px; }
    .rx-compare-head { margin-bottom: 20px; }
    .rx-compare-title { font-size: 1.25rem; font-weight: 700; color: var(--color-heading, #0b2a4e); margin: 0 0 6px; }
    .rx-compare-sub { font-size: 0.9rem; color: #64748b; margin: 0; }
    .rx-ph-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .rx-ph-card { display: flex; flex-direction: column; align-items: center; gap: 5px; background: #fff;
      border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 10px; text-decoration: none;
      transition: border-color .15s, box-shadow .15s; text-align: center; }
    .rx-ph-card:hover { border-color: #3b82f6; box-shadow: 0 2px 10px rgba(59,130,246,.12); }
    .rx-ph-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .rx-ph-name { font-size: 0.82rem; font-weight: 600; color: #1e293b; }
    .rx-ph-cta  { font-size: 0.72rem; color: #3b82f6; }
    .rx-compare-all { display: block; text-align: center; font-size: 0.85rem; color: #64748b; text-decoration: none; margin-top: 2px; }
    .rx-compare-all:hover { color: #1d4ed8; }
    .rx-compare-attr { font-size: 0.7rem; color: #94a3b8; text-align: center; margin-top: 12px; }
    .rx-compare-attr strong { color: #00ac4f; }
    .goodrx-widget-slot { margin-top: 10px; }
    @media (max-width: 600px) {
      .rx-ph-grid { grid-template-columns: repeat(3, 1fr); }
    }
"""

CSS_ANCHOR = (
    "    /* Minimal modal visibility guarantees in case external CSS differs */"
)

# ── HTML section to inject (before <!-- Footer email capture -->) ─────────────
HTML_SNIPPET = """  <!-- ── Pharmacy Price Comparison (GoodRx-powered) ───────────────────────────
       White-labeled: SaveRx branding is primary. GoodRx attribution is small.
       GoodRx publisher widget slot: set data-publisher-id once approved.
       Apply at: https://www.goodrx.com/business/solutions/publisher-products
  ──────────────────────────────────────────────────────────────────────────── -->
  <section class="rx-compare" aria-labelledby="rxCompareTitle">
    <div class="container rx-compare-inner">
      <div class="rx-compare-head">
        <h2 id="rxCompareTitle" class="rx-compare-title">Compare Cash Prices at Your Pharmacy</h2>
        <p class="rx-compare-sub">
          Cash prices for <strong class="js-grx-drug"></strong> vary by pharmacy.
          Use a free coupon to pay less — no insurance needed.
        </p>
      </div>
      <div class="rx-ph-grid" id="rx-ph-grid"><!-- Populated by JS --></div>
      <div class="goodrx-widget-slot">
        <div id="goodrx-publisher-widget"
             class="goodrx-widget"
             data-drug=""
             data-publisher-id=""
             data-quantity="1">
        </div>
      </div>
      <a class="rx-compare-all js-grx-all" href="#" target="_blank" rel="noopener sponsored">
        View all pharmacy prices on GoodRx &rarr;
      </a>
      <p class="rx-compare-attr">Coupon prices provided by <strong>GoodRx</strong>. Estimates only — final price at pharmacy.</p>
    </div>
  </section>
  <!-- End Pharmacy Price Comparison -->

"""

HTML_ANCHOR = "  <!-- Footer email capture (kept as-is) -->"

# ── JS to inject (after the modalDrug line, before the catch block) ───────────
JS_SNIPPET = """
          // ── GoodRx price comparison section ──────────────────────────────────
          // Update drug name spans
          $$('.js-grx-drug').forEach(el => el.textContent = model.brand || slug);

          // Build GoodRx deep-link for "View all" CTA
          const grxBase = `https://www.goodrx.com/${encodeURIComponent(slug)}`;
          const grxParams = new URLSearchParams({
            utm_source: 'saverx', utm_medium: 'web', utm_campaign: 'pharmacy_compare'
          });
          const grxAllLink = document.querySelector('.js-grx-all');
          if (grxAllLink) grxAllLink.href = `${grxBase}?${grxParams}`;

          // Update GoodRx publisher widget data-drug
          const grxWidget = document.getElementById('goodrx-publisher-widget');
          if (grxWidget) grxWidget.setAttribute('data-drug', slug);

          // Pharmacy cards — brand-color dots, no trademarked logos
          const PHARMACIES = [
            { name: 'CVS',       color: '#cc0000', id: 'CVS'       },
            { name: 'Walgreens', color: '#046b30', id: 'WALGREENS' },
            { name: 'Walmart',   color: '#0071ce', id: 'WALMART'   },
            { name: 'Rite Aid',  color: '#003087', id: 'RITEAID'   },
            { name: 'Costco',    color: '#e31837', id: 'COSTCO'    },
            { name: 'Kroger',    color: '#003DA5', id: 'KROGER'    },
          ];
          const phGrid = document.getElementById('rx-ph-grid');
          if (phGrid && phGrid.children.length === 0) {
            phGrid.innerHTML = PHARMACIES.map(p => {
              const url = `${grxBase}?${new URLSearchParams({
                utm_source: 'saverx', utm_medium: 'web',
                utm_campaign: 'pharmacy_compare', pharmacy: p.id
              })}`;
              return `<a class="rx-ph-card" href="${url}" target="_blank" rel="noopener sponsored"
                         data-pharmacy="${p.id}">
                <span class="rx-ph-dot" style="background:${p.color}" aria-hidden="true"></span>
                <span class="rx-ph-name">${p.name}</span>
                <span class="rx-ph-cta">See price &rarr;</span>
              </a>`;
            }).join('');
            phGrid.addEventListener('click', ev => {
              const card = ev.target.closest('.rx-ph-card');
              if (!card) return;
              if (typeof gtag !== 'undefined') {
                gtag('event', 'pharmacy_compare_click', {
                  drug_name: window.__drugName || slug,
                  pharmacy: card.dataset.pharmacy || 'unknown'
                });
              }
            });
          }
          // ── End GoodRx section ────────────────────────────────────────────────
"""

JS_ANCHOR = "          if (modalDrug) modalDrug.value = window.__drugName;\n        } catch(err){"

# ── Widget script to inject (before </body>) ──────────────────────────────────
WIDGET_SNIPPET = """
  <!-- GoodRx Publisher Widget script
       Activates when data-publisher-id is set on #goodrx-publisher-widget.
       Apply at: https://www.goodrx.com/business/solutions/publisher-products -->
  <script async src="https://www.goodrx.com/widget/js/widget.js"></script>
"""

WIDGET_ANCHOR = "</body>"


def patch_file(path: Path) -> str:
    """Patch a single drug page. Returns 'patched', 'skipped', or 'error:<msg>'."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        return f"error:read:{e}"

    # Already patched?
    if JS_MARKER in content:
        return "skipped"

    original = content

    # 1. Inject CSS before the "Minimal modal visibility" comment
    if CSS_ANCHOR in content and CSS_MARKER not in content:
        content = content.replace(CSS_ANCHOR, CSS_SNIPPET + CSS_ANCHOR)

    # 2. Inject HTML section before the footer email capture comment
    if HTML_ANCHOR in content and HTML_MARKER not in content:
        content = content.replace(HTML_ANCHOR, HTML_SNIPPET + HTML_ANCHOR)

    # 3. Inject JS after the modalDrug line (before the catch block)
    if JS_ANCHOR in content and JS_MARKER not in content:
        content = content.replace(
            JS_ANCHOR,
            "          if (modalDrug) modalDrug.value = window.__drugName;"
            + JS_SNIPPET
            + "        } catch(err){",
        )

    # 4. Inject widget script before </body>
    if WIDGET_ANCHOR in content and SCRIPT_MARKER not in content:
        content = content.replace(WIDGET_ANCHOR, WIDGET_SNIPPET + WIDGET_ANCHOR)

    if content == original:
        return "skipped"

    try:
        path.write_text(content, encoding="utf-8")
    except Exception as e:
        return f"error:write:{e}"

    return "patched"


def main():
    pages = sorted(DRUGS_DIR.rglob("index.html"))
    # Exclude the drugs/index.html listing page and glp1-online.html (not a template page)
    pages = [p for p in pages if p.parent != DRUGS_DIR and p.parent.name != ""]

    patched = skipped = errors = 0
    error_list = []

    for page in pages:
        result = patch_file(page)
        if result == "patched":
            patched += 1
        elif result == "skipped":
            skipped += 1
        else:
            errors += 1
            error_list.append(f"  {page.relative_to(REPO)}: {result}")

    print(f"Done: {patched} patched, {skipped} already up-to-date, {errors} errors")
    if error_list:
        print("Errors:")
        for e in error_list:
            print(e)
    else:
        print("No errors.")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
