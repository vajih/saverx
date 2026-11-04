# Experts contact integration

## Review status

The user approved a dedicated Experts spreadsheet instead of the shared SaveRx spreadsheet. The old backend and existing forms are excluded from this implementation. The dedicated backend is deployed at version 2. After owner authorization, its public health check and both real browser submissions passed. The website remains undeployed pending review.

- New spreadsheet: `1Dxv5Oz96CAdQzXdqtmHHiPavn1ctSduTci5P6qFcj-w`
- New Apps Script project: `1UmIkmnayA0Cayck_7Z0p2P8sxi7WOqyBECXwqzgxdw18a7_zliJ9pQx2`
- Initial project inspection: blank default myFunction. The approved backend was uploaded and deployed as version 2.
- Backend code: `backend/experts/Code.gs` and `backend/experts/appsscript.json`.
- Frontend endpoint configuration: `assets/js/experts-config.js`, pointing only to the new dedicated endpoint. There is no legacy endpoint fallback.

## Page and navigation

`experts/index.html` serves `/experts/`, preserving the supplied page's stylesheet, blue/black palette, illustrations and responsive layout. The original root `experts.html` remains untouched as the local handoff. `assets/js/experts.js` replaces downloads with initial-contact forms. Logo links go home; patient CTAs and the guidance card open the patient form; expert CTAs open the expert form.

Shared public navs and `templates/relief/header.html` include Experts. `scripts/install-experts-nav.py`, called by the brand metadata generator, retains the link after regeneration. Shared navigation collapses at 1100px to fit tablets. `/experts/` is included in the sitemap and sitemap generator.

## Data and safety

The dedicated handler creates only Expert Requests and Expert Signups in the new spreadsheet. Columns: `submission_id, submitted_at, submission_type, name, email, selected_topic_or_expertise, notes, source_page`.

Timestamps are generated on the server. Strict field/type/topic/length/email checks and the website honeypot reject invalid requests. A script lock serializes duplicate-ID checks and writes. Visitor-controlled cells use plain-text formatting plus apostrophe escaping. Existing tab headers are checked and never replaced. The handler confirms the saved ID/type by reading the written row back; responses contain the tab, timestamp, and duplicate status without returning contact details. No emails or payments are sent.

The browser requires a readable JSON acknowledgement with `saved:true` and a matching ID. Failure retains all inputs and offers retry using the same ID. Pending requests disable repeated submission. The backend capability check must return `experts-v1` before any POST. Missing configuration cannot send contacts to the old backend or display false success. Free text warns against medical records, diagnoses, insurance IDs and other personal health information. Contact consent links to the existing privacy policy.

## Required release steps

1. Review the files and local test results. Obtain permission before writing code to the new Apps Script project or publishing a web app.
2. Push only `backend/experts` to the new project. The owner must authorize spreadsheet access in Google if required. Create an Experts-only web app executing as the owner with public access; retain its deployment ID for subsequent updates.
3. Put its actual `/exec` URL in `assets/js/experts-config.js`. Do not invent or reuse an unrelated endpoint.
4. Test the local page against the real dedicated endpoint with one labeled dummy submission per type. Check the confirmed tab/ID, retry the same IDs, and verify no duplicate rows. Confirm actual cross-origin readability. Report live results separately from mocks.
5. Show the final changes and results before publishing the site through the existing PR/main workflow. Do not merge or deploy the site without approval.

## Local verification

`node --test test/*.test.mjs`; `node scripts/test-code-gs.mjs`; `python3 scripts/check-drug-options.py`; `python3 scripts/check-article-pages.py`; `node scripts/check-relief-redesign.mjs HEAD`; `git diff --check`.

Mocked browser QA covers /experts/ and navigation at desktop/tablet/mobile sizes, direct CTAs, full guidance card, retained artwork, consent, capability guard, failed/unconfirmed save, retry IDs, pending duplicate-click suppression and confirmed-only success. Mocks do not establish that Google Sheets saves work.

The earlier shared-backend experiment was restored to version 18 and its original source after Google denied access. That backend is outside the dedicated Experts rollout; do not alter it as part of this work.

## Dedicated deployment verification

Deployment ID: `AKfycby9MC7xtgif_umU2IxA8VXQs6G9eB2uATVf1Z9PKSNAKB3p45Fi_OHXsJaPQjwmB6yF9A`, version 2. Public `?mode=experts_health` returns HTTP 200 and experts-v1 after owner authorization. Live browser POST responses are readable cross-origin and contain confirmed saved records. The shared SaveRx backend was not touched during this dedicated deployment.

## Live verification — November 4, 2026

Two clearly labeled DUMMY QA records were submitted from the local page to the real dedicated endpoint. The backend read back each saved ID/type before acknowledging success. Retrying each identical ID returned duplicate:true with the original timestamp, without appending another row. No email or payment was sent.

- Expert Requests: `029cb445-d26c-42c3-983d-1c481a3ca2a7`, server time `2026-11-04T06:38:37.431Z`; saved and same-ID retry verified.
- Expert Signups: `f9df9126-efcd-4b13-b2af-51932f0d7d76`, server time `2026-11-04T06:38:43.399Z`; saved and same-ID retry verified.

## Existing shared backend check

A read-only request to the old SaveRx drug endpoint on November 4 still returned HTTP 403 rather than JSON. The dedicated Experts setup does not modify that backend, but existing live submissions cannot be certified until its Google access/authorization issue is resolved. Local legacy backend and page regression tests pass; those are not proof of live delivery.
