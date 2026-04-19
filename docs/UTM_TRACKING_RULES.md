# UTM Tracking Rules — SaveRx.ai

## Goal
Ensure all outbound links include standardized UTM parameters for tracking.

---

## RULE 1 — ONLY EXTERNAL LINKS

Apply UTM parameters ONLY if:
- Link points to external domain
- NOT saverx.ai

---

## RULE 2 — STANDARD FORMAT

All outbound links must include:

utm_source=saverx
utm_medium=referral
utm_campaign=[page-context]

---

## RULE 3 — CAMPAIGN NAMING

Use page-based naming:

Examples:
- repatha-savings-page
- ozempic-guide
- homepage
- blog-copay-cards

---

## RULE 4 — DO NOT BREAK LINKS

- Preserve existing query params
- Append, don’t overwrite unless same key
- Handle edge cases safely

---

## RULE 5 — CENTRALIZED LOGIC

DO NOT manually append UTMs inline everywhere.

Use:
- utility function OR
- link wrapper component

---

## RULE 6 — CLEAN FALLBACK

If URL parsing fails:
- return original URL unchanged

---

## RULE 7 — FUTURE READY

Design must allow:
- adding affiliate parameters later
- switching tracking strategy centrally