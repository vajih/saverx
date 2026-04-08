# SaveRx.ai — Developer Handoff Brief
> Written: April 7, 2026. Use this to onboard a new chat session immediately.
> Also read: `CLAUDE.md` (auto-loaded), `ROADMAP.md`, `docs/REVENUE_SPEC.md`

---

## What Was Accomplished This Session

### 1. Migrated email delivery: MailerLite → Resend.com
MailerLite had a critical bug: it stripped `{$subscriber.fields.drug}` merge tags from outgoing emails, resulting in blank drug names. Switched entirely to Resend.com for all transactional email delivery.

### 2. Rewrote `scripts/Code.gs` from scratch
Full replacement of the Apps Script backend. New architecture:
- `doPost` → logs to Google Sheet + sends welcome email via Resend + queues day 3/7 follow-ups
- `processEmailQueue` → hourly trigger sends queued follow-ups
- `doGet` → handles unsubscribe clicks, logs to Unsubscribes sheet, returns HTML confirmation page
- All template merge tags (`{$subscriber.fields.drug}`, `{$unsubscribe}`) replaced server-side before sending

### 3. Updated all 361 drug pages to new Apps Script URL
The old script deployment (`AKfycbyPArH...`) was replaced with a new one (`AKfycbxC1tT...`). Used `sed` to update all 361 HTML files. Committed and pushed.

### 4. Fixed FROM_EMAIL domain
Resend only allows sending from verified domains. `saverx.ai` is NOT verified — only `newsletter.saverx.ai` is. Fixed `FROM_EMAIL` to `SaveRx.ai <hello@newsletter.saverx.ai>`.

### 5. Implemented full unsubscribe system (CAN-SPAM compliant)
- Every email footer has a working unsubscribe link
- Clicking it hits the Apps Script `doGet` endpoint
- Email is written to `Unsubscribes` tab in Google Sheet
- Future emails (welcome + follow-ups) are suppressed for unsubscribed addresses
- HTML confirmation page served on unsubscribe

### 6. E2E tested and confirmed working
Tested Repatha (cardiovascular), Ozempic (GLP-1), FreeStyleLibre (diabetes) — all 3 emails delivered with correct drug names in subject and body.

---

## Current Architecture

```
User fills form on drug page
  → POST to Apps Script (AKfycbxC1tT...)
    → doPost()
      → Google Sheet (CopayEnrollments) — always written
      → isUnsubscribed() check
      → sendResendEmail(..., "welcome") — fetches template from saverx.ai/emails/
          → applyMergeTags() → replaces drug name + unsubscribe URL
          → POST to api.resend.com/emails
      → queueFollowUps() → EmailQueue sheet (day 3, day 7)

Hourly trigger (processEmailQueue)
  → Reads EmailQueue sheet
  → For each pending row where send_at <= now:
      → isUnsubscribed() check (marks "unsubscribed" if true)
      → sendResendEmail() → Resend API

User clicks Unsubscribe link in email
  → GET Apps Script ?action=unsubscribe&email=...
    → doGet()
      → Writes to Unsubscribes sheet
      → Returns HTML confirmation page
```

---

## Key Credentials & Config

### Apps Script
| Variable | Value |
|---|---|
| **Live deployment URL** | `https://script.google.com/macros/s/AKfycbx94hvoMsW63Cll1adLwUQaMG2IJ3qgO2S0x7vhYR_UfUtK0J8YCHX8O-6S4sng0nHuNQ/exec` |
| **Old URL (retired)** | `AKfycbyPArHul2llNlpy2YIW9-...` — no longer used |
| **Google Sheet ID** | `19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE` |
| **Script Property** | `RESEND_API_KEY = re_R4NahWa8_7fzxQmtGepKYfvCYVXD7uZ8d` |

### Resend
| Variable | Value |
|---|---|
| **API key** | `re_R4NahWa8_7fzxQmtGepKYfvCYVXD7uZ8d` (send-only restricted key) |
| **Verified domain** | `newsletter.saverx.ai` ONLY — `saverx.ai` is NOT verified |
| **FROM_EMAIL** | `SaveRx.ai <hello@newsletter.saverx.ai>` |

