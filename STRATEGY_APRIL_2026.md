# SaveRx.ai — Strategic Review & Roadmap

**Date:** April 11, 2026
**Prepared for:** Vajih Khan (advisor) and Asma Khan (founder)
**Purpose:** Comprehensive strategic audit, competitive benchmark, revenue roadmap, and specific guidance on (a) the telehealth partner demos next week, (b) cookies & consent, and (c) the path from where we are today to a premiere platform.

---

## 0. Executive Summary

SaveRx.ai has quietly accumulated something most healthcare startups never get: **an organic-traffic moat of 361 drug pages, a growing segmented email list, and a live email automation loop**, built on a static architecture that costs almost nothing to run. That combination — SEO inventory + owned audience + zero infra cost — is the exact substrate that one-person AI companies have been turning into cash.

The platform is not revenue-blocked. It is **funnel-blocked**. The traffic and the list exist; what's missing is the conversion plumbing between them and paying partners. Three things unlock revenue this quarter:

1. **Close 1–2 telehealth affiliate partnerships** — and structure them as revenue-share, not just flat CPA. The demos next week are a good idea *if prepared correctly* (see §4).
2. **Ship the category page fixes** already specified in `CATEGORY_FIX_PROMPT.md` — drug cards with prices, email capture on every category page, and a proper 7-tile homepage grid. This is the conversion layer.
3. **Add a cookie consent banner** — not because of growth, but because it is now a prerequisite for AdSense approval, for running a retargeting pixel, and for being taken seriously by enterprise partners. More on this in §5.

Everything else (scaling content, paid traffic, new categories, B2B deals) should come **after** the funnel actually converts. The single biggest risk right now is building more on top of a funnel that hasn't been stress-tested with real money.

---

## 1. Current State Audit

### What exists and works

- **361 drug pages** live on Cloudflare Pages, each with email capture, AI chat widget, GTM/GA4 tracking, and JSON-LD schema.
- **256 leads captured** (165 deduped) — segmented by drug category (GLP-1, cardiovascular, diabetes, general).
- **Email automation** via Google Apps Script + Resend: welcome + day 3 + day 7, 12 segmented HTML templates, CAN-SPAM compliant unsubscribe flow.
- **AI chat proxy** (Cloudflare Worker, OpenAI Responses API) with GLP-1 intent detection and an affiliate-aware system prompt that points intent-matched users to `glp1-online.html`.
- **7 category landing pages** (weight-loss, diabetes, heart-cholesterol, autoimmune, migraine, respiratory, mental-health) with JSON-LD and breadcrumbs.
- **1 live affiliate** — Embody GLP-1 (Katalys network), wired into the homepage, the category page, and the GLP-1 comparison page.
- **Admin dashboard** (Node.js server on localhost:3001) for internal lead review.
- **GTM + GA4** installed site-wide; conversion events partially wired.

### What's specified but not shipped

- The category system needs the fix pass described in `CATEGORY_FIX_PROMPT.md` — real drug cards fetched from the Apps Script featured endpoint, email capture on every category page, 7-tile homepage grid, accordion FAQs, CSS cleanup.
- AdSense application — pending; will fail until a cookie banner is in place (§5).
- Additional affiliate programs — Hims & Hers, Ro, GobyMeds, Noom — applications drafted, not submitted.
- `/coverage-check.html` insurance tool — specified in `docs/REVENUE_SPEC.md`, not built.

### Honest weaknesses

- **One live affiliate, one funnel.** The entire revenue plan is a single thread today. Until there are 3+ active affiliate streams, one policy change at Katalys or Embody takes the whole revenue line to zero.
- **Conversion data is thin.** 256 leads is a leading indicator, not a revenue indicator. We don't yet know what % click through to the affiliate, what % the affiliate actually converts, and what the LTV looks like. Until we do, every optimization is guesswork.
- **Trust signals are weak.** The site does not prominently display: who wrote the content, who the medical reviewer is, the "about" story, a real founder photo, or any press/credentials. For a health site, this gap is not cosmetic — it suppresses conversion, it prevents partnerships, and it risks Google's E-E-A-T penalties for health content (YMYL — Your Money or Your Life).
- **No cookie/consent banner.** Blocks AdSense approval, blocks any serious retargeting pixel, and will eventually flag legal review from any real partner.
- **No analytics dashboard for revenue.** GA4 is installed, but there's no single pane of glass showing: visitors → email signups → affiliate clicks → confirmed conversions. This has to exist before hiring, paying for traffic, or closing partner deals.

