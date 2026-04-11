# SaveRx.ai — Cookie Consent Banner Implementation Prompt

**For:** Claude Code Sonnet 4.6
**Goal:** Ship a minimal, privacy-respecting, Google Consent Mode v2-compliant cookie banner across all SaveRx.ai pages. This unblocks AdSense re-submission, enables retargeting in Phase 2, and satisfies partner diligence questions.

**Scope:** Hand-rolled vanilla JS (no vendor CMP, no dependency added). ~150 lines of JS/CSS. One reusable script loaded on every page. Deploys to Cloudflare Pages via `wrangler pages deploy`.

---

## Before you start — read these files

1. `CLAUDE.md` — project context and constraints
2. `STRATEGY_APRIL_2026.md` §5 — the strategic rationale for this work
3. `index.html` — find the existing GTM snippet (look for `GTM-MVZBBF7R`); your banner must work with it
4. `privacy.html` — current privacy policy; you'll need to update it
5. `assets/css/tokens.css` — use existing design tokens for banner styling
6. `assets/css/components.css` — where the banner CSS will live
7. A sample drug page (e.g., `drugs/ozempic/index.html`) — confirm the GTM snippet is identical and that your script can be injected the same way across all 361 pages

**Do not modify:**

- The existing GTM container ID
- Any tracking pixels that are already live
- The site's static HTML structure beyond adding the script tag and banner markup
- `scripts/Code.gs` or the Apps Script deployment

---

## Task 1 — Create the consent management script

**File:** `assets/js/consent.js` (new file)

Build a single vanilla JS file that:

### 1a. Google Consent Mode v2 defaults
Before GTM loads, push the default consent state to `dataLayer`. This must run **synchronously in the `<head>`, before the GTM snippet**. Use `denied` as the default for all non-essential categories:

```javascript
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
  'functionality_storage': 'granted',
  'security_storage': 'granted',
  'wait_for_update': 500
});
gtag('set', 'url_passthrough', true);
gtag('set', 'ads_data_redaction', true);
```

### 1b. Stored consent check
On page load, read `localStorage.getItem('saverx_consent')`. If it exists and is valid JSON with a `timestamp` within the last 365 days, apply the stored consent via `gtag('consent', 'update', …)` and do NOT show the banner. If missing, expired, or invalid, show the banner.

### 1c. Banner rendering
Inject the banner HTML into the page only when needed. Use `document.createElement` (not innerHTML with user data). The banner must:

- Be positioned **fixed, bottom of viewport**, full width on mobile, max-width ~720px centered on desktop
- Have a high z-index (e.g., 9999) but not block the entire viewport
- Include 3 action buttons: **Accept all**, **Reject all**, **Preferences**
- Include a concise description (max 2 short sentences) and a link to `/privacy.html`
- Include an `aria-label="Cookie consent"`, `role="dialog"`, `aria-modal="false"`
- Have a close (×) button in the corner that is **functionally equivalent to Reject all** (never a dark-pattern "close = accept")
- Animate in with a subtle slide-up transition (use CSS `transform: translateY(100%)` → `translateY(0)` + `transition`)

### 1d. Preferences modal
When "Preferences" is clicked, replace the banner content (same container, same position) with granular toggles for three categories:

- **Analytics** — Google Analytics 4, event tracking. Default: off.
- **Advertising** — Google Ads, AdSense, future Meta pixel. Default: off.
- **Personalization** — saved state for a better return visit. Default: off.

Plus a read-only **Essential** section explaining what essential cookies are (CSRF tokens, session continuity) and that they cannot be disabled. Include **Save preferences** and **Accept all** buttons at the bottom.

### 1e. Consent handlers
Implement three handlers:

**`acceptAll()`:**
```javascript
gtag('consent', 'update', {
  'ad_storage': 'granted',
  'ad_user_data': 'granted',
  'ad_personalization': 'granted',
  'analytics_storage': 'granted'
});
saveConsent({ analytics: true, advertising: true, personalization: true });
hideBanner();
```

**`rejectAll()`:**
```javascript
gtag('consent', 'update', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied'
});
saveConsent({ analytics: false, advertising: false, personalization: false });
hideBanner();
```

**`savePreferences(prefs)`:**
Map the preferences object to the appropriate Consent Mode v2 flags. `prefs.analytics` → `analytics_storage`. `prefs.advertising` → `ad_storage`, `ad_user_data`, `ad_personalization`. `prefs.personalization` → `functionality_storage` (already granted by default, but make it toggleable via `personalization_storage`).

### 1f. saveConsent helper
Store in localStorage as JSON:
```javascript
{
  "timestamp": 1712851200000,
  "version": 1,
  "analytics": true|false,
  "advertising": true|false,
  "personalization": true|false
}
```

