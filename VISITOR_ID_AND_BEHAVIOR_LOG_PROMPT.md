# SaveRx.ai — Visitor ID & Behavior Log Implementation Prompt

**For:** Claude Code Sonnet 4.6
**Goal:** Wire a persistent visitor ID into the existing email capture form and begin collecting a lightweight behavior log keyed by that ID. This is the first step in building the longitudinal user database described in the SaveRx project brief.

**Prerequisite:** The cookie consent banner (`COOKIE_BANNER_PROMPT.md`) must ship first. This task depends on `assets/js/consent.js` existing and on Consent Mode v2 being wired. Do not start this task until the consent banner is live and the user has granted analytics consent.

**Scope:** ~3–4 hours of focused work. Touches: `consent.js`, the email capture form markup on every drug and category page, `scripts/Code.gs` (one column added), a new Cloudflare Worker for behavior logging, and a small admin view to confirm data is flowing.

---

## Before you start — read these files

1. `CLAUDE.md` — project context and hard constraints
2. `STRATEGY_APRIL_2026.md` §5 and the data-strategy conversation in the session transcript for the why
3. `scripts/Code.gs` — the existing email capture backend. Find the `doPost` handler and the sheet-writing logic
4. `drugs/ozempic/index.html` — the canonical email capture form pattern
5. `categories/weight-loss/index.html` — if the category fix has shipped, this page also has a form
6. `assets/js/consent.js` — the file you created in the previous sprint; you will extend it here
7. `saverx-chat-proxy/src/index.js` — the existing Cloudflare Worker pattern you'll mirror for the behavior log worker

**Do NOT modify:**

