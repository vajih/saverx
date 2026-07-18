# SaveRx Enrollment Copilot — Demand-Validation Assessment & Plan

> Prepared July 18, 2026, after full inspection of the `saverx` repo (main branch, commit `9c8d84c5`), the live site, CLAUDE.md, HANDOFF.md, ROADMAP.md, STRATEGY_APRIL_2026.md, VISITOR_ID_AND_BEHAVIOR_LOG_PROMPT.md, drug page templates, Code.gs, GTM/GA4 wiring, and the get-glp1 quiz.
> **No code has been written or modified.**

---

## 1. What already exists and can be reused

The good news: you are perhaps 70% of the way to being able to run this test. The site is a static Cloudflare Pages deployment with ~370 drug pages generated from a shared template, and every piece of infrastructure the test needs already has a working precedent in the repo.

**Directly reusable:**

- **All five pilot drug pages exist** (`drugs/repatha/`, `drugs/ozempic/`, `drugs/wegovy/`, `drugs/dupixent/`, `drugs/stelara/`) and share one template, so a CTA can be injected consistently.
- **The insurance-tier accordion** ("What will I pay?" — Private / Government / Cash) already segments visitors by insurance category on every drug page. This is half your intake form, already answered implicitly by which accordion the user opens — and it should be instrumented as a signal.
- **The get-glp1.html quiz** is a working 4-step, tap-to-select intake pattern with `quiz_start` / `quiz_step_complete` / `quiz_complete` GA4 events. This is exactly the interaction model the enrollment intake should reuse — do not design a new form paradigm.
- **The Apps Script backend** (`scripts/Code.gs`) already handles form POSTs → Google Sheet (`CopayEnrollments`) → Resend welcome email → day 3/7 follow-up queue → CAN-SPAM unsubscribe. Adding one sheet tab and one route handles the new intake.
- **GTM (GTM-MVZBBF7R) + GA4 (G-FCKENS1BWB) + Consent Mode v2 + consent.js** are live site-wide.
- **UTM appending on outbound manufacturer links** already exists (`goToManufacturer()` and `__openAccordionCta()` both set utm_source/medium/campaign).
- **Email templates** (14 in `emails/`) give you the pattern for an intake-confirmation email.
- **The `scripts/_add-*.mjs` injection pattern** (consent banner, insurance accordion, categories nav) is the established way to patch a component into many static pages — reuse it for the CTA.
- **VISITOR_ID_AND_BEHAVIOR_LOG_PROMPT.md** already specs a consented visitor ID — shipping it first would let you connect page behavior → intake → eventual payment for the same person, which is the single most valuable analytical thread in this test.

**Gaps found during inspection (fix before or during the test):**

1. **No GA4 event fires on the manufacturer outbound click.** The modal/footer submit opens the manufacturer site and beacons to Apps Script, but never calls `gtag('event', ...)`. Your single most important existing conversion is invisible in GA4. `pharmacy_compare_click` exists on 364 pages; the manufacturer click — the whole point of the site — does not.
2. **`email_signup` fires on only 7 pages.** Funnel measurement is inconsistent across the 370.
3. **UTM values are inconsistent** with `docs/UTM_TRACKING_RULES.md`: pages use `utm_source=saverx.ai` (manufacturer links) and `utm_source=saverx` (GoodRx links); the spec says `saverx`. Standardize before you start measuring, or attribution slices will be split.
4. **Security issue, unrelated but urgent: `HANDOFF.md` contains the live Resend API key in plaintext and is committed to git.** Rotate the key in Resend, move it to Script Properties only, and scrub the doc. Anyone with repo access can send email as SaveRx.
5. **No rate limiting / spam protection** beyond a honeypot on the Apps Script endpoint — acceptable so far, worth noting once you attach pricing signals to it.

---

## 2. Flaws and risks in the proposed validation strategy — candid assessment

**Flaw 1: A survey radio button is weak evidence of willingness to pay.**
Asking "would you prefer free, $9.99, or $19.99?" measures stated preference, and stated preference for paid help routinely overstates real conversion by 5–10x, especially when a free option sits next to it in the same list. If the decision to build an app hinges on this test, the pricing question must involve an actual commitment: a real checkout page (Stripe Payment Link) where the card is entered — with honest terms ("You will not be charged until we complete your first enrollment" or a founding-member refundable deposit). A priced button that leads to a real checkout, even if most abandon there, gives you the two numbers that matter: checkout-started rate and checkout-completed rate. Keep the survey question too — it's fine as a segmentation field — just don't treat it as the WTP result.

