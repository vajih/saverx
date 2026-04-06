# SaveRx.ai — Revenue Features Technical Specification
> Read this file alongside `ROADMAP.md` before building any revenue feature.
> This document gives Claude Code the exact technical context needed to implement each initiative.

---

## Site Architecture (Current State)

```
saverx.ai/
├── index.html                  ← Homepage
├── drugs/
│   ├── ozempic.html            ← Drug page (×358 total)
│   ├── wegovy.html
│   └── ...
├── saverx-chat-proxy/          ← Cloudflare Worker (AI chat)
│   └── src/index.js
├── scripts/
│   ├── mailerlite-setup.js
│   ├── mailerlite-import.js
│   └── Code.gs                 ← Google Apps Script backend
├── docs/                       ← Spec files (this folder)
├── admin-server.js             ← Local admin dashboard
└── admin.html
```

**Hosting:** Cloudflare Pages + Workers
**Analytics:** GTM (GTM-MVZBBF7R) + GA4
**Email:** MailerLite (new API, JWT token in .env)
**Backend:** Google Apps Script web app (doPost for email capture)
**Chat:** Cloudflare Worker proxying AI API

Drug pages are static HTML files. Each drug page has:
- Drug name, description, pricing table
- Email capture form (submits to Google Apps Script)
- AI chat widget (connects to Cloudflare Worker)

---

## Feature 1: GLP-1 Affiliate CTA Component

### Goal
Add a revenue-generating CTA section to each GLP-1 drug page that links to telehealth affiliate partners.

### Target pages (8 files)
```
drugs/ozempic.html
drugs/wegovy.html
drugs/mounjaro.html
drugs/zepbound.html
drugs/saxenda.html
drugs/victoza.html
drugs/rybelsus.html
drugs/trulicity.html
```

### HTML component to add
Insert this block into each target drug page, after the pricing/savings section and before the email capture form:

```html
<!-- AFFILIATE CTA: GLP-1 Online Access -->
<section class="affiliate-cta" id="glp1-online-access">
  <div class="affiliate-cta-header">
    <h2>Get {DRUG_NAME} Online — Without Insurance</h2>
    <p>Telehealth providers can prescribe GLP-1 medications online, often at a fraction of the retail price.</p>
  </div>
  <div class="affiliate-cards">
    <a class="affiliate-card" href="HIMS_AFFILIATE_URL" target="_blank" rel="noopener"
       data-provider="hims" data-drug="{DRUG_SLUG}" onclick="trackAffiliateClick('hims', '{DRUG_SLUG}')">
      <div class="affiliate-card-name">Hims & Hers</div>
      <div class="affiliate-card-price">From $199/month</div>
      <div class="affiliate-card-note">No insurance needed</div>
      <div class="affiliate-card-cta">Get Started →</div>
    </a>
    <a class="affiliate-card" href="RO_AFFILIATE_URL" target="_blank" rel="noopener"
       data-provider="ro" data-drug="{DRUG_SLUG}" onclick="trackAffiliateClick('ro', '{DRUG_SLUG}')">
      <div class="affiliate-card-name">Ro Body</div>
      <div class="affiliate-card-price">From $145/month</div>
      <div class="affiliate-card-note">Includes provider consultation</div>
      <div class="affiliate-card-cta">Get Started →</div>
    </a>
    <a class="affiliate-card" href="CALIBRATE_AFFILIATE_URL" target="_blank" rel="noopener"
       data-provider="calibrate" data-drug="{DRUG_SLUG}" onclick="trackAffiliateClick('calibrate', '{DRUG_SLUG}')">
      <div class="affiliate-card-name">Calibrate</div>
      <div class="affiliate-card-price">From $249/month</div>
      <div class="affiliate-card-note">Metabolic health program</div>
      <div class="affiliate-card-cta">Get Started →</div>
    </a>
  </div>
  <p class="affiliate-disclosure">
    SaveRx may earn a commission if you purchase through these links.
    Prices are estimates — verify on provider's website.
  </p>
</section>
```

