# SaveRx.ai — Revenue Roadmap
> Last updated: April 2026
> Inspired by Medvi's model: own the patient funnel, monetize through partners, stay out of regulated territory.

---

## Strategic Position

SaveRx sits **upstream** of companies like Medvi, Hims & Hers, and Ro. We own the moment when patients are researching drug prices — before they decide whether to use insurance, go to a telehealth provider, or find a coupon. That is the highest-leverage position in the funnel.

**We are not a pharmacy. We are not a telehealth provider. We are the trusted guide that connects patients to the right next step — and we earn on every referral.**

Current assets:
- 358 drug pages with organic SEO traffic
- 252 email leads segmented by drug (GLP-1, cardiovascular, diabetes, general)
- Live email capture on every drug page (Google Apps Script → Google Sheets)
- MailerLite integration in progress (groups created, import pending)
- Cloudflare Worker AI chat on every page
- GTM + GA4 installed site-wide
- Google AdSense application pending

---

## Roadmap Overview

| Phase | Initiative | Revenue Type | Effort | Timeline |
|-------|-----------|-------------|--------|----------|
| 1 | GLP-1 Telehealth Affiliate Links | Affiliate CPA | Low | Week 1 |
| 2 | GLP-1 Telehealth Comparison Page | Affiliate CPA + SEO | Medium | Week 2 |
| 3 | Email Sequences → Conversion Funnel | Affiliate CPA | Low | Week 2 |
| 4 | AI Chat Upgrade (Revenue-Aware) | Affiliate CPA | Medium | Week 3 |
| 5 | "Does Insurance Cover This?" Tool | Lead gen + Affiliate | High | Week 4 |
| 6 | Google AdSense (in progress) | Display ads | Done | Week 1 |
| 7 | GoodRx Publisher Widgets | Affiliate CPC | Medium | Week 3 |

---

## Phase 1 — GLP-1 Telehealth Affiliate Links
**Revenue: $30–$150 per converted referral | Effort: 1–2 days**

### What
Add a "Get a Prescription Online" CTA section to every GLP-1 drug page. Link to telehealth affiliate partners. Earn a commission for every patient who signs up.

### Target drug pages
- Ozempic, Wegovy, Mounjaro, Zepbound, Saxenda, Victoza, Rybelsus, Trulicity

### Affiliate programs to apply for
- [ ] **Hims & Hers** — hims.com/partners (GLP-1 affiliate program)
- [ ] **Ro** — ro.co/affiliates
- [ ] **Calibrate** — joincalibrate.com (affiliate)
- [ ] **Noom Med** — noom.com/affiliate
- [ ] **Found** — joinfound.com/affiliate

### Implementation
- Add a styled CTA card to each GLP-1 drug page HTML
- CTA text: "Get a GLP-1 Prescription Online — No Insurance Needed"
- Show 2–3 provider options with price comparison ($X/month)
- Each provider card links to affiliate URL with tracking params
- Track clicks as GA4 events via GTM: `glp1_affiliate_click`

### Success metric
> 5+ affiliate clicks/day within 30 days → target $500–$2,000/month

---

## Phase 2 — GLP-1 Telehealth Comparison Page
**Revenue: High-intent SEO traffic → affiliate commissions | Effort: 2–3 days**

### What
Build a dedicated `/glp1-online` page: "Compare GLP-1 Online Providers — Pricing, Speed, Requirements." This is the SaveRx price-comparison model applied one level up — instead of comparing pharmacy prices, we compare telehealth providers.

### Target keywords
- "cheapest GLP-1 online" (~2,400/mo)
- "Ozempic online prescription" (~18,000/mo)
- "best telehealth for weight loss" (~5,400/mo)
- "compounded semaglutide online" (~8,100/mo)
- "Wegovy alternative cheaper" (~3,200/mo)

### Page structure
1. Hero: "Compare GLP-1 Providers — Find the Cheapest Option for You"
2. Comparison table: Provider | Monthly cost | Drug options | Insurance accepted | Turnaround | Rating | CTA
3. Provider deep-dives (accordion): Hims, Ro, Calibrate, Noom Med, Found
4. FAQ section (SEO content): "Is compounded semaglutide safe?", "How do I get Ozempic online?"
5. Email capture at bottom: "Get notified when prices drop"

