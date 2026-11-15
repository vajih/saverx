# SaveRx Savings Watch — Audit & Implementation Plan

Status: **APPROVED (all 6 decisions). MVP built locally on `feature/savings-watch-mvp`; pending owner review on localhost and a live Twilio test. Not pushed, not deployed.**
See `docs/SAVINGS_WATCH_SETUP.md` for run, test and deploy steps.

## 1. What we are building

A free service: a visitor on a medication page shares a mobile number, verifies it, and consents to text messages. SaveRx researches the manufacturer savings options, a human verifies them, and the visitor gets an SMS with a link to a private, expiring results page. Goal: a consented, first-party phone/interest list plus a trusted channel.

## 2. Audit findings

| Area | Finding |
|---|---|
| Framework | None. 372 static HTML pages (`drugs/<slug>/index.html`), vanilla JS, no build step (hard constraint in CLAUDE.md). |
| Hosting | Cloudflare Pages (`wrangler pages deploy . --project-name saverx`). `vercel.json`/`Procfile` serve only the local-style admin dashboard (`admin-server.js`). |
| Backend | (a) Google Apps Script `scripts/Code.gs` + Google Sheet (leads, EnrollmentInterest, EventLog, unsubscribes); (b) separate Apps Script `backend/experts/`; (c) Cloudflare Worker `saverx-chat-proxy` (OpenAI proxy, no storage bindings). No SQL database. |
| Auth | None for users. Admin = single shared password (`ADMIN_PASSWORD`) on the Express dashboard. |
| Twilio / Supabase | **Not configured anywhere.** No Twilio code, env vars, or secrets. No Supabase. |
| Existing SMS | `/get-help/` collects an *optional* phone + `consent_sms` checkbox into the sheet, but nothing sends SMS. `privacy.html` and `terms.html` do not mention text messaging. `terms.html` has email-only consent language. |
| Medication data | Each drug page embeds `<script id="drug-page-profile">` JSON: brand, manufacturer, copay program URL, terms URL, eligibility, assistance program, `checkedAt`. Repatha has a complete profile. This is a ready-made starting draft for a verified result. |
| Tests | `node:test` `.mjs` files in `test/` run against browser JS via `vm` harnesses; Worker uses vitest. |
| Analytics | GA4/GTM with Consent Mode; PII-free beacons to `EventLog`. Rule already in code: **never send email/phone to gtag.** |

### Reusable
- `drug-page-profile` JSON → draft result content.
- Consent/honeypot/idempotent-ID patterns from `assets/js/enroll.js` and `backend/experts/Code.gs`.
- Pilot-CTA injection script pattern (`scripts/_add-enroll-cta.mjs`) for adding the button to pages.
- Design tokens/components (`assets/css/tokens.css`, `components.css`).
- Existing `EventLog` beacon pattern for funnel analytics.

## 3. Key decision: where does the backend live?

**Recommendation: a new Cloudflare Worker (`saverx-savings-watch`) with a D1 (SQLite) database, routed at `saverx.ai/api/savings/*`.** Not Apps Script.

Why Apps Script is the wrong place for this feature:
1. **Twilio webhooks need signature validation** (`X-Twilio-Signature` header). Apps Script web apps cannot read request headers, so STOP handling and delivery-status callbacks cannot be verified, i.e. anyone could forge an opt-in/out or status.
2. **No rate limiting / IP visibility** for OTP abuse (SMS pumping can cost real money).
3. Sheets gives no access control, audit trail, or retention enforcement for phone-number-plus-medication data. The existing validation plan already states the real product should move to Workers/D1 or Supabase.

Why a separate Worker rather than Pages Functions: the site deploys by uploading the repo root, so adding `functions/` would couple this to the static deploy and risk shipping non-site files. A separate Worker mirrors `saverx-chat-proxy`, deploys independently, and holds secrets via `wrangler secret`.