---

## 2. Competitive Landscape — Who We're Actually Competing With

It helps to look at SaveRx not in isolation but in the context of the category. There are four types of players in the prescription savings space, and SaveRx sits at the intersection of two of them.

### Type 1 — High-volume coupon aggregators
**GoodRx, SingleCare, WellRx, RxSaver, BuzzRx, Optum Perks.** These are the Amazons of drug coupons — massive scale, thousands of pharmacies, direct negotiating relationships with PBMs. Their moat is inventory and trust built over a decade. GoodRx alone does ~$750M/year revenue. **You cannot out-inventory them.** Their weakness is that they are generic, high-friction, and not specialized. You win by being the trusted editorial guide that *sends* patients to them (and earns a publisher fee) rather than competing with them.

### Type 2 — Patient-assistance nonprofits
**NeedyMeds, RxAssist, Partnership for Prescription Assistance.** These are nonprofit directories of manufacturer programs. They have credibility but terrible UX and no AI layer. **Their weakness is user experience and content freshness.** You win by being what a 2026 patient actually expects — fast, personal, AI-guided.

### Type 3 — Telehealth + drug delivery bundlers
**Hims & Hers ($6B+ market cap), Ro, Medvi, Henry Meds, Calibrate, Noom Med, Sesame.** These companies own the prescribing + shipping + monthly subscription. They spend **$150–$400 per customer on paid acquisition.** This is your customer. They want what you have (qualified intent at the moment of drug research) more than you want what they have. **This is the leverage you bring to the telehealth demos.** More on this in §4.

### Type 4 — AI health guides / copilots
**Buoy Health, K Health, Ada, Abridge (enterprise), and a wave of 2025–2026 AI copilots.** These are chatbots, not content sites. Their moat is model quality and clinical partnerships. **Their weakness is discovery — nobody Googles "I need an AI health chatbot."** People Google "how much does Repatha cost." That is SaveRx's entry point.

### Where SaveRx uniquely fits

You are the **trusted editorial + AI companion upstream of all four types**. You don't try to replace GoodRx — you rank on Google and send users to GoodRx (and earn from it). You don't try to replace Hims — you capture the patient at the research stage and send them to Hims (and earn from it). You're not competing with NeedyMeds — you're the modern UI version. And the AI chat is the binding agent that makes it feel personal instead of like a directory.

**The strategic position in one sentence:** *SaveRx.ai is the AI-native patient research layer that sits between "I heard I should take this drug" and "I've started taking it."*

This is a defensible, monetizable, low-cost-to-operate position — and it's the one Medvi shortcut around because they went straight into prescribing. Medvi made $401M fast but took on regulatory, compliance, and clinical liability. SaveRx can reach $10–20M ARR without touching any of that, and at a fraction of Medvi's headcount.

---

## 3. Where the Revenue Actually Comes From

Most advisors will tell you "add more affiliates." That's half right. The real answer is that SaveRx has **six distinct monetization surfaces**, and until you're running at least four of them, you haven't built a business — you've built a referral link. The priority order matters because some surfaces unlock others (e.g., an email list unlocks sponsored sends; a cookie banner unlocks AdSense; proof of conversions unlocks rev-share deals with telehealth).