### Success metric
> Rank on page 1 for 2+ target keywords within 60 days → $1,000–$5,000/month

---

## Phase 3 — Email Sequences as Conversion Funnel
**Revenue: Affiliate CTAs inside existing email nurture | Effort: 1 day**

### What
Update the MailerLite email sequences (already written in `docs/EMAIL_SEQUENCES.md`) to include affiliate CTAs in emails 2 and 3 of the GLP-1 sequence. Turn informational emails into a conversion funnel.

### Updated email flow for GLP-1 group
- **Email 1** (Day 0): Drug savings tips for {$drug} — informational, builds trust
- **Email 2** (Day 3): "Can't afford {$drug}? Here's how to get it online for less" — introduce telehealth option, soft affiliate CTA
- **Email 3** (Day 7): "The cheapest way to get {$drug} right now" — direct comparison + affiliate links

### Updated email flow for general group
- **Email 1** (Day 0): Welcome + top savings tips
- **Email 2** (Day 5): "Are you paying too much? Use these tools" — GoodRx embed, affiliate CTAs

### Implementation
- Edit email copy in MailerLite dashboard
- Add UTM params to all affiliate links: `?utm_source=saverx&utm_medium=email&utm_campaign=glp1-sequence`
- Track opens/clicks in MailerLite reporting

### Success metric
> 10%+ click rate on affiliate CTAs in emails 2 and 3 → $200–$1,000/month from 252 existing leads

---

## Phase 4 — AI Chat Upgrade (Revenue-Aware Responses)
**Revenue: Affiliate CTA at end of every relevant chat answer | Effort: 2–3 days**

### What
Upgrade the Cloudflare Worker AI chat proxy to return revenue-generating responses. When a user asks about GLP-1 access, insurance, or cost, the chat response includes a structured affiliate recommendation card.

### Current state
- Cloudflare Worker proxying AI responses
- Basic drug info Q&A
- No revenue touchpoints in chat

### Target state
- Detect intent keywords: "get prescription", "qualify for", "can I get", "how much does", "insurance covers"
- Append structured affiliate card to response when intent is detected
- Card format: "✅ Get {drug} Online → [Provider name] — $X/month → [CTA button]"
- Log chat intents as GA4 events: `chat_affiliate_intent`

### System prompt additions
```
When a user asks how to access or afford a GLP-1 drug (Ozempic, Wegovy, Mounjaro, Zepbound,
Saxenda, Rybelsus, Trulicity), after your informational answer, append:

---
**Get a prescription online:**
- [Hims & Hers](https://hims.com?ref=saverx) — from $X/month
- [Ro](https://ro.co?ref=saverx) — from $X/month
*SaveRx may earn a commission if you sign up.*
```

### Success metric
> 5+ affiliate clicks/day from chat → $300–$1,500/month

---

## Phase 5 — "Does Insurance Cover This?" Tool
**Revenue: Lead gen + insurance affiliate | Effort: 3–5 days**

### What
Build an interactive tool at `/coverage-check`: users enter their drug name + insurance plan → tool shows whether it's likely covered + copay estimate. When coverage is denied or expensive, offer the telehealth alternative.

### Why this works
GLP-1 coverage is the #1 frustration of patients. Most insurance plans don't cover Ozempic for weight loss. When the tool shows "not covered," that's the highest-intent moment to offer the telehealth/compounded alternative.

### Data source
- CMS formulary data (public)
- Manual coverage tables for top 20 insurance plans + top 30 drugs
- Fallback: "Based on typical plans, [drug] is [covered/not covered] for [condition]"

### Insurance affiliate partners to apply for
- [ ] **eHealth** — ehealthinsurance.com/affiliate (Medicare plan comparison)
- [ ] **GoHealth** — gohealth.com/partner
- [ ] **HealthMarkets** — healthmarkets.com/affiliate

### Conversion flow
1. User enters drug + insurance → sees coverage status
2. If covered: show copay estimate + GoodRx coupon comparison
3. If not covered: show telehealth alternative with affiliate CTA
4. Both paths: email capture ("Get notified if your coverage changes")

### Success metric
> 50+ tool uses/day within 60 days → $500–$3,000/month (insurance lead gen pays $30–$80/lead)