### GA4 tracking function to add to each page
```javascript
function trackAffiliateClick(provider, drug) {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'affiliate_click', {
      'event_category': 'revenue',
      'event_label': provider,
      'drug': drug,
      'provider': provider
    });
  }
}
```

### CSS to add to stylesheet or `<style>` block
```css
.affiliate-cta {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
}
.affiliate-cta-header h2 { font-size: 1.4rem; color: #14532d; margin-bottom: 0.5rem; }
.affiliate-cta-header p { color: #166534; margin-bottom: 1.5rem; }
.affiliate-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.affiliate-card {
  background: white;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.affiliate-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.affiliate-card-name { font-weight: 700; font-size: 1rem; color: #14532d; }
.affiliate-card-price { font-size: 1.1rem; font-weight: 600; color: #16a34a; }
.affiliate-card-note { font-size: 0.8rem; color: #6b7280; }
.affiliate-card-cta { margin-top: 0.75rem; font-size: 0.9rem; font-weight: 600; color: #15803d; }
.affiliate-disclosure { font-size: 0.75rem; color: #9ca3af; margin-top: 1rem; }
```

### Affiliate URL placeholders
Replace these once affiliate accounts are approved:
```
HIMS_AFFILIATE_URL     → https://www.hims.com/weight-loss?utm_source=saverx&utm_medium=referral
RO_AFFILIATE_URL       → https://ro.co/weight-loss?utm_source=saverx&utm_medium=referral
CALIBRATE_AFFILIATE_URL → https://joincalibrate.com?utm_source=saverx&utm_medium=referral
```

---

## Feature 2: GLP-1 Telehealth Comparison Page

### Goal
Build `drugs/glp1-online.html` — a standalone comparison page targeting high-volume SEO keywords.

### File to create
`drugs/glp1-online.html`

### Page sections (in order)

**1. `<head>`**
```html
<title>Compare GLP-1 Online Providers 2026 — Cheapest Ozempic & Semaglutide Options</title>
<meta name="description" content="Compare the best online GLP-1 providers. Find the cheapest way to get Ozempic, Wegovy, Mounjaro, or semaglutide prescribed online without insurance.">
```

**2. Hero section**
- H1: "Get a GLP-1 Prescription Online — Compare Providers & Prices"
- Subheading: "250,000+ Americans have switched to online GLP-1 programs. Compare pricing, drugs offered, and turnaround time."
- Trust badges: "No insurance required" · "Licensed providers" · "Ships to your door"

**3. Comparison table**
Build a responsive HTML table with these columns and data:

| Provider | Monthly Cost | Drugs Available | Insurance | Turnaround | Rating | CTA |
|----------|-------------|-----------------|-----------|-----------|--------|-----|
| Hims & Hers | $199–$449 | Semaglutide, Tirzepatide | Not required | 2–3 days | ★★★★☆ | [Affiliate link] |
| Ro Body | $145–$299 | Semaglutide | Not required | 3–5 days | ★★★★☆ | [Affiliate link] |
| Calibrate | $249/mo | GLP-1 (varies) | Optional | 5–7 days | ★★★★☆ | [Affiliate link] |
| Noom Med | $149–$249 | Semaglutide | Not required | 2–4 days | ★★★★☆ | [Affiliate link] |
| Found | $99–$199 | Multiple | Optional | 3–5 days | ★★★☆☆ | [Affiliate link] |

**4. Provider deep-dives (accordion)**
One section per provider with: what's included, who qualifies, pros/cons, affiliate CTA.

**5. FAQ section (SEO content — include all of these questions)**
```
Q: Is it legal to get GLP-1 drugs online?
Q: What's the difference between branded and compounded semaglutide?
Q: Do I need insurance to get Ozempic online?
Q: How much does it cost to get Wegovy online without insurance?
Q: What GLP-1 drugs can I get online?
Q: How long does it take to get a GLP-1 prescription online?
Q: Is compounded semaglutide safe?
```

**6. Email capture**
- Heading: "Get price drop alerts for GLP-1 online programs"
- Form fields: email, drug interest dropdown
- Submits to existing Google Apps Script endpoint

