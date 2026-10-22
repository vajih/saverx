# Medication payment-options redesign

Applies to the 363 standard data-bound drug pages and templates/index.html. Existing drug guide articles and independent landing pages keep their own reading UI.

## Information architecture

One payment-options section replaces repeated hero price overlays, savings tables, cash-price strikes, annual projections and six repeated pharmacy cards. Visitors can explore all routes or choose coverage locally; government/cash choices hide the commercial co-pay card and clear a suggested commercial calculator price. Assistance never reuses the co-pay URL as if it were a PAP link.

The cost comparator uses the visitor's own quote and another price for the same dose, quantity and supply. It shows a difference, including when the compared price is higher. It does not infer annual savings from a list price or claim insurance benefit eligibility. Inputs have no name attributes and the new script makes no network calls or storage writes.

Medication overview, pharmacy questions, next-fill checklist and source details each have one home. Existing email forms remain optional behind a disclosure. Official-program links are ungated. Enrollment pilot IDs and tracking, backend endpoints, consent/GTM and all affiliate sections/disclosures are retained; affiliate services sit in a separate expandable section.

## Data and verified example

Repatha has a curated profile in data/drug-option-profiles.json, checked October 22, 2026 against:
- https://www.repatha.com/repatha-cost
- https://www.repatha.com/copaytcs
- https://www.amgensupportplus.com/repatha/financial-support
- https://www.repatha.com/

The manufacturer lists a minimum $25 for eligible commercially insured patients' one-month supply, subject to criteria and limits. This replaces displaying the older feed price for this example. Its quote expires after 30 days without review; expired curated quotes never fall back to older feed values. Amgen Safety Net Foundation and AmgenNow are separate assistance/cash routes. No unverified cash price is invented. Cash price comparisons remain accessible on GoodRx.

Other drugs use the existing read-only response, with feed-derived offers explicitly labeled for confirmation. They are not independently verified by this redesign. Missing, negative or invalid amounts stay unknown; no source URL means no displayed offer. A feed response arriving late updates the shared UI without a second API request. Clinical descriptions for other drugs remain feed-derived. This task does not add medication dosing instructions or clinical recommendations.

## Maintain

Edit templates/relief/drug/options.html, assets/css/drug-options.css and assets/js/drug-options.js. scripts/build-drug-options.py is an idempotent migration for standard pages that do not already have drug-options-page. Existing transformed pages may be edited directly. apply-relief-redesign.py invokes the migration for newly generated pages. If changing the structure of all existing pages, update the migrated pages too; the migration intentionally skips them to preserve subsequent edits. Run the separate brand-assets generator last if installed, preserving its metadata.

## Checks

- node --test test/drug-options.test.mjs
- python3 scripts/check-drug-options.py
- node --check assets/js/drug-options.js
- node scripts/check-relief-redesign.mjs c29ac929
- git diff --check

The static checker compares forms, affiliate blocks, preserved scripts and hooks against base c29ac929. It also validates unique IDs, fragment targets, landmarks and absence of duplicate legacy price sections. All 363 drug contracts and the template pass. New model tests cover invalid amounts, quote differences, unverified URLs, checked profile precedence and expiry.

Desktop and 375px mobile checks cover coverage choices, no-price fallback, the same-supply comparator, source links and layouts. No live lead/contact/newsletter forms were submitted. Production release needs the repository's normal human review (DEV_WORKFLOW.md).

## Conversion revision (v2)

The medication name, generic/manufacturer and overview now lead the page. Four coverage choices reveal payment routes only after selection. No commercial price is prefilled in the cost comparator until private insurance is selected.

Directly after the options, every standard page has a guided-enrollment block and an inline email panel, followed by a dedicated pharmacy cash-price section. Guided help links use the existing /get-help/?drug= route; early-access scope and fees remain disclosed. Existing pilot IDs/scripts survive on their five original pages. New guided_enrollment_click analytics events contain placement and public drug slug only, using the existing consent-governed gtag queue.

Email capture reuses footerForm, backend endpoint and submission handler. It now includes a required, unchecked email-updates consent checkbox and explains that submission opens the official program site and sends medication-related emails/follow-ups. No live submission or delivery test was performed. The existing server's email sequence and opt-out behavior are unchanged; the new checkbox is not a new backend consent-audit field.

A dismissible sticky guided-help CTA appears after coverage selection when the main conversion block is out of view, hides around the footer or an open dialog, and stays dismissed for this page load. A departure prompt is shown at most once per page load: desktop top-edge exit after 20 seconds and coverage selection; mobile after 45 seconds near the lower page, as a nonmodal reminder. It skips active forms, typed email and completed submissions. Its email button focuses the same inline form; no duplicate capture form or history interception. All reminder state is in memory, not cookies/localStorage.

scripts/upgrade-drug-conversion.py applies this revision idempotently and is invoked by build-drug-options.py. Shared conversion styling/behavior are assets/css/drug-conversion.css and assets/js/drug-conversion.js. Existing forms are compared against the merged base after excluding only the new consent label. Tests in test/drug-conversion.test.mjs cover reminder gating, dismissal, mobile nonmodal behavior, typed-email suppression and sticky dismissal. Desktop/mobile Repatha and Ozempic layouts were reviewed; the native required-checkbox contract and CTA destinations were checked without submitting forms.

## Approved mockup implementation (v3)

The current layout supersedes the insurance-choice gate described above. All three “What will I pay?” rows are immediately readable: private insurance with the available program minimum/supply, government insurance with a plan-dependent status, and cash pay with variable prices. Native details/summary disclosures add eligibility and application links only. Opening a row never hides other coverage summaries. Government coverage is not labeled universally unavailable.

Medication identity remains first. Guided help and consented email capture follow the summary rows, then the mint pharmacy comparison section with an inline vector illustration, the cost comparator and supporting information. Summary prices use the existing freshness/unknown-value safeguards. The cost comparator stays blank until visitors enter prices or open the private-insurance detail; a commercial minimum is never assumed for government/cash routes.

The sticky and departure aids now recognize viewing the payment summary as engagement; visitors need not select or disclose an insurance type. The summary toggle remains local, with no insurance values sent to analytics. Native keyboard operation, all summaries visible initially, simultaneous rows, desktop/mobile layouts, consent association and unchanged forms/integrations were checked. No live form submissions were sent.

scripts/upgrade-drug-summary.py is the final idempotent migration, called after upgrade-drug-conversion.py. assets/css/drug-summary.css provides the approved row layout and pharmacy illustration styling. All pages retain their prior metadata, consent scripts, backend endpoints and affiliate blocks. The package includes all previous unmerged drug redesign commits and replaces earlier drug-page ZIPs.
