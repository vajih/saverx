# Enrollment Copilot Demand Test — Deploy & Run Book

> Companion to the validation plan (SAVERX_ENROLLMENT_COPILOT_VALIDATION_PLAN.md).
> Branches: `feat/outbound-analytics` → `feat/enroll-intake` → `feat/enroll-cta-pilot` → `feat/enroll-backend`, merged to `main`.
> Rollback: `git revert` the merge commits, or `git checkout pre-copilot-test` and redeploy.

---

## What shipped

| Piece | Files | Notes |
|---|---|---|
| Outbound analytics (PR0) | `assets/js/track.js`, `scripts/_add-outbound-tracking.mjs`, 363 drug pages | `official_site_click` now fires on modal/footer/accordion manufacturer clicks; `utm_source` standardized to `saverx` |
| Intake page (PR1) | `get-help/index.html`, `assets/js/enroll.js`, `privacy.html`, `terms.html` | noindex during test; gov-insurance PAP branch; consent checkbox required |
| Pilot CTA (PR2) | `scripts/_add-enroll-cta.mjs`, 5 pilot pages | repatha, dupixent, stelara, ozempic (control), wegovy |
| Backend (PR3) | `scripts/Code.gs`, `emails/enroll-confirmation.html` | `form_type=enroll_intake` → `EnrollmentInterest` tab + confirmation email; dedup by `intake_id` |
| Security | `HANDOFF.md` | Plaintext Resend key removed — **key must still be rotated** (it remains in git history) |

---

## Deploy order (important)

1. **Rotate the Resend API key** (Resend dashboard → API Keys). Update Apps Script Script Properties (`RESEND_API_KEY`) and local `.env`. The old key is in git history.
2. **Deploy the backend first.** Paste `scripts/Code.gs` into the Apps Script editor → Deploy → **Manage deployments → Edit → New version** on the EXISTING deployment (the URL must not change — hard constraint). Run `testConnection()` to confirm.
3. **Deploy the email template + site.** `wrangler pages deploy . --project-name saverx` (the template must be live at `saverx.ai/emails/enroll-confirmation.html` before intakes arrive — same deploy covers both).
4. **Smoke test** (see below).

## Stripe (optional now, recommended within week 1)

Create two Payment Links in Stripe (Product: "SaveRx Guided Enrollment" $9.99, "Guided Enrollment + Follow-up" $19.99):
- After-payment redirect: `https://saverx.ai/get-help/?checkout=success&tier=paid_999` (and `paid_1999`).
- Paste both URLs into `STRIPE_LINKS` at the top of `assets/js/enroll.js`, redeploy Pages.
- Until then, paid tiers show a no-charge reservation (still recorded via `service_preference`).

## GA4 (one-time, ~10 min)

New events arriving automatically: `official_site_click`, `enroll_intake_view`, `assist_cta_view`, `assist_cta_click`, `intake_start`, `intake_step`, `intake_complete`, `price_tier_selected`, `checkout_started`, `checkout_completed`.
In GA4 Admin → Events: mark `intake_complete` and `checkout_started` as key events (conversions). Custom dimensions (event-scoped): `drug_slug`, `placement`, `tier`, `step_id`, `insurance_category`.

## Smoke test checklist

- [ ] Drug page → modal/footer email submit opens manufacturer site AND `official_site_click` appears in GA4 DebugView with `utm_source=saverx` on the destination URL
- [ ] Pilot page shows the two-pathway card; Pathway A opens manufacturer site directly (no email gate)
- [ ] `/get-help/?drug=repatha` walks through all steps; free tier → done screen; paid tier → reservation screen
- [ ] Submission appears in the `EnrollmentInterest` tab with all columns populated
- [ ] Confirmation email arrives (check spam; from `hello@newsletter.saverx.ai`)
- [ ] Unsubscribed test address receives NO confirmation email
- [ ] `/get-help/` (no drug param) shows the medication picker with autocomplete

## Reporting (added after initial ship)

- **Live dashboard:** `https://saverx.ai/dashboard/enrollment.html` — funnel KPIs, decision thresholds
  (green/yellow/red), cohort mixes. Aggregates only, noindex, unlinked. Reads `?mode=metrics` from Apps Script.
- **Daily scorecard email:** `dailyEnrollmentReport()` in Code.gs sends a threshold scorecard via Resend at ~6pm daily.
  Setup (part of step 2b): set Script Property `REPORT_RECIPIENTS` = `vajihkhan@gmail.com,asmavkhan@gmail.com`
  (also the code fallback if the property is absent), then run `createDailyReportTrigger()` once from the editor.
- **EventLog beacons:** pilot CTA cards and /get-help/ send PII-free pings (`?mode=track&ev=…&slug=…`) to a new
  `EventLog` tab, so the funnel top (card views/clicks, intake starts) is reportable without the GA4 API.
  GA4 remains the source of truth for sessions/traffic.

## GA4 integration + paid traffic (added)

- Code.gs pulls pilot-page **sessions** from GA4 (property `521819447`, since 2026-07-18) via the
  **Google Analytics Data** advanced service. One-time setup in the **Copay Enrollment** project:
  Editor → Services (+) → "Google Analytics Data API" → Add → run `testGa4Connection()` → expect
  "GA4 OK — N pilot-page sessions". If it errors, verify the property ID (GA4 Admin → Property settings)
  and account access. Then redeploy (pencil on the `AKfycbxFzCPGB…` deployment → New version).
- With GA4 connected, the CTA threshold uses **real sessions** as denominator (≥6% of sessions) instead
  of the card-view proxy; dashboard + daily email gain source splits (facebook vs organic).
- **Facebook ads rules:** every ad link must carry `utm_source=facebook&utm_medium=paid_social&utm_campaign=<name>`;
  do NOT install the Meta Pixel during the test (health-data risk + consent rework); point ads at
  high-friction drugs (repatha/dupixent/stelara); analyze paid and organic cohorts separately —
  thresholds were calibrated for organic intent.

## Weekly readout (during the 4–6 week window)

Track in a `Readout` tab or GA4 exploration, per drug cohort:
sessions → assist_cta_view → assist_cta_click → intake_start → intake_complete → paid tier selected → checkout_started → checkout_completed, plus fulfilled cases and median hands-on minutes.

**Decision thresholds (agreed in the plan):** CTA click ≥6–8% of pilot sessions · intake completion ≥40% of starts · paid tier ≥25% of completes · checkout started ≥30% of paid selections · ≥10 real card entries · ≥15 concierge cases at ≤~40 min median. Widen to top-20 pages if pilot traffic is too low after 2 weeks (add slugs to `PILOT_SLUGS` in `scripts/_add-enroll-cta.mjs` and re-run).

## Operating the concierge (manual, weeks 2–8)

1. New row in `EnrollmentInterest` → guide replies from a saverx.ai address within 1 business day.
2. Log every case in a `Cases` tab: `intake_id | started_at | drug | steps_taken | blockers | outcome | minutes_spent | notes`. Reference `intake_id`, don't copy contact info.
3. Never log into a manufacturer portal AS the patient; guide them while they do it (self-attestation constraint).
4. Medicare/Medicaid intakes: help with PAP applications (NeedyMeds/RxAssist/manufacturer PAP), not copay cards.

## Data hygiene

- `EnrollmentInterest` contains consumer health information: no exports to git (`.gitignore` already covers `data/*leads*`), retention 12 months per privacy.html, deletion requests honored via existing flow.
- Never add email/phone/free-text to GA4 events. Categorical values only.
