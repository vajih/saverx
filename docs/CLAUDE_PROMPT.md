# Claude Code Prompt — MailerLite Email Automation for SaveRx.ai

Copy everything below this line and paste it into Claude Code.

---

## PROMPT START

I'm building an automated email management system for **SaveRx.ai**, a prescription savings website. The site helps patients find official manufacturer copay programs for expensive medications like Ozempic, Repatha, FreeStyleLibre, Mounjaro, and 300+ others.

I need you to implement a full MailerLite integration so that every user who submits their email on the site is automatically added to the right subscriber group and receives a personalized email sequence based on which drug they looked up.

**Read these spec files first before writing any code:**
- `docs/MAILERLITE_SPEC.md` — full technical spec, API details, group structure, Apps Script changes
- `docs/EMAIL_SEQUENCES.md` — complete email copy for all automation sequences

---

## CURRENT STATE

The site's email capture flow works like this:

1. User visits a drug page (e.g. `/drugs/ozempic/`) or the homepage
2. User clicks "Check savings" or subscribes via newsletter
3. A modal appears asking for their email
4. On submit, the frontend POSTs to a **Google Apps Script** web app endpoint
5. The Apps Script writes the email + drug + source to a Google Sheet
6. The user is redirected to the manufacturer's official copay page

The Apps Script lives at:
`https://script.google.com/macros/s/AKfycbyPArHul2llNlpy2YIW9-4X1G6AQSLmYw9jPpUoGx_KdAhIwcR_-ebRme6b0EVk7znUDw/exec`

The current `Code.gs` in the Apps Script project has these key constants:
```javascript
const SHEET_ID = '19AJUSoi_q-IYMWahKJ9EsIW8vRRW1fZQOiL3X7J_hAE';
const SHEET_NAME = 'CopayEnrollments';
const HONEYPOT = 'website';
```

Currently there is **zero email follow-up** after the Google Sheet write. Users are captured and then lost.

---

## WHAT I NEED BUILT

### 1. Update Google Apps Script (`Code.gs`)

Add the following to the existing `doPost` function (do NOT break existing Google Sheet logging):

- `addToMailerLite(email, drug, source)` function that:
  - POSTs to `https://connect.mailerlite.com/api/subscribers`
  - Sends: email, custom fields (drug, source, drug_category), and group IDs
  - Gets the API key from `PropertiesService.getScriptProperties().getProperty('MAILERLITE_API_KEY')`
  - Uses `muteHttpExceptions: true` and logs errors without failing the main flow

- `getDrugCategory(drugName)` function that:
  - Maps drug names to one of: `glp1`, `cardiovascular`, `diabetes`, `general`
  - Is case-insensitive and strips `®` and `™` characters
  - Returns `general` for N/A, empty, or unknown drugs
  - Uses the full mapping defined in `docs/MAILERLITE_SPEC.md`

- `MAILERLITE_GROUPS` constant with placeholders for group IDs (I'll fill these in after creating groups in the MailerLite dashboard)

### 2. Create a MailerLite setup script (`scripts/mailerlite-setup.js`)

A Node.js script I can run once to:
- Create all 5 subscriber groups in MailerLite
- Create the 3 custom fields (drug, source, drug_category)
- Output the group IDs so I can paste them into the Apps Script

Use the MailerLite v2 API (`https://connect.mailerlite.com/api`).
Read the API key from `.env` as `MAILERLITE_API_KEY`.

### 3. Create a bulk import script (`scripts/mailerlite-import.js`)

A Node.js script that:
- Reads a CSV file (`data/saverx-leads.csv`) containing existing leads
- The CSV has columns: Timestamp, Email, Drug, Source, UserAgent
- For each row, calls the MailerLite API to add the subscriber with the right group and custom fields
- Skips rows where Email is empty or doesn't contain `@`
- Skips rows where Email is a test address (contains 'test', 'example', 'spam')
- Logs progress: total processed, added, skipped, errors
- Handles rate limiting (MailerLite allows 60 requests/minute on free plan) with a 1-second delay between batches of 10

### 4. Update `env.example`

Add the following to `env.example`:
```
# MailerLite
MAILERLITE_API_KEY=your_mailerlite_api_key_here
MAILERLITE_GROUP_GLP1=
MAILERLITE_GROUP_CARDIO=
MAILERLITE_GROUP_DIABETES=
MAILERLITE_GROUP_GENERAL=
MAILERLITE_GROUP_ALL=
```

### 5. Create `docs/SETUP_GUIDE.md`

A step-by-step guide for me to follow that covers:
1. Creating a MailerLite account and getting the API key
2. Running `scripts/mailerlite-setup.js` to create groups and fields
3. Copying the group IDs into the Apps Script
4. Deploying the updated Apps Script as a new version
5. Running `scripts/mailerlite-import.js` to import existing 252 leads
6. Creating the automation workflows in the MailerLite dashboard (with screenshots references)
7. Testing with a live form submission

---

## CONSTRAINTS & REQUIREMENTS

- **Do not break the existing Google Sheet logging** — the Sheet write must still happen even if MailerLite fails
- **MailerLite errors must not cause the Apps Script to return a non-200 response** — the frontend redirect must always work
- **The Apps Script cannot use npm packages** — use only `UrlFetchApp` for HTTP calls
- **Node.js scripts should use native `fetch`** (Node 18+) or `axios` if fetch isn't available
- **All API keys must come from environment variables**, never hardcoded
- **The bulk import script must be idempotent** — running it twice should not create duplicate subscribers (MailerLite upserts by email)
- **Drug names in the CSV may have `®` or `™` symbols** — strip these before category mapping

---

## FILE STRUCTURE AFTER COMPLETION

```
saverx/
├── docs/
│   ├── MAILERLITE_SPEC.md      (existing)
│   ├── EMAIL_SEQUENCES.md      (existing)
│   ├── CLAUDE_PROMPT.md        (existing)
│   └── SETUP_GUIDE.md          (new - create this)
├── scripts/
│   ├── mailerlite-setup.js     (new - create this)
│   └── mailerlite-import.js    (new - create this)
├── data/
│   └── saverx-leads.csv        (I will place this here)
├── env.example                 (update this)
└── [existing files unchanged]
```

---

## DEFINITION OF DONE

- [ ] `Code.gs` changes written out as a complete updated file I can copy into the Apps Script editor
- [ ] `scripts/mailerlite-setup.js` creates all groups and fields, outputs group IDs
- [ ] `scripts/mailerlite-import.js` imports CSV, handles errors gracefully, logs results
- [ ] `env.example` updated with all MailerLite variables
- [ ] `docs/SETUP_GUIDE.md` written so a non-developer could follow it
- [ ] All scripts tested for syntax errors
- [ ] No hardcoded API keys anywhere

Start with `Code.gs` since that's the most critical — it gates all future lead capture.

## PROMPT END