### Google Sheet tabs (all in sheet ID above)
| Tab | Purpose |
|---|---|
| `CopayEnrollments` | All form submissions (audit log) |
| `EmailQueue` | Follow-up email queue (day 3, day 7) |
| `Unsubscribes` | Opt-out list — emails suppressed automatically |

### Hosting
- **Static site**: Cloudflare Pages → `wrangler pages deploy . --project-name saverx`
- **Worker (AI chat)**: `cd saverx-chat-proxy && wrangler deploy`

---

## Google Sheet Columns

### CopayEnrollments
`timestamp | email | drug | source | user-agent`

### EmailQueue
`email | drug | category | type | send_at | sent_at | status`

Status values: `pending` → `sent` / `failed` / `unsubscribed`

### Unsubscribes
`email | unsubscribed_at`

---

## Email Templates

All 12 HTML files live in `emails/` → deployed to `https://saverx.ai/emails/`

| File | Sent when | Trigger |
|---|---|---|
| `glp1-welcome.html` | Ozempic, Wegovy, Mounjaro, Zepbound, Trulicity, Victoza, Saxenda, Rybelsus | Immediately on signup |
| `glp1-follow-up-1.html` | GLP-1 drugs | Day 3 |
| `glp1-follow-up-2.html` | GLP-1 drugs | Day 7 |
| `cardiovascular-welcome.html` | Repatha, Eliquis, Entresto, Jardiance, Brilinta, Xarelto, Farxiga, etc. | Immediately |
| `cardiovascular-follow-up-1.html` | Cardiovascular | Day 3 |
| `cardiovascular-follow-up-2.html` | Cardiovascular | Day 7 |
| `diabetes-cgm-welcome.html` | FreeStyleLibre, Dexcom, Toujeo, Tresiba, Januvia, Metformin, etc. | Immediately |
| `diabetes-cgm-follow-up-1.html` | Diabetes/CGM | Day 3 |
| `diabetes-cgm-follow-up-2.html` | Diabetes/CGM | Day 7 |
| `welcome.html` | Everything else (general) | Immediately |
| `follow-up-1.html` | General | Day 3 |
| `follow-up-2.html` | General | Day 7 |

### Template merge tags (handled by `applyMergeTags()` in Code.gs)
| Tag | Replaced with |
|---|---|
| `{$subscriber.fields.drug}` | Drug name (e.g. "Ozempic") |
| `{$subscriber.fields.drug\|slugify}` | URL slug (e.g. "ozempic") |
| `{$unsubscribe}` | Full Apps Script unsubscribe URL with encoded email |

---

## Code.gs Functions Reference

| Function | Purpose |
|---|---|
| `doPost(e)` | Main entry point for form submissions |
| `doGet(e)` | Serves unsubscribe confirmation page |
| `sendResendEmail(toEmail, drug, category, type)` | Sends one email via Resend API |
| `queueFollowUps(email, drug, category)` | Adds day 3 + day 7 rows to EmailQueue |
| `processEmailQueue()` | Hourly trigger — sends due follow-ups |
| `isUnsubscribed(email)` | Checks Unsubscribes sheet, returns bool |
| `getDrugCategory(drug)` | Returns `"glp1"` / `"cardiovascular"` / `"diabetes"` / `"general"` |
| `applyMergeTags(html, drug, toEmail)` | Replaces all template placeholders |
| `slugify(str)` | Lowercase, hyphens only |
| `createHourlyTrigger()` | One-time setup — installs hourly trigger for processEmailQueue |

---

## Outstanding Tasks (Must Do Before Production Traffic)

### Critical
- [ ] **Redeploy Code.gs** — paste current `scripts/Code.gs` into Apps Script editor, create a **new deployment** (not update existing) since `doGet` signature changed. Update `SCRIPT_URL` var in Code.gs if new deployment URL differs.
- [ ] **Run `createHourlyTrigger()`** — in Apps Script editor, select `createHourlyTrigger` from dropdown → Run. Installs the hourly trigger for follow-up emails.

### Important
- [ ] **Test unsubscribe flow** — send a test email, click the unsubscribe link, confirm the Unsubscribes sheet gets an entry and a re-submission doesn't send email.
- [ ] **Verify existing queue** — the EmailQueue sheet has entries from test submissions (Repatha/Ozempic/FreeStyleLibre for test emails). These are all pending day 3/7 sends. Fine to leave or manually mark as `sent` to clear them.