- The Apps Script web app deployment URL
- Any existing GTM/GA4 tag
- The cookie banner UX (only extend the script, don't change its behavior)
- Any drug page structure beyond adding a hidden form field and a small page-view beacon
- The email templates in `emails/`

---

## Task 1 — Extend `consent.js` with visitor ID issuance

**File:** `assets/js/consent.js`

Add a new section that runs **only after analytics consent is granted** (either via Accept All, or via saving preferences with analytics = true, or via stored consent on a return visit).

### 1a. Visitor ID generation and storage

When analytics is granted, call a new function `ensureVisitorId()`:

```javascript
function ensureVisitorId() {
  let id = localStorage.getItem('saverx_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('saverx_visitor_id', id);
    localStorage.setItem('saverx_visitor_first_seen', Date.now().toString());
  }
  window.SaveRx = window.SaveRx || {};
  window.SaveRx.visitorId = id;
  return id;
}
```

Rules:
- Only runs if `analytics` consent is `true`. If the user rejected analytics, do nothing — `window.SaveRx.visitorId` stays undefined, and the form will fall back to anonymous submission.
- The ID is a UUID v4. No personal info is embedded. If `crypto.randomUUID` is unavailable (very old browsers), fall back to a random hex string of 32 chars.
- Persisted in `localStorage`, not a document cookie. Reason: we avoid the cookie-header bloat, it survives as long as the browser storage does, and it's simpler to read from JS.
- Never regenerated unless the user explicitly rejects consent or clears storage.

### 1b. Tie deletion to reject-all

When the user clicks "Reject all" or explicitly revokes analytics in the preferences modal, also delete:

```javascript
localStorage.removeItem('saverx_visitor_id');
localStorage.removeItem('saverx_visitor_first_seen');
window.SaveRx.visitorId = undefined;
```

This is the soft-delete path. It does not remove the row from the server-side log (§4 handles that), but it ensures that if the same browser returns later, it gets a fresh ID.

### 1c. Expose a helper

Export via `window.SaveRx.getVisitorId()` so form handlers and page-view beacons can read it without directly touching localStorage.

---

## Task 2 — Wire visitor ID into the email capture form

### 2a. Update the form markup

For every page that has the email capture form, add a hidden input field **after** the existing hidden `source` and `drug` fields:

```html
<input type="hidden" name="visitor_id" id="saverx-visitor-id-input" value="">
```

This field is populated by JavaScript at form submission time, not at page render time, because the visitor ID may not exist until after the user grants consent mid-session.

### 2b. Form submission handler

Find the existing form submit handler (in the drug page's inline `<script>` block or in `assets/js/*.js`). Before the form is submitted, add:

```javascript
const visitorId = (window.SaveRx && window.SaveRx.getVisitorId && window.SaveRx.getVisitorId()) || '';
document.getElementById('saverx-visitor-id-input').value = visitorId;
```

If `visitorId` is empty (user rejected analytics), the form still submits successfully — the `visitor_id` column in the sheet will just be blank for that row. The form must never fail because of a missing visitor ID.

### 2c. Idempotent injection script

**File:** `scripts/_add-visitor-id-field.mjs` (new)

A Node.js ESM script that walks every HTML file with an email capture form and:
1. Checks if the page already has `saverx-visitor-id-input` (grep guard — idempotent)
2. Finds the existing hidden input for `source`
3. Inserts the new hidden input immediately after it
4. Finds the form submit handler
5. Inserts the visitor-ID-read line just before the `fetch(` or `form.submit()` call
6. Writes the file back
7. Logs a summary

Run it and verify at least 5 drug pages, the homepage featured form (if any), and each of the 7 category pages have been updated. Run grep to confirm zero double-injections.

---

## Task 3 — Update `scripts/Code.gs` to store the visitor ID

**File:** `scripts/Code.gs`

### 3a. Add the column

In the `doPost` handler, where the row is written to the Leads sheet, add `visitor_id` to the row payload. The sheet should have a new column H (or whatever the next free column is) labeled `visitor_id`. If the column doesn't exist, create it on first write.

The row-writing snippet should look something like:

```javascript
const visitorId = (params.visitor_id || '').toString().slice(0, 64); // cap length defensively
sheet.appendRow([
  new Date(),
  params.email,
  params.drug,
  params.source,
  getDrugCategory(params.drug),
  'new',
  '',
  visitorId  // new column
]);
```

Keep `muteHttpExceptions: true` on any external fetch calls (per CLAUDE.md constraints). If `visitor_id` is missing or empty, write an empty string — never fail.

### 3b. Expose visitor_id on the admin endpoint

If `doGet` has an endpoint that returns recent leads for the admin dashboard (`admin.html` + `admin-server.js`), include `visitor_id` in the response. This gives you a way to manually inspect the linkage during QA.

### 3c. Redeploy the Apps Script

After making changes, redeploy as a new web app version. **The deployment URL must not change** — deploy as an update to the existing deployment, not as a new one. If you create a new deployment URL by mistake, 358 drug pages will silently start 404ing on form submit. This is the single most important constraint in this task.

### 3d. Verify

Test by submitting the form on a drug page manually in a browser. Check the Google Sheet for:
- New row appended
- Correct email, drug, source
- `visitor_id` column populated with a UUID
- Re-submit from the same browser — same visitor ID should appear again
- Open an incognito window, submit — different visitor ID appears

---

## Task 4 — Build the behavior log Cloudflare Worker

This is the infrastructure that captures every page view (not just form submissions) keyed by visitor ID, so that over time you build a research journey for each user.

### 4a. Create the worker

**New directory:** `saverx-behavior-log/`
**New file:** `saverx-behavior-log/wrangler.toml`
**New file:** `saverx-behavior-log/src/index.js`

Mirror the pattern from `saverx-chat-proxy/` for the wrangler setup.

The worker exposes one endpoint: `POST /event`. It accepts a JSON body with:
```json
{
  "visitor_id": "uuid",
  "event_type": "page_view" | "affiliate_click" | "email_submit" | "chat_message",
  "page": "/drugs/ozempic/",
  "drug": "Ozempic",
  "category": "weight-loss",
  "timestamp": 1712851200000,
  "referrer": "https://google.com/...",
  "meta": { ... }  // optional, small
}
```

Requirements:
- CORS configured for `saverx.ai` and `*.saverx.ai`
- Validates `visitor_id` is a non-empty string under 64 chars
- Validates `event_type` is one of the allowed values
- Validates `page` is a path that starts with `/` and is under 256 chars
- Rejects any payload over 4KB
- Writes the event to a **Cloudflare KV namespace** called `BEHAVIOR_LOG` keyed by `${visitor_id}:${timestamp}` with a TTL of 400 days (rolling annual log)
- Also appends to a per-visitor summary key `summary:${visitor_id}` with the most recent 50 events (store as a JSON array, prune oldest on write)
- Returns `204 No Content` on success; errors return structured JSON with a short message
- Rate-limits per visitor ID: no more than 100 events per minute (simple KV counter with a 60s TTL)

### 4b. Set up the KV namespace

Document the wrangler commands to create the KV namespace and bind it to the worker:

```bash
wrangler kv namespace create BEHAVIOR_LOG
# then add the binding to wrangler.toml under [[kv_namespaces]]
```

### 4c. Deploy the worker

```bash
cd saverx-behavior-log && wrangler deploy
```

The deployed URL will be something like `saverx-behavior-log.saverx.workers.dev`. Add that URL as a constant at the top of `assets/js/consent.js` (or a new `assets/js/tracking.js` — your call).

---

## Task 5 — Page-view beacon on every page

**File:** `assets/js/tracking.js` (new, or append to `consent.js` — keep them separate for clarity)

### 5a. Fire a page_view event on load

Only if analytics consent is granted and `visitor_id` exists:

```javascript
function logPageView() {
  if (!window.SaveRx?.visitorId) return;
  const payload = {
    visitor_id: window.SaveRx.visitorId,
    event_type: 'page_view',
    page: location.pathname,
    drug: document.querySelector('meta[name="saverx-drug"]')?.content || null,
    category: document.querySelector('meta[name="saverx-category"]')?.content || null,
    timestamp: Date.now(),
    referrer: document.referrer?.slice(0, 256) || null
  };
  navigator.sendBeacon(
    'https://saverx-behavior-log.saverx.workers.dev/event',
    new Blob([JSON.stringify(payload)], { type: 'application/json' })
  );
}

if (document.readyState === 'complete') logPageView();
else window.addEventListener('load', logPageView);
```

Use `navigator.sendBeacon` — it fires on page unload reliably and doesn't block navigation.

### 5b. Add drug and category meta tags

For each drug page, add to the `<head>`:
```html
<meta name="saverx-drug" content="Ozempic">
<meta name="saverx-category" content="weight-loss">
```

For each category page, add:
```html
<meta name="saverx-category" content="weight-loss">
```

Do this via `scripts/_add-meta-tags.mjs` — idempotent — and verify with a grep.

### 5c. Instrument affiliate click events

Find every `<a>` tag with `onclick="...affiliate_click...">` on drug, category, and homepage. In addition to the existing GA4 event, also fire a behavior-log event:

```javascript
function logAffiliateClick(provider, source) {
  if (!window.SaveRx?.visitorId) return;
  navigator.sendBeacon(
    'https://saverx-behavior-log.saverx.workers.dev/event',
    new Blob([JSON.stringify({
      visitor_id: window.SaveRx.visitorId,
      event_type: 'affiliate_click',
      page: location.pathname,
      timestamp: Date.now(),
      meta: { provider, source }
    })], { type: 'application/json' })
  );
}
```

Wire the existing `onclick` to call `logAffiliateClick(…)` alongside the GA4 event. Keep the GA4 event — do not replace it.

---

## Task 6 — Admin view to verify the data is flowing

**File:** `admin.html` (existing) and `admin-server.js` (existing)

Add a new section to the admin dashboard titled **"Visitor journeys"**:

- Input: visitor ID (paste manually)
- On submit, fetches `GET /visitor/{id}` from the behavior log worker (you'll need to add this endpoint to the worker — read the `summary:${visitor_id}` KV key and return it)
- Displays a chronological list: timestamp, page, event type, drug, category
- Also shows the matching row from the Google Sheet leads table (joined by visitor_id) so you can see: "this UUID belongs to email x@y.com who visited Ozempic, Wegovy, and GLP-1 comparison before signing up"

This is the single most important manual QA tool — it's how you verify the linkage works end-to-end. It's also the first draft of what will later become the "customer 360" view in the real database.

### 6a. Worker endpoint

Add to `saverx-behavior-log/src/index.js`:

```javascript
// GET /visitor/{id}
if (url.pathname.startsWith('/visitor/') && request.method === 'GET') {
  const id = url.pathname.split('/')[2];
  if (!isValidVisitorId(id)) return new Response('Invalid ID', { status: 400 });
  const summary = await env.BEHAVIOR_LOG.get(`summary:${id}`, { type: 'json' });
  return new Response(JSON.stringify(summary || []), {
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' }
  });
}
```

Protect this endpoint with a shared secret in a header (`x-saverx-admin-key`) read from an env var set via `wrangler secret put`. The admin dashboard adds the header on every request.

---

## Task 7 — Privacy policy update

**File:** `privacy.html`

Add to the existing Cookies and Consent section:

> **Visitor ID and research history.** When you grant analytics consent, SaveRx stores a random identifier in your browser's local storage and uses it to remember which drug pages you have viewed on our site. This helps us personalize future emails and recommend content relevant to your interests. The ID is linked to your email address only if and when you submit one of our email capture forms. You can clear this data at any time by clicking "Reject all" in our cookie settings or by clearing your browser's local storage. You can also request deletion of all associated data by contacting us through our [Contact](/contact.html) page.

Also add to the existing processors list a line about Cloudflare KV storing non-PII event data.

---

## Task 8 — Data deletion flow

**File:** `unsubscribe.html` (existing) and `scripts/Code.gs`

Today, `unsubscribe.html` handles email unsubscribe only. Extend it so that the user can also request full data deletion:

- Add a checkbox on the unsubscribe page: "Also delete all of my research history and visitor data"
- If checked, the unsubscribe handler (in `Code.gs`) should:
  1. Look up the user by email in the Leads sheet, read their `visitor_id`
  2. Mark the Leads row as deleted (clear PII, keep a hash for uniqueness counting)
  3. Call the behavior log worker `DELETE /visitor/{id}` endpoint (to be added) to wipe both the per-event and summary keys
  4. Return a success message
- Add the `DELETE /visitor/{id}` endpoint to the worker, same admin-key protection, that deletes all KV keys matching `{id}:*` and `summary:{id}`

This is the guardrail from the conversation: **every user must be able to fully delete themselves in one action.** Build it before you have 10,000 users, not after.

---

## Definition of Done

- [ ] `consent.js` generates and stores a UUID visitor ID only after analytics consent
- [ ] `window.SaveRx.getVisitorId()` works and returns the ID or undefined
- [ ] Reject all / revoke analytics clears the ID
- [ ] Every drug page email form has the `visitor_id` hidden input
- [ ] Every category page email form has the `visitor_id` hidden input
- [ ] `scripts/Code.gs` writes `visitor_id` to a new sheet column and is redeployed to the existing URL
- [ ] A manual form submit produces a row with the correct visitor ID
- [ ] The new `saverx-behavior-log` worker is deployed and responding on `/event`
- [ ] KV namespace `BEHAVIOR_LOG` exists and is bound
- [ ] Page loads fire a `page_view` event (verify in KV via `wrangler kv key list`)
- [ ] Affiliate clicks fire an `affiliate_click` event alongside the existing GA4 event
- [ ] Every drug page has `saverx-drug` and `saverx-category` meta tags
- [ ] Rate limiting works (test by spamming the endpoint)
- [ ] Admin dashboard "Visitor journeys" view renders a chronological list for a sample visitor ID
- [ ] The admin endpoint is protected by a secret header
- [ ] Privacy policy updated with the visitor ID disclosure
- [ ] Unsubscribe page now offers data deletion
- [ ] Full deletion path tested end-to-end: submit email → fire events → request deletion → verify sheet row cleared + KV keys gone
- [ ] No PII stored in KV (only visitor IDs, pages, drugs, timestamps)
- [ ] No JavaScript errors in the console on any page after deploy
- [ ] Grep confirms `visitor_id` field injected exactly once on every targeted page

---

## Anti-patterns to avoid

1. **Do NOT store PII in the behavior log.** Only the UUID, page path, drug, category, timestamp, and referrer. No email, no IP address, no user agent details. If an email is needed for a join, do it server-side against the Sheet — never in KV.
2. **Do NOT set the visitor ID before consent.** The whole point of the consent banner is that nothing non-essential happens until the user says yes.
3. **Do NOT create a new Apps Script deployment URL.** Update the existing one in place.
4. **Do NOT make the form submission fail** if visitor_id is missing. Graceful degradation.
5. **Do NOT log IP addresses** anywhere — Cloudflare sees them, but do not copy them into your own KV or sheets. IP addresses are considered personal data under GDPR.
6. **Do NOT skip the deletion path.** Without a working deletion flow, you have a legal exposure that grows with every user.
7. **Do NOT expose the behavior log worker's admin endpoint publicly.** Shared-secret header only, and consider IP allowlisting the admin dashboard later.
8. **Do NOT use `fetch()` with `keepalive: true`** instead of `sendBeacon()` for page-view logging — `sendBeacon` is more reliable on unload and browsers treat it as explicitly for this use case.

---

## Estimated time

~4 hours:

- Task 1 (consent.js extension): 30 min
- Task 2 (form wiring + injection script): 45 min
- Task 3 (Code.gs update + redeploy): 30 min
- Task 4 (behavior log worker + KV): 75 min
- Task 5 (page-view beacon + meta tags): 45 min
- Task 6 (admin view): 30 min
- Task 7 + 8 (privacy policy + deletion flow): 45 min
- End-to-end testing: 30 min

---

## After you finish

Report back with:

1. A list of every file created or modified
2. The URL of the deployed `saverx-behavior-log` worker
3. A screenshot (or description) of the admin "Visitor journeys" view showing a real sample journey
4. The shape of a `summary:${visitor_id}` KV entry after a simulated 5-event session
5. Confirmation that the deletion flow fully wipes both the sheet row and all KV keys
6. Any ambiguities you resolved, and what you chose

---

## Why this matters

This task is the point where SaveRx stops being a static website with a mailing list and starts being a **stateful user relationship platform**. Before this task, the site forgets every visitor the moment they close the tab. After this task, the site remembers: what pages they researched, in what order, over what timeframe, and eventually — once they give their email — which human that journey belongs to.

That memory is the raw material for:

- **Personalized email sends** — "Since you last visited, Wegovy has a new copay card"
- **Returning-visitor personalization** — "Welcome back. Here's what's new on the drugs you care about"
- **High-value B2B data** — aggregated (never individual) patterns about what drug research journeys look like, which employer-benefits platforms and telehealth partners will pay for
- **The SaveRx+ premium tier** — a $9/mo "AI health companion" that has months of research history to personalize against, which is the moat no competitor can fast-follow
- **Acquisition value** — a healthcare research database with 3+ years of longitudinal opted-in user journeys is worth more per user than almost any other kind of consumer data, and it is the single asset most likely to be the deciding factor in any future acquisition conversation

This is a 4-hour task that builds a compounding asset. Every day it runs, the asset gets more valuable. Every day it doesn't run, the opportunity cost grows. Ship it immediately after the cookie banner is live.
