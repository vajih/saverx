# SaveRx.ai — MailerLite Setup Guide# SaveRx.ai — MailerLite Setup Guide












































































































































































































































































| `docs/SETUP_GUIDE.md` | New | This guide || `env.example` | Updated | MailerLite env var reference || `scripts/mailerlite-import.js` | New | Bulk import of existing CSV leads || `scripts/mailerlite-setup.js` | New | One-time setup: creates groups and fields || `scripts/Code.gs` | Updated | Apps Script with MailerLite integration ||------|--------|---------|| File | Status | Purpose |## Summary of Files Changed---| Duplicate subscribers in import | Should not happen | MailerLite upserts by email — safe to re-run || Automation doesn't trigger | Automation not activated | Check MailerLite → Automations — toggle must be ON || Import fails with 422 | Email format issue | The CSV email column may have extra spaces or formatting || All subscribers go to `general` group | Group IDs are empty in Code.gs | Re-check Step 3 || Subscribers added to Sheet but not MailerLite | API key missing in Apps Script | Re-check Step 4 || `❌ Invalid API key` in setup script | Wrong token format | Use the JWT token from Integrations → API, not the Classic key ||---------|-------------|-----|| Problem | Likely Cause | Fix |## Troubleshooting---   - Confirm the group IDs in `MAILERLITE_GROUPS` are correct (Step 3)   - Verify `MAILERLITE_API_KEY` is set in Script Properties (Step 4)   - Check Apps Script → **Executions** log for MailerLite errors4. If the subscriber appears in the Sheet but **not** in MailerLite:   - [ ] Within a minute, the welcome email appears in your inbox   - [ ] The custom fields `drug`, `source`, `drug_category` are populated   - [ ] The subscriber is in the **All SaveRx Leads** group   - [ ] The subscriber is in the **GLP-1 Users** group (for an Ozempic page)   - [ ] The subscriber appears in MailerLite → **Subscribers** within ~30 seconds   - [ ] The row appears in the `CopayEnrollments` Google Sheet within ~5 seconds   - [ ] You are redirected to the manufacturer's page (existing behavior unchanged)3. Verify:2. Click **"Check savings"**, enter a **real email address you control**, and submit.1. Open a drug page on the live site (e.g., [saverx.ai/drugs/ozempic/](https://saverx.ai/drugs/ozempic/)).## Step 8: Test End-to-End---3. Use the full email copy from `docs/EMAIL_SEQUENCES.md`.| Email 2 | Send | `Do you know someone on Ozempic or Wegovy?` || Wait | 5 days | — || Email 1 | Send immediately | `Welcome to SaveRx — here's what we do` ||------|-------|---------|| Step | Delay | Subject |2. Add steps:1. Create another automation with trigger: **"When subscriber joins a group"** → select **General Savings** only.*Triggered when a subscriber joins General Savings group.*### Automation 2 — General Welcome (2 emails)6. Click **Save & activate**.5. Set **From name:** `SaveRx Team` and **From email:** `help@saverx.ai`.4. Use `{$drug|default:"your prescription"}` as the dynamic field throughout each email.| Email 3 | Send | `One more option for {$drug\|default:"your prescription"} you may not have seen` || Wait | 4 days | — || Email 2 | Send | `Are you paying too much for {$drug\|default:"your medication"}?` || Wait | 3 days | — || Email 1 | Send immediately | `Quick check-in about your {$drug\|default:"prescription"} savings` ||------|-------|---------|| Step | Delay | Subject |3. Add steps using the email copy in `docs/EMAIL_SEQUENCES.md`:2. Set trigger: **"When subscriber joins a group"** → select all 3 drug-specific groups.1. In MailerLite, go to **Automations → Create automation**.*Triggered when a subscriber joins GLP-1 Users, Cardiovascular, or Diabetes & CGM groups.*### Automation 1 — Drug-Specific Welcome (3 emails)## Step 7: Create Automation Workflows in MailerLite---> **Idempotent by design:** Running the import twice will NOT create duplicates — MailerLite upserts by email address.7. Check your MailerLite dashboard under **Subscribers** to verify the count and group assignments.6. The script processes 10 subscribers per batch with a 1.2-second delay (to stay within MailerLite's 60 req/min rate limit). For 252 leads it takes about 30–35 seconds.   ```   node scripts/mailerlite-import.js --csv data/saverx-leads.csv   ```bash5. If the preview looks correct, run the real import:   ```   node scripts/mailerlite-import.js --csv data/saverx-leads.csv --dry-run   ```bash4. **Dry-run first** to see what will be imported without making API calls:   ```   Timestamp, Email, Drug, Source, UserAgent   ```3. Make sure the CSV has these columns (matching the export format):   ```   saverx/data/saverx-leads.csv   ```2. Rename the downloaded file to `saverx-leads.csv` and place it in the `data/` folder:   - File → Download → Comma-separated values (.csv)   - Open the `CopayEnrollments` sheet1. Export your existing leads from the Google Sheet:## Step 6: Import Existing Leads (252 leads from Google Sheet)---> **To test immediately:** In the Apps Script editor, click **Run → doGet** to confirm no syntax errors.   - In most cases the URL stays the same for web app deployments — but double-check.6. Copy the new Web App URL (it changes each deployment) and update any references if needed.5. Click **Deploy**.   `Add MailerLite integration`4. Under **Version**, select **"New version"** and add a description:  3. Click the pencil (edit) icon on your existing deployment.2. Click **Deploy → Manage deployments**.   (Replace the entire file — the new version includes all the MailerLite functions.)1. In the Apps Script editor, copy the full contents of `scripts/Code.gs` from this repo and paste it into the `Code.gs` file in the editor.  ## Step 5: Deploy the Updated Apps Script---4. Click **Save**.   - **Value:** `eyJ...your_token_here` (same value as in your `.env`)   - **Property:** `MAILERLITE_API_KEY`3. Add:2. Scroll down to **Script Properties** and click **"Add script property"**.1. In the Apps Script editor, click **Project Settings** (gear icon in the left sidebar).The Apps Script reads the API key from Script Properties (not your local `.env`).## Step 4: Add the API Key to Apps Script Script Properties---   (The rest of the file in `scripts/Code.gs` is the full updated version with MailerLite integration already written.)   ```   };     all:            '12345682',     general:        '12345681',     diabetes:       '12345680',     cardiovascular: '12345679',     glp1:           '12345678',   const MAILERLITE_GROUPS = {   ```javascript3. Replace the empty placeholder values with the IDs printed by the setup script:2. Open `Code.gs` and find the `MAILERLITE_GROUPS` constant near the top (around line 20).   - Find the SaveRx project (or open it via the Google Sheet → Extensions → Apps Script)   - Go to [script.google.com](https://script.google.com)1. Open the Apps Script project:```};  all:            '12345682',  general:        '12345681',  diabetes:       '12345680',  cardiovascular: '12345679',  glp1:           '12345678',const MAILERLITE_GROUPS = {════════════════════════════════════════📋  COPY THESE INTO Apps Script (Code.gs):```The setup script also prints a `MAILERLITE_GROUPS` block formatted for Apps Script:## Step 3: Copy Group IDs into the Apps Script---> **If you run it a second time**, it will detect existing groups/fields and skip them safely.> **If the script errors with "Invalid API key":** Make sure your `.env` uses the JWT token from Integrations → API, not the Classic API key.3. Copy the group IDs printed at the end into your `.env` file.```...MAILERLITE_GROUP_CARDIO=12345679MAILERLITE_GROUP_GLP1=12345678════════════════════════════════════════════════════════════📋  COPY THESE INTO YOUR .env FILE:════════════════════════════════════════════════════════════  ✅  Created field "drug_category"   (text)  ✅  Created field "source"          (text)  ✅  Created field "drug"            (text)🏷️   Creating custom fields...  ✅  Created "All SaveRx Leads"      (ID: 12345682)  ✅  Created "General Savings"       (ID: 12345681)  ✅  Created "Diabetes & CGM"        (ID: 12345680)  ✅  Created "Cardiovascular"        (ID: 12345679)  ✅  Created "GLP-1 Users"           (ID: 12345678)📁  Creating subscriber groups...✅  API key valid🔑  Verifying API key...────────────────────────────────────────🚀  SaveRx.ai MailerLite Setup```**Expected output:**```node scripts/mailerlite-setup.js```bashThis script creates the 5 subscriber groups and 3 custom fields in MailerLite automatically.## Step 2: Run the Setup Script (Create Groups & Custom Fields)---   ```   MAILERLITE_API_KEY=eyJ...your_token_here   ```5. Open `.env` and paste your API key:   ```   cp env.example .env   ```bash4. In your local repo, copy the example env file if you haven't yet:   - **Save it somewhere safe** — you won't be able to see it again.   - The token starts with `eyJ...` (it's a JWT).3. Click **"Generate new token"**, give it a name like `SaveRx Production`, and copy the token.2. Once logged in, go to **Integrations → API** (left sidebar).   - The free plan supports up to 1,000 subscribers and 12,000 emails/month.1. Go to [app.mailerlite.com](https://app.mailerlite.com) and create a free account.## Step 1: Create a MailerLite Account & Get Your API Key---- This repository cloned locally- A Google account with access to the SaveRx Apps Script project- Node.js 18+ installed (`node --version` to check)## Prerequisites---Follow these steps in order. The whole process takes about 20–30 minutes.
Follow these steps in order. The whole process takes about 20–30 minutes.

