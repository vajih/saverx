# Get Help redesign

The intake now presents three understandable stages (About you → Your help → Sign up), with four question screens. It explains human guidance, the free alternative, and service fees before asking for contact details. The paper ticket illustration is native CSS/SVG, with no new image dependency.

- Medication remains editable, including when prefilled by a drug page.
- Coverage and prescription questions share the first screen. Selection stays visible until the visitor continues, allowing people to read Medicare/Medicaid and prescription notices.
- The main difficulty is a separate, short screen. Optional notes stay editable after choosing an answer.
- Guided enrollment leads the help choices; nothing is preselected. Existing $9.99, $19.99, free checklist, and free-only categories remain unchanged.
- Sign-up shows the medication, coverage, and selected service, with a Change action. Email and contact consent are required. Phone and separate SMS consent are optional.
- Free completion gives coverage-specific starting steps. Guided completion explains the no-payment request and expected human follow-up. Confirmation email copy covers both service paths.

## Integration and limitations

Existing `form_type=enroll_intake`, field names, deduplication `intake_id`, endpoint, GTM, consent controls, and categorical funnel events remain. No backend deployment is needed for this change. Publish the updated email template with the site.

Stripe links remain empty as on main. Paid choices therefore request help without payment; the page must not imply an active checkout or a guaranteed reservation. When configuring Stripe links later, verify product prices and payment terms and update any no-payment copy if checkout behavior changes. A return URL alone no longer generates `checkout_completed`; it generates `checkout_returned`. Verified payment conversion needs provider-side confirmation.

`intake_start` fires on the first medication edit or option selection. Existing step IDs are retained, although insurance and prescription now share a screen. Segment this release when comparing funnel performance. Never add emails, phone numbers, or free text to analytics.

The current Apps Script transport uses sendBeacon/no-cors. The browser can detect a rejected queue/network failure, but cannot verify that the Sheet write or email succeeded. Success copy reflects a sent request rather than verified delivery. A future acknowledged endpoint could strengthen this, outside this UI change.

## Validation

- `node --test test/enroll.test.mjs test/drug-conversion.test.mjs test/drug-options.test.mjs test/relief-data.test.mjs test/support-pages.test.mjs`
- `node --check assets/js/enroll.js`
- `git diff --check`
- Desktop interaction review: coverage notice, questions, plan selection, recap.
- Responsive review at 375px: medication prefill and direct entry, uninsured/prescription path, free sign-up. No real intake, email, or payment submitted in browser QA.

## Measure after release

Compare intake completions per start, paid choices per completion, and actual fulfilled cases against the prior flow, segmented by drug and traffic source. This redesign aims to improve conversion; an uplift is not yet measured. Keep free help and clear fees visible while evaluating results.
