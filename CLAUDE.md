# SaveRx.ai — Claude Code Project Context

> This file is read automatically by Claude Code every session.
> It is the single source of truth for project architecture, current state, and priorities.
> Always read `ROADMAP.md` and the relevant spec file in `docs/` before writing code.

---

## What SaveRx.ai Is

SaveRx.ai is a **prescription drug savings website** with 358 static HTML drug pages. It helps patients find manufacturer copay assistance programs for expensive medications (Ozempic, Repatha, Mounjaro, FreeStyleLibre, and 350+ others).

**Strategic position:** We are the top-of-funnel for drug cost decisions — patients research prices here before deciding whether to use insurance, get a coupon, or pursue a telehealth prescription. We monetize through affiliate referrals, display ads, and email marketing. We are NOT a pharmacy, telehealth provider, or prescriber.

---

## Architecture

```
saverx.ai (Cloudflare Pages)
├── 358 static HTML drug pages  →  drugs/{drug-name}.html
├── Homepage                    →  index.html
├── Cloudflare Worker AI chat   →  saverx-chat-proxy/src/index.js
├── Google Apps Script backend  →  scripts/Code.gs
│   └── doPost: captures email + drug → Google Sheet + Resend (transactional email)
├── Google Sheet (leads)        →  ID: 19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE
├── Resend.com (transactional email) → api.resend.com
├── GTM                         →  GTM-MVZBBF7R (installed site-wide)
├── GA4                         →  analytics.google.com
└── Admin dashboard             →  admin-server.js + admin.html (localhost:3001)
```

**Hosting:** Cloudflare Pages + Workers
**Deploy:** `wrangler pages deploy . --project-name saverx`
**Worker deploy:** `cd saverx-chat-proxy && wrangler deploy`

---

## Current State (April 2026)

### Done ✅

- 361 drug pages live with email capture forms
- Google Apps Script captures email + drug + source → Google Sheet
- Welcome email + day 3/7 follow-ups via Resend.com (12 segmented HTML templates in `emails/`)
- Unsubscribe system: CAN-SPAM compliant, Unsubscribes sheet, suppresses future sends
- 252 leads exported to `data/saverx-leads.csv` (deduped version: `data/saverx-leads-deduped.csv`)
- `scripts/Code.gs` — Apps Script with Resend email delivery + follow-up queue
- `docs/EMAIL_SEQUENCES.md` — full email copy for all sequences
- `admin-server.js` + `admin.html` — local admin dashboard at localhost:3001

### In Progress 🔄

- [ ] Redeploy `scripts/Code.gs` as new deployment (doGet unsubscribe handler added)
- [ ] Run `createHourlyTrigger()` in Apps Script editor (installs hourly follow-up processor)
- [ ] Apply for Google AdSense, Hims & Hers affiliate, Ro affiliate, GoodRx Publisher API

### Not Started ⬜

- GLP-1 affiliate CTA cards on drug pages (Phase 1 — highest priority revenue)
- GLP-1 telehealth comparison page `/drugs/glp1-online.html` (Phase 2)
- AI chat upgrade — revenue-aware responses (Phase 4)
- Insurance coverage check tool `/coverage-check.html` (Phase 5)

---

## Key Files Reference

| File                             | Purpose                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `CLAUDE.md`                      | **This file** — auto-loaded context for Claude Code                          |
| `ROADMAP.md`                     | Strategic roadmap, all phases, master to-do checklist, revenue projections   |
| `docs/REVENUE_SPEC.md`           | Technical specs for all 5 revenue features (HTML, CSS, JS, JSON)             |
| `docs/EMAIL_SEQUENCES.md`        | Complete email copy for all automation sequences                             |
| `docs/MASTER_PROMPT.md`          | Consolidated Claude Code prompt for all build phases                         |
| `scripts/Code.gs`                | Google Apps Script — email capture + Resend email delivery + follow-up queue |
| `scripts/dedup-csv.mjs`          | Deduplicates the leads CSV                                                   |
| `data/saverx-leads.csv`          | Raw exported leads from Google Sheet                                         |
| `data/saverx-leads-deduped.csv`  | Deduplicated leads (use this for import)                                     |
| `saverx-chat-proxy/src/index.js` | Cloudflare Worker — AI chat proxy                                            |
| `assets/css/components.css`      | Shared CSS components                                                        |
| `assets/css/tokens.css`          | Design tokens (colors, spacing, fonts)                                       |
| `admin-server.js`                | Admin dashboard Node.js server                                               |
| `admin.html`                     | Admin dashboard UI                                                           |
| `.env`                           | API keys (never commit — in .gitignore)                                      |
| `env.example`                    | Env var reference (safe to commit)                                           |

