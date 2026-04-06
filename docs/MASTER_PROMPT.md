# SaveRx.ai — Master Claude Code Prompt
> This is the single, consolidated prompt to use in Claude Code.
> It covers all build phases: MailerLite completion + all 5 revenue features.
> Paste the prompt under "FULL PROMPT" into Claude Code from the saverx/ root directory.

---

## Before You Start

Open VSCode with the `saverx/` folder as the root. Claude Code will automatically
read `CLAUDE.md` for project context. You do not need to explain the project —
just paste the prompt below.

**Run Claude Code from terminal:**
```bash
cd ~/Development/saverx
claude
```

---

## FULL PROMPT

```
Read CLAUDE.md first for full project context. Then read the files listed under
"Read before building" for each phase below. Implement each phase in order,
confirming completion before proceeding to the next.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 0 — COMPLETE MAILERLITE FOUNDATION (do this first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/MAILERLITE_SPEC.md, docs/SETUP_GUIDE.md, scripts/Code.gs

Status check — before writing any code, confirm the following by reading the
files listed above:

1. Does scripts/Code.gs have addToMailerLite() and getDrugCategory() functions?
2. Does the MAILERLITE_GROUPS constant have real group IDs (not empty strings)?
   - Check .env for MAILERLITE_GROUP_GLP1 etc. and verify they match Code.gs
3. Does data/saverx-leads-deduped.csv exist?

If Code.gs has empty group IDs, update MAILERLITE_GROUPS using the IDs from .env.

Then verify scripts/mailerlite-import.js is ready to run by checking:
- It reads from data/saverx-leads-deduped.csv (the deduped file)
- It handles the CSV columns: Timestamp, Email, Drug, Source, UserAgent
- Dry-run command is: node scripts/mailerlite-import.js --csv data/saverx-leads-deduped.csv --dry-run

Report what you found and what (if anything) needed fixing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — GLP-1 AFFILIATE CTA CARDS  [Highest revenue priority]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/REVENUE_SPEC.md (Feature 1 section), assets/css/components.css, assets/css/tokens.css

Task: Add the affiliate CTA section to each of these 8 drug pages:
- drugs/ozempic.html
- drugs/wegovy.html
- drugs/mounjaro.html
- drugs/zepbound.html
- drugs/saxenda.html
- drugs/victoza.html
- drugs/rybelsus.html
- drugs/trulicity.html

Rules:
- First READ one drug page (e.g. drugs/ozempic.html) to understand the existing
  structure before modifying any files
- Insert the CTA block AFTER the savings/pricing section, BEFORE the email
  capture form — find the right location by reading the file
- Substitute the actual drug name and drug slug for each page
- Add trackAffiliateClick() GA4 event function to each page's <script> block
- Add the CSS once to assets/css/components.css — do not duplicate it per page
- Use placeholder affiliate URLs from REVENUE_SPEC.md (marked HIMS_AFFILIATE_URL etc.)
- Add the affiliate disclosure line under the CTA cards
- Do NOT remove or alter the email capture form, GTM tags, or chat widget
- Confirm each file individually after editing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — GLP-1 TELEHEALTH COMPARISON PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/REVENUE_SPEC.md (Feature 2 section), drugs/ozempic.html (for style reference)

Task: Create drugs/glp1-online.html

Rules:
- Match the header, footer, nav, and CSS of existing drug pages exactly
- Include the full comparison table with all 5 providers from the spec
- Write full answers (~150 words each) for all 7 FAQ questions in the spec
- Add FAQPage JSON-LD structured data for SEO
- Add BreadcrumbList JSON-LD structured data
- Add internal links to all 8 GLP-1 drug pages in a "Related Drugs" section
- Use the same email capture form + Google Apps Script endpoint as other drug pages
- Add both affiliate disclosure and medical disclaimer from REVENUE_SPEC.md
- Include GTM tag (copy from an existing drug page)
- After creating the file, add an internal link to this page from drugs/ozempic.html,
  drugs/wegovy.html, and drugs/mounjaro.html ("Compare GLP-1 online providers →")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — EMAIL SEQUENCE UPDATES (copy file only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/EMAIL_SEQUENCES.md, docs/REVENUE_SPEC.md (Feature 3 section)

Task: Create docs/EMAIL_UPDATES.md

This file will contain the updated email copy for MailerLite. I will paste each
section directly into the MailerLite dashboard — I am not editing MailerLite via code.

The file should contain clearly separated, copy-paste-ready sections for:
1. GLP-1 Email 2 — the affiliate block to APPEND at the bottom of existing email 2
2. GLP-1 Email 3 — the FULL REWRITE of email 3 (subject line + body)
3. General Email 2 — the affiliate block to APPEND at the bottom

Each section should be formatted as plain text (not markdown) so it pastes cleanly
into MailerLite's text editor. Include MailerLite dynamic field syntax:
{$drug|default:"your medication"} where appropriate.

Include correct UTM parameters on all affiliate links:
?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email2
(adjust utm_content per email)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — AI CHAT UPGRADE (Cloudflare Worker)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/REVENUE_SPEC.md (Feature 4 section), saverx-chat-proxy/src/index.js

Task: Modify saverx-chat-proxy/src/index.js

Rules:
- Read the ENTIRE current index.js before making any changes
- Add the detectGLP1Intent() function exactly as specified in REVENUE_SPEC.md
- Add the system prompt addition from REVENUE_SPEC.md to the existing system prompt
  (append to it — do not replace the whole system prompt)
- After getting the AI response, call detectGLP1Intent(userMessage) and if true,
  append the affiliate recommendation block to the response
- The affiliate block should link to /drugs/glp1-online.html (internal link)
- Add a clearly labeled comment block above new code: // REVENUE: GLP-1 intent detection
- Preserve ALL existing functionality — routing, auth, error handling, response format
- Non-GLP-1 questions must be completely unaffected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — AFFILIATE DATA FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: docs/REVENUE_SPEC.md (Shared Implementation Notes section)

Task: Create data/affiliates.json

Use the structure from REVENUE_SPEC.md. Add all 5 providers:
hims, ro, calibrate, noom_med, found.

Add a comment at the top of the JSON file explaining that URLs are placeholders.
Note: JSON doesn't support comments — add a "meta" key instead:
{
  "_instructions": "Replace affiliate URLs with real tracking links after approval. See ROADMAP.md for affiliate programs to apply for.",
  "providers": { ... }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After completing all phases, produce a completion report with:

□ Phase 0: List any Code.gs fixes made and confirm import script is ready
□ Phase 1: List all 8 drug pages modified + confirm CTA CSS added to components.css
□ Phase 2: Confirm drugs/glp1-online.html created + 3 internal links added
□ Phase 3: Confirm docs/EMAIL_UPDATES.md created with all 3 sections
□ Phase 4: Confirm saverx-chat-proxy/src/index.js modified + existing tests pass
□ Phase 5: Confirm data/affiliates.json created

For every file modified, state: filename | what changed | lines affected

Then list the 3 manual steps I still need to do myself:
1. What to run in the terminal (import script command)
2. What to update in Google Apps Script dashboard
3. What to paste into MailerLite dashboard
```