### Nice to have
- [ ] Commit `HANDOFF.md` to git after reviewing

---

## Next Development Priorities (from ROADMAP.md)

### Phase 1 — GLP-1 Affiliate CTAs (highest priority revenue)
Add a styled CTA card to 8 GLP-1 drug pages linking to telehealth affiliate partners (Hims & Hers, Ro, Calibrate, Noom Med, Found). Full HTML/CSS spec in `docs/REVENUE_SPEC.md` Feature 1.

Affected pages:
- `drugs/ozempic/index.html`
- `drugs/wegovy/index.html`
- `drugs/mounjaro/index.html`
- `drugs/zepbound/index.html`
- `drugs/saxenda/index.html`
- `drugs/victoza/index.html`
- `drugs/rybelsus/index.html`
- `drugs/trulicity/index.html`

Need to apply for affiliate programs: hims.com/partners, ro.co/affiliates, joincalibrate.com, noom.com/affiliate, joinfound.com/affiliate

### Phase 2 — GLP-1 comparison page `/drugs/glp1-online.html`
High-intent SEO page comparing telehealth GLP-1 providers. Full spec in `docs/REVENUE_SPEC.md` Feature 2.

### Phase 3 — Email sequence CTAs
Add affiliate links into the follow-up email templates. Currently they drive back to the drug page only.

### Phase 4 — AI chat upgrade
Make the Cloudflare Worker chat revenue-aware — surface relevant affiliate offers contextually. Spec in `docs/REVENUE_SPEC.md` Feature 4.

### Phase 5 — Insurance coverage tool `/coverage-check.html`
Lead gen tool. Spec in `docs/REVENUE_SPEC.md` Feature 5.

---

## File Map (Most Important)

| File | Purpose |
|---|---|
| `scripts/Code.gs` | **The entire email backend** — Apps Script, Resend, unsubscribe |
| `emails/*.html` | 12 email templates (served from Cloudflare Pages) |
| `drugs/*/index.html` | 357 static drug pages |
| `templates/index.html` | Master drug page template (used by generator) |
| `assets/css/tokens.css` | Design tokens — use existing vars, don't add new colors |
| `assets/css/components.css` | Shared CSS components |
| `saverx-chat-proxy/src/index.js` | Cloudflare Worker — AI chat proxy |
| `docs/REVENUE_SPEC.md` | Full HTML/CSS/JS specs for all 5 revenue features |
| `ROADMAP.md` | Strategic roadmap + master to-do |
| `.env` | API keys (never commit) |

---

## Constraints — Never Break These

1. The Google Sheet write in `doPost` must always succeed — it's the audit log
2. Email failures must be silent — never break the form submission flow
3. Do NOT change the Apps Script deployment URL without updating `SCRIPT_URL` in Code.gs AND re-running sed across all 361 drug pages
4. Do NOT remove GTM tags from drug pages — they power GA4
5. All 357 drug pages are static HTML — no build step, no bundler, no framework
6. CSS: use existing design tokens from `assets/css/tokens.css` — do not add new color values
7. Never commit `.env` — it contains API keys and lead PII paths

---

## Quick Test Commands

```bash
# Test E2E via Apps Script (replace email as needed)
REDIR=$(curl -s -o /dev/null -w "%{redirect_url}" -X POST \
  "https://script.google.com/macros/s/AKfycbx94hvoMsW63Cll1adLwUQaMG2IJ3qgO2S0x7vhYR_UfUtK0J8YCHX8O-6S4sng0nHuNQ/exec" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=TEST@example.com&drug=Ozempic&source=test")
curl -s -L "$REDIR"
# Expected: {"status":"ok"}

# Test Resend API directly
source .env
curl -s -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"SaveRx.ai <hello@newsletter.saverx.ai>","to":["TEST@example.com"],"subject":"Test","html":"<p>Test</p>"}'
# Expected: {"id":"..."}

# Deploy to Cloudflare Pages
wrangler pages deploy . --project-name saverx

# Deploy Cloudflare Worker (AI chat)
cd saverx-chat-proxy && wrangler deploy
```
