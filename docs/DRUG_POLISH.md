# Drug page and directory polish

This revision implements the current request to collect email before opening official-program and pharmacy-comparison destinations. It supersedes the earlier ungated-link design in DRUG_OPTIONS_REDESIGN.md and the enrollment pilot specification.

## Layout

- Remove isolated 02/04 prefixes from section eyebrows. The three numbered next steps remain a coherent ordered list.
- Move the existing condition/category link from outside the main page into the medication identity block. Preserve its destination and count.
- Restyle the paid-services disclosure and its provider cards with the same warm surfaces, cobalt buttons, type, borders, and spacing as the rest of the page. Existing affiliate URLs, disclosure, text, and tracking hooks remain unchanged.
- Make directory cards compact (roughly 165px tall on desktop instead of the former 230px minimum). Cards show name, available generic/manufacturer, existing category, and the program/pharmacy routes found on the destination page. No price is implied.
- Enrich metadata from the existing read-only featured feed. Generic/manufacturer search stays local and re-applies after metadata arrives. A feed failure retains the static catalog. Narrow screens have two compact columns, with a single column at 340px and below. Filter scrolling is confined to its own row.

## Email handoff

`assets/js/drug-outbound.js` intercepts program/assistance links, financial source links, and external pharmacy comparisons before legacy handlers can open a tab. Ordinary, keyboard, modified, and middle-click navigation use one native dialog. Safety-information links, internal page navigation, guided enrollment, and paid affiliate services are outside this handoff.

The dialog shows the destination domain, requires an email and an unchecked consent box, and discloses savings emails/follow-ups and opt-out. Closing or pressing Escape returns to the page without navigation or submission. The chosen destination is held in memory. Submitting opens that destination in the current tab after the lead request is queued, using the existing centralized UTM helper. It does not add contacts or destinations to analytics.

The inline `footerForm` already asks for email/consent and uses this same transport. Existing legacy form HTML, IDs, backend endpoint, and scripts are retained; capture-phase handling prevents duplicate legacy sends and redirects. Existing lead fields remain, plus `consent_email=yes`. The backend currently ignores this extra field: this change does not add a server-side consent audit column. Required consent is enforced by the browser UI.

The Apps Script transport uses sendBeacon/no-cors. A rejected queue falls back to fetch; a detectable network failure stays on the page for retry. Queue acceptance is not a verified Sheet write or email delivery. No email or payment was actually sent during QA. This is a client-side workflow, not access control over publicly available external links.

## Maintain and validate

`scripts/upgrade-drug-polish.py` applies the changes to all 363 drug pages, the shared template, and the directory. It is the final stage of `upgrade-drug-summary.py`, preserving the new UI after existing generation scripts run. Re-running it produces no content differences.

Checks completed:

```
node --test test/drug-outbound.test.mjs test/drug-directory.test.mjs test/drug-conversion.test.mjs test/drug-options.test.mjs test/relief-data.test.mjs test/support-pages.test.mjs
node scripts/check-relief-redesign.mjs a872b89e
python3 scripts/check-drug-options.py
node --check assets/js/drug-outbound.js
node --check assets/js/drug-directory.js
git diff --check
```

35 tests passed. Integration checks cover 363 drug pages, the shared template, all 357 directory links, and seven categories. Desktop review covers Ozempic identity/category, expanded paid services, and pharmacy handoff; mobile review at 375px covers the dialog and compact directory, including generic search and no horizontal page overflow. Source/official and middle-click handoffs are also covered by unit fixtures. Actual delivery, outbound navigation after submission, and live enrollment are not exercised against production.

The prior Get Help ZIP is a separate update. Preserve any Get Help changes when importing this branch. No merge or production deployment is included.