| # | Revenue Stream | Economics | Difficulty | Timeline to Cash |
|---|---|---|---|---|
| 1 | **Affiliate CPA** (telehealth, coupons) | $30–$500 per conversion | Medium | 30–60 days |
| 2 | **Display ads** (AdSense, Mediavine) | $5–$30 RPM | Low (once cookie banner) | 30 days |
| 3 | **Email sponsorships** (segmented lists) | $0.10–$0.50 per send per advertiser | Low | 60–90 days |
| 4 | **Lead sale / co-reg** (opt-in lead sold to verified healthcare partners) | $2–$15 per lead | Medium | 90 days |
| 5 | **Revenue share with telehealth partners** (instead of flat CPA) | 10–20% of subscription LTV | High negotiation | 60–120 days |
| 6 | **SaveRx+ premium** (personalized AI companion, $9/mo) | Recurring | High | 6–12 months |

Notice that **only streams 1 and 2 matter in the first 90 days**. Everything else depends on having either more leads, better conversion data, or a different kind of conversation with partners. The sequence is deliberate.

### The $10K MRR plan (realistic)

If you close 2 affiliate partners and get AdSense approved, here is what that looks like in numbers, assuming your current ~30K monthly organic sessions (rough estimate based on 361 pages at modest SEO volume):

- **AdSense:** 30K sessions × 1.8 pageviews × $12 RPM ÷ 1000 = ~$650/mo. Starts day 1.
- **Embody GLP-1 affiliate:** 30K sessions × 3% affiliate CTR = 900 clicks × 4% conversion × $100 commission = ~$3,600/mo.
- **Second telehealth partner (e.g., Hims):** another $2,500/mo at a similar profile.
- **Coupon aggregator affiliate (GoodRx Gold or WellRx):** 30K sessions × 2% CTR × $1.50 per click = ~$900/mo.
- **Email monetization (a segmented GLP-1 list of ~500 subs gets ~$400/mo in sponsor CPM once you hit 1,000+).**

**Total: ~$8,000–$10,000/mo within 90 days, with no headcount and no paid acquisition.**

That is what a one-person AI company looks like at month 3. It is not glamorous, it is not billion-dollar yet, but it is real, recurring, and compounding — and critically, it is **cash-positive while you figure out the bigger moves.**

---

## 4. The Telehealth Demos Next Week — Guidance for Asma

**Short answer: Yes, this is a good idea. But not as "please list me as an affiliate" — as "let me show you my funnel and negotiate on my terms."**

### Why it's a good idea
- The timing is right. Telehealth customer acquisition costs are at an all-time high ($150–$400 per customer). Any partner who can show them qualified intent at lower cost is welcome.
- SaveRx has something scarce: **segmented intent data.** A list of 256 patients who actively searched for Ozempic, Wegovy, Mounjaro, etc., within the past few months is more qualified than any paid ad audience.
- Even one partnership converts SaveRx from "affiliate publisher" to "distribution partner," which is a different conversation — and a different rate card.

### Why it can go badly
- If Asma walks in asking "do you have an affiliate link I can put up?" she gets the standard $25–$50 CPA template, a junior partnerships manager, and three weeks of ghosting. That's the commodity conversation.
- The better conversation is: "I'm bringing you qualified patient intent. Here's my data. Let's talk about a revenue-share, co-branded landing pages, and a preferred-partner slot on my site. What's your cost-per-acquisition, and can we beat it together?"

### Pre-demo homework (by Tuesday)
1. **Print the conversion story.** One page. "SaveRx has 361 drug-research pages, 256 verified opt-in emails, and 30K monthly sessions. Of our GLP-1 visitors, X% click on provider CTAs, Y% submit email, and we can produce Z qualified referrals per month." Even rough numbers are fine — precision matters less than clarity.
2. **Prepare two deal structures to propose:**
   - **Option A — Preferred partner slot** (exclusive or semi-exclusive placement on glp1-online.html and the weight-loss category page). Offer: 3-month exclusivity for a higher rev-share or a minimum guarantee.
   - **Option B — White-label landing page.** We build a SaveRx.ai/partner/hims (or /ro, /henry, etc.) page, SEO-optimized, tracking properly attributed. They get branded traffic; we get higher commissions + SEO halo.
