# SaveRx.ai — Category System Fix Prompt (v2)

**For:** Claude Code Sonnet 4.6
**Context:** This prompt fixes UX/UI and conversion gaps in the category navigation system that was built from `CATEGORY_BUILD_PROMPT.md`. The data layer (`data/categories.json`) and SEO scaffolding are solid; what's missing is the conversion plumbing — real drug-card grids, email capture, homepage entry points, and the CSS cleanup.

**Before you start — read these files in order:**

1. `CLAUDE.md` — project context, architecture, constraints
2. `data/categories.json` — the 7-category data layer, already populated
3. `categories/weight-loss/index.html` — the current category page pattern (what we're rewriting)
4. `index.html` lines 311–408 — the current homepage `#condition-tabs` section (what we're replacing)
5. `drugs/ozempic/index.html` — find the email capture form block and the drug pricing card markup; you will reuse both verbatim
6. `mockups/category-tiles-mockup.html` — the original 7-tile grid design the homepage should match
7. `assets/css/tokens.css` and `assets/css/components.css` — use existing tokens; do NOT introduce new color hex codes

**Do not modify:**

- `scripts/Code.gs` or the Apps Script deployment
- GTM/GA4 snippets in any page
- Any file under `drugs/` except to add related-category footer links (Task 8, optional)
- `data/categories.json` structure (you may correct typos/counts if you find them)

---

## Task 1 — Replace homepage `#condition-tabs` with the 7-tile grid

**File:** `index.html`

Delete the entire `<section class="container" id="condition-tabs">` block (lines ~311–408) including its companion `<script>` tab-switching IIFE, and replace with a **grid of 7 category tiles** based on the mockup in `mockups/category-tiles-mockup.html`.

Requirements:

- Section id: `#browse-by-condition`, `aria-label="Browse savings by health condition"`
- H2: "Browse by Health Condition"
- Subheading paragraph: "Find manufacturer savings, copay cards, and patient assistance by the condition you're treating."
- Grid: CSS grid, `minmax(260px, 1fr)`, `gap: 24px`, auto-fit. On mobile collapses to single column cleanly.
- **7 tiles** in this exact order, each reading its data from `data/categories.json` (hardcoded is fine since the site is static, but read from the JSON file to populate — do NOT invent drug counts):
  1. Weight Loss & GLP-1 (badge: "Most Popular")
  2. Diabetes
  3. Heart & Cholesterol
  4. Autoimmune & Inflammation
  5. Migraine
  6. Asthma & Respiratory
  7. Mental Health
- Each tile is a single `<a href="/categories/{slug}/">` (the whole tile is clickable, not just a button inside)
- Each tile contains: large icon (emoji), category title (h3), short description (1 sentence from JSON), drug count pill ("{N} medications"), subtle chevron on the right
- Hover: lift (translateY(-4px)), stronger shadow, accent-colored border (use the tile's own accent color, set via CSS custom property `--cat-accent` on the tile)
- Each tile gets its accent color via an inline style attribute: `style="--cat-accent: #10b981; --cat-accent-bg: #ecfdf5;"` — use the colors from `data/categories.json` (`theme.accent` and `theme.bg`)
- The "Most Popular" badge on Weight Loss is an absolutely-positioned pill in the top-right corner of the tile
- Include GA4 tracking: on click, fire `gtag('event', 'category_click', { category: '{slug}', source: 'homepage-tile-grid' })`

**CSS:** Put all new styles in `assets/css/components.css` under a clearly commented `/* ========== Category tile grid ========== */` block. Do NOT use inline `<style>` in `index.html`. Use tokens from `tokens.css` (spacing, font sizes, radii, shadows). The only hex values allowed are those read from `data/categories.json`.

**Place the new section directly below the hero** (after the `</section>` that closes `.hero.section`), before the `#featured` section. This puts category entry points above the fold on most screens.

---

## Task 2 — Rewrite the category page template

**Files:** All 7 pages under `categories/{slug}/index.html`

The current pages use a "drug chips" pattern. Replace with a proper landing-page layout. Build the pattern once on `categories/weight-loss/index.html`, verify it looks right, then propagate to the other 6 (autoimmune, diabetes, heart-cholesterol, mental-health, migraine, respiratory).

**New page structure, top to bottom:**

### 2a. Header + breadcrumb (keep existing)
- Keep the existing `<header>`, mobile drawer, and `<nav class="breadcrumb">`. No changes.

### 2b. Hero (refactor — strip inline styles)
- Keep the H1, icon, and description, but remove all inline `style=""` attributes.
- Add a new **stats bar** immediately below the hero description as a horizontal row of 3 stat blocks:
  - `{drug_count} medications` (from JSON)
  - `Avg savings up to $X/month` — use a category-specific value:
    - weight-loss: `$800`
    - diabetes: `$600`
    - heart-cholesterol: `$500`
    - autoimmune: `$4,500`
    - migraine: `$700`
    - respiratory: `$450`
    - mental-health: `$350`
  - `Updated April 2026`
- Each stat block: small uppercase label on top, large number/value below.
- CSS class: `.cat-stats-bar` in `components.css`.

### 2c. Drug card grid (REPLACES the chip list)
- Heading: `<h2>Medications in this category</h2>`
- Below the heading, add a loading skeleton grid (3 placeholder cards) and a real `<div id="cat-drug-cards" class="cards" role="list"></div>`.
- **Fetch drug data from the existing Apps Script endpoint** — the homepage `index.html` already has a block that does this for the Featured section. Find that fetch code (search for `featured-cards` and the `script.google.com/macros` URL) and adapt it. The endpoint returns JSON; filter it client-side to only the drug names listed in `drugs[].brand` for this category from `data/categories.json`.
- Each card shows: drug brand name (linking to `/drugs/{slug}/`), generic name, manufacturer, cash price, "as low as" price, savings per fill, a small "View savings" button.
- Reuse the existing `.card` CSS class from the homepage — do NOT invent a new one. If you need category-specific accent colors on cards, use the `--cat-accent` custom property set on a wrapper element.
- If the fetch fails, gracefully fall back to rendering simple chip links (current behavior) so the page never appears broken.

### 2d. Email capture form (NEW — required)
- Below the drug grid, add a full-width panel with:
  - Heading: "Get savings alerts for {category name}"
  - Subtext: "We'll email you when new manufacturer programs, coupons, or telehealth options become available for your medications."
  - The email form itself — **copy it verbatim from `drugs/ozempic/index.html`**, then change only:
    - `drug` hidden input value → the category name (e.g., `"Weight Loss & GLP-1"`)
    - `source` hidden input value → `"SaveRx Category - {slug}"` (e.g., `"SaveRx Category - weight-loss"`)
  - Keep the same Apps Script POST URL from the Ozempic page; do not change it
  - Keep the honeypot field, success message div, and button labels exactly as on the drug page
- Class wrapper: `.cat-email-capture` with subtle accent-tinted background using `--cat-accent-bg`.

### 2e. Affiliate CTA band (refactor existing)
- Keep the existing CTA block but strip inline styles and move the styling into `components.css` as `.cat-cta-band`.
- Weight-loss keeps the real Embody GLP-1 Katalys link from `data/categories.json`. Other categories keep their placeholder CTAs.
- Add trust sub-copy below the button: "Licensed US providers · HSA/FSA eligible · No insurance required" (for weight-loss). For other categories, use generic trust copy: "Official manufacturer programs · Verified savings · Updated monthly".
- Preserve the existing GA4 `affiliate_click` tracking.

### 2f. FAQ (convert to accordion)
- Replace the current plain `<p class="faq-q">` / `<p class="faq-a">` pattern with native `<details>` / `<summary>` elements — zero JS, full a11y, works on all browsers.
- Style `summary` with: larger font, bold, a chevron that rotates on `[open]`, generous padding, hover state.
- Keep the JSON-LD FAQPage block exactly as-is above the HTML FAQ. The JSON-LD and the visible FAQ text should stay in sync. Add an HTML comment above both: `<!-- NOTE: FAQ content is duplicated in JSON-LD above. Keep both in sync when editing. -->`
- Style in `components.css` under `.cat-faq`.

### 2g. Related categories strip (NEW)
- Below the FAQ, add `<h2>Explore other categories</h2>` and a horizontally-scrolling strip of the **other 6 categories** (exclude the current one).
- Each item: mini tile with icon, title, drug count, accent-colored border. Links to `/categories/{slug}/`.
- Class: `.cat-related-strip` — CSS grid with horizontal scroll on mobile, regular grid on desktop.
- Fire `category_click` GA4 event with `source: 'related-strip'` on click.

### 2h. Footer (keep existing)
- No changes.

---

## Task 3 — Add category dropdown to primary nav

**Files:** `index.html` (and propagate later via `scripts/_add-categories-nav.mjs`)

Replace the plain `<a href="/categories/">Categories</a>` link in the primary nav with a dropdown:

```html
<div class="nav-dropdown">
  <button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">
    Categories <span class="caret">▾</span>
  </button>
  <div class="nav-dropdown-menu" role="menu">
    <!-- 7 category links with icon + name, populated from data/categories.json -->
    <a href="/categories/weight-loss/" role="menuitem">💉 Weight Loss & GLP-1</a>
    <!-- ... etc for all 7 -->
    <hr>
    <a href="/categories/" role="menuitem"><strong>View all categories →</strong></a>
  </div>
</div>
```

Requirements:

- Keyboard accessible (Tab to open, Arrow keys to navigate, Escape to close)
- Click-outside closes it
- Mobile: falls back to inline expansion (no overlay)
- Vanilla JS only, small IIFE in the existing nav script block
- Style in `components.css` under `/* ========== Nav dropdown ========== */`

After verifying the dropdown works on `index.html`, update `scripts/_add-categories-nav.mjs` (or create it if missing) so the same dropdown markup gets injected into every drug page's primary nav. Run the script. Verify at least 5 drug pages have the dropdown after running.

---

## Task 4 — Update related-category links on drug pages (Task 8, scoped)

For each drug listed under a category in `data/categories.json`, open its `drugs/{slug}/index.html` file and add a small "Related category" link in the drug page footer or below the savings section:

```html
<p class="drug-category-link">
  Part of <a href="/categories/{category-slug}/">{category name}</a> — see all {N} medications
</p>
```

Only do this for the 8 drugs in weight-loss as a first pass. If that works, expand to all categories.

---

## Task 5 — CSS cleanup pass

**File:** `assets/css/components.css`

1. Add all new classes from Tasks 1–4 under clearly commented section headers (`/* ========== Category tile grid ========== */`, etc.)
2. Remove **every inline `style=""` attribute** from the 7 category pages. Every color, font-size, and spacing value must come from a class that references `tokens.css` variables.
3. Audit `categories/*/index.html` and `categories/index.html` for any remaining inline styles — remove them.
4. Do not introduce new hex color values except those already present in `data/categories.json` (category accent colors). Everything else must reference `var(--brand-600)`, `var(--neutral-700)`, etc., from `tokens.css`.

---

## Task 6 — Sitemap + internal linking

**File:** `sitemap.xml`

- Verify all 7 category pages are listed with priority 0.8
- Verify `categories/index.html` is listed with priority 0.9
- If any are missing, add them

---

## Task 7 — Analytics events (required)

Verify these GA4 events fire and add any that are missing:

| Event | Where | Parameters |
|-------|-------|------------|
| `category_click` | Homepage tiles | `category`, `source: 'homepage-tile-grid'` |
| `category_click` | Nav dropdown | `category`, `source: 'nav-dropdown'` |
| `category_click` | Related-strip on category pages | `category`, `source: 'related-strip'` |
| `view_category` | Category page load | `category` |
| `affiliate_click` | Category page CTA | `category`, `provider`, `source: 'category-page-cta'` |
| `email_signup` | Category page email form | `category`, `source: 'category-page-form'` — fire on successful submission |

Use the existing `gtag` function; no new GA4 setup needed.

---

## Definition of Done

Before you say "done," manually verify each of these:

- [ ] Homepage has a 7-tile grid below the hero, each tile links to `/categories/{slug}/`, and the "Most Popular" badge sits on Weight Loss
- [ ] The old 4-tab `#condition-tabs` block and its JS are fully removed from `index.html`
- [ ] Each of the 7 category pages has: hero, stats bar, drug card grid (fetched from Apps Script), email capture form, affiliate CTA, accordion FAQ, related-categories strip
- [ ] The email form on a category page successfully POSTs to the Apps Script endpoint when you test it (network tab shows 200 OK; the hidden `source` value is correct)
- [ ] The drug card grid renders real prices from the Apps Script endpoint (not just chips)
- [ ] FAQ opens/closes as native `<details>` accordions; JSON-LD is preserved and still in sync
- [ ] Nav "Categories" is a dropdown with 7 links; works on keyboard; closes on outside click
- [ ] Zero inline `style=""` attributes remain in any of the 7 category pages or `categories/index.html`
- [ ] All new CSS is in `assets/css/components.css` — no new `<style>` blocks in HTML
- [ ] All 7 category pages validate: run a quick grep to confirm `aria-current="page"` on the correct nav link, canonical URL is correct, OG tags match the category
- [ ] `sitemap.xml` contains all 7 category pages + the index
- [ ] GA4 events listed in Task 7 all fire — test at least 2 of them by clicking through with the browser console open
- [ ] Mobile: open each page in a narrow viewport (375px). Tile grid single-column, stats bar wraps cleanly, FAQ readable, email form full-width

---

## Notes, gotchas, and anti-patterns to avoid

1. **Do not rebuild the drug card from scratch.** Find the existing card pattern on the homepage (`#featured-cards`) or on a drug index page, and reuse its markup and class names.
2. **Do not change the Apps Script URL.** Read it from an existing drug page and use the same one. There is one canonical URL currently in use across all 358 drug pages.
3. **Do not add a framework, bundler, or build step.** Static HTML + vanilla JS only.
4. **Do not introduce new colors.** Every color must come from `tokens.css` or `data/categories.json`.
5. **Do not duplicate the FAQ in three places.** Currently it's in JSON-LD + HTML. Keep it to two (JSON-LD + accordion HTML) and add the sync comment.
6. **Verify before propagating.** Finish all changes on `categories/weight-loss/index.html` first, show the diff, get visual confirmation the pattern is right, then replicate to the other 6 pages.
7. **Preserve SEO hygiene.** Do not touch canonical, OG, GTM snippets, or JSON-LD except the FAQ block.
8. **If something is ambiguous, stop and ask.** Don't invent drug prices, affiliate URLs, or savings numbers. If data is missing from `data/categories.json`, flag it and ask — do not fabricate.

---

## Suggested order of execution

1. Tasks 1 + 5 together (homepage tile grid + CSS organization) — 30 min
2. Task 2 on weight-loss only — 45 min
3. Visual check, get approval
4. Task 2 propagation to other 6 categories — 30 min
5. Task 3 (nav dropdown) + propagation script — 30 min
6. Task 4 (drug page related-category links) for weight-loss drugs only — 15 min
7. Task 6 + Task 7 (sitemap + analytics verification) — 15 min
8. Full Definition-of-Done checklist walk-through — 15 min

**Total estimated time:** ~3 hours of Claude Code execution.

---

## After you finish

Report back with:

1. A list of every file you modified
2. Screenshots (or descriptions) of the homepage and one category page
3. Any items from the Definition of Done that are NOT yet checked, and why
4. Any decisions you made where the prompt was ambiguous, and what you picked
