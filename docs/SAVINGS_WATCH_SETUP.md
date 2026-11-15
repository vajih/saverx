# Savings Watch: Setup & Run Book

Companion to `docs/SAVINGS_WATCH_PLAN.md`. Nothing here deploys automatically; production steps need owner approval.

## 1. Run it locally (no accounts, no real texts)

```bash
cd saverx-savings-watch
npm test          # 56 Worker tests (real SQL on SQLite, mock Twilio, synthetic data); site tests: node --test test/*.test.mjs from the repo root
npm run dev       # http://localhost:3002  (real Worker code + SQLite, mock Twilio)
```

| URL | What |
|---|---|
| `/drugs/repatha/` | Pilot page with the "Find savings for me — Free" card |
| `/savings-watch/?drug=repatha` | Signup form (mock verification code is always **123456**) |
| `/admin/savings` | Admin queue (dev bypass, localhost only) |
| `/dev/outbox` | Shows the texts the mock "sent", including the results link |

Local data lives in `saverx-savings-watch/.dev-data/` (git-ignored). Delete that folder to reset.

## 2. Test with real Twilio (your own phone only)

1. In the Twilio Console create a **Verify Service** (Verify → Services → Create). Copy its SID (`VA…`).
2. Copy `saverx-savings-watch/.dev.vars.example` to `.dev.vars` (git-ignored) and set:
   ```
   TWILIO_LIVE=true
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_VERIFY_SERVICE_SID=VA...
   LIVE_TEST_ALLOWLIST=+1YOURNUMBER
   ```
   With `LIVE_TEST_ALLOWLIST` set the code refuses to contact any other number. Never paste these values into chat, commits, or screenshots.
3. **Use a dedicated test number, not your personal cell.** Buy a cheap Twilio number (~$1.15/mo) and put it in `LIVE_TEST_ALLOWLIST`. It proves the live route (the form gets a 200 and Twilio logs an inbound text from the Verify sender), and your personal number never touches the project. Caveats: Twilio masks one-time codes in its logs (`**verification code is:**`), so a script cannot read the code back; to complete the code step with real Twilio you need a phone that shows the text, or a temporary inbound webhook (e.g. an ngrok tunnel). Do not reuse a number that already has a webhook (e.g. one routed to another app). Trial accounts can only text numbers verified in the console (Phone Numbers → Verified Caller IDs).
4. `npm run dev` prints a loud "LIVE TWILIO MODE" banner. Sign up on the form with your number: you should receive a real code from Twilio Verify.
5. **The results text** (Messaging API) additionally needs `TWILIO_MESSAGING_SERVICE_SID` and a sender that carriers will deliver: US business texting requires A2P 10DLC registration (or a verified toll-free number). Until that is approved, results texts may be blocked by carriers (e.g. error 30034). Verify codes work regardless. For local live testing of the results text, the status callback URL is not reachable from Twilio, so delivery status will not update locally (it is covered by automated tests).

## 3. A2P 10DLC / sender registration (start now: takes days to weeks)

Console → Messaging → Regulatory Compliance. You need: legal business name, EIN, address, website (saverx.ai), a privacy policy that covers SMS (updated in this PR), and opt-in flow description/screenshots (the signup page). Register a **Brand**, then a **Campaign** (use case: "Customer care" or "Mixed"; describe: one-time texts with a private link to savings info the user requested, plus optional updates). Then attach a US number to a **Messaging Service** and copy its SID (`MG…`). Keep sample messages generic (no medication names), matching `src/admin.js`.

## 4. Production deploy (needs approval; do not run before the checklist is signed off)