---

## Phase 6 — Google AdSense
**Status: Application pending**

- [ ] Apply at adsense.google.com
- [ ] Add auto-ads tag via GTM (tag already installed: GTM-MVZBBF7R)
- [ ] Add manual ad units to high-traffic drug pages (sidebar + between sections)

**Expected: $200–$800/month at current traffic levels**

---

## Phase 7 — GoodRx Publisher Widgets
**Revenue: CPC on coupon clicks | Effort: 1 day after approval**

- [ ] Apply at goodrx.com/business/solutions/digital-health
- [ ] Embed GoodRx price widget on every drug page
- [ ] Replace static price tables with live GoodRx widget
- [ ] Track widget clicks via GTM: `goodrx_widget_click`

**Expected: $0.10–$0.50 per coupon click → $300–$1,500/month**

---

## Master To-Do Checklist

### Immediate (This Week)
- [ ] Fix MailerLite API key → run `node scripts/mailerlite-setup.js`
- [ ] Export Google Sheet → save as `data/saverx-leads.csv`
- [ ] Run `node scripts/mailerlite-import.js` to import 252 leads
- [ ] Deploy updated `Code.gs` to Google Apps Script
- [ ] Apply for Hims & Hers affiliate program
- [ ] Apply for Ro affiliate program
- [ ] Apply for Google AdSense
- [ ] Apply for GoodRx Publisher API

### Week 2
- [ ] Add GLP-1 affiliate CTA cards to all 8 GLP-1 drug pages
- [ ] Build `/glp1-online` comparison page
- [ ] Update MailerLite email sequences with affiliate CTAs
- [ ] Build email automations in MailerLite dashboard (triggers, delays)
- [ ] Apply for Calibrate + Noom Med affiliate programs

### Week 3
- [ ] Upgrade Cloudflare Worker AI chat with revenue-aware responses
- [ ] Add GA4 event tracking for affiliate clicks (via GTM)
- [ ] Apply for GoodRx Publisher API (if not already approved)
- [ ] Apply for eHealth / GoHealth insurance affiliate
- [ ] Add GoodRx widgets to top 20 drug pages

### Week 4
- [ ] Build `/coverage-check` insurance tool
- [ ] Add email capture to comparison page and coverage tool
- [ ] Set up GA4 conversion goals for each revenue channel
- [ ] Review analytics: which pages drive most affiliate clicks?
- [ ] A/B test CTA copy on top 3 GLP-1 pages

### Ongoing
- [ ] Weekly: review MailerLite subscriber growth + email open rates
- [ ] Weekly: review GA4 affiliate click events
- [ ] Monthly: apply for additional affiliate programs
- [ ] Monthly: expand drug page coverage (add new drugs, update pricing)

---

## Revenue Projection (Conservative)

| Channel | Month 1 | Month 2 | Month 3 |
|---------|---------|---------|---------|
| GLP-1 Affiliate (pages) | $200 | $800 | $2,000 |
| GLP-1 Comparison Page | $0 | $400 | $1,500 |
| Email Affiliate CTAs | $100 | $300 | $600 |
| AI Chat Affiliate | $0 | $200 | $600 |
| AdSense | $100 | $200 | $400 |
| GoodRx Widgets | $0 | $150 | $400 |
| Insurance Tool | $0 | $0 | $800 |
| **Total** | **$400** | **$2,050** | **$6,300** |

---

## Files Reference

| File | Purpose |
|------|---------|
| `ROADMAP.md` | This file — master strategy and todo list |
| `docs/REVENUE_SPEC.md` | Technical specs for all 5 revenue features |
| `docs/MAILERLITE_SPEC.md` | MailerLite integration architecture |
| `docs/EMAIL_SEQUENCES.md` | Full email copy for all automations |
| `docs/CLAUDE_CODE_REVENUE_PROMPT.md` | Prompt to give Claude Code to build revenue features |
| `scripts/mailerlite-setup.js` | Create MailerLite groups + fields |
| `scripts/mailerlite-import.js` | Bulk import existing leads |
| `scripts/Code.gs` | Updated Google Apps Script |
| `admin-server.js` | Admin dashboard server |
| `admin.html` | Admin dashboard UI |