---

## Prerequisites

- Node.js 18+ installed (`node --version` to check)
- A Google account with access to the SaveRx Apps Script project
- This repository cloned locally

---

## Step 1: Create a MailerLite Account & Get Your API Key

1. Go to [app.mailerlite.com](https://app.mailerlite.com) and create a free account.
   - The free plan supports up to 1,000 subscribers and 12,000 emails/month.

2. Once logged in, go to **Integrations → API** (left sidebar).

3. Click **"Generate new token"**, give it a name like `SaveRx Production`, and copy the token.
   - The token starts with `eyJ...` (it's a JWT).
   - **Save it somewhere safe** — you won't be able to see it again.

4. In your local repo, copy the example env file if you haven't yet:
   ```bash
   cp env.example .env
   ```

5. Open `.env` and paste your API key:
   ```
   MAILERLITE_API_KEY=eyJ...your_token_here
   ```

---

## Step 2: Run the Setup Script (Create Groups & Custom Fields)

This script creates the 5 subscriber groups and 3 custom fields in MailerLite automatically.

```bash
node scripts/mailerlite-setup.js
```

**Expected output:**
```
🚀  SaveRx.ai MailerLite Setup
────────────────────────────────────────
🔑  Verifying API key...
✅  API key valid

📁  Creating subscriber groups...
  ✅  Created "GLP-1 Users"           (ID: 12345678)
  ✅  Created "Cardiovascular"        (ID: 12345679)
  ✅  Created "Diabetes & CGM"        (ID: 12345680)
  ✅  Created "General Savings"       (ID: 12345681)
  ✅  Created "All SaveRx Leads"      (ID: 12345682)

🏷️   Creating custom fields...
  ✅  Created field "drug"            (text)
  ✅  Created field "source"          (text)
  ✅  Created field "drug_category"   (text)

════════════════════════════════════════════════════════════
📋  COPY THESE INTO YOUR .env FILE:
════════════════════════════════════════════════════════════
MAILERLITE_GROUP_GLP1=12345678
MAILERLITE_GROUP_CARDIO=12345679
...
```

3. Copy the group IDs printed at the end into your `.env` file.

> **If the script errors with "Invalid API key":** Make sure your `.env` uses the JWT token from Integrations → API, not the Classic API key.

> **If you run it a second time**, it will detect existing groups/fields and skip them safely.

---

## Step 3: Copy Group IDs into the Apps Script

The setup script also prints a `MAILERLITE_GROUPS` block formatted for Apps Script:

```
📋  COPY THESE INTO Apps Script (Code.gs):
════════════════════════════════════════
const MAILERLITE_GROUPS = {
  glp1:           '12345678',
  cardiovascular: '12345679',
  diabetes:       '12345680',
  general:        '12345681',
  all:            '12345682',
};
```

1. Open the Apps Script project:
   - Go to [script.google.com](https://script.google.com)
   - Find the SaveRx project (or open it via the Google Sheet → Extensions → Apps Script)

2. Open `Code.gs` and find the `MAILERLITE_GROUPS` constant near the top (around line 20).

3. Replace the empty placeholder values with the IDs printed by the setup script:
   ```javascript
   const MAILERLITE_GROUPS = {
     glp1:           '12345678',
     cardiovascular: '12345679',
     diabetes:       '12345680',
     general:        '12345681',
     all:            '12345682',
   };
   ```
   (The rest of the file in `scripts/Code.gs` is the full updated version with MailerLite integration already written.)

---

## Step 4: Add the API Key to Apps Script Script Properties

The Apps Script reads the API key from Script Properties (not your local `.env`).

1. In the Apps Script editor, click **Project Settings** (gear icon in the left sidebar).

2. Scroll down to **Script Properties** and click **"Add script property"**.

3. Add:
   - **Property:** `MAILERLITE_API_KEY`
   - **Value:** `eyJ...your_token_here` (same value as in your `.env`)

4. Click **Save**.

---

## Step 5: Deploy the Updated Apps Script

1. In the Apps Script editor, copy the full contents of `scripts/Code.gs` from this repo and paste it into the `Code.gs` file in the editor.  
   (Replace the entire file — the new version includes all the MailerLite functions.)

2. Click **Deploy → Manage deployments**.

3. Click the pencil (edit) icon on your existing deployment.

4. Under **Version**, select **"New version"** and add a description:  
   `Add MailerLite integration`

5. Click **Deploy**.

6. Copy the new Web App URL (it changes each deployment) and update any references if needed.
   - In most cases the URL stays the same for web app deployments — but double-check.

> **To test immediately:** In the Apps Script editor, click **Run → doGet** to confirm no syntax errors.

---

## Step 6: Import Existing Leads (252 leads from Google Sheet)

1. Export your existing leads from the Google Sheet:
   - Open the `CopayEnrollments` sheet
   - File → Download → Comma-separated values (.csv)

2. Rename the downloaded file to `saverx-leads.csv` and place it in the `data/` folder:
   ```
   saverx/data/saverx-leads.csv
   ```

3. Make sure the CSV has these columns (matching the export format):
   ```
   Timestamp, Email, Drug, Source, UserAgent
   ```

4. **Dry-run first** to see what will be imported without making API calls:
   ```bash
   node scripts/mailerlite-import.js --csv data/saverx-leads.csv --dry-run
   ```

5. If the preview looks correct, run the real import:
   ```bash
   node scripts/mailerlite-import.js --csv data/saverx-leads.csv
   ```

6. The script processes 10 subscribers per batch with a 1.2-second delay (to stay within MailerLite's 60 req/min rate limit). For 252 leads it takes about 30–35 seconds.

7. Check your MailerLite dashboard under **Subscribers** to verify the count and group assignments.

> **Idempotent by design:** Running the import twice will NOT create duplicates — MailerLite upserts by email address.

---

## Step 7: Create Automation Workflows in MailerLite

### Automation 1 — Drug-Specific Welcome (3 emails)
*Triggered when a subscriber joins GLP-1 Users, Cardiovascular, or Diabetes & CGM groups.*

1. In MailerLite, go to **Automations → Create automation**.
2. Set trigger: **"When subscriber joins a group"** → select all 3 drug-specific groups.
3. Add steps using the email copy in `docs/EMAIL_SEQUENCES.md`:

| Step | Delay | Subject |
|------|-------|---------|
| Email 1 | Send immediately | `Quick check-in about your {$drug\|default:"prescription"} savings` |
| Wait | 3 days | — |
| Email 2 | Send | `Are you paying too much for {$drug\|default:"your medication"}?` |
| Wait | 4 days | — |
| Email 3 | Send | `One more option for {$drug\|default:"your prescription"} you may not have seen` |

4. Use `{$drug|default:"your prescription"}` as the dynamic field throughout each email.
5. Set **From name:** `SaveRx Team` and **From email:** `help@saverx.ai`.
6. Click **Save & activate**.

### Automation 2 — General Welcome (2 emails)
*Triggered when a subscriber joins General Savings group.*

1. Create another automation with trigger: **"When subscriber joins a group"** → select **General Savings** only.
2. Add steps:

| Step | Delay | Subject |
|------|-------|---------|
| Email 1 | Send immediately | `Welcome to SaveRx — here's what we do` |
| Wait | 5 days | — |
| Email 2 | Send | `Do you know someone on Ozempic or Wegovy?` |

3. Use the full email copy from `docs/EMAIL_SEQUENCES.md`.

---

## Step 8: Test End-to-End

1. Open a drug page on the live site (e.g., [saverx.ai/drugs/ozempic/](https://saverx.ai/drugs/ozempic/)).

2. Click **"Check savings"**, enter a **real email address you control**, and submit.

3. Verify:
   - [ ] You are redirected to the manufacturer's page (existing behavior unchanged)
   - [ ] The row appears in the `CopayEnrollments` Google Sheet within ~5 seconds
   - [ ] The subscriber appears in MailerLite → **Subscribers** within ~30 seconds
   - [ ] The subscriber is in the **GLP-1 Users** group (for an Ozempic page)
   - [ ] The subscriber is in the **All SaveRx Leads** group
   - [ ] The custom fields `drug`, `source`, `drug_category` are populated
   - [ ] Within a minute, the welcome email appears in your inbox

4. If the subscriber appears in the Sheet but **not** in MailerLite:
   - Check Apps Script → **Executions** log for MailerLite errors
   - Verify `MAILERLITE_API_KEY` is set in Script Properties (Step 4)
   - Confirm the group IDs in `MAILERLITE_GROUPS` are correct (Step 3)

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `❌ Invalid API key` in setup script | Wrong token format | Use the JWT token from Integrations → API, not the Classic key |
| Subscribers added to Sheet but not MailerLite | API key missing in Apps Script | Re-check Step 4 |
| All subscribers go to `general` group | Group IDs are empty in Code.gs | Re-check Step 3 |
| Import fails with 422 | Email format issue | The CSV email column may have extra spaces or formatting |
| Automation doesn't trigger | Automation not activated | Check MailerLite → Automations — toggle must be ON |
| Duplicate subscribers in import | Should not happen | MailerLite upserts by email — safe to re-run |

---

## Summary of Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `scripts/Code.gs` | Updated | Apps Script with MailerLite integration |
| `scripts/mailerlite-setup.js` | New | One-time setup: creates groups and fields |
| `scripts/mailerlite-import.js` | New | Bulk import of existing CSV leads |
| `env.example` | Updated | MailerLite env var reference |
| `docs/SETUP_GUIDE.md` | New | This guide |