---

## Environment Variables

All keys are in `.env`. Never hardcode them. Never commit `.env`.

```bash
RESEND_API_KEY=re_...               # Resend.com API key (send-only restricted key)
```

For Google Apps Script, `RESEND_API_KEY` is stored in Project Settings → Script Properties (NOT in .env).

For the Cloudflare Worker (saverx-chat-proxy), secrets are set via:

```bash
wrangler secret put OPENAI_API_KEY
```

For Google Apps Script, keys are stored in Project Settings → Script Properties (NOT in .env).

---

## Drug Page Structure

Each drug page follows this pattern:

```html
<head>
  <!-- GTM tag, GA4, meta tags, CSS -->
</head>
<body>
  <!-- Header / nav -->
  <!-- Hero section: drug name, description -->
  <!-- Savings section: pricing table, GoodRx info -->
  <!-- Email capture form → Google Apps Script endpoint -->
  <!-- AI chat widget → Cloudflare Worker -->
  <!-- Footer -->
</body>
```

The Google Apps Script endpoint:

```
https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec
```

POST body: `{ email, drug, source }`

---

## Drug Category Mapping

Drug categories are determined in `Code.gs` via `getDrugCategory(drug)`:

- **glp1**: Ozempic, Wegovy, Mounjaro, Zepbound, Saxenda, Victoza, Rybelsus, Trulicity, semaglutide, tirzepatide, liraglutide
- **cardiovascular**: Repatha, Entresto, Eliquis, Xarelto, Jardiance (CV), Farxiga (CV), Brilinta, Plavix
- **diabetes**: Jardiance (diabetes), Farxiga (diabetes), FreeStyleLibre, Dexcom, Metformin, Januvia, Victoza
- **general**: everything else + N/A + newsletter signups

Category drives which email template is sent (12 templates in `emails/`).

---

## Critical Constraints

**Never break these:**

1. The Google Sheet write in `Code.gs` must always succeed — use `muteHttpExceptions: true` on all external calls
2. The email capture form must always return success to the user — Resend errors must be silent
3. Do not change the Google Apps Script web app deployment URL
4. Do not remove GTM tags from any drug page — they power GA4 analytics
5. All 358 drug pages must remain functional after any CSS or JS changes
6. Drug pages are static HTML — no build step, no bundler, no framework

**Never commit:**

- `.env` (API keys)
- `node_modules/`
- `.venv/`
- `data/saverx-leads.csv` (contains PII)

---

## Code Style

- Drug pages: vanilla HTML/CSS/JS — no frameworks, no bundlers
- Scripts: Node.js ESM (`import`/`export`), native `fetch` (Node 18+), no HTTP libraries
- Worker: Cloudflare Workers JS (no Node.js APIs)
- Apps Script: Google Apps Script (uses `UrlFetchApp`, `SpreadsheetApp`, `PropertiesService`)
- CSS: uses design tokens from `assets/css/tokens.css` — use existing variables, don't add new colors

---

## Revenue Priority Order

1. **GLP-1 affiliate CTAs** on 8 drug pages → `docs/REVENUE_SPEC.md` Feature 1
2. **GLP-1 comparison page** `/drugs/glp1-online.html` → Feature 2
3. **Email sequence CTAs** — add affiliate links to follow-up email templates in `emails/` → Feature 3
4. **AI chat upgrade** in Worker → Feature 4
5. **Insurance coverage tool** `/coverage-check.html` → Feature 5

Full specs, HTML, CSS, JS for all 5 features are in `docs/REVENUE_SPEC.md`.
Full roadmap with timeline and projections is in `ROADMAP.md`.