**7. Internal links**
Add links to individual drug pages: "Learn more about Ozempic →", "Compare Wegovy prices →" etc.

### SEO implementation notes
- Add structured data (FAQPage schema) for the FAQ section
- Add BreadcrumbList schema
- Internal link from homepage and each GLP-1 drug page to this comparison page
- Add this page to sitemap.xml

---

## Feature 3: Email Sequence Affiliate CTAs

### Goal
Update MailerLite email sequences to include affiliate CTAs in emails 2 and 3 of the GLP-1 sequence.

### Changes to make in MailerLite dashboard

**GLP-1 Email 2 (currently: savings tips) → add at bottom:**
```
---
💊 Can't afford {$drug|default:"your GLP-1"}?

Many patients are switching to online telehealth programs that prescribe
GLP-1 medications for $145–$299/month — no insurance required.

→ Compare online GLP-1 providers
[BUTTON: See Pricing Options]  ← affiliate link

*SaveRx may earn a small commission if you sign up.*
```

**GLP-1 Email 3 (Day 7) → make this the main CTA:**
```
Subject: The cheapest way to get {$drug|default:"Ozempic"} right now

Hi,

Here's what I've found comparing the most affordable ways to access {$drug}:

Option 1: GoodRx coupon at your local pharmacy
→ Saves up to 80% off retail price
→ [Check your price at GoodRx]

Option 2: Online telehealth program (no insurance needed)
→ Hims & Hers: from $199/month
→ Ro: from $145/month
→ [Compare all options]

Option 3: Manufacturer savings program
→ Novo Nordisk (Ozempic/Wegovy) patient assistance
→ Eli Lilly (Mounjaro/Zepbound) savings card
→ [See if you qualify]

Which option fits your situation best? Reply and let me know — I read every email.

— The SaveRx Team
```

### UTM parameters for all email affiliate links
```
?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email3
```

---

## Feature 4: AI Chat Upgrade (Revenue-Aware)

### File to modify
`saverx-chat-proxy/src/index.js`

### Current behavior
Chat proxies user messages to AI API and returns plain text responses.

### Target behavior
Detect high-intent queries → append structured affiliate recommendation block.

### Intent detection keywords
```javascript
const GLP1_INTENT_KEYWORDS = [
  'get prescription', 'get ozempic', 'get wegovy', 'get mounjaro',
  'can i get', 'how do i get', 'where can i get',
  'qualify for', 'do i qualify',
  'online prescription', 'telehealth',
  'without insurance', 'no insurance',
  'cheaper alternative', 'affordable',
  'compounded semaglutide', 'compounded tirzepatide'
];

function detectGLP1Intent(message) {
  const lower = message.toLowerCase();
  return GLP1_INTENT_KEYWORDS.some(kw => lower.includes(kw));
}
```

### System prompt addition
Add this to the existing system prompt in the Worker:
```
You are a helpful drug savings assistant for SaveRx.ai.

When a user asks how to ACCESS or AFFORD a GLP-1 medication (Ozempic, Wegovy,
Mounjaro, Zepbound, Saxenda, Rybelsus, Trulicity, semaglutide, tirzepatide),
after giving your informational answer, append this exact block:

---
**Get a GLP-1 prescription online:**
Compare providers who offer online prescriptions without insurance:
- Visit SaveRx's [GLP-1 Provider Comparison](/drugs/glp1-online.html) page
---

Keep your answer helpful and factual. Never claim to prescribe medications.
Always recommend consulting a doctor for medical decisions.
```

### Worker modification pattern
```javascript
// After getting AI response, check if we should append affiliate block
if (detectGLP1Intent(userMessage) && !response.includes('glp1-online')) {
  response += '\n\n---\n**Looking for an online provider?**\nSaveRx has a [GLP-1 provider comparison](/drugs/glp1-online.html) with current pricing from major telehealth services.\n---';
}
```

---

## Feature 5: Insurance Coverage Check Tool

### Goal
Build `/coverage-check.html` — an interactive tool where users enter their drug + insurance plan and see coverage status + next steps.

