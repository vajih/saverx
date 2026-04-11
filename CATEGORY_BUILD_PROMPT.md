# Claude Code Prompt — SaveRx Category Navigation System

> **Instructions:** Paste this entire prompt into Claude Code (Sonnet 4.6) running from the `saverx/` repo root. Claude Code will auto-read `CLAUDE.md` for repo context before executing.

---

## Objective

Build a complete condition-based category navigation system for SaveRx.ai. This adds a new browsing layer (by health condition) alongside the existing per-drug pages, without breaking anything.

## Scope — 5 Deliverables

1. **`data/categories.json`** — Single source of truth mapping 7 categories to their drugs
2. **Homepage category tile section** — Visual grid added to `index.html` between hero and existing featured section
3. **7 category landing pages** — Dynamic SEO + conversion pages at `/categories/{slug}/index.html`
4. **Site-wide nav update** — "Categories" dropdown added to the header on drug pages + top-level pages
5. **Sitemap + internal linking updates** — Add category URLs to `sitemap.xml`, add category backlink from each drug page

## The 7 Categories

| # | Slug | Display Name | Accent Color | Icon | Priority |
|---|------|--------------|--------------|------|----------|
| 1 | `weight-loss` | Weight Loss & GLP-1 | `#10b981` / `#ecfdf5` | ⚖️ | Most Popular |
| 2 | `diabetes` | Diabetes | `#3b82f6` / `#eff6ff` | 💉 | High |
| 3 | `heart-cholesterol` | Heart & Cholesterol | `#ef4444` / `#fef2f2` | ❤️ | High |
| 4 | `autoimmune` | Autoimmune & Inflammation | `#8b5cf6` / `#f5f3ff` | 🛡️ | Medium |
| 5 | `migraine` | Migraine | `#f59e0b` / `#fffbeb` | ⚡ | Medium |
| 6 | `respiratory` | Asthma & Respiratory | `#06b6d4` / `#ecfeff` | 🫁 | Medium |
| 7 | `mental-health` | Mental Health | `#ec4899` / `#fdf2f8` | 🧠 | Medium |

## Step 1 — Create `data/categories.json`

Structure:

```json
{
  "categories": [
    {
      "slug": "weight-loss",
      "name": "Weight Loss & GLP-1",
      "short_name": "Weight Loss",
      "icon": "⚖️",
      "color": "#10b981",
      "color_bg": "#ecfdf5",
      "description": "Ozempic, Wegovy, Mounjaro, Zepbound and other GLP-1 medications for weight management and type 2 diabetes.",
      "long_description": "GLP-1 receptor agonists are the most prescribed weight-loss medications today. They work by slowing digestion and reducing appetite. Savings are complicated — most plans don't cover weight loss, and copay cards often exclude GLP-1s. We help you find every available option.",
      "meta_title": "GLP-1 & Weight Loss Medication Savings | SaveRx.ai",
      "meta_description": "Find the cheapest way to get Ozempic, Wegovy, Mounjaro, Zepbound and other GLP-1 weight loss medications. Compare manufacturer programs, telehealth providers, and savings cards.",
      "featured": true,
      "badge": "Most Popular",
      "drugs": ["ozempic", "wegovy", "mounjaro", "zepbound", "saxenda", "rybelsus", "trulicity", "victoza", "qsymia"],
      "email_category": "glp1",
      "affiliate_cta": {
        "headline": "Can't afford your GLP-1 medication?",
        "body": "Online telehealth providers prescribe Ozempic, Wegovy, and compound alternatives for $145-$299/month — no insurance required.",
        "link": "/drugs/glp1-online.html",
        "button_text": "Compare Telehealth Options"
      }
    }
    // ... repeat for all 7 categories
  ]
}
```

### Drug assignments for each category

Use this mapping. Cross-check against actual drug pages in `/drugs/` — only include drugs that have live pages. Log any missing ones.

**weight-loss**: ozempic, wegovy, mounjaro, zepbound, saxenda, rybelsus, trulicity, victoza, qsymia

**diabetes**: jardiance, farxiga, freestylelibre, dexcom, lantus, humalog, tresiba, toujeo, basaglar, tradjenta, invokana, januvia, glyxambi, synjardy, xigduo-xr, invokamet-xr, trijardy-xr, janumet, xultophy, steglujan, segluromet, onglyza, qternmet-xr, nesina, oseni, kazano, novolog, fiasp, apidra, lyumjev, afrezza, humalog, ryzodeg-70-30, levemir, baqsimi

