# Savings Watch: A2P 10DLC campaign application (copy-paste answers)

Register under the **legal entity that actually operates SaveRx.ai**, in a Twilio account separate from any other
business (the dental account's brand is Northwest Dental PC and cannot be reused). Do NOT put SaveRx traffic on
another product's campaign. Carriers approve one use case per campaign.

> Message text below mirrors what the app really sends (`saverx-savings-watch/src/admin.js`, `webhooks.js`).
> If you change that text, change this doc and the registration together; mismatches are a top rejection reason.

## Before submitting (reviewers visit your site)
- [ ] https://saverx.ai/savings-watch/ is **live** (reviewers open the opt-in page). It is noindex but public.
- [ ] Privacy policy `/privacy.html#sms` and terms `/terms.html#sms` are live and name the operating company.
- [ ] Footer/privacy/terms say "SaveRx.ai is operated by <legal entity name>" (+ DBA filing if "SaveRx" is a trade name).
- [ ] Business info matches the IRS record exactly (legal name, EIN, address). Enter the EIN yourself in Twilio.

## Campaign fields
**Use case:** Low Volume Mixed (covers the requested-results text and optional updates).

**Campaign description**
SaveRx.ai helps US patients find manufacturer prescription savings programs. A visitor enters their mobile number on
saverx.ai, verifies it with a one-time code, and checks a box agreeing to receive a text message. A SaveRx researcher
reviews official manufacturer programs, then we text the visitor one message with a private, expiring link to the
results page. Visitors can separately opt in to occasional savings updates. Texts never contain medication names or
health information; those appear only on the private link page.

**How do end users consent / opt in?**
Web form at https://saverx.ai/savings-watch/ (medication page → "Find savings for me — Free"). The visitor enters a US
mobile number, receives and enters a one-time code (Twilio Verify), and must check an unchecked, separate consent box:
"I agree to receive a text message from SaveRx.ai with a link to the savings information I requested. Message and data
rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of using SaveRx.ai." A second,
separate unchecked box opts in to occasional updates. Consent wording, time and a hashed IP are stored. Privacy Policy
(https://saverx.ai/privacy.html#sms) and Terms (https://saverx.ai/terms.html#sms) are linked on the form.

**Opt-in message / confirmation:** The verification code SMS (sent by Twilio Verify) followed by the results text below.
Mobile numbers are never shared with third parties for their marketing.

**Sample message 1 (results link)**
`SaveRx: Your savings info is ready: https://saverx.ai/r/Ab3dEf... (expires in 14 days). Reply STOP to opt out, HELP for help.`

**Sample message 2 (HELP reply)**
`SaveRx.ai: savings info you requested. Help: help@saverx.ai. Msg & data rates may apply. Reply STOP to opt out.`

**Sample message 3 (optional updates, only for separate opt-in)**
`SaveRx: A new savings update is ready: https://saverx.ai/r/Ab3dEf... Reply STOP to opt out, HELP for help.`

**Message volume:** under 1,000 per month during the pilot (low volume).

**Flags:** Embedded links: **Yes** (own domain saverx.ai, no public URL shorteners). Embedded phone numbers: No.
Age-gated content: No. Direct lending/loan: No. Affiliate marketing: No (links go to official manufacturer sites).

**Opt-out / help keywords:** STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT / HELP, INFO. START and UNSTOP resume.
Handled by Twilio's Messaging Service plus our signed webhook (suppression is checked before every send).

## After approval
1. Attach a US number to the new Messaging Service; put the `MG...` SID in `TWILIO_MESSAGING_SERVICE_SID`.
2. Point the number's incoming-message webhook to `https://saverx.ai/api/twilio/inbound`.
3. Re-run the live test, then follow `docs/SAVINGS_WATCH_SETUP.md` §6 (launch checklist).

## If rejected
Open the campaign → read the rejection reason. Common causes: opt-in page not reachable, privacy policy lacks SMS
language, business name on site ≠ registered brand, sample messages differ from real traffic, vague description.
Fix and resubmit; each resubmission may incur a vetting/campaign fee.
