# Claude Code — SaveRx Revenue Build Prompt

> Copy the prompt below and paste it into Claude Code (in VSCode or terminal).
> Run it from the root of the `saverx/` directory.
> Claude Code will read the spec files and implement each feature step by step.

---

## How to Use This File

1. Open VSCode with the `saverx/` folder open
2. Open Claude Code (Ctrl+Shift+P → "Claude Code" or via terminal: `claude`)
3. Copy the prompt under **PROMPT TO USE** and paste it in
4. Claude Code will read the spec files first, then implement

---

## PROMPT TO USE

```
You are helping me build revenue features for SaveRx.ai, a drug price comparison
website with 358 static HTML drug pages, a Google Apps Script backend, and a
Cloudflare Worker AI chat proxy.

Before writing any code, read these files in this order:
1. ROADMAP.md — the strategic context and master to-do list
2. docs/REVENUE_SPEC.md — the technical specification for all 5 revenue features
3. docs/EMAIL_SEQUENCES.md — the email copy and sequences

Then implement the following features in priority order. After each feature,
confirm it is complete before moving to the next.

---

FEATURE 1: GLP-1 Affiliate CTA Component (Priority: Immediate)

Add the affiliate CTA section from docs/REVENUE_SPEC.md (Feature 1) to these
drug pages:
- drugs/ozempic.html
- drugs/wegovy.html
- drugs/mounjaro.html
- drugs/zepbound.html
- drugs/saxenda.html
- drugs/victoza.html
- drugs/rybelsus.html
- drugs/trulicity.html

Rules:
- Insert the CTA block AFTER the savings/pricing section and BEFORE the email
  capture form on each page
- Replace {DRUG_NAME} with the actual drug name on each page
- Replace {DRUG_SLUG} with the lowercase drug name (e.g., "ozempic")
- Add the trackAffiliateClick() function to each page's script block
- Use placeholder affiliate URLs from REVENUE_SPEC.md for now (marked with
  HIMS_AFFILIATE_URL etc.) — I will replace these once affiliate accounts are approved
- Add the CSS styles once to a shared stylesheet if one exists, otherwise add
  inline to each page
- Do NOT break any existing functionality

FEATURE 2: GLP-1 Telehealth Comparison Page (Priority: High)

Create drugs/glp1-online.html following the spec in docs/REVENUE_SPEC.md Feature 2.

Rules:
- Match the visual style of existing drug pages (use same header, footer, CSS)
- Include all 7 FAQ questions from the spec with detailed answers (~150 words each)
- Add FAQPage structured data (JSON-LD) for SEO
- Add BreadcrumbList structured data
- Include internal links to all 8 GLP-1 drug pages
- Include the email capture form pointing to the same Google Apps Script endpoint
  used on other drug pages
- Add affiliate disclosure and medical disclaimer from REVENUE_SPEC.md

FEATURE 3: Email Sequence CTA Updates (Priority: High)

Update the follow-up email templates in the `emails/` folder to include affiliate CTAs:
- Create docs/EMAIL_UPDATES.md with the exact updated copy for:
  - GLP-1 Email 2 addition (the bottom append block)
  - GLP-1 Email 3 full rewrite
  - General Email 2 addition
- Include the correct UTM parameters from the spec
- Format it clearly for editing the HTML files in `emails/` directly

FEATURE 4: AI Chat Upgrade (Priority: Medium)

Modify saverx-chat-proxy/src/index.js to:
- Add the detectGLP1Intent() function from docs/REVENUE_SPEC.md
- Update the system prompt with the addition from the spec
- Append the affiliate recommendation block when GLP-1 intent is detected
- Preserve all existing chat functionality

Rules:
- Do not change the API endpoint, authentication, or response format
- Test that non-GLP-1 questions are unaffected
- Add a comment block explaining the intent detection logic

FEATURE 5: Affiliate Data File (Priority: Medium)

Create data/affiliates.json using the structure from docs/REVENUE_SPEC.md.
Fill in all fields with realistic placeholder values.
Add a comment at the top of the file: "// Update URLs with real affiliate links after approval"

---

DEFINITION OF DONE:

For each feature, confirm:
□ Code is syntactically valid
□ No existing functionality is broken
□ Affiliate disclosure text is included where required
□ Medical disclaimer text is included where required
□ GA4 tracking function is present on pages with affiliate links
□ All affiliate URLs are clearly marked as placeholders needing replacement

After all features are complete:
□ Create a SETUP_GUIDE.md in the root with step-by-step instructions for:
  1. How to apply for each affiliate program
  2. Where to replace affiliate URL placeholders once approved
  3. How to deploy the Worker changes with wrangler
  4. How to verify the changes are live
```

---

## Feature-by-Feature Prompts (Use These for Single Features)

If you want to build one feature at a time, use these individual prompts:

### Feature 1 Only — Affiliate CTAs

```
Read ROADMAP.md and docs/REVENUE_SPEC.md.
Implement Feature 1 (GLP-1 Affiliate CTA Component) only.
Add the affiliate CTA section to all 8 GLP-1 drug pages listed in the spec.
Use placeholder affiliate URLs. Include trackAffiliateClick() and CSS.
Confirm each file when done.
```

### Feature 2 Only — Comparison Page

```
Read ROADMAP.md and docs/REVENUE_SPEC.md.
Create drugs/glp1-online.html per Feature 2 spec.
Match existing site styling. Include all FAQs with full answers, structured data,
email capture, affiliate cards, internal links, and legal disclosures.
```

### Feature 4 Only — Chat Upgrade

```
Read docs/REVENUE_SPEC.md Feature 4.
Modify saverx-chat-proxy/src/index.js to add GLP-1 intent detection and
append the affiliate recommendation block. Preserve all existing functionality.
```

---

## Prompt Optimization Tips

When using Claude Code, these techniques get better results:

**Be specific about file paths.** Claude Code works best when you name exact files. Vague instructions like "update the drug pages" produce worse results than "update drugs/ozempic.html".

**Ask for confirmation after each file.** Add "Confirm when ozempic.html is complete before moving to wegovy.html" to prevent Claude from batching changes incorrectly.

**Request a diff before applying.** For large changes, say "Show me the diff for ozempic.html before making any changes" to review first.

**Run in sequence, not parallel.** The features build on each other. Feature 2 (comparison page) should reference the affiliate component from Feature 1.

**Ask Claude Code to verify.** End with "After all changes, list every file you modified and what you changed in each."

---

## After the Build: Deployment Steps

Once Claude Code has implemented the features:

### 1. Test locally

```bash
# Serve the site locally to check all pages
npx serve . -p 8080
# Open http://localhost:8080/drugs/ozempic.html
# Open http://localhost:8080/drugs/glp1-online.html
# Open http://localhost:8080/coverage-check.html
```

### 2. Deploy drug pages to Cloudflare

```bash
wrangler pages deploy . --project-name saverx
```

### 3. Deploy Worker changes

```bash
cd saverx-chat-proxy
wrangler deploy
```

### 4. Verify live

- Check saverx.ai/drugs/ozempic.html for affiliate CTA
- Check saverx.ai/drugs/glp1-online.html for comparison page
- Test chat on any drug page with "how do I get Ozempic online?"

### 5. Set up affiliate tracking in GA4

- Go to GA4 → Configure → Events → Mark `affiliate_click` as a conversion
- Create a GA4 audience: "Clicked affiliate link" for retargeting

---

## Reference: Current Google Apps Script Endpoint

The email capture form on all drug pages submits to:

```
https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec
```

POST body: `{ email, drug, source }`

The current `scripts/Code.gs` is deployed to this endpoint. Do not change the deployment URL.
