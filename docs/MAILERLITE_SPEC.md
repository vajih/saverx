# MailerLite Integration Specification
## SaveRx.ai — Automated Email Management System

---

## Overview

SaveRx.ai captures user emails via two touchpoints:
1. **Drug Page Modal** — user clicks "Check savings" on a specific drug page (has drug name)
2. **Home Modal / Newsletter** — user subscribes from the homepage (no specific drug)

Currently, captured emails go to a Google Sheet (via Apps Script) and users are redirected to manufacturer pages. **There is zero follow-up.** This integration adds MailerLite as the email automation layer to convert that captured intent into ongoing engagement and revenue.

---

## Architecture

```
User clicks "Check Savings"
        ↓
Email modal captures: email + drug + source
        ↓
Google Apps Script (doPost handler)
        ↓ (parallel)
    ┌───┴───────────────────┐
    │                       │
Google Sheet            MailerLite API
(existing log)         (new: subscriber +
                        group + automation)
        ↓
User redirected to manufacturer page
```

---

## MailerLite Configuration

### API Details
- **Base URL:** `https://connect.mailerlite.com/api`
- **Auth:** Bearer token (stored as environment variable `MAILERLITE_API_KEY`)
- **Key endpoints used:**
  - `POST /subscribers` — create/update subscriber with custom fields
  - `GET /groups` — list segments
  - `POST /subscribers/{subscriber_id}/groups/{group_id}` — assign to segment

### Custom Fields (to create in MailerLite dashboard)
| Field Name | Field Key | Type   | Description                        |
|------------|-----------|--------|------------------------------------|
| Drug       | drug      | text   | The drug the user searched for     |
| Source     | source    | text   | Which modal/page captured the lead |
| Drug Category | drug_category | text | GLP1 / Cardiovascular / Diabetes / Other |

### Subscriber Groups (Segments)
Create these groups in MailerLite before running integration:

| Group Name         | Description                                      |
|--------------------|--------------------------------------------------|
| GLP-1 Users        | Ozempic, Wegovy, Mounjaro, Trulicity, Victoza    |
| Cardiovascular     | Repatha, Eliquis, Entresto, Jardiance, Baqsimi   |
| Diabetes / CGM     | FreeStyleLibre, Toujeo, Trulance, Dymista        |
| General Savings    | Newsletter signups, N/A drug, unknown            |
| All SaveRx Leads   | Every subscriber (master list)                   |

---

## Drug Category Mapping

```javascript
const DRUG_CATEGORIES = {
  // GLP-1 / Weight loss / Diabetes injectable
  'glp1': [
    'ozempic', 'wegovy', 'mounjaro', 'trulicity', 'victoza',
    'saxenda', 'rybelsus', 'ozempic®', 'mounjaro®'
  ],
  // Cardiovascular
  'cardiovascular': [
    'repatha', 'eliquis', 'entresto', 'jardiance', 'baqsimi',
    'corlanor', 'valsartan', 'entresto®', 'eliquis®'
  ],
  // Diabetes / CGM
  'diabetes': [
    'freestylelibre', 'freestyle libre', 'toujeo', 'trulance',
    'dymista', 'xultophy', 'tresiba', 'basaglar'
  ]
};

function getDrugCategory(drugName) {
  if (!drugName || drugName === 'N/A' || drugName === '') return 'general';
  const lower = drugName.toLowerCase().replace(/[®™]/g, '').trim();
  for (const [category, drugs] of Object.entries(DRUG_CATEGORIES)) {
    if (drugs.some(d => lower.includes(d))) return category;
  }
  return 'general';
}
```

---

## Google Apps Script Changes

### Current `doPost` flow (existing):
1. Parse form data
2. Write to Google Sheet
3. Return OK

### New `doPost` flow (after integration):
1. Parse form data
2. Write to Google Sheet (keep existing)
3. **NEW:** Call `addToMailerLite(email, drug, source)`
4. Return OK

### New function to add to `Code.gs`:

