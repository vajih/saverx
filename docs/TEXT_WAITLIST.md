# Text-alerts waitlist: where it lives and how to extend it

Captures a US mobile number + a medication (no texts are sent until A2P is approved; the first text asks the person to reply YES).
Rows go to the Google Sheet `TextWaitlist` tab through the Apps Script web app (`scripts/Code.gs`, `form_type=text_waitlist`).
Everything is hidden until `data/savings-watch.json` has `interest: true` and `live: false`.

## Surfaces (the `variant` column; `source_page` has the exact page)
| Surface | Where | Injector | `variant` |
|---|---|---|---|
| Drug-page card | `drugs/<slug>/` (363) and 7 guide pages | `scripts/_add-sms-interest.mjs` | `coupons` / `updates` (A/B headline) |
| Homepage band + hero link | `index.html` | `scripts/_add-sms-home.mjs` | `home` |
| Content-page band + sticky bar | 67 pages: `conditions/*`, `categories/*`, `learn/*`, comparison pages, `drugs/index.html`, `pharmacy`, `get-glp1`, `request-medication` | `scripts/_add-sms-band.mjs` | `content` |

Not included on purpose: about, contact, experts, privacy, terms, get-help, savings-watch, dashboard/admin.

## Rules that must not drift
- The consent paragraph on the homepage and content bands is word-for-word identical (the content-band injector copies it from the homepage band; a test enforces it).
  Changing the wording means changing the version string (`data-si-consent-version`, `CONSENT_VERSION` in `assets/js/sms-interest.js`) so each row records what the visitor saw.
- Never fire a Google Analytics event right before navigating: Google batches events (~5 s) and drops the batch on page change. The homepage/content bands hand the
  `sms_waitlist_signup` event to the destination drug page (see `docs/GA4_SETUP.md`).
- Phone numbers never reach analytics or beacon URLs; typed medication names never go to analytics (unlisted drugs are sent as `custom`).

## Add or change pages
Re-run the injector (idempotent): `node scripts/_add-sms-band.mjs`. To add a page type, add it to `targetPages()` in `scripts/_add-sms-band.mjs`
and give `chipsFor()` a rule if it should have page-specific quick-pick chips. Tests: `test/sms-band.test.mjs`, `test/sms-interest.test.mjs`.
