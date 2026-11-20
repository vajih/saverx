# Facebook ad test — measuring cost per verified phone (Savings Watch)

Goal: cost per **verified** phone number per Facebook campaign/ad set. Source brief: `MUSE_Instructions.md` (reviewed 2026-11-20).

## What is built (PR `feat/savings-watch-utm`)
- `/savings-watch/` reads `utm_source|medium|campaign|content|term` from the landing URL, sanitizes them (lowercase `[a-z0-9_-]`,
  max 100 chars, dropped if they look like a phone number or email) and sends them in the `/start` request only.
- The Worker re-sanitizes (`src/validate.js: sanitizeUtm`) and stores them on the `requests` row. **First-touch**: a duplicate
  `/start` never overwrites them. UTMs are never sent to GA4 and never added to any analytics call. No pixel / third-party tag.
- Admin (`/admin/savings`) shows **Verified phones by campaign (last 30 days)** and a Campaign column on each request.
- Migration `saverx-savings-watch/migrations/0002_utm_attribution.sql` (existing databases); `schema.sql` already has the columns.

## Ad link standard
```
https://saverx.ai/savings-watch/?drug=repatha&utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<ad-set-or-creative>
```
One distinct `utm_campaign` per campaign, one `utm_content` per ad set/creative. Never put a phone number or other PII in a UTM.
**Cost per verified phone** = ad spend for that `utm_campaign` in Ads Manager ÷ the verified count for it in the admin table.

## Where this deviates from the brief (and why)
- **Verified count uses `verified_at IS NOT NULL`, not `status='verified'`.** The admin workflow moves requests on to
  ready/sent/closed; those are still verified phones, and `status='verified'` would undercount them as the test progresses.
- **Overlong UTMs are dropped** (not truncated), matching the acceptance criteria.
- **Fix 2 (unhide the drug-page Savings Watch card) is intentionally NOT done.** The switch is site-wide (`data/savings-watch.json`
  `live`); turning it on shows "Find savings for me" on every page while the Worker is undeployed and Twilio A2P is unapproved
  (every click would fail), and it hides the live text-alerts waitlist cards. Flip `live` only after the Worker is deployed and
  the A2P campaign is approved. Organic drug-page visitors already reach phone capture through the waitlist.
- **Deploy**: this repo deploys the static site on merge to `main` (no `jekyll build` step). The Worker/database steps below are
  not run yet.

## Deploy order (when the Worker goes live; not yet)
1. `wrangler d1 execute saverx-savings-watch --remote --file=migrations/0002_utm_attribution.sql` (skip if the database was created from the new `schema.sql`), then verify the five `utm_*` columns exist.
2. `cd saverx-savings-watch && wrangler deploy` (set Twilio secrets via `wrangler secret put`; never in code, PRs or docs).
3. Merge to `main` (site deploys automatically).
4. Smoke test: `https://saverx.ai/savings-watch/?drug=repatha&utm_source=facebook&utm_medium=paid_social&utm_campaign=smoke-test&utm_content=ad-a`,
   submit a test number, verify the code, confirm the admin list shows `smoke-test` and the by-campaign table reads 1. Remove the test row under normal retention.

## Before spending (blockers, not part of this change)
- Meta ad account is disabled (owner must contact Facebook).
- Twilio A2P approval pending; Worker not deployed.
- PR #17: missing `superseded_at` migration, non-atomic consent replacement, rejected sends block retries for an hour. Resolve or explicitly accept before spending (it also needs a numbered migration here: see `migrations/README.md`).
- GA4 (property 521819447): mark `savings_watch_verified` as a key event (admin step, ~2 min) for a session-source cross-check.

## Live capture today: the text-alerts waitlist
The waitlist (drug pages + homepage) is the funnel capturing phone numbers now. It records `utm_source|medium|campaign` from the
landing URL at submit time (TextWaitlist tab) but does not persist them across pages or record `utm_content`/`utm_term`.
Extending that (first-touch persistence + content/term) is a separate, small Code.gs change.