```bash
cd saverx-savings-watch
npx wrangler d1 create saverx-savings-watch                  # paste database_id into wrangler.jsonc
npx wrangler d1 execute saverx-savings-watch --remote --file=schema.sql
for s in HMAC_KEY TURNSTILE_SECRET ACCESS_TEAM_DOMAIN ACCESS_AUD ADMIN_EMAILS \
         TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_VERIFY_SERVICE_SID TWILIO_MESSAGING_SERVICE_SID; do
  npx wrangler secret put $s
done
```
- `HMAC_KEY`: long random string (e.g. `openssl rand -hex 32`). **Changing it later breaks phone matching and STOP suppression**, so store it safely.
- `ADMIN_EMAILS`: comma-separated allowlist (you and Asma). `ACCESS_TEAM_DOMAIN` like `yourteam.cloudflareaccess.com`; `ACCESS_AUD` is the Access application's AUD tag.
- Set `TWILIO_LIVE` to `"true"` in `wrangler.jsonc` only at launch. Do **not** set `ALLOW_ANY_HOUR` or `TURNSTILE_BYPASS` or `ADMIN_DEV_EMAIL` in production.
- **Turnstile:** Cloudflare dashboard → Turnstile → add site `saverx.ai`; put the *site key* in `assets/js/savings-watch-config.js` and the *secret* in `TURNSTILE_SECRET`. Until then the form cannot submit in production (fails closed).
- **Cloudflare Access:** Zero Trust → Access → Applications → self-hosted. Protect `saverx.ai/admin/savings*` and `saverx.ai/api/admin/*`, policy = your two emails. Use that app's AUD tag above.
- **Routes** (uncomment in `wrangler.jsonc`, then `npx wrangler deploy`): `saverx.ai/api/savings/*`, `saverx.ai/api/admin/*`, `saverx.ai/api/twilio/*`, `saverx.ai/admin/savings*`, `saverx.ai/r/*`.
- **Twilio webhooks:** Messaging Service → Integration: Incoming messages → `https://saverx.ai/api/twilio/inbound` (POST). Status callbacks are set per message automatically (`/api/twilio/status`). Leave Twilio's default opt-out (STOP/HELP) handling on.
- **Site:** deploy Pages as usual (`wrangler pages deploy . --project-name saverx`). The `/savings-watch/` page is `noindex` during the pilot.
- **Rollout beyond Repatha:** add slugs to `PILOT_SLUGS` in `wrangler.jsonc` and the client list in `assets/js/savings-watch.js`, then run `node scripts/_add-savings-watch-cta.mjs --all`. Only after the pilot passes.

## 5. Operating it

- Admin → pick a verified request → **Load draft from drug page** → verify every detail on the official sites → tick the verification box → **Save** → **Preview** → **Send text** (two-click confirm).
- Send window: 11am–9pm ET (keeps every US recipient between 8am and 9pm local). Max 3 sends per request. Links expire 14 days after sending; re-sending rotates the link.
- STOP / UNSUBSCRIBE / CANCEL / END / QUIT suppress the number immediately and withdraw consent. START / UNSTOP restores. HELP replies with contact info.
- Retention (daily cron): phone numbers purged ~30 days after the link expires (or 2 days for never-verified requests); results deleted then too; consent records are kept.

## 6. Launch checklist (all must be true)

- [ ] Counsel reviewed consent wording (`src/consent.js`, marked `v1-draft`), privacy §"Text messaging", terms §5A
- [ ] A2P brand + campaign approved; Messaging Service SID in secrets
- [ ] Turnstile site key + secret set; Access app protecting admin routes; admin test from a non-allowlisted account is denied
- [ ] Twilio webhook URLs configured; STOP tested end to end from a real phone
- [ ] `HMAC_KEY` backed up; D1 schema applied; secrets set; no real values in git (`git grep -i "AC[0-9a-f]\{32\}"` is empty)
- [ ] Live test from owner's own phone: signup → code → admin send → link opens → expires → STOP
- [ ] Owner approval to deploy

## Known limits of this MVP

- Recurring "Savings Watch" updates: consent is stored separately; sending recurring updates is manual through the same admin until demand is proven.
- Not verified: HIPAA applicability. No HIPAA claim is made anywhere. Twilio offers a BAA only on specific plans.
- Single admin send path; no bulk send by design.