**heart-cholesterol**: repatha, praluent, leqvio, nexletol, nexlizet, vascepa, entresto, eliquis, xarelto, brilinta, pradaxa, savaysa, corlanor, evkeeza, camzyos

**autoimmune**: enbrel, dupixent, rinvoq, tremfya, taltz, cimzia, otezla, xeljanz, actemra, orencia, kevzara, remicade, adbry, vtama, briumvi, mavenclad, kesimpta, ocrevus, tecfidera, tysabri, aubagio, bafiertam, mayzent, zeposia, lemtrada

**migraine**: nurtec, aimovig, emgality, vyepti, zavzpret, tosymra, trudhesa, qulipta, ubrelvy

**respiratory**: symbicort, advair-diskus, breo-ellipta, trelegy, anoro-ellipta, stiolto-respimat, dulera, fasenra, arnuity-ellipta, qvar-redihaler, striverdi-respimat, breztri-aerosphere, dupixent

**mental-health**: vyvanse, trintellix, rexulti, auvelity, spravato, lybalvi, aristada, viibryd, belsomra, sublocade, xyrem, azstarys, ingrezza

For each category, also write a unique `long_description`, `meta_title`, `meta_description`, and `affiliate_cta` matching the tone and intent of that condition. Reference `docs/REVENUE_SPEC.md` and `docs/EMAIL_SEQUENCES.md` for tone.

## Step 2 — Update `index.html`

Add a new `<section class="categories">` between the existing hero section and the featured drugs section. Use the design from `mockups/category-tiles-mockup.html` — it's already tested and uses the right tokens.

