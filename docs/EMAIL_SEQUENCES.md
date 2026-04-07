# SaveRx.ai — Email Sequences

## Email Automation Copy

Merge tags are replaced server-side by `applyMergeTags()` in `scripts/Code.gs` before sending via Resend.
Fallback for empty drug field: "your prescription"

---

## AUTOMATION 1: Drug-Specific Welcome Series

_For: GLP-1 Users, Cardiovascular, Diabetes/CGM groups_

---

### Email 1 — Day 0 (Immediate)

**Internal name:** `SaveRx - Welcome - Drug Checkin`
**Subject:** `Quick check-in about your {$drug|default:"prescription"} savings`
**Preview text:** `Did your copay card actually work?`
**From name:** `SaveRx Team`
**From email:** `help@saverx.ai`

---

**BODY:**

Hi there,

A little while back you visited SaveRx.ai looking for savings on **{$drug|default:"your prescription"}**.

We wanted to check in — did you actually get your copay card set up?

Sometimes the manufacturer programs have eligibility quirks that trip people up (insurance type, income limits, pharmacy restrictions). If anything felt confusing or didn't work, just reply to this email and we'll help you sort it out directly.

**Here's your direct savings page:**
→ [Check {$drug|default:"your"} savings at SaveRx.ai](https://saverx.ai)

A few things that may have changed since your last visit:

- Several manufacturer programs updated their income eligibility thresholds
- New copay assistance programs were added for FreeStyleLibre, Dymista, and Trulance
- We added a comparison tool showing which program saves the most per fill

Stay well,
**The SaveRx Team**

---

_You're receiving this because you looked up prescription savings at SaveRx.ai. [Unsubscribe](#)_

---

### Email 2 — Day 3

**Internal name:** `SaveRx - Insurance Check - Drug Specific`
**Subject:** `Are you paying too much for {$drug|default:"your medication"}?`
**Preview text:** `Your insurance plan may not be optimized for this drug`
**From name:** `SaveRx Team`

---

**BODY:**

Hi,

We want to share something most people on {$drug|default:"specialty medications"} don't know.

**The copay card is only half the story.**

Even with a manufacturer copay card, the wrong insurance plan can cost you hundreds more per year through deductibles, formulary restrictions, and step therapy requirements. A lot of people save $150/fill with a copay card but lose $2,000/year on their overall plan.

**If you're on Medicare**, now is a good time to make sure your Part D plan is optimized for {$drug|default:"your medication"}. Plans vary wildly in how they cover specialty drugs — and the annual enrollment window opens again in October.

[→ Compare Medicare Part D plans for your medication](https://saverx.ai)

**If you have commercial insurance**, we recommend checking if your current plan has a preferred specialty pharmacy for {$drug|default:"your drug"} — using the wrong pharmacy can void your copay card savings entirely.

Questions? Reply to this email — we read every one.

**The SaveRx Team**

---

_[Unsubscribe](#)_

---

### Email 3 — Day 7

**Internal name:** `SaveRx - GoodRx Comparison`
**Subject:** `One more option for {$drug|default:"your prescription"} you may not have seen`
**Preview text:** `GoodRx vs. manufacturer copay — which wins?`
**From name:** `SaveRx Team`

---

**BODY:**

Hi,

Last one from us for a while — we promise.

A question we get a lot: _"Should I use the manufacturer copay card or a GoodRx coupon?"_

The answer depends entirely on your situation:

**Use the manufacturer copay card if:**

- You have commercial (employer) insurance
- Your drug is brand-name only (no generic available)
- The manufacturer program is still accepting new enrollees

**Use GoodRx if:**

- You're uninsured or underinsured
- Your insurance doesn't cover {$drug|default:"this drug"}
- You're in Medicare (copay cards often can't be used with Medicare)

For {$drug|default:"your medication"}, we've done the comparison:
[→ See GoodRx vs. manufacturer pricing on SaveRx.ai](https://saverx.ai)

This is the last email in this sequence. Going forward you'll only hear from us when we have meaningful updates — new programs, price changes, or eligibility news relevant to {$drug|default:"your medication"}.

Take care,
**The SaveRx Team**

---

_[Unsubscribe](#)_

---

## AUTOMATION 2: General Welcome Series

_For: General Savings group (newsletter signups, N/A drug)_

---

### Email 1 — Day 0 (Immediate)

**Internal name:** `SaveRx - General Welcome`
**Subject:** `Welcome to SaveRx — here's what we do`
**Preview text:** `Official savings programs most people don't know about`

---

**BODY:**

Hi,

Thanks for joining SaveRx.ai.

Here's the short version of what we do: we find **official manufacturer savings programs** for expensive brand-name medications — the ones pharmaceutical companies fund directly but don't advertise well.

These aren't sketchy discount cards. They're programs run by Pfizer, Novo Nordisk, Amgen, and other manufacturers that can bring a $500+/month prescription down to $0–$35/month for eligible patients.

**Some of the drugs we cover:**

- **Ozempic / Wegovy / Mounjaro** (GLP-1 medications)
- **Repatha / Eliquis / Entresto** (cardiovascular)
- **FreeStyleLibre** (continuous glucose monitors)
- **Stelara / Dupixent / Otezla** (biologics)

[→ Browse all 300+ drug savings programs](https://saverx.ai/list.html)

If you're looking for a specific drug and don't see it, reply to this email with the name and we'll research it for you.

**The SaveRx Team**

---

### Email 2 — Day 5

**Internal name:** `SaveRx - GLP1 Awareness`
**Subject:** `Do you know someone on Ozempic or Wegovy?`
**Preview text:** `These programs can save $400+/month`

---

**BODY:**

Hi,

One quick thing.

GLP-1 medications like Ozempic, Wegovy, and Mounjaro have become some of the most prescribed (and most expensive) drugs in the country. List price is often $900–$1,300/month.

What most people don't know: **Novo Nordisk and Eli Lilly both run copay assistance programs** that can bring that cost down to $25–$99/month for commercially insured patients.

If you or someone you know is on one of these:

[→ Check Ozempic savings programs](https://saverx.ai/drugs/ozempic)
[→ Check Wegovy savings programs](https://saverx.ai/drugs/wegovy)
[→ Check Mounjaro savings programs](https://saverx.ai/drugs/mounjaro)

These programs have enrollment limits and eligibility windows — it's worth checking sooner than later.

**The SaveRx Team**

---

_[Unsubscribe](#)_

---

## Email Personalization Reference

### Merge Tag Reference
These are handled by applyMergeTags() in scripts/Code.gs:
- drug name: {{$subscriber.fields.drug}}
- URL slug: {{$subscriber.fields.drug|slugify}}
- unsubscribe URL: {{$unsubscribe}}

### Subject Line Templates (EMAIL_SUBJECTS in Code.gs)
- welcome: Your {{drug}} savings are waiting - SaveRx.ai
- follow-up-1: Have you enrolled in your {{drug}} savings yet?
- follow-up-2: Last reminder: your {{drug}} savings program
