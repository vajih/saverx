# SaveRx relief redesign

Ports the approved “A little less out of pocket” concept into the existing static site. No framework, build service, new backend, or domain change is required.

## What changes

- Homepage: medication search, soft CSS sculptures, condition shelf, plain-language explanations. Existing medication requests, newsletter integration, consent and chat remain.
- Directory: all 357 records with existing detail pages, rendered as HTML from `data/drugs.json`; search and condition filters work locally. No live prices are inferred from the directory.
- Seven condition pages: local category membership with explicit Nurtec/Trelegy aliases; replaces malformed legacy grid JavaScript. Category alerts retain the same form field names and API.
- Medication pages: coverage-first layout, shared identity, original data binding, forms, consent, analytics, enrollment help, pharmacy links and affiliate sections. Placeholder testimonials are removed from standard drug pages.
- Existing About, Contact, comparison, education, legal and condition articles retain their content and backend handlers, with updated navigation, typography and surfaces. A new `/learn/` hub links to existing educational URLs.
- Shared loader: live API details, then live featured fallback, then a clearly unavailable state with the local medication name. Missing amounts stay unknown instead of displaying `$0`. Forms and card actions cannot route to the homepage when no program URL is available.
- Corrects the Repatha directory record from “Drug” to “Repatha”.

## Source and maintenance

- `assets/css/tokens.css` is the shared palette source. Existing brand aliases are retained.
- `assets/css/relief.css` and `templates/relief/` define discovery pages.
- `assets/css/relief-legacy.css` adapts existing page layouts; `relief-chrome.css` defines accessible shared navigation and footer.
- `assets/js/relief.js` implements search, filtering, navigation and category alerts.
- `assets/js/drug-data.js` adapts the existing read-only API.
- `python scripts/apply-relief-redesign.py` rerenders discovery pages from local data and idempotently migrates new standard pages. Run after changing directory/category membership or generating additional drug pages. Generated pages remain directly deployable static files.

## Offline checks

```sh
node --check assets/js/relief.js
node --check assets/js/drug-data.js
node --test test/relief-data.test.mjs
node scripts/check-relief-redesign.mjs
git diff --check
```

The checks use fixtures only and never create a real lead or send email. The integration checker compares modified drug pages with the checked-out base commit, verifies original form IDs and API URLs, and checks directory links and inline-script syntax.

## Review before merging

Use the Cloudflare Pages branch preview if the repository's preview integration is active. Production `main` and Cloudflare configuration are unchanged by this branch.

Review homepage, directory search (including Repatha), all condition filters, a GLP-1 page, a non-GLP-1 page, contact, consent controls, and mobile menu. Confirm a real program's current eligibility/price with its official source. Price verification is separate from preserving the existing API data contract.

Live contact submissions, newsletter emails, enrollment submissions, and paid checkout are not exercised by automated checks. Complete any live submission tests only with designated test accounts and authorization. The existing email/backend implementation is retained; its delivery guarantees are outside this visual migration.

## Rollback

Revert the redesign merge commit. No data migration or backend deployment is needed.
