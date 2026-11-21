# Google Analytics 4 — setup audit and admin checklist (SaveRx.ai)

Property **521819447**, measurement ID **G-FCKENS1BWB**, GTM **GTM-MVZBBF7R**. Audited 2026-11-21 (code, live behavior in a real browser, and the Data API).

## What is verified working (in code)
- Consent Mode v2: all storage defaults to **denied** before GTM/gtag load; `consent.js` updates it on the visitor's choice; GPC honored. No `_ga` cookies exist before a choice.
- One `page_view` per load (the GTM Google tag and the page's own `gtag('config')` both use G-FCKENS1BWB; Google dedupes it, so there is no double counting).
- 445 public pages carry the identical tag set, in the right order. `/experts/` has **no** analytics (decide if that is intentional: it has contact forms).
- Custom events carry categorical parameters only (`drug_slug`, `variant`, `placement`); no phone numbers, emails or free text.
- The Data API connection used by the dashboard works.

## Changed in code (this PR)
- **Reports only from saverx.ai.** localhost, `*.pages.dev` previews and staging hosts send nothing (they would pollute the property).
- **Owner opt-out:** open any page with `?no_analytics=1` once to exclude that browser (`?no_analytics=0` re-enables).
- **Conversion no longer lost:** Google batches events and sends them ~5 s later, and drops the batch if the page changes first (measured).
  The homepage signup redirects to the drug page after 250 ms, so the `sms_waitlist_signup` event is now sent by the drug page it lands on (variant `home`).
  Rule going forward: never fire a GA event right before navigating; hand it to the next page.
- The Apps Script click beacon uses a keepalive request so it also survives the redirect.

## Admin steps (GA4 screens — only the property owner can do these)
1. **Key events:** Admin → Data display → Events → mark as key event: `sms_waitlist_signup` (primary), `savings_watch_verified`, `intake_complete`, `official_site_click` (secondary).
2. **Custom dimensions** (Admin → Custom definitions → Create, scope **Event**): `drug_slug`, `variant`, `placement`. Without these you cannot report signups by drug.
3. **Data retention:** Admin → Data collection and modification → Data retention → **14 months** (default is 2).
4. **Enhanced measurement:** Data streams → your web stream → Enhanced measurement ⚙ → turn **off "Form interactions"** (it auto-fires `form_start`/`form_submit` with field names; redundant with our events).
5. **Google signals:** Data collection → Google signals → **off** (a prescription-drug site; avoids ad-personalization linkage).
6. **Unwanted referrals:** Data streams → Configure tag settings → List unwanted referrals → add `stripe.com`, `checkout.stripe.com`, `buy.stripe.com` so a payment return does not become a referral session.
7. **Check for past pollution:** Explore → free form → dimension **Hostname**. Anything other than saverx.ai (e.g. `localhost`) came from testing; remove with Data collection and modification → Data deletion requests (use carefully).
8. **Product links:** link Search Console and AdSense (Admin → Product links).
9. **Verify consent mode:** Data streams → your stream → Consent settings should show consent mode active.
10. Optional: remove the duplicate Google tag from the GTM container (harmless as is).

## Reading the numbers
- With the banner unanswered or rejected, Google sees cookieless pings that are **not** counted as users in standard reports, so GA4 undercounts real traffic. The Google Sheet (`TextWaitlist`) is the source of truth for signups; GA4 is for sources and behavior.
- Campaign attribution: UTMs in the landing URL are captured by GA4 automatically (session source / medium / campaign).
