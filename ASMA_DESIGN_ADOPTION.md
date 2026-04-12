# SaveRx.ai — Adopting Asma's Design System

**Date:** April 11, 2026
**Based on live audit of:** `saverxapril2026.vercel.app` (Asma's redesign) and `saverx.ai` (current production)
**For:** Vajih and Asma

---

## Why this matters

Asma's redesign is materially better than what's on saverx.ai today — not by a little, by a lot. It's the difference between looking like a SaaS landing page template and looking like a trusted healthcare editorial brand. The good news is that the improvements are almost entirely in **design tokens + three structural components**, which means we can port them into the existing saverx.ai repo without rebuilding from scratch. This document is the exact recipe.

---

## Side-by-side: what's different and why Asma's wins

### Color palette

| | Asma's site | Current saverx.ai | Why Asma's is better |
|---|---|---|---|
| Background | `#f1efe8` (warm cream) | `#ffffff` (pure white) | Cream reads as calm, trustworthy, editorial. White reads as generic SaaS. |
| Surface (cards) | `#fdfcfa` (warm off-white) | `#ffffff` | Subtle contrast with the cream body creates visual depth without shadow tricks. |
| Text | `#2c2c2a` (warm near-black) | `#0f172a` (cool slate) | Warm text on warm bg = softer read, less fatigue. Cool on white = clinical. |
| Primary | Teal `#0b6e5c` / dark `#084d3f` | Blue `#1d4ed8` | Teal in healthcare reads as "caring/wellness." Blue is everyone's default. |
| Accent green (savings) | `#3b6d11` on `#eaf3de` | Emerald `#10b981` | Asma's green is a darker, more serious "money saved" green — not a neon SaaS green. |
| Info blue | `#185fa5` on `#e6f1fb` | none | Asma has a semantic info color for neutral callouts. |
| Warn amber | `#ba7517` on `#faeeda` | none | Semantic warning color for "government insurance unavailable" cases. |
| Borders | `rgba(44,44,42,0.12)` | none defined | Asma uses translucent warm borders — they blend with the paper bg and feel organic. |

**Takeaway:** Asma built a full **semantic color system** with matching `-bg` pairs (`--savings` + `--savings-bg`, `--info` + `--info-bg`, `--warn` + `--warn-bg`). That's a professional design-system move and the biggest single upgrade to steal.

### Typography

| | Asma's site | Current saverx.ai |
|---|---|---|
| Font family | System stack (`-apple-system, system-ui, Segoe UI, Helvetica, Arial`) | Inter + fallback |
| H1 | 48px, weight **500** (medium) | 44px, weight **700** (bold) |
| H2 | 24–32px, weight 500 | ~28px, weight 700 |
| Line height | ~1.15 for hero | ~1.2 |
| Body | system-ui | Inter |

**The single most impactful change:** Asma uses **font-weight 500** (medium) for all headings. saverx.ai uses **700** (bold). Medium weight + warm color reads as calm, premium, editorial (think NYT, Stripe, modern financial products). Bold weight + high contrast reads as SaaS startup landing page. This one change will do more for "feels premium" than any other edit.

The system font choice is also deliberate — it loads instantly (no Google Fonts network request), renders natively on every platform, and pairs better with the warm paper background than Inter does.

### Buttons and CTAs

| | Asma's site | Current saverx.ai |
|---|---|---|
| Nav/search button | Teal `#0b6e5c`, 10px radius, 14px/500, 8px 18px padding | Emerald `#10b981`, 10px radius, 16px/600, 12px 18px padding |
| Drug-page primary CTA | Dark teal `#084d3f`, **999px pill**, 16px 20px padding, white text | Same emerald button reused everywhere |

**The pill-shaped CTA on drug pages** is a subtle but important differentiation — it signals "this is the one action on this page" and feels more premium than a rounded rectangle. Use pills for primary page-level CTAs (get card, activate savings). Use 10px rounded rectangles for everything else (nav buttons, form submits, secondary actions).

### Page architecture (homepage)

**Asma's homepage has 6 tightly-scoped sections in deliberate order:**

1. **Hero** — white surface card, large H1 "Pay less for your branded medications," short subhead, single search input, single teal button. Minimal.
2. **Trust bar** — small horizontal scrolling row of verified/no-insurance/updated badges. Looks like TV-ad trust icons. Builds credibility instantly.
3. **How it works** — 3 numbered steps (Search → See savings → Activate card). Plain, clean, no illustrations.
4. **Testimonials** — "REAL PATIENTS. REAL SAVINGS." 5-star quotes. This is the most underused section on saverx.ai today.
5. **Commonly searched medications** — 7 pill chips (Repatha®, Ozempic®, etc.) with ® marks preserved.
6. **Education section** — "What is a manufacturer copay savings card?" single card, links to explainer.
7. **Footer disclaimer band** — teal-tinted strip with "SaveRx is not insurance" in plain text.

**saverx.ai currently has:** hero, the (newly-shipped) category tiles, featured drug cards, AI chat widget. It's close structurally, but the trust bar, testimonials, and education callouts are missing — and those are exactly the trust signals this category needs.

### Drug page architecture — the biggest structural win

This is the single most important thing to steal from Asma. Her Repatha page has an **insurance-tier accordion** — three cards, collapsible, each representing how patients actually think about drug cost:

1. **Private insurance** (employer or marketplace plan) — "$0–15/mo" big number, "30-day supply," "Typical cash price ~$780/mo," "Save up to 98%," "Get Amgen Savings Card" pill CTA
2. **Government insurance** (Medicare, Medicaid, CHIP) — "Unavailable" (because manufacturer copay cards can't legally be used with Medicare) — but honest about it
3. **No insurance** (cash-pay patients) — either shows a patient-assistance path or "Unavailable" with a link to alternatives

The hero displays `$0–15/mo` at **52px, weight 300** (light, not bold) — making the number the emotional center of the page, like a price tag on a luxury item.

This matches the way patients actually think: "OK I have Repatha, what will *I* pay based on *my* insurance?" It's also legally honest (Medicare can't use copay cards) and funnel-optimized (cash-pay becomes the telehealth affiliate opportunity).

**Current saverx.ai drug pages** are a generic "here's savings info" template without this segmentation. Adopting the three-tier pattern is a functional and visual upgrade at the same time.

### Other details worth copying

- **No emojis in nav or content.** Asma's site uses zero emojis. saverx.ai currently uses 💉💊❤️🧠⚡🫁🛡️ in category tiles and elsewhere. Emojis feel casual, dated, and accessibility-inconsistent. Replace with proper SVG icons or nothing at all.
- **Sticky translucent nav** — `rgba(241, 240, 233, 0.92)` backdrop blur. Subtle, modern, professional.
- **® marks preserved** on drug names. Small detail, big professionalism signal in pharma.
- **Breadcrumb on drug pages** — "SaveRx › Repatha®" above the H1. saverx.ai has this on category pages but not drug pages.
- **"Not insurance" disclaimer band** — Asma's site has an unmissable teal-tinted band on every page: *"SaveRx is not insurance. We help commercially insured patients find manufacturer savings programs."* This is legal CYA plus brand positioning, in one element.

---

## The migration plan

Three phases, done in order. **Phase 1 (design tokens) is the 80/20** — if you only do one phase, do this one. It's 1 hour of work and it changes the entire feel of the site.

### Phase 1 — Port the design tokens (1 hour)

**File to update:** `assets/css/tokens.css`

Replace the current tokens with Asma's system. Keep the existing variable names that are referenced elsewhere (`--brand-600`, etc.) but **change the values** and add the new semantic tokens:

```css
:root {
  /* === Canvas (Asma's paper palette) === */
  --bg: #f1efe8;              /* warm cream body background */
  --surface: #fdfcfa;          /* card/panel background */
  --surface-2: #ffffff;        /* elevated surface when needed */

  /* === Text === */
  --text: #2c2c2a;             /* primary text, warm near-black */
  --text-2: #5f5e5a;            /* secondary text */
  --text-3: #9a9a92;            /* tertiary / metadata */

  /* === Borders === */
  --border: rgba(44, 44, 42, 0.12);
  --border-strong: rgba(44, 44, 42, 0.20);

  /* === Primary (teal) === */
  --teal: #0b6e5c;              /* primary buttons, links, accents */
  --teal-dark: #084d3f;         /* primary CTA hover, pill CTAs */
  --teal-mid: #1a9478;          /* highlights */
  --teal-light: #e1f5ee;        /* tinted backgrounds */

  /* === Semantic === */
  --savings: #3b6d11;           /* "you save $X" text */
  --savings-bg: #eaf3de;        /* savings callout bg */
  --info: #185fa5;              /* neutral callouts */
  --info-bg: #e6f1fb;
  --warn: #ba7517;              /* "unavailable" / caution */
  --warn-bg: #faeeda;

  /* === Legacy aliases (keep existing CSS working) === */
  --brand-600: var(--teal);
  --brand-700: var(--teal-dark);
  --brand: var(--teal);
  --accent: var(--teal);

  /* === Shape === */
  --radius: 12px;
  --radius-sm: 8px;
  --radius-pill: 999px;         /* NEW: for primary drug-page CTAs */

  /* === Shadow === */
  --shadow-sm: 0 1px 2px rgba(44, 44, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(44, 44, 42, 0.06);
  --shadow-lg: 0 12px 32px rgba(44, 44, 42, 0.08);

  /* === Typography === */
  --font-sans: -apple-system, "system-ui", "Segoe UI", Helvetica, Arial, sans-serif;
  --fw-regular: 400;
  --fw-medium: 500;              /* headings use this — NOT 700 */
  --fw-semibold: 600;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: var(--fw-regular);
}

h1, h2, h3, h4 {
  font-weight: var(--fw-medium);
  color: var(--text);
  line-height: 1.15;
}

h1 { font-size: 48px; }
h2 { font-size: 32px; }
h3 { font-size: 24px; }
```

**Remove the Inter font import** from wherever it's loaded (`<link rel="stylesheet" href="https://fonts.googleapis.com/...">` tag in the HTML head). System fonts are what we want.

That's Phase 1. Reload the site. Every page on saverx.ai instantly picks up the cream background, warm text, teal primary, and medium headings — without touching any HTML.

### Phase 2 — Port the structural components (4–6 hours)

Once the tokens are in, ship these components one at a time, each as its own small commit:

1. **Sticky translucent nav** with `background: rgba(241, 240, 233, 0.92)` and `backdrop-filter: blur(10px)`, thin bottom border `1px solid var(--border)`.
2. **Trust bar** — horizontal strip below hero: "Verified manufacturer programs · No insurance info required · Updated regularly · Not affiliated with any manufacturer · Brand-name only · Instant access · No income requirements." Small text, warm border top+bottom, optional subtle marquee animation.
3. **How it works** — 3-step numbered block: Search → See savings → Activate card. Keep it text-only, no illustrations. Title "How it works," medium weight, 3 columns on desktop, stacked on mobile.
4. **Testimonials** — the "REAL PATIENTS. REAL SAVINGS." section. Use 3 real (or realistic placeholder) quotes with 5-star indicators. This is the missing trust layer.
5. **"Not insurance" disclaimer band** — site-wide footer strip with teal-tinted bg (`--teal-light`) saying "SaveRx is not insurance..." in small, warm text.
6. **Primary CTA pill variant** — new button class `.btn-primary-pill` with `border-radius: var(--radius-pill)`, `padding: 16px 20px`, `font-size: 15px`, `font-weight: 500`, `background: var(--teal-dark)`, `color: white`. Use only for drug-page "Get [manufacturer] Savings Card" CTAs.
7. **Remove emojis from category tiles** and replace with either proper SVG icons (Heroicons has healthcare-relevant icons) or nothing — just the category name + description.

### Phase 3 — Port the drug page insurance-tier accordion (4–6 hours)

This is the biggest structural change and the highest impact. The accordion pattern:

- **3 cards, stacked vertically**, each with a header (always visible) and a body (collapses)
- **Header:** left side = insurance type (title) + plain-English subtitle ("Employer or marketplace plan"); right side = headline price ("$0–15/mo") + ▲/▼ chevron
- **Body (private insurance card, open by default):** hero price in 52px/300 weight, subhead "30-day supply" , cash-price strikethrough "Typical cash price ~$780/mo," savings callout "Save up to 98%" (on `--savings-bg`), pill CTA "Get [Manufacturer] Savings Card ↗"
- **Government card (collapsed by default):** when opened, shows honest explanation that manufacturer copay cards cannot legally be used with Medicare/Medicaid/CHIP. Link to patient-assistance alternatives.
- **Cash-pay card (collapsed by default):** when opened, shows manufacturer patient-assistance path if available, plus the **GLP-1 telehealth affiliate block** where appropriate. This is where the affiliate revenue lives — but presented as a real solution for real people, not a banner.

Build this as a reusable snippet that can be dropped into all 361 drug pages via an injection script.

---

## The Claude Code prompt to execute the migration

Copy-paste this into Claude Code in the saverx.ai repo:

```
Execute the SaveRx.ai design adoption plan described in
`ASMA_DESIGN_ADOPTION.md` (sibling file in this repo).

Do this in three phases, one commit per phase, tested in the browser
between each:

PHASE 1 — Port design tokens (1 hour)
1. Read `ASMA_DESIGN_ADOPTION.md` for the full token list
2. Replace `assets/css/tokens.css` with the new token system (keep legacy
   aliases so existing selectors still work)
3. Remove any Google Fonts / Inter loading from the HTML head
4. Verify the homepage, a category page, and a drug page all render with
   the new cream background and medium-weight headings. Report visual
   before/after.

PHASE 2 — Structural components (4-6 hours)
5. Sticky translucent nav (new CSS class, apply to index.html first)
6. Trust bar component below hero on homepage
7. How it works 3-step section on homepage
8. Testimonials section with placeholder quotes (ask Vajih/Asma for real
   quotes later)
9. Site-wide "Not insurance" disclaimer band (inject into every page via
   a script similar to `scripts/_add-consent-banner.mjs`)
10. New `.btn-primary-pill` class in components.css
11. Remove all emoji usage from category tiles; replace with Heroicon SVGs
    or strip entirely

PHASE 3 — Drug page insurance-tier accordion (4-6 hours)
12. Build the 3-card accordion as a reusable HTML snippet with inline CSS
    referencing tokens
13. Write `scripts/_upgrade-drug-pages.mjs` that walks every drugs/*.html
    file and replaces the existing savings section with the new accordion,
    populated from the existing data per drug (brand, generic, manufacturer,
    cash price, private-insurance copay, affiliate URL)
14. Run it, spot-check 10 drug pages at random, verify the accordion
    works and the data is correct
15. Report any drugs where the data was missing and the accordion fell back
    to "Unavailable" — those need to be fixed manually

Constraints:
- Do NOT break the email capture forms — they must continue to POST to
  the existing Apps Script URL
- Do NOT break GTM/GA4 tracking
- Do NOT remove the AI chat widget
- Commit each phase separately with a descriptive message
- If anything is ambiguous, stop and ask before continuing
```

---

## What to keep from saverx.ai (don't throw out)

A few things saverx.ai already has that Asma's site doesn't — keep these:

1. **361 drug pages** with SEO inventory. Asma's site has 7. The SEO moat is on saverx.ai.
2. **Google Apps Script email capture + Resend automation.** Working loop.
3. **AI chat widget** (Cloudflare Worker). Asma's site doesn't have this yet.
4. **7 category landing pages** (live as of today's audit).
5. **Drug comparison pages** (Ozempic vs. Wegovy, etc.). These are link-bait gold.
6. **GLP-1 telehealth comparison page** with the Embody affiliate.

The goal is to **apply Asma's design system to saverx.ai's content inventory**, not the other way around. Asma's design is the better design; saverx.ai is the better content base.

---

## Homework for Asma

Before we run the migration:

1. **Send over the actual CSS Module files** from her Next.js project (the `.module.css` files under `page.module.css`, `DrugAccordion.module.css`, etc.) so we have the exact class-level styling to reference.
2. **Send the 3 real testimonial quotes** she wants used (or confirm it's OK to ship with placeholders and update later).
3. **Confirm the teal palette** — `#0b6e5c` vs. `#084d3f` — is the final choice, or if she's still iterating.
4. **Send any icon set** she's using instead of emojis (Heroicons, Lucide, custom SVGs).

Once Vajih has those four things from Asma, Claude Code can run Phase 1 and Phase 2 in a single session.