Include a `version` field so we can invalidate old consent if the policy changes.

### 1g. Re-open affordance
Add a small, persistent "Cookie settings" link in the site footer (via a `data-consent-toggle` attribute that any element can use). Clicking it reopens the preferences modal, allowing users to change their mind — this is a GDPR requirement and a trust signal.

### 1h. Accessibility
- All buttons are `<button>` elements with proper labels
- Focus is trapped inside the banner when open
- `Escape` key triggers `rejectAll()` and closes the banner
- Focus returns to the element that opened the preferences modal
- Color contrast meets WCAG AA (check against tokens.css)

### 1i. GA4 consent events
Fire these events via `gtag('event', …)` once consent is given (they'll only transmit if analytics is granted):

- `consent_accept_all` — user clicked accept all
- `consent_reject_all` — user clicked reject all
- `consent_custom` — user saved custom preferences (include the preferences as params)

---

## Task 2 — Create the CSS

**File:** `assets/css/components.css` — append a new section

Add a clearly commented `/* ========== Cookie consent banner ========== */` block with:

- `.saverx-consent-banner` — fixed bottom, max-width 720px, centered, box-shadow, border-radius from tokens
- `.saverx-consent-banner[hidden]` — display: none
- `.saverx-consent-banner__backdrop` — semi-transparent only for the preferences modal state
- `.saverx-consent-banner__content`, `.saverx-consent-banner__actions`, `.saverx-consent-banner__close`
- `.saverx-consent-banner__toggle` — styled toggle switch for the preferences modal
- Dark-mode compatibility via existing `tokens.css` variables
- Mobile: full-width (minus 16px margin), actions stack vertically below ~480px
- Use only tokens from `tokens.css` — no new hex values

---

## Task 3 — Inject into every page

### 3a. Create an injection script

**File:** `scripts/_add-consent-banner.mjs` (new file)

Node.js ESM script that:

1. Walks every `.html` file under the repo root (excluding `node_modules/`, `.venv/`, `staging/`, `test/`, `mockups/`, and `emails/`)
2. For each file, check if it already has `assets/js/consent.js` referenced — skip if so (idempotent)
3. Finds the existing GTM `<script>` block (matches on `GTM-MVZBBF7R`)
4. Inserts a new `<script src="/assets/js/consent.js"></script>` tag **immediately before** the GTM script (so consent defaults are set before GTM loads)
5. Also inserts the Consent Mode v2 default block (from Task 1a) as an inline script **before** the consent.js script tag, so defaults are set synchronously
6. Writes the file back
7. Logs each file modified to stdout

After writing the script, run it with `node scripts/_add-consent-banner.mjs` and verify:

- `index.html` has the consent script
- At least 5 random drug pages have it
- `categories/weight-loss/index.html` has it
- `privacy.html`, `about.html`, `contact.html` have it
- Zero pages have it twice (grep to confirm)

### 3b. Add the footer cookie-settings link

For each HTML page, find the existing footer (look for `<footer>` or the footer section structure used across pages) and add a "Cookie settings" link with `data-consent-toggle` attribute. This must also be idempotent — do not add it twice if it already exists.

Example insertion near the existing privacy/terms links in the footer:
```html
<a href="#" data-consent-toggle>Cookie settings</a>
```

---

## Task 4 — Update privacy.html

**File:** `privacy.html`

Add a new section titled **"Cookies and Consent"** that explains:

1. What categories of cookies SaveRx uses (essential, analytics, advertising, personalization) — match the banner's preferences modal exactly
2. That the user can change their preferences at any time via the "Cookie settings" link in the footer
3. That we honor GPC (Global Privacy Control) signals — add a line saying we treat a GPC signal as an automatic "reject all"
4. Who our current third-party processors are (Google Analytics 4, Google Tag Manager, Google AdSense if approved, Resend for email, Cloudflare for hosting)
5. Link to each processor's privacy policy
6. A note about GDPR/CCPA rights (access, deletion, opt-out of sale) with a contact link to `contact.html`

Do not rewrite the entire privacy page — just add this new section and link to it from the top TOC if one exists.

---

## Task 5 — Handle GPC (Global Privacy Control)

In `consent.js`, on initial load, check for `navigator.globalPrivacyControl === true`. If it's present and true, automatically apply `rejectAll()` without showing the banner. This is a growing browser standard that sophisticated privacy-aware users rely on, and honoring it is a strong trust signal. Log a `consent_gpc_honored` event for GA4 tracking.

---

## Task 6 — Test

Before declaring done:

1. **Clear localStorage**, reload `index.html`, confirm banner appears bottom of page
2. **Click "Accept all"**, confirm banner disappears, confirm `localStorage.saverx_consent` has correct shape, confirm GTM's consent state is updated (check `dataLayer` in devtools)
3. **Clear localStorage**, reload, click "Reject all", confirm the same flow with denied state
4. **Click Preferences**, toggle analytics on / advertising off, save, confirm the mixed state persists
5. **Click the footer "Cookie settings" link** after consent has been given, confirm preferences modal reopens with current state
6. **Press Escape** while banner is open, confirm rejectAll runs
7. **Tab through** the banner with keyboard only, confirm focus trap works
8. **Test on mobile viewport** (375px) — banner must not cover critical content, buttons stack vertically
9. **Check a drug page** (e.g., `/drugs/ozempic/`) — same behavior as homepage
10. **Check a category page** (e.g., `/categories/weight-loss/`) — same behavior
11. **Inspect `dataLayer`** in console — confirm `consent` events are firing with correct payload
12. **Run `grep -r "consent.js" --include="*.html" | wc -l`** — should return ≥ 370 (361 drug pages + homepage + categories + other static pages)
13. **Visit with browser's "Do Not Track"** or a GPC-enabled browser — banner should not appear and reject state should auto-apply

---

## Definition of Done

- [ ] `assets/js/consent.js` exists and is self-contained (no external dependencies)
- [ ] `assets/css/components.css` has the new banner styles using only `tokens.css` variables
- [ ] `scripts/_add-consent-banner.mjs` exists and has been run
- [ ] Every `.html` file under the repo root (outside excluded dirs) has the consent script + Consent Mode v2 defaults
- [ ] GTM snippet is still intact on every page — no accidental removal
- [ ] Footer "Cookie settings" link present on every page
- [ ] `privacy.html` has the new Cookies and Consent section
- [ ] GPC honored automatically
- [ ] All 13 test cases in Task 6 pass
- [ ] Zero inline `style=""` attributes introduced
- [ ] Banner is WCAG AA accessible (keyboard, focus trap, ARIA, contrast)
- [ ] `localStorage.saverx_consent` has the correct shape and 365-day expiry logic
- [ ] No JavaScript errors in the console on any page after deploy

---

## Anti-patterns to avoid

1. **Do NOT use a dark pattern.** No "close = accept." No pre-checked opt-in boxes. No hiding "Reject all" behind "More options." These kill trust with the sophisticated users SaveRx wants.
2. **Do NOT add a dependency.** No CMP SaaS, no npm package, no CDN script. Self-contained vanilla JS.
3. **Do NOT block the viewport.** Bottom banner only. No full-screen modal on initial load.
4. **Do NOT set any non-essential cookies before consent.** Google Consent Mode v2 handles this correctly when defaults are `denied` — just make sure the default block runs BEFORE the GTM container script.
5. **Do NOT skip the footer re-open link.** It's a GDPR requirement and a trust signal.
6. **Do NOT hardcode colors.** Use `tokens.css` variables only.
7. **Do NOT forget idempotency.** The injection script will be re-run. Each run must be safe.
8. **Do NOT modify the Apps Script or email templates.** This is a front-end-only task.

---

## Estimated time

~2–3 hours of focused Claude Code execution:

- Task 1 (consent.js): 45 min
- Task 2 (CSS): 20 min
- Task 3 (injection + footer link): 30 min
- Task 4 (privacy.html): 15 min
- Task 5 (GPC): 10 min
- Task 6 (testing): 30 min

---

## After you finish

Report back with:

1. A list of every file created or modified (expect ~365 HTML files, plus 3 new files)
2. A screenshot or description of the banner on desktop and mobile
3. The full `localStorage.saverx_consent` shape after an "Accept all"
4. Confirmation that `dataLayer` shows the correct `consent` events
5. Any files that failed the idempotency check (grep returning > 1 match)
6. Any decisions you made where the prompt was ambiguous

---

## Why this matters (for context)

This 2–3 hour task unblocks three separate revenue and partnership workstreams:

1. **AdSense re-submission** — without a CMP, the application will be rejected or gated; with one, it's approval within 7–14 days, which starts the $500–$1,500/mo display ad revenue line.
2. **Retargeting capability** — the moment this ships, SaveRx can legally set a Meta pixel or Google Ads remarketing tag in Phase 2, which enables the behavioral email triggers and retargeting ads from the 90-day roadmap.
3. **Partner diligence** — every enterprise telehealth, employer-benefits, or B2B partner will ask about GDPR/CCPA compliance. "Yes, here's our CMP and consent log" is the answer that closes deals faster.

That's roughly $2K/mo in revenue unlocked + partner credibility, for 2–3 hours of work. This is the highest-ROI ticket in the current backlog, which is why it ships before anything else in the category fix or content pipeline.