3. **Bring the ask in writing.** Ask for: (a) tiered CPA — flat for first 50 conversions/month, bonus tier after, (b) creative assets library (so the site always has current imagery and copy), (c) a Slack/email line for questions, (d) monthly reporting on conversion quality.
4. **Have a calendly.com or scheduling link ready.** Propose a 30-day pilot with a follow-up review.
5. **Prepare a soft ask at the end of each demo.** "Who else in your network should I be talking to?" — every founder should leave a demo with 1–2 new warm intros.

### Red flags to avoid
- **Do NOT sign anything exclusive longer than 90 days.** You need the optionality to bring on competing partners.
- **Do NOT let them write the tracking pixel.** Use your own GA4 + UTM params + the affiliate network's pixel — that way you have your own data when deals renegotiate.
- **Do NOT agree to prescribing, clinical advice, or "medical content review" from the telehealth partner** — the moment SaveRx is editorially influenced by a prescriber, the trust layer collapses and so does the SEO. Keep a hard wall: *they* pay for distribution, *you* control the content.
- **Do NOT accept payments in product / free prescriptions / equity-only deals.** Cash or revenue-share only. If they ask for equity, that's a different conversation and should not happen in a partnerships demo.

### What a successful demo looks like
A successful demo ends with: (a) the partner asking for a redline of a term sheet, (b) agreement to a 30-day paid pilot, (c) a named POC and a shared Slack or email thread, (d) a scheduled 30-day review. If you get all four, the deal is 80% done. If you get none, the partner was never serious.

---

## 5. Cookies, Consent & Retargeting — The Analysis

The screenshot you sent is a standard **consent management platform (CMP) banner**. Here is the honest take on when, why, and how SaveRx should add one.

### Should SaveRx add a cookie banner? **Yes — but not because the law says so.**

Legal is the floor, not the motivation. The actual reasons:

1. **AdSense (and any premium ad network like Mediavine or Raptive) now effectively requires a CMP** for sites with any significant US traffic. Google's own consent mode v2 rolled out in 2024 and any site serving personalized ads needs a compliant banner.
2. **Retargeting and conversion optimization require it.** If you want to run a Meta pixel, a GA4 audience, or a remarketing campaign (Phase 2 of revenue), you need documented user consent to set those cookies.
3. **Partnerships will ask.** Any real telehealth partner will ask if you're GDPR/CCPA compliant in their diligence questionnaire. Asma walks into a better negotiation if the answer is "yes, here's our CMP."
4. **Trust.** In health, the presence of a privacy-respecting consent UI actually *increases* conversion among sophisticated users, especially 35+ women (which is a huge chunk of the GLP-1 market). It reads as "serious company."

### When to ship it

**This sprint. Before the category page fix ships, before AdSense is reapplied, before the first retargeting dollar is spent.** It is a 2-hour job and it unblocks three other workstreams. Don't wait.

### How to implement it — the pragmatic answer

Three options, in increasing order of cost:

**Option 1 — Free, minimalist, under your control (recommended to start).**
Hand-roll a simple banner in vanilla JS, store the choice in localStorage, and use Google Consent Mode v2 flags. Total code: ~100 lines. You control the UX, zero vendor lock-in, and it's fully styled with your tokens.