Why D1 over Supabase: one fewer vendor/BAA question, same platform, free tier is ample, no new account. (Trade-off: no built-in auth, handled below with Cloudflare Access.)

Other pieces:
- **Abuse protection:** Cloudflare Turnstile on the form + per-IP and per-phone rate limits (D1 counters) + Twilio Verify's own limits + honeypot. Restrict Verify to US numbers.
- **Admin:** a small admin UI served by the Worker, protected by **Cloudflare Access** (SSO/email one-time-PIN, allowlist of you and Asma) plus the Worker verifying the Access JWT. Avoids building login and does not reuse the shared-password dashboard.
- **Results pages:** `https://saverx.ai/r/<token>`; token = 128-bit random, only its SHA-256 stored, expires after 14 days, `noindex`, `no-store`, no third-party scripts.

## 4. Architecture

```
Drug page ──button──▶ /savings-watch/?drug=repatha  (static page + JS, Turnstile)
                            │ POST /api/savings/start   (validate, rate limit, create request, Twilio Verify send)
                            │ POST /api/savings/verify  (Verify check → phone_verified)
                            ▼
                   Worker (saverx-savings-watch) ── D1
                            ▲                          requests, consents, results, messages,
 Twilio ── /api/twilio/status (signed) ─┤              suppression, events, rate_limits
 Twilio ── /api/twilio/inbound (signed; STOP/HELP) ┘
 Admin (Cloudflare Access) ─▶ /admin/savings : queue → prefilled draft from profile → verify → "Send SMS"
 Visitor ◀─SMS─ "SaveRx: your savings info is ready: saverx.ai/r/<token>. Reply STOP to opt out."
```

### Data model (D1)
- `requests(id, drug_slug, phone_hmac, phone_e164, status[new|verified|researching|ready|sent|closed], created_at, ip_hash, source_page, utm_*)`
- `consents(id, request_id, type[transactional|watch], text_version, text_shown, checked_at, ip_hash, user_agent)`: separate rows so Watch consent is independent.
- `results(id, request_id, token_hash, content_json, verified_by, verified_at, expires_at, viewed_at, outcome)`
- `messages(id, request_id, twilio_sid, status, error_code, sent_at, delivered_at)`
- `suppression(phone_hmac, reason, at)`: STOP list, checked before **every** send.
- `events(name, drug_slug, day)`: aggregate funnel, no PII.

Phone dedupe uses an HMAC (secret in Worker) so duplicates are detectable without relying on raw numbers. Raw E.164 is kept only as long as needed to send, then purged by retention job (results/tokens 30 days after expiry; requests 12 months, adjustable).

### Privacy rules baked in
- SMS body never contains a medication name or health information, only a link and STOP language.
- GA4 receives categorical events only. No phone numbers, no tokens.
- Free-text is not collected. The form states "Don't enter medical details."
- No secrets or real data in git; synthetic test data only; no real SMS in dev (Twilio calls go through an injectable client; dev default = mock; real sending requires an explicit `TWILIO_LIVE=true` env var that you set).

## 5. MVP scope mapping (your 9 items)

| # | Item | Plan |
|---|---|---|
| 1 | "Find savings for me — Free" button | New script injects into the Repatha page only for the pilot, then rolls out later. |
| 2 | Mobile form + consent | `/savings-watch/` page; unchecked, separate consent checkbox with TCPA-style disclosure (msg frequency, STOP/HELP, rates, not a condition of anything); consent text versioned and stored verbatim. |
| 3 | Twilio Verify | Worker `start`/`verify` endpoints. |
| 4 | Secure storage | D1 tables above. |
| 5 | Admin workflow | Queue, prefilled draft from `drug-page-profile`, mandatory "I verified this at <source> on <date>" checkbox, then send. |
| 6 | SMS + expiring page | Twilio Messaging Service; link tokens as above. |
| 7 | Opt-out + status | Signed inbound webhook (STOP/UNSUBSCRIBE/CANCEL → suppression; HELP reply; START re-opt-in) and signed status callbacks. |
| 8 | Ongoing Watch | **Proposed: store the separate consent in MVP, but defer the recurring-send tooling.** Sending recurring updates to a tiny list manually through the same admin is enough to validate demand. Please confirm. |
| 9 | Analytics | Aggregate funnel (view, start, verified, sent, delivered, link opened, "Did this help?" outcome) in `events` + a small admin counts view + GA4 categorical events. |