### File to create
`coverage-check.html`

### Data structure
Create `data/coverage-data.json`:
```json
{
  "drugs": {
    "ozempic": {
      "name": "Ozempic (semaglutide)",
      "coverage": {
        "medicare_part_d": {
          "status": "covered",
          "condition": "Type 2 diabetes only",
          "typical_copay": "$45–$100/month",
          "notes": "Not covered for weight loss under most Medicare plans"
        },
        "blue_cross_blue_shield": {
          "status": "conditional",
          "condition": "Type 2 diabetes diagnosis required",
          "typical_copay": "$30–$60/month",
          "notes": "Prior authorization often required"
        },
        "uninsured": {
          "status": "expensive",
          "retail_price": "$969/month",
          "goodrx_price": "$850/month",
          "telehealth_option": true,
          "telehealth_price": "$199–$449/month (compounded)"
        }
      }
    }
  }
}
```

### Tool flow (JavaScript)
```
User selects drug → User selects insurance plan
→ Look up coverage-data.json
→ Show coverage status (covered / conditional / not covered)
→ If covered: show copay estimate + GoodRx comparison
→ If not covered: show telehealth alternative with affiliate CTA
→ Both paths: email capture ("Get notified if coverage changes")
```

### Conversion paths
- **Covered**: "Compare what you'd pay with GoodRx vs your copay" → GoodRx widget
- **Conditional**: "Check if you qualify" → affiliate telehealth link
- **Not covered**: "Get it online for $X/month" → affiliate telehealth link (highest conversion)

---

## Shared Implementation Notes

### Affiliate link management
Store all affiliate URLs in a single file: `data/affiliates.json`
```json
{
  "hims": {
    "name": "Hims & Hers",
    "glp1_url": "https://www.hims.com/weight-loss?utm_source=saverx",
    "logo": "/assets/logos/hims.png",
    "monthly_from": 199,
    "commission": "$30–$50 per signup"
  },
  "ro": {
    "name": "Ro Body",
    "glp1_url": "https://ro.co/weight-loss?utm_source=saverx",
    "logo": "/assets/logos/ro.png",
    "monthly_from": 145,
    "commission": "$30–$50 per signup"
  }
}
```

### GTM event taxonomy
All affiliate events should follow this pattern:
```javascript
gtag('event', 'affiliate_click', {
  'event_category': 'revenue',
  'event_label': '{provider}_{drug}_{location}',
  // location = 'drug_page' | 'comparison_page' | 'email' | 'chat' | 'coverage_tool'
  'value': 1
});
```

### Legal compliance
Every page with affiliate links must include:
```html
<p class="affiliate-disclosure">
  SaveRx.ai participates in affiliate programs. We may earn a commission when
  you click links to partner sites. This does not affect our editorial independence
  or the prices you pay. We only recommend services we have researched.
</p>
```

Every page mentioning drug dosing or clinical information must include:
```html
<p class="medical-disclaimer">
  SaveRx.ai provides drug pricing information only. This is not medical advice.
  Always consult a licensed healthcare provider before starting or changing medication.
</p>
```

---

## Dependencies & Environment

No new npm packages required for Phases 1–3 (pure HTML/CSS/JS).

Phase 4 (Worker upgrade): modify existing Cloudflare Worker — deploy with `wrangler deploy`.

Phase 5 (coverage tool): requires creating `data/coverage-data.json` (static file, no backend needed).

### Environment variables needed (add to `.env` and Cloudflare Workers secrets)
```
MAILERLITE_API_KEY=         # Already set
MAILERLITE_GROUP_GLP1=      # Already set
MAILERLITE_GROUP_CARDIO=    # Already set
MAILERLITE_GROUP_DIABETES=  # Already set
MAILERLITE_GROUP_GENERAL=   # Already set
MAILERLITE_GROUP_ALL=       # Already set
HIMS_AFFILIATE_ID=          # After approval
RO_AFFILIATE_ID=            # After approval
CALIBRATE_AFFILIATE_ID=     # After approval
GOODRX_PUBLISHER_KEY=       # After approval
```