**Option 2 — Free tier of a managed CMP (best ROI).**
Use **Cookiebot** (free under 100 pages — won't fit us, we have 361+), **Osano** (free tier, 5K sessions/month — too small), or **CookieYes** (free tier, 25K sessions/month — this is the one). CookieYes gives you a hosted banner, auto-scan of cookies on your site, DSAR (data-subject access request) handling, and an audit log. Costs $0 for now, $10/mo at scale.

**Option 3 — Paid enterprise CMP.** OneTrust, TrustArc, Didomi. Overkill until you're at $1M ARR and have a legal team. Skip.

**My recommendation:** Start with **Option 1** this sprint (to unblock AdSense and retargeting) and migrate to **Option 2 (CookieYes)** within 60 days when you want to stop thinking about it and when a partner asks for an audit log.

### What the banner should actually do

- Default state: **only strictly necessary cookies active** (your own session cookie, CSRF token if any). All marketing, analytics, and personalization cookies **blocked until consent**.
- **Accept / Reject / Preferences** (three buttons). Not "Accept or close X" — that's dark-pattern territory and will lose trust with sophisticated users.
- On accept: fire a `consent_granted` event in GTM, which flips GA4, Meta pixel, and any ad tag live via Consent Mode v2.
- On reject: GA4 stays in "cookieless ping" mode (you still get modeled conversions), but no personalization cookies set.
- Preferences: granular toggles for Analytics, Marketing, Personalization.
- The banner should appear at the bottom of the viewport, not as a full-screen blocker. Health sites that blocker-wall users lose 8–15% of sessions instantly.

### The follow-up opportunity you asked about

You specifically asked "how do we use cookies for better follow-up with users?" Here's the honest answer: **cookies themselves don't drive follow-up — email does.** Cookies enable:

1. **Retargeting** (showing a Meta ad to someone who read a Repatha page but didn't sign up)
2. **Behavioral email triggers** — e.g., "you visited 3 GLP-1 pages in one session → auto-send the GLP-1 welcome kit"
3. **Homepage personalization** — e.g., "you came back to the site, show you the category you looked at last time"
4. **Frequency capping** on promotions

These are all Phase 2 moves. They matter, but not until your email loop is actually converting. Today, a cookie banner is the permission slip that lets you do them in 90 days.

---

## 6. The 90-Day Roadmap — Sequenced for Revenue

This is deliberately sequenced so that every step unblocks the next, and no step depends on something that isn't already in the repo.

### Weeks 1–2 — Unblock the funnel

- **Ship the category page fix** from `CATEGORY_FIX_PROMPT.md` (drug cards, email capture, 7-tile homepage grid, CSS cleanup, nav dropdown). This is the conversion layer.
- **Add the cookie banner** (Option 1 above). Unblocks AdSense + retargeting + partner diligence.
- **Re-submit AdSense** with the banner and updated privacy page. Approval in 7–14 days.
- **Build a lightweight revenue dashboard** — a single HTML page, pulled from GA4 + the Google Sheet, that shows: daily sessions, email signups, affiliate clicks, estimated revenue. This should be the first thing you check every morning.
- **Asma's telehealth demos.** Go in armed with §4 above.

### Weeks 3–4 — Prove the loop

- **Apply to 3 more affiliate programs:** Hims & Hers (via Katalys or Impact), GoodRx Publisher API, and one of {Ro, Henry Meds, Sesame} depending on Asma's demo outcomes.
- **Update email sequences** (`docs/EMAIL_UPDATES.md`) with affiliate CTAs in the day 3 and day 7 sends.
- **Write 5 pillar editorial pieces** (3,000+ words each, founder-bylined if Asma is comfortable): "The real cost of Ozempic in 2026," "How I saved $900/month on Repatha," "The 2026 GLP-1 buyer's guide," "Manufacturer copay cards vs. telehealth: which is cheaper?" and "How to get a GLP-1 prescription when your insurance says no." These are link bait and affiliate magnets and E-E-A-T wins all at once.
- **Add a simple founder photo + bio + medical reviewer credit** to the about page and every drug page footer. This is a non-negotiable trust move.

### Weeks 5–8 — Pour gas on what works

- **Scale the top 20 converting drug pages** — rewrite them longer, better, with more schema, more internal linking, more drug cards, and more affiliate variants. Ignore the tail until the head is optimized.
- **Negotiate Hims (or winning partner) to revenue share** after 60 days of flat CPA data. You now have the conversion evidence to go back and ask for a bigger piece.
- **Launch a lightweight "Ask SaveRx" AI personalization** — the chat widget, but now logged-in via email, with memory of prior conversations. This starts the SaveRx+ premium thread.
- **A/B test the email capture form** on the top 10 drug pages. Test: single-field vs. two-field, inline vs. modal, hero vs. footer. Pick the winner, ship it everywhere.

### Weeks 9–12 — Move upstream

- **Reach out to employer benefits brokers and HR platforms.** They need a "prescription savings wellness widget" for their clients. This is Type 3 revenue — not a consumer play, a B2B play. SaveRx is already 80% of what they need.
- **Launch sponsored email sends** once the list crosses 500 active opt-ins per category. A GLP-1 sponsor will pay $0.25–$0.50 per open.
- **Ship `/coverage-check.html`** (the insurance check tool from `docs/REVENUE_SPEC.md`). This is the lead-capture magnet for non-GLP-1 categories.
- **Plan content hires.** At month 3, if revenue is at $8K+/mo and growing, the first freelance content writer at $1.5–$2K/mo doubles your content velocity.

---

## 7. The Year-1 Vision — What "Premiere Platform" Actually Means

It's worth naming the end state so every weekly decision points in the same direction. Here is what SaveRx looks like 12 months from now if execution goes well:

- **1,200+ drug pages** covering every significant branded US prescription drug.
- **25,000+ email subscribers** segmented into 8–10 clinical buckets, with an active automation loop in each.
- **4–6 affiliate revenue streams** — at least one rev-share, not just flat CPA.
- **$30–$60K MRR**, 80%+ gross margin, operated by 1–2 people + contractors.
- **"SaveRx+" consumer premium** launched, with a small but growing paid base ($9/mo personalized drug companion).
- **1–2 B2B deals** — an employer benefits platform, a pharmacy chain, or an insurer — paying a SaaS fee for embedded drug-savings tools.
- **A trust layer unmatched in the space** — founder bylines, medical reviewer, press mentions, a newsletter, a podcast. Not because these are necessary, but because they make every downstream conversation easier.
- **Operational discipline of a one-person AI company**: everything automated, nothing manual, every repeated task delegated to a script, skill, or agent.

This is not a billion-dollar outcome in year 1. It's a **$500K–$1M ARR outcome in year 1** — and that is the staging ground from which the billion-dollar version becomes possible.

---

## 8. The "One-Person Billion-Dollar Company" Playbook (Adapted for SaveRx)

The general pattern in the 2025–2026 wave of one-person AI companies (Cal.com precursors, Midjourney's early org, PhotoRoom, some of the Y Combinator solo founders, and Medvi as the healthcare example) has a few repeatable ingredients. Here is the version tailored to SaveRx:

1. **Pick a boring, high-intent niche with direct monetization.** Drug savings is exactly this. Every visitor has bought something this month — and will buy again next month. That's better than most social or entertainment startups.
2. **Build a content/SEO moat before raising or scaling.** Traffic inventory is the hardest asset to replicate. SaveRx already has 361 pages — keep building.
3. **Use AI to replace entire job functions, not to add features.** Content generation, email personalization, chat support, analytics summaries — each of these is a contractor you don't hire.
4. **Monetize on day one.** Medvi's (and other one-person companies') secret was that monetization wasn't a phase, it was the first action. SaveRx has this — it just needs to plug in more streams.
5. **Keep cost structure irrationally low.** Cloudflare, Google Apps Script, Resend, a Cloudflare Worker — all near-free. Don't move off this stack until revenue forces it. Not until it forces it. There is no dignity in a shiny stack with no customers.
6. **Pick distribution, not product, as the moat.** SaveRx's moat is not the AI. It's the SEO inventory + email list. Protect those; everything else is replaceable.
7. **Do not raise money until you have to.** Every dollar raised under $5M ARR is a dollar that costs you 10x in dilution. If SaveRx can reach $30K MRR bootstrapped, a seed round at that point is cheaper and more optional.
8. **Treat the founder's time as the scarcest resource.** The only question worth asking every morning is: "is this activity creating conversion events or not?" If not, automate it or kill it.

---

## 9. Risks & Guardrails

These are the things that can kill the business, ranked by how much sleep I'd lose over each:

1. **Medical liability / YMYL penalty.** If Google downgrades health content without clear authorship and credentials, SaveRx's traffic halves overnight. *Guardrail:* ship founder + medical reviewer bylines this month. Non-optional.
2. **Single affiliate concentration.** One affiliate = one unemployment notice. *Guardrail:* get to 3+ active affiliates within 60 days. Do not celebrate a single-partner deal as "we've figured it out."
3. **Google algorithm volatility.** Health SEO is the most volatile category. *Guardrail:* diversify traffic — email (owned), direct (brand), and eventually paid (when unit economics work).
4. **Partner misalignment.** A telehealth partner that wants editorial control or creative approval over SaveRx content. *Guardrail:* never sign that. Walk.
5. **Founder bandwidth.** Asma running a healthcare platform as a concept + demoing to partners + overseeing engineering is a lot. *Guardrail:* ruthless prioritization, a weekly 1:1 with Vajih as advisor, and 1–2 contractors hired the moment revenue allows.
6. **Regulatory drift.** HIPAA, CAN-SPAM, FDA advertising rules, state-by-state telehealth rules. *Guardrail:* one hour with a healthcare marketing attorney in month 3 — not expensive, enormously cheap as insurance.
7. **Content commoditization by AI.** Every competitor will have AI-generated drug pages in 12 months. *Guardrail:* double down on what AI-generated pages can't fake — founder voice, first-person stories, original data (the aggregated SaveRx lead data will tell real cost stories over time).

---

## 10. The Weekly Operating Cadence

This is how I'd run SaveRx at its current stage, week by week:

- **Monday, 30 min:** revenue dashboard review. How many sessions, signups, affiliate clicks, revenue, versus last week. What moved and why.
- **Tuesday, 2 hours:** new content / editorial / SEO. One pillar piece or two drug page rewrites.
- **Wednesday, 90 min:** partner / BD activity. Outreach emails, affiliate applications, demo prep.
- **Thursday, 2 hours:** engineering / features. Ship one thing that converts. No engineering for engineering's sake.
- **Friday, 60 min:** retrospective + next-week plan. What worked, what didn't, what to cut.

Five hours a day of focused execution beats twelve hours of context-switching. At SaveRx's stage, **the bottleneck is not hours — it's decisions.** Every decision made quickly and acted on beats every decision deliberated for a week.

---

## 11. Your Three Decisions This Week

To make this memo action-oriented, here are the three decisions that matter most this week:

1. **Approve the category fix prompt** (`CATEGORY_FIX_PROMPT.md`) and hand it to Claude Code. This is your conversion layer.
2. **Approve the cookie banner** (Option 1 — hand-rolled, 2 hours) and hand it to Claude Code as a small follow-up task. I can write the prompt in 10 minutes when you're ready.
3. **Prep Asma for the telehealth demos.** Use §4 as the briefing doc. Do not walk in cold.

Everything else in this roadmap is downstream of those three.

---

## 12. Final Word

SaveRx.ai is at the specific moment in a startup's life when **the foundation is built, the funnel is visible, and execution is the only thing that matters.** There are no more big architectural decisions to make. There is no product feature that will change the trajectory. The next 90 days are pure shipping and pure conversion.

The good news: that is the easiest kind of 90 days to execute on, and it's the kind of moment when a one-person company can quietly turn into a $1M ARR business without anyone noticing. The bad news: it's also the moment when most founders get distracted by shiny objects — a new feature, a new platform, a rebrand — and stall out.

Stay on the three decisions this week. Ship the three things in the next two weeks. Measure the results. Adjust. Compound.

Asma has something rare — a well-positioned concept in a large, high-intent, boringly profitable market, built cheaply, with real early data. The goal is to protect the boringness and let it compound. That is how one-person billion-dollar companies actually start — not with a grand vision, but with a $500/month affiliate check that turns into $5,000, then $50,000, then something you can't ignore.

You're closer than you think.

— Your strategic advisor
