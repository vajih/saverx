# Email Sequence Updates — GLP-1 Affiliate CTAs

> Append these blocks to the existing email templates in `emails/`.
> UTM parameters follow the pattern: `utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=emailN`

---

## GLP-1 Email 2 — Append Block

Add this section **at the bottom of the email body, above the unsubscribe footer**, in the GLP-1 Email 2 template (`emails/glp1-email-2.html` or equivalent):

```html
<!-- Affiliate CTA block — GLP-1 Email 2 -->
<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:20px;"
>
  <tr>
    <td
      style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0f172a;"
    >
      <p style="margin:0 0 8px;font-weight:700;">
        💊 Can't afford {$drug|default:"your GLP-1"}?
      </p>
      <p style="margin:0 0 14px;color:#475569;">
        Many patients are switching to online telehealth programs that prescribe
        GLP-1 medications for <strong>$145–$299/month</strong> — no insurance
        required.
      </p>
      <p style="margin:0 0 16px;">
        <a
          href="https://saverx.ai/drugs/glp1-online.html?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email2"
          style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;"
        >
          See Pricing Options →
        </a>
      </p>
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        *SaveRx may earn a small commission if you sign up through one of our
        partner links.
      </p>
    </td>
  </tr>
</table>
<!-- End affiliate CTA block -->
```

**Plain-text version append:**

```
-------------------------
Can't afford {$drug|default:"your GLP-1"}?

Many patients are switching to online telehealth programs that prescribe
GLP-1 medications for $145–$299/month — no insurance required.

See pricing options: https://saverx.ai/drugs/glp1-online.html?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email2

*SaveRx may earn a small commission if you sign up through a partner link.
-------------------------
```

---

## GLP-1 Email 3 — Full Subject Line Update

**New subject:** `The cheapest way to get {$drug|default:"Ozempic"} right now`

**Preview text:** `3 ways to lower your cost — one of them might surprise you`

---

## GLP-1 Email 3 — Body CTA Section

Replace the existing CTA section in Email 3 with the three-option format below, or add it as the primary content block:

```html
<!-- GLP-1 Email 3 — Three Options CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="font-family:sans-serif;font-size:16px;line-height:1.7;color:#0f172a;padding-bottom:12px;">
      <p style="margin:0 0 16px;">Here are the 3 most effective ways to lower your {$drug|default:"GLP-1"} cost right now:</p>
    </td>
  </tr>

  <!-- Option 1: GoodRx -->
  <tr>
    <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:12px;font-family:sans-serif;">
      <p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#1d4ed8;">① Use a GoodRx Coupon</p>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;">
        Even with insurance, GoodRx sometimes beats your copay. Free to use at most pharmacies.
      </p>
      <a href="https://www.goodrx.com/{$drug_slug|default:"ozempic"}?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email3_goodrx"
         style="font-size:13px;color:#1d4ed8;text-decoration:underline;">
        Get GoodRx coupon for {$drug|default:"your drug"} →
      </a>
    </td>
  </tr>

  <tr><td style="height:10px;"></td></tr>

  <!-- Option 2: Online Telehealth -->
  <tr>
    <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;font-family:sans-serif;">
      <p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#14532d;">② Get a Prescription Online ($145–$299/mo)</p>
      <p style="margin:0 0 8px;font-size:14px;color:#166534;">
        Online providers like Hims &amp; Hers and Ro prescribe semaglutide or tirzepatide — no insurance needed.
        Often the cheapest option for patients paying out of pocket.
      </p>
      <a href="https://saverx.ai/drugs/glp1-online.html?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email3"
         style="display:inline-block;background:#10b981;color:#ffffff;padding:10px 18px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px;">
        Compare Online Providers →
      </a>
    </td>
  </tr>

  <tr><td style="height:10px;"></td></tr>

  <!-- Option 3: Manufacturer Savings -->
  <tr>
    <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;font-family:sans-serif;">
      <p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#1e40af;">③ Official Manufacturer Savings Card</p>
      <p style="margin:0 0 8px;font-size:14px;color:#1d4ed8;">
        Eligible commercially-insured patients may pay as little as $25–$99/month through the manufacturer's
        copay program. Not available for Medicare/Medicaid patients.
      </p>
      <a href="https://saverx.ai/drugs/{$drug_slug|default:"ozempic"}/?utm_source=saverx_email&utm_medium=email&utm_campaign=glp1-sequence&utm_content=email3_manufacturer"
         style="font-size:13px;color:#1e40af;text-decoration:underline;">
        See {$drug|default:"manufacturer"} savings card →
      </a>
    </td>
  </tr>

</table>

<p style="font-size:11px;color:#9ca3af;margin-top:16px;">
  *SaveRx may earn a commission if you sign up through a partner telehealth link. This doesn't affect the prices you pay.
</p>
<!-- End GLP-1 Email 3 CTA -->
```

**UTM parameters used in Email 3:**

- GoodRx link: `utm_content=email3_goodrx`
- Online provider comparison: `utm_content=email3`
- Manufacturer savings card: `utm_content=email3_manufacturer`

---

## Merge Tags Required

Ensure your email platform populates these merge tags:

| Merge Tag       | Description                              | Fallback       |
| --------------- | ---------------------------------------- | -------------- |
| `{$drug}`       | Brand name of the drug (e.g., "Ozempic") | `"your GLP-1"` |
| `{$drug_slug}`  | URL slug of the drug (e.g., "ozempic")   | `"ozempic"`    |
| `{$first_name}` | Subscriber first name                    | `"there"`      |

---

## Files to Update

- `emails/glp1-email-2.html` — append the GLP-1 Email 2 block above before the footer
- `emails/glp1-email-3.html` — replace subject line + update/add the three-option CTA block
  (If only a plain-text template exists, use the plain-text versions above)

After editing, test locally before re-deploying `scripts/Code.gs`.