**Flaw 2: Drug selection is skewed toward the easiest enrollments.**
Ozempic/Wegovy copay cards are ~2 minutes on Novo's site with instant issuance. Patients feel little pain there, so a paid copilot will look like it has no demand — but that's a drug-selection artifact, not a market answer. The real friction lives in specialty biologics: Dupixent MyWay and Stelara withMe (multi-step, specialty-pharmacy coordination, annual re-enrollment), Repatha (Amgen SupportPlus + frequent PA denials), and generally anything with prior authorization, denial appeals, bridge programs, or paper PAP applications. Recommendation: keep one GLP-1 page as a high-traffic **control**, and weight the test toward high-friction programs — Repatha, Dupixent, Stelara, plus consider Enbrel/Skyrizi/Rinvoq which are already live pages with large copay-card friction. Expect and design for *different* conversion by cohort; that difference is itself the answer to "which medications deserve automation."

**Flaw 3: The current email-gate modal contaminates the test.**
Today, "Get your savings card" requires an email before opening the manufacturer site. If the new "Get help enrolling" CTA sits next to a gated official-link path, you can't tell whether people chose assistance or just picked whichever path looked less annoying. For the pilot pages only, make the official-site pathway a clean, ungated link (you'll still capture the outbound click event), and let the assistance CTA be the one that asks questions. Transparent two-pathway choice is only a valid preference test if both pathways are honest about their cost.

**Flaw 4: Three pages may not produce enough traffic for statistical signal.**
Historical volume (252 leads total across 361 pages over months) suggests individual page traffic is modest. Rough math: to read a CTA click-rate of ~8% with useful confidence you want ≥300–500 unique pilot-page visitors; to read intake completion and pricing selection you want ≥50–100 CTA clicks. If the 3–5 pilot pages don't do that in ~4 weeks, widen the CTA to the top 15–20 drug pages by GA4 traffic (injection script makes this cheap) while keeping one shared intake flow. Decide the widening trigger up front, not mid-test.

**Flaw 5: Privacy/regulatory framing needs care but is manageable.**
You are not a HIPAA covered entity and this test collects no PHI from a covered-entity relationship — but medication + insurance status + contact info is "consumer health data" under the FTC Health Breach Notification Rule and state laws (Washington My Health My Data, Nevada SB 370, and others). Practical implications: collect the minimum (your instinct is right), add an explicit consent checkbox on the intake ("I agree SaveRx may store this information and contact me about enrollment help"), never send email/phone/free-text into GA4 (categorical values only), update privacy.html to disclose this collection and its purpose, and set a retention/deletion policy. If you collect mobile numbers with intent to text, you need express written TCPA consent language — simpler to make phone optional and email primary for the test.

**Flaw 6: The strategic assumption most worth challenging — is the patient the payer?**
As a healthcare-business point, not just UX: manufacturer hubs already provide enrollment help free; $9.99–19.99 one-time patient payments have hard unit economics for a support-heavy service; and price-sensitive patients seeking discount programs are the hardest segment to charge. That doesn't invalidate the test — it sharpens what it must prove: that friction is painful enough that some patients pay *despite* free alternatives. But design the test so its data is valuable even if patient-pay fails: the intake's "primary difficulty" answers, drug mix, insurance mix, and completed-assistance case notes are precisely the evidence you'd take to the B2B buyers in your strategy docs (pharmacies, hubs, employers). Also note the strongest recurring-revenue angle in this space: copay cards expire and require **annual re-enrollment**, and denials/PA recur — "follow-up and renewal" is the subscription, not the first card. Your $19.99 tier is pointing at the right thing; make renewal/follow-up its explicit centerpiece.