Requirements:
- Read the mockup file first and copy its CSS into `assets/css/components.css` (don't re-inline it)
- The tile grid should be data-driven: on page load, fetch `data/categories.json` and render the 7 tiles dynamically (match the same pattern the existing featured grid uses)
- Each tile links to `/categories/{slug}/`
- Include a "Most Popular" badge only on the `featured: true` category
- Maintain full mobile responsiveness
- Add a graceful fallback so the section still renders if JSON fetch fails (SSR-style initial HTML with category tiles hardcoded, then JS enhances)

## Step 3 — Create 7 Category Landing Pages

For each category, create `categories/{slug}/index.html`. These are SEO + conversion hubs.

### Required sections per category page

1. **Header + nav** (copy from existing drug pages — same sticky header, same GTM tag, same CSS)
2. **Breadcrumb** (`Home > Categories > {Category Name}`)
3. **Hero** — category name, long_description, and the category's accent color as a subtle top border or badge
4. **Stats bar** — "{N} medications · {saving estimate} average savings · Updated {date}"
5. **Drug grid** — All drugs in this category as clickable cards. Each card shows: drug name, generic name, manufacturer, cash price, "as low as" price, savings per fill. Uses same drug data source (Google Apps Script featured endpoint in mode=drug)
6. **Affiliate CTA block** — Uses `affiliate_cta` from categories.json. For weight-loss, this links to `/drugs/glp1-online.html`. For other categories, use a sensible default (GoodRx comparison or manufacturer savings link) — leave a `TODO: affiliate URL pending approval` comment
7. **Email capture form** — Same Apps Script form as drug pages, but with `source: "SaveRx Category - {slug}"` and `drug: "{Category Name}"`. This ensures the email sequences tag the lead with `email_category` from categories.json
8. **FAQ section** — 4-6 category-specific questions with full-text answers. Include FAQPage JSON-LD schema
9. **Footer** — Same footer as existing pages

### SEO requirements per category page

- `<title>` from `meta_title`
- `<meta name="description">` from `meta_description`
- `<link rel="canonical">` to `https://saverx.ai/categories/{slug}/`
- Open Graph tags
- `BreadcrumbList` + `CollectionPage` + `FAQPage` JSON-LD schemas
- H1 tag contains the primary keyword from `meta_title`
- All drug cards linked with descriptive anchor text

### Design consistency

- Uses `assets/css/tokens.css` variables — no hardcoded colors except category accents
- Uses existing `.btn`, `.card`, container classes from `assets/css/components.css`
- Matches the header/footer/nav markup of existing drug pages exactly
- Category accent color only appears in: top border, category badge, CTA button hover, drug card hover accent
- All other UI stays on-brand blue

## Step 4 — Update Site-Wide Navigation

Add a "Categories" dropdown to the sticky header on:
- `index.html`
- `about.html`
- `contact.html`
- `privacy.html`
- All 358 drug pages in `/drugs/*/index.html`
- `templates/index.html` (so future drug pages inherit it)

The dropdown should list all 7 categories with their icons, linking to `/categories/{slug}/`. Make it accessible (keyboard navigable, aria-expanded, escape to close).

**IMPORTANT:** Use a single script approach for drug pages — write a Node.js script at `scripts/_add-categories-nav.mjs` that walks `drugs/*/index.html`, finds the existing `<nav>` element, and inserts the Categories dropdown as the first nav item. This matches the pattern of `scripts/_fix-api-urls.mjs`. Don't manually edit 358 files.

## Step 5 — Sitemap + Internal Links

1. **`sitemap.xml`** — Add all 7 category URLs at priority 0.9 (same as `glp1-online.html`)
2. **Each drug page** — Add a small "Related category" link in the page sidebar that points back to its parent category. Use the same `_add-categories-nav.mjs` script to do this in one pass
3. **`/categories/index.html`** — Create an index page at the top of /categories/ that lists all 7 categories (essentially the homepage tile section reused)

## Constraints — Don't Break These

These are from `CLAUDE.md` and are non-negotiable:

1. Drug pages are static HTML — no build step, no framework, no bundler
2. Don't change the Google Apps Script deployment URL
3. Don't remove GTM tags from any page
4. Use existing design tokens from `tokens.css` — no new colors except category accents (which only appear in category-scoped CSS)
5. All 361 drug pages must remain functional after changes
6. Never commit `.env` or PII CSVs
7. The email capture form must keep returning success to the user even if backend calls fail

## Definition of Done

Report back to me with this exact checklist:

- [ ] `data/categories.json` created with all 7 categories populated with drugs, descriptions, CTAs, and email_category mapping
- [ ] `mockups/category-tiles-mockup.html` design ported into `assets/css/components.css` (new CSS added, no duplication)
- [ ] `index.html` updated with category tile section between hero and featured
- [ ] 7 category landing pages created at `categories/{slug}/index.html` — list each filename
- [ ] `categories/index.html` created (category index hub)
- [ ] Site-wide "Categories" dropdown added to header on: index.html, about.html, contact.html, privacy.html, templates/index.html
- [ ] `scripts/_add-categories-nav.mjs` created and run — confirm how many drug pages were updated
- [ ] `sitemap.xml` updated with 8 new URLs (7 categories + 1 index)
- [ ] Each drug page has a "Related: {category}" link in the sidebar
- [ ] Tested locally with `npx serve . -p 8080` — confirm:
  - [ ] Homepage category tiles render and are clickable
  - [ ] Each of the 7 category pages loads and displays drug grid
  - [ ] Category dropdown in nav works on a drug page
  - [ ] Email capture form on a category page submits successfully to Apps Script and logs a row in Google Sheet
  - [ ] Mobile responsive — test at 375px width
- [ ] Listed any drugs from the category mapping that didn't have existing drug pages (so I can create them later)

## After You're Done

Once this is live, the immediate next step is updating `CLAUDE.md`'s "Done" section to reflect category navigation, and then deploying with `wrangler pages deploy . --project-name saverx`. I'll handle that myself — just confirm the build works locally first.

## Reference Files

Read these before starting:
- `CLAUDE.md` — repo context (auto-loaded)
- `mockups/category-tiles-mockup.html` — design spec for tile section
- `drugs/ozempic/index.html` — reference drug page for header/footer/nav markup
- `drugs/glp1-online.html` — reference for SEO-focused landing page structure
- `assets/css/tokens.css` — design tokens
- `assets/css/components.css` — existing component CSS (add new category styles here)
- `scripts/_fix-api-urls.mjs` — pattern to follow for the nav update script
- `scripts/Code.gs` — see `getDrugCategory()` for existing category logic to stay consistent with
- `docs/REVENUE_SPEC.md` — for tone of affiliate CTAs
- `docs/EMAIL_SEQUENCES.md` — for understanding how email_category drives automation

Start with Step 1 (`data/categories.json`) and work sequentially. Ask me if anything is ambiguous before making assumptions.
