# SaveRx.ai — Revenue Features Setup Guide

> Use this guide after all revenue features have been implemented.
> Follow each section in order to go live with affiliate revenue.

---

## Prerequisites

- Node.js 18+ (`node --version`)
- Wrangler CLI installed and authenticated (`wrangler whoami`)
- Access to the SaveRx Google Apps Script project at [script.google.com](https://script.google.com)
- This repository cloned and all changes committed

---

## Part 1: Apply for Affiliate Programs

All 5 affiliate providers are pre-configured in `data/affiliates.json`. Apply for each program below, then replace the placeholder URLs per Part 2.

### 1. Hims & Hers

- **Program page:** [partners.hims.com](https://partners.hims.com) (or search "Hims affiliate program Impact")
- **Network:** Impact Radius
- **Commission:** CPA (per conversion) — exact rate disclosed after approval
- **Approval time:** 1–5 business days
- **What to say:** "SaveRx.ai is a drug savings information site with ~40K monthly visitors researching GLP-1 medications. We publish educational content and refer patients to telehealth providers."
- **After approval:** Copy your tracking URL from Impact Radius dashboard

### 2. Ro Body

- **Program page:** [ro.co](https://ro.co) — look for "Partners" or apply via ShareASale
- **Network:** ShareASale or direct
- **Commission:** CPA — typically $50–$150/conversion
- **Approval time:** 3–7 business days
- **After approval:** Copy your affiliate tracking link from the network dashboard

### 3. Calibrate

- **Program page:** [joincalibrate.com](https://joincalibrate.com) — apply via their partner page or email partnerships@joincalibrate.com
- **Network:** Direct or Impact
- **After approval:** Copy your tracking URL

### 4. Noom Med

- **Program page:** [noom.com/affiliate](https://www.noom.com/affiliate)
- **Network:** CJ Affiliate (Commission Junction)
- **After approval:** Copy your tracking URL from CJ dashboard

### 5. Found

- **Program page:** [joinfound.com](https://www.joinfound.com) — look for affiliate/partner link in footer or email hello@joinfound.com
- **Network:** Direct or ShareASale
- **After approval:** Copy your tracking URL

---

## Part 2: Replace Affiliate URL Placeholders

Once each affiliate program approves you and provides a tracking URL, update these files:

### 2a. Update `data/affiliates.json`

Open `data/affiliates.json` and replace the `glp1_url` value for each provider with your real affiliate tracking URL. Keep the `utm_source=saverx&utm_medium=referral` parameters OR use whatever UTM params the affiliate network requires.

```json
{
  "id": "hims",
  "glp1_url": "https://go.impact.com/your-real-affiliate-link-here"
}
```

### 2b. Update drug page affiliate CTAs

The affiliate CTA blocks on all 7 GLP-1 drug pages reference URLs directly in HTML. Run a find-replace across these files:

- `drugs/ozempic/index.html`
- `drugs/wegovy/index.html`
- `drugs/mounjaro/index.html`
- `drugs/zepbound/index.html`
- `drugs/saxenda/index.html`
- `drugs/rybelsus/index.html`
- `drugs/trulicity/index.html`

Search for the placeholder URL patterns (e.g., `utm_source=saverx&utm_medium=referral` on the hims.com domain) and replace with your real affiliate tracking URL.

### 2c. Update the comparison page

Open `drugs/glp1-online.html` and replace the same placeholder URLs in the affiliate card `<a href>` links for all 5 providers.

### 2d. Update email templates

The email CTA blocks in `docs/EMAIL_UPDATES.md` have placeholder URLs that need to be applied to the email HTML files in `emails/`. Update:

- `emails/glp1-email-2.html` — append the affiliate CTA block from `docs/EMAIL_UPDATES.md` (GLP-1 Email 2 section), replacing placeholder URLs
- `emails/glp1-email-3.html` — replace with the full rewrite from `docs/EMAIL_UPDATES.md` (GLP-1 Email 3 section), replacing placeholder URLs

---

## Part 3: Deploy Worker Changes

The AI chat proxy (`saverx-chat-proxy/src/index.js`) has been updated with GLP-1 intent detection. Deploy it:

```bash
cd saverx-chat-proxy
wrangler deploy
```

Expected output:

```
✨ Successfully published your Worker to saverx-chat-proxy.workers.dev
```

**Verify the Worker is live:**

```bash
curl -s -X POST https://saverx-chat-proxy.YOUR-SUBDOMAIN.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How can I get Ozempic online without insurance?"}]}' \
  | jq .
```

The response should include affiliate provider recommendations.

---

## Part 4: Deploy Drug Pages to Cloudflare Pages

```bash
# From the root of the repo
wrangler pages deploy . --project-name saverx
```

This deploys all static files including:

- Updated GLP-1 drug pages with affiliate CTAs
- New `drugs/glp1-online.html` comparison page
- Updated `sitemap.xml`

---

## Part 5: Fix the Google Apps Script Endpoint

The email capture endpoint needs to be redeployed from the Apps Script editor.

### Why this is needed

The current deployment URL (`AKfycbxC1tTVJ...`) is returning a 404. A new Web App deployment is required.

### Steps

1. Open [script.google.com](https://script.google.com) and find the SaveRx project
2. If the editor is empty, paste in the full contents of `scripts/Code.gs`
3. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → copy the new `/exec` URL
5. Run the bulk URL update script:

```bash
# Edit scripts/_fix-api-urls.mjs — set NEW_URL to the new deployment URL
# Then run:
node scripts/_fix-api-urls.mjs
```

This script updates `window.SAVERX_API` across all drug pages automatically.

6. Redeploy to Cloudflare Pages (Part 4 above)

### Install the hourly trigger

In the Apps Script editor, run the `createHourlyTrigger()` function once to install the follow-up email processor:

1. Click the function dropdown (top of editor) → select `createHourlyTrigger`
2. Click **Run**
3. Authorize the script when prompted
4. Go to **Triggers** (clock icon in sidebar) to confirm the hourly trigger was created

---

## Part 6: Verify Everything is Live

### Checklist

**Affiliate CTAs:**

- [ ] Open [saverx.ai/drugs/ozempic/](https://saverx.ai/drugs/ozempic/) — affiliate card section should appear below the pricing table
- [ ] Click an affiliate card — confirm the link goes to the expected affiliate page
- [ ] Open GA4 → Realtime → Events — confirm `affiliate_click` fires when clicking a card

**Comparison page:**

- [ ] Open [saverx.ai/drugs/glp1-online.html](https://saverx.ai/drugs/glp1-online.html) — page should load
- [ ] All 5 provider cards visible; FAQ section expands

**Email capture:**

- [ ] Submit the form on any drug page with a real email you control
- [ ] Confirm the row appears in the Google Sheet within ~30 seconds
- [ ] Confirm the welcome email arrives within a few minutes

**AI chat:**

- [ ] Open any drug page and ask the chat widget: "How do I get Ozempic online without insurance?"
- [ ] Response should include telehealth provider recommendations

**Sitemap:**

- [ ] Confirm [saverx.ai/sitemap.xml](https://saverx.ai/sitemap.xml) contains the `glp1-online.html` entry

---

## Part 7: Set Up GA4 Affiliate Conversion Tracking

1. Go to **GA4 → Configure → Events**
2. Find the `affiliate_click` event
3. Click the toggle to **Mark as conversion**

Create a GA4 audience for retargeting:

1. Go to **GA4 → Audiences → New audience**
2. Name: `Clicked affiliate link`
3. Condition: Event = `affiliate_click`
4. Save

---

## Ongoing: Apply for Additional Monetization

Per the roadmap, also apply for:

- **Google AdSense** — [adsense.google.com](https://adsense.google.com) — display ads on all pages
- **GoodRx Publisher API** — email publishers@goodrx.com — embed live drug prices
- **Amazon Associates** — for any medical device/supply links (optional)

---

## Reference: Key Files

| File                                    | What to Update                |
| --------------------------------------- | ----------------------------- |
| `data/affiliates.json`                  | Affiliate URLs once approved  |
| `drugs/glp1-online.html`                | Affiliate card hrefs          |
| `drugs/ozempic/index.html` (+ 6 others) | Affiliate CTA hrefs           |
| `emails/glp1-email-2.html`              | Append affiliate CTA block    |
| `emails/glp1-email-3.html`              | Apply full rewrite with CTAs  |
| `saverx-chat-proxy/src/index.js`        | Already updated — deploy only |
| `scripts/Code.gs`                       | Redeploy as new Web App       |