**Flaw 7: Don't skip the fulfillment half of the test.**
A painted-door test tells you people *want* help; it doesn't tell you whether you can *deliver* it, what it costs you in minutes per case, or what problems actually occur. The highest-value version of this experiment includes manually helping 10–25 intake completers (concierge, email-based, free or founders' price). That produces: real completed-assistance cases (your metric #7), a time-cost per case, a library of actual failure modes to automate, and testimonials. This is the classic do-things-that-don't-scale step and it is where most of the learning lives.

---

## 3. Recommended experiment and user journey

**Positioning (honest early-access, no fake product):**
"SaveRx Enrollment Help — early access. A real person from SaveRx reviews your situation and guides you through the manufacturer's official enrollment. We're onboarding a limited number of patients."

**Journey:**

1. **Drug page (pilot set).** Existing content unchanged. Two pathways presented in the hero/accordion area:
   - *Pathway A:* "Go to the official [Manufacturer] savings program →" — direct, ungated outbound link (UTM'd, event-tracked).
   - *Pathway B:* CTA card — "Not sure which program fits, or hit a problem? Get guided enrollment help from SaveRx." → `assist_cta_click`.
2. **Intake page** (single shared page, `/get-help/?drug=repatha`), quiz-style, one question per screen, reusing the get-glp1 pattern:
   - Step 1 — Insurance category (Commercial / Medicare / Medicaid / Uninsured / Not sure). Medicare/Medicaid answers branch to an honest screen: copay cards aren't allowed for you; here's PAP/Extra Help guidance + "want help with a PAP application?" (this cohort's demand is its own finding).
   - Step 2 — Prescription status (Have it / Doctor visit scheduled / Not yet).
   - Step 3 — Primary difficulty (Don't know which program / Application confusing / Was denied or PA problem / Card stopped working or renewal / Pharmacy or specialty-pharmacy issue / Cost still too high / Other + short optional text).
   - Step 4 — Service preference (Free self-serve checklist / $9.99 guided enrollment / $19.99 guided + follow-up & renewal / I'd only use this if free).
   - Step 5 — Email (required), mobile (optional, with TCPA-safe language), consent checkbox.
3. **Commitment step (the real WTP test).** If a paid tier was chosen: "Early access is limited. Reserve your spot — you won't be charged until we complete your first enrollment." → Stripe Payment Link (card entry, $0 or authorization-style deposit with plain refund terms). Track `checkout_started` / `checkout_completed`. If free tier: deliver the self-serve checklist immediately (email + on-page), which is your honest free value and your baseline cohort.
4. **Confirmation.** Sets expectations ("a SaveRx guide will email you within 1 business day"), links the official program site again (never hold the user hostage), confirmation email via existing Resend pipeline.
5. **Concierge fulfillment (manual).** You or the pharmacist partner personally help the first 10–25 cases by email. Log every case: time spent, steps, blockers, outcome.

This design answers all seven of your questions with behavioral rather than stated data, and it never implies an automated product exists.

---

## 4. Minimum build required

**Pages:** one new intake page (`get-help/index.html`) with in-page steps — not per-drug pages; one confirmation state (same page); privacy.html and terms.html additions. Optional: a short `/get-help/checklist` deliverable per program (can be an email only, to start).

**Components:** one CTA card partial injected into pilot drug pages via a new `scripts/_add-enroll-cta.mjs` (follows the existing `_add-*.mjs` pattern); one small `assets/js/enroll.js` for the intake logic + events.

**Forms/data fields (intake):** drug slug (prefilled from query param), insurance_category, prescription_status, primary_difficulty (+optional free text), service_preference, email, phone (optional), consent flag, page source, UTM params, user agent, visitor_id (if the consent-gated visitor ID ships first).

**Backend:** one new route/branch in `Code.gs` `doPost` (`form_type=enroll_intake`) writing to a new `EnrollmentInterest` tab; one confirmation email template in `emails/`; a `Cases` tab for manual fulfillment tracking.

**Integrations:** Stripe Payment Links (two links: $9.99, $19.99 — no API integration needed for the test); GA4 events via existing gtag; no new hosting, no new services.

---

## 5. Privacy-conscious data model

`EnrollmentInterest` sheet tab (the only place contact info lives):

| Field | Type | Notes |
|---|---|---|
| timestamp | ISO | |
| intake_id | UUID | generated client-side; the join key to GA4-safe events |
| visitor_id | UUID/null | only if analytics consent granted |
| drug_slug | enum | |
| insurance_category | enum | commercial / medicare / medicaid / uninsured / unsure |
| prescription_status | enum | |
| primary_difficulty | enum | |
| difficulty_text | free text | optional; never sent to GA4 |
| service_preference | enum | free_self / paid_999 / paid_1999 / free_only |
| checkout_result | enum | not_offered / started / completed / abandoned |
| email | string | |
| phone | string/null | optional |
| consent_contact | bool | checkbox timestamped |
| consent_sms | bool/null | separate, only if phone given |
| source_page, utm_*, user_agent | strings | |

Rules: no names required, no DOB, no insurance member IDs, no diagnoses (drug name is the maximum health signal), no free-text or contact fields in GA4/dataLayer, deletion on request honored via the existing unsubscribe pipeline, stated retention (suggest 12 months), Sheet shared with no one beyond you. `Cases` tab references intake_id, not a second copy of contact details.

---

## 6. Analytics events and success thresholds

**New GA4 events (all categorical params only — drug_slug, tier, step, insurance_category):**

| Event | Fires when |
|---|---|
| `assist_cta_view` | CTA card enters viewport (IntersectionObserver) |
| `assist_cta_click` | Pathway B chosen |
| `official_site_click` | Pathway A chosen — **add site-wide**, not just pilot; this fixes the existing measurement gap |
| `intake_start` | Step 1 answered |
| `intake_step` | each step, with step number |
| `intake_complete` | contact submitted |
| `price_tier_selected` | tier param |
| `checkout_started` / `checkout_completed` | Stripe link opened / Stripe success return |
| `case_completed` | logged manually or via admin, for reporting |

**Decision thresholds (over a 4–6 week window, per cohort — set them now so the result can't be argued after the fact):**

- `assist_cta_click` ÷ pilot-page sessions ≥ **6–8%** → interest exists (below 3% on high-friction drugs → weak signal).
- `intake_complete` ÷ `intake_start` ≥ **40%** → form and value prop are understood.
- Paid tier selected ÷ `intake_complete` ≥ **25%**, and `checkout_started` ÷ paid-tier-selected ≥ **30%** → pricing has substance.
- `checkout_completed` ≥ **10 people** entering real payment details → strongest single green light.
- ≥ **15 concierge cases** fulfilled with median hands-on time ≤ ~40 min → deliverable economics.
- Qualitative gate: primary_difficulty answers cluster (≥40% in one or two problems) → you know what to automate first.

Green: build Phase-2 product for the winning drug cohort. Yellow (interest high, payment low): pivot to free tool + B2B/affiliate monetization using the friction data. Red across the board on high-friction drugs with ≥500 CTA views: patient-pay copilot is not the product.

---

## 7. Google Sheets/Apps Script vs. another backend

**Keep Apps Script + Sheets for the test.** Reasons: it's live, battle-tested in this exact flow, integrates with your Resend pipeline and unsubscribe suppression, and the expected volume (tens–hundreds of rows) is far below any quota. Adding a backend (Workers + D1, Supabase) now would be premature infrastructure for a demand test and would split your lead data across two systems.

Conditions: rotate the leaked Resend key first; add the new tab rather than widening `CopayEnrollments`; keep the "sheet write must always succeed" constraint. **The eventual application should not be built on Apps Script** — that's a Phase-3 decision (Workers/D1 or Supabase, proper auth, audit logging) and belongs after a green result, not before.

---

## 8. Proposed file-by-file implementation plan

**PR 0 — Analytics & hygiene (do first, benefits everything):**
- `HANDOFF.md` — remove API key (and rotate it in Resend; consider git-history scrub).
- `assets/scripts.js` or new `assets/js/track.js` — central `saverxOutbound(url, campaign)` util per UTM_TRACKING_RULES rule 5; fires `official_site_click`; standardizes `utm_source=saverx`.
- Injection script to wire the util into `goToManufacturer()` / `__openAccordionCta()` across drug pages (sed/mjs, existing pattern).

**PR 1 — Intake experience:**
- `get-help/index.html` — intake quiz (markup modeled on get-glp1.html, tokens from `assets/css/tokens.css`).
- `assets/js/enroll.js` — step logic, validation, events, POST to Apps Script, Stripe link handoff.
- `privacy.html`, `terms.html` — disclosure additions; independence/non-affiliation disclaimer block on the intake page.
- `sitemap.xml` — optionally exclude (`noindex` during test to keep cohorts clean).

**PR 2 — CTA on pilot pages:**
- `scripts/_add-enroll-cta.mjs` — injects CTA card into a defined slug list (start: repatha, dupixent, stelara, ozempic-as-control, wegovy; expandable to top-20).
- Pilot pages: modal email-gate bypassed for Pathway A on these pages only (flag in the injected script), so the two-pathway choice is honest.

**PR 3 — Backend + email:**
- `scripts/Code.gs` — `form_type` routing, `EnrollmentInterest` + `Cases` tabs, confirmation email send; redeploy as **new version of existing deployment** (URL must not change — hard constraint in CLAUDE.md).
- `emails/enroll-confirmation.html` (+ free-tier checklist email per pilot program).

**Ops (no code):** two Stripe Payment Links; GTM: register new events / mark as conversions in GA4; a simple weekly readout tab in the Sheet.

Estimated effort: PR0 ~half day, PR1 ~1–2 days, PR2 ~half day, PR3 ~1 day.

---

## 9. Git branch strategy

- `main` stays deployable (Cloudflare Pages production).
- One feature branch per PR above: `feat/outbound-analytics`, `feat/enroll-intake`, `feat/enroll-cta-pilot`, `feat/enroll-backend`. Small, revertible merges in that order.
- Use Cloudflare Pages **branch preview deployments** to QA each branch on a preview URL before merging — no staging server needed.
- Tag `pre-copilot-test` on main before the first merge, so the whole experiment is one `git revert`/redeploy away from removal.
- Code.gs is versioned in git but deployed manually — note the Apps Script version number in the PR3 description so backend rollback is documented too.
- Never commit: `.env`, lead exports, the Sheet contents (already in .gitignore — keep it that way for `EnrollmentInterest` exports as well).

---

## 10. Phased plan — demand test vs. eventual application

- **Phase 0 (week 1):** analytics hygiene, key rotation, thresholds agreed and written down, Stripe links created, legal copy reviewed.
- **Phase 1 (weeks 2–3):** intake + CTA live on 3–5 pilot pages. Ship the consent-gated visitor ID (existing spec) if capacity allows.
- **Phase 2 (weeks 3–8):** demand data accrues; concierge fulfillment of every completed intake (manual, email-first); widen CTA to top-20 pages if traffic trigger hits; weekly metric readout.
- **Phase 3 (week 8–9): decision gate** against §6 thresholds. Green → write the product spec from the Cases log (automate the top 1–2 friction points for the winning drug cohort only). Yellow → free tool + B2B pivot using collected evidence. Red → kill patient-pay; keep `official_site_click` analytics as permanent value.
- **Phase 4 (only after green):** build the actual Copilot as a separate service (proper backend, auth, payments via Stripe API, case management) — separate repo or `/app` sub-project, not more static-page patching. The demand-test intake then becomes the product's top-of-funnel and nothing built in Phases 0–2 is wasted.

Keep the two workstreams financially and mentally separate: the test's job is to *kill or fund* the app, not to become v0.5 of it.

---

## 11. Questions to answer before implementation

1. **What is actual GA4 traffic per pilot page over the last 30 days?** This decides 3 pages vs. top-20 from day one, and whether 4 weeks is a realistic window. (I couldn't see GA4 from the repo.)
2. **Are you able and willing to accept real payments now** (business entity, Stripe account, refund policy)? If no, the WTP signal downgrades to tier-selection + checkout-started, and thresholds should be adjusted.
3. **Who fulfills concierge cases, and how many hours/week can they commit?** If the pharmacist partner participates, disclose credentials honestly ("guidance from a licensed pharmacist" is a major trust and conversion lever — but only if true and they're on board).
4. **SMS or email-only?** SMS improves follow-up response dramatically but brings TCPA consent requirements and a sending tool. Email-only is the low-risk default for the test.
5. **Has a lawyer glanced at the intake copy and privacy disclosures** with FTC HBNR / WA My Health My Data in mind? One hour of review is cheap relative to the downside.
6. **Ozempic as control or replaced?** I recommend keeping it as a high-traffic low-friction control; confirm you're comfortable interpreting its likely low paid-conversion as expected, not as failure.
7. **What happens to Medicare/Medicaid intakes?** They can't use copay cards; PAP-application help is a real (arguably bigger-pain) service. Decide now whether they're in scope for concierge help or get a resources screen only — it changes the intake branching.
8. **Threshold sign-off:** do you agree with the §6 numbers, or want to adjust before launch? They must be fixed before data starts arriving.

---

*This document proposes; nothing has been implemented. On approval of (or edits to) the plan, PR 0 is the recommended starting point.*
