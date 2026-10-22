# Supporting pages redesign

Extends the merged Relief design across Compare programs, Savings guides, Our story, Contact us, and the new Request a medication page. Uses existing type/color tokens and CSS paper illustrations. Guides add local search/topic filtering. Five existing guide articles receive typography styling with original article content preserved. Existing contact endpoint and form contracts remain. Medication requests use the existing request_med backend, require email consent, and confirm only an acknowledged successful sheet write. Footer request links now target the dedicated page.

## Maintain

Edit templates/relief/support/ and run `python3 scripts/build-support-pages.py`. The base relief generator calls this generator. Existing content, consent infrastructure and drug integrations are retained.

## Verified

- `node --check assets/js/support-pages.js`
- `node --test test/support-pages.test.mjs` (six passing tests)
- `node scripts/check-relief-redesign.mjs`
- `git diff --check`
- Desktop and 375px mobile visual review; guide filtering and contact topic routing.
- No live contact, newsletter or medication requests submitted. Backend delivery still requires an owner-controlled smoke test before release.

## Review

Most changed files contain only a footer URL replacement. Clinical guide bodies and drug comparison articles are not rewritten. Review the founder story (preserved from production) and request-email consent before merging. Human review and production deployment follow DEV_WORKFLOW.md.