## 6. Compliance & launch requirements (not legal advice, have counsel review)

- **TCPA / CTIA:** express written consent before any non-verification text; clear disclosure; honor STOP immediately. Reusing the existing `/get-help/` optional SMS checkbox as consent is **not** recommended. Its wording was not designed for this.
- **A2P 10DLC:** US business SMS requires brand + campaign registration (business legal name, EIN, website, privacy policy with SMS terms, opt-in flow screenshots). Approval can take days to weeks, so **start registration in parallel with development**. Health-related content can attract extra carrier scrutiny; keep messages generic. Verify via Twilio Verify does not require campaign registration, but marketing/results texts do.
- **Privacy policy / terms:** must add SMS program terms (frequency, "Msg & data rates may apply," STOP/HELP, no sharing of mobile numbers with third parties for their marketing). Current pages have none.
- **Health-data law:** a phone number tied to a medication is health-adjacent. SaveRx is likely **not** a HIPAA covered entity, but this is **not verified**, and HIPAA is not claimed anywhere. Consider FTC Health Breach Notification Rule and state consumer-health laws (e.g., Washington My Health My Data, Nevada, Connecticut). Twilio offers a BAA only on specific plans. We make no HIPAA claim until this is reviewed.
- **Operational:** quiet hours (no texts before 8am/after 9pm recipient time), suppression check on every send, consent records retained, audit of who verified each result.

## 7. Testing plan

`node --test` (no new dependencies) against Worker modules with an injected fake Twilio client and in-memory repository. Synthetic data only. Cases: happy path (Repatha), invalid/non-US phone, wrong/expired OTP, OTP attempt limits, duplicate request, rate-limit trip, missing consent, STOP → suppression → send blocked, START re-opt-in, delivery failure (30003/30005/30007), forged webhook signature rejected, expired/unknown result token, token not guessable (hash-only storage), admin route without Access JWT, and "SMS body contains no drug name" assertion. Front-end form tested using the existing `vm` harness pattern. Final PR includes screenshots (mobile viewport) and the test run output.

## 8. Cost (rough, verify against current Twilio pricing)

Twilio Verify is billed per successful verification (a few cents); outbound SMS ~1 cent/segment plus carrier fees; A2P brand/campaign one-time and monthly fees; Cloudflare Worker/D1/Turnstile/Access are free at this scale (Access free up to 50 users). Pilot volume is expected to cost on the order of tens of dollars per month.

## 9. Proposed PR sequence (small, deployable steps)

1. Worker skeleton + D1 schema + start/verify endpoints + tests (mock Twilio only).
2. Form page + Repatha button + consent text + tests.
3. Admin queue + results page + token expiry + tests.
4. Messaging send, signed status/inbound webhooks, suppression + tests.
5. Analytics, privacy/terms SMS language, `SAVINGS_WATCH_SETUP.md`, `env.example`.

Nothing is merged or deployed without your approval.

## 10. Decisions needed from the owner

1. Approve Worker + D1 (vs. Apps Script)?
2. Do you already have a Twilio account, and which legal entity/EIN will register A2P?
3. OK to use Cloudflare Access for admin (you + Asma)?
4. Item 8: store consent now, defer recurring sends?
5. Product overlap: `/get-help/` already sells paid "Guided Enrollment." Savings Watch is free. Confirm they coexist (Savings Watch as the free top-of-funnel).
6. Pilot only on Repatha first (button not added to the other 371 pages)?