---

## Single-Phase Prompts (Use When Resuming Mid-Build)

If Claude Code loses context or you want to continue a specific phase:

### Resume Phase 1 (affiliate CTAs)
```
Read CLAUDE.md and docs/REVENUE_SPEC.md Feature 1.
I have already completed [list completed pages]. Continue adding the GLP-1 affiliate
CTA section to the remaining pages: [list remaining pages].
Read the first remaining page before modifying anything.
```

### Resume Phase 2 (comparison page)
```
Read CLAUDE.md and docs/REVENUE_SPEC.md Feature 2.
Create drugs/glp1-online.html following the spec. Read drugs/ozempic.html first
to match the exact styling. Include all FAQs with full answers, JSON-LD structured
data, email capture, and affiliate disclosure.
```

### Resume Phase 4 (Worker upgrade)
```
Read CLAUDE.md and docs/REVENUE_SPEC.md Feature 4.
Read saverx-chat-proxy/src/index.js in full before making changes.
Add GLP-1 intent detection and append the affiliate recommendation block.
Preserve all existing chat functionality.
```

---

## After the Build: Deploy Commands

```bash
# Test locally before deploying
npx serve . -p 8080
# Check: http://localhost:8080/drugs/ozempic.html  (affiliate CTA visible?)
# Check: http://localhost:8080/drugs/glp1-online.html  (comparison page works?)

# Deploy static pages to Cloudflare
wrangler pages deploy . --project-name saverx

# Deploy Worker changes
cd saverx-chat-proxy
wrangler deploy
cd ..

# Import leads to MailerLite (run after Worker is deployed)
node scripts/mailerlite-import.js --csv data/saverx-leads-deduped.csv --dry-run
# If dry-run looks good:
node scripts/mailerlite-import.js --csv data/saverx-leads-deduped.csv
```

---

## Affiliate Programs to Apply For (Manual — Do In Parallel With Build)

These require human sign-up — do these while Claude Code is building:

| Program | URL | Commission | Notes |
|---------|-----|-----------|-------|
| Hims & Hers | hims.com/partners | $30–$50/signup | GLP-1 weight loss program |
| Ro Body | ro.co/affiliates | $30–$50/signup | Semaglutide program |
| Calibrate | joincalibrate.com/affiliate | $40–$60/signup | Metabolic health |
| Noom Med | noom.com/affiliate | $30/signup | GLP-1 program |
| Found | joinfound.com/affiliate | $25–$40/signup | Weight management |
| GoodRx Publisher | goodrx.com/business | $0.10–0.50/click | Price widget |
| Google AdSense | adsense.google.com | CPM-based | Display ads |
| eHealth | ehealthinsurance.com/affiliate | $30–$80/lead | Insurance |

Once affiliate links are approved, replace placeholder URLs in:
1. `data/affiliates.json` — update all `*_url` fields
2. Each GLP-1 drug page — find `HIMS_AFFILIATE_URL`, `RO_AFFILIATE_URL`, `CALIBRATE_AFFILIATE_URL`
3. `drugs/glp1-online.html` — update all provider CTA links