```javascript
const MAILERLITE_API_KEY = PropertiesService.getScriptProperties().getProperty('MAILERLITE_API_KEY');

// Group IDs — fill these in after creating groups in MailerLite dashboard
const MAILERLITE_GROUPS = {
  glp1: 'GROUP_ID_GLP1',
  cardiovascular: 'GROUP_ID_CARDIO',
  diabetes: 'GROUP_ID_DIABETES',
  general: 'GROUP_ID_GENERAL',
  all: 'GROUP_ID_ALL_LEADS'
};

function addToMailerLite(email, drug, source) {
  if (!email || !email.includes('@')) return;

  const category = getDrugCategory(drug);
  const groupId = MAILERLITE_GROUPS[category];
  const allGroupId = MAILERLITE_GROUPS['all'];

  const payload = {
    email: email,
    fields: {
      drug: drug || 'N/A',
      source: source || 'unknown',
      drug_category: category
    },
    groups: [groupId, allGroupId].filter(Boolean),
    status: 'active'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + MAILERLITE_API_KEY,
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://connect.mailerlite.com/api/subscribers', options);
    const result = JSON.parse(response.getContentText());
    Logger.log('MailerLite response: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('MailerLite error: ' + e.toString());
  }
}
```

### Store API key securely:
In Apps Script editor → Project Settings → Script Properties:
- Key: `MAILERLITE_API_KEY`
- Value: `[your MailerLite API key]`

---

## Automation Workflows in MailerLite

Create these as **Automation workflows** triggered by "Subscriber joins group":

### Automation 1: Drug-Specific Welcome (GLP-1, Cardiovascular, Diabetes groups)
**Trigger:** Subscriber added to any drug-specific group

| Step | Delay | Action | Subject |
|------|-------|--------|---------|
| 1 | Immediate | Send Email 1 | "Quick check-in about your {drug} savings" |
| 2 | 3 days | Send Email 2 | "Are you paying too much for {drug}?" |
| 3 | 7 days | Send Email 3 | "One more thing about your {drug} prescription" |

### Automation 2: General Welcome (General Savings group)
**Trigger:** Subscriber added to General Savings group

| Step | Delay | Action | Subject |
|------|-------|--------|---------|
| 1 | Immediate | Send Email 1 | "SaveRx: New savings programs just added" |
| 2 | 5 days | Send Email 2 | "Are you or someone you know on a GLP-1?" |

---

## Revenue Touchpoints in Emails

Each email should include at least one revenue-generating link:

| Email | Primary CTA | Revenue Mechanism |
|-------|-------------|-------------------|
| Email 1 | "Check my savings" → saverx.ai/{drug-page} | Ad impressions on return visit |
| Email 2 | "Compare insurance plans" → eHealth affiliate | $50–$200/enrollment commission |
| Email 3 | "Get GoodRx coupon" → GoodRx publisher link | $0.50–$2 per prescription filled |

### Affiliate Links to Integrate
- **eHealth Insurance:** `https://www.ehealthinsurance.com` (apply for affiliate program)
- **GoHealth:** Medicare Part D comparison ($50–$100/qualified lead)
- **GoodRx Publisher API:** Apply at `goodrx.com/developer`

---

## Environment Variables Required

```bash
# Google Apps Script Properties
MAILERLITE_API_KEY=ml-xxxxxxxxxxxxxxxx

# MailerLite Group IDs (get after creating groups)
MAILERLITE_GROUP_GLP1=xxxxxxxxx
MAILERLITE_GROUP_CARDIO=xxxxxxxxx
MAILERLITE_GROUP_DIABETES=xxxxxxxxx
MAILERLITE_GROUP_GENERAL=xxxxxxxxx
MAILERLITE_GROUP_ALL=xxxxxxxxx
```

---

## Success Metrics

| Metric | Target (Month 1) |
|--------|-----------------|
| Subscribers added to MailerLite | 100% of new captures |
| Email 1 open rate | >30% |
| Email 1 click rate | >8% |
| Return visits from email | >15 sessions/send |
| Affiliate clicks per send | >5 |

---

## Implementation Checklist

- [ ] Create MailerLite account and get API key
- [ ] Create 5 subscriber groups in MailerLite dashboard
- [ ] Create 3 custom fields: drug, source, drug_category
- [ ] Add `MAILERLITE_API_KEY` to Apps Script Script Properties
- [ ] Update `Code.gs` with `addToMailerLite()` function and `getDrugCategory()` helper
- [ ] Add group IDs to `MAILERLITE_GROUPS` constant
- [ ] Test with a real form submission (check MailerLite dashboard)
- [ ] Create Automation 1 (drug-specific, 3 emails)
- [ ] Create Automation 2 (general, 2 emails)
- [ ] Set up eHealth / GoHealth affiliate account
- [ ] Apply for GoodRx publisher API
- [ ] Apply for Google AdSense (add to GTM after approval)
