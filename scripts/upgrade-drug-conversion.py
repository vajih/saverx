"""Apply the drug-identity-first conversion layout to existing options pages."""
from pathlib import Path
import re,json,html
ROOT=Path(__file__).resolve().parents[1]
profiles=json.loads((ROOT/'data/drug-option-profiles.json').read_text())
for p in list((ROOT/'drugs').glob('*/index.html'))+[ROOT/'templates/index.html']:
 s=p.read_text()
 if 'drug-options-page' not in s or 'drug-conversion-v2' in s:continue
 slug=p.parent.name if p.parent.name!='templates' else 'medication'
 profile=json.loads(re.search(r'id="drug-page-profile">(.*?)</script>',s,re.S)[1]);name=html.escape(profile.get('brand',slug.title()))
 about=re.search(r'<section id="about-medication".*?</section>',s,re.S)[0]
 description=html.escape(profile.get('about',{}).get('text','Check the generic name and medication overview with your prescription. Ask your pharmacist if you are unsure which medication you have.'))
 hero_about=f'<div id="rx-about" class="drug-hero-overview"><p id="rx-about-desc">{description}</p><div class="drug-about-tags"><span id="rx-about-class" hidden></span><span id="rx-about-indication" hidden></span></div><a class="drug-text-link" data-drug-about-link href="#medication-details">Drug & safety information ↗</a></div>'
 s=s.replace(about,'')
 s=re.sub(r'<p class="drug-deck">.*?</p>',hero_about,s,count=1,flags=re.S)
 s=s.replace('<em>Your options, unpacked.</em>','').replace('A LITTLE CLARITY ON COST','KNOW YOUR MEDICATION',1)
 s=s.replace('<a href="#your-savings">Your savings</a>','<a href="#enroll-help">Enrollment help</a><a href="#pharmacy-prices">Pharmacy prices</a>',1).replace('<a href="#next-steps">Next steps</a>','',1)
 s=s.replace('href="#about-medication">About this medication','href="#medication-details">Drug details')
 s=s.replace('class="drug-options-page','class="drug-options-page') # Class appended below for existing shell.
 s=s.replace(' drug-options-page',' drug-options-page drug-conversion-v2',1)
 s=s.replace('<h2>How are you paying?</h2>','<h2>What insurance do you have?</h2>')
 s=re.sub(r'<button type="button" data-coverage="all".*?</button>','',s,count=1,flags=re.S)
 s=s.replace('Start with the option that matches your coverage. More than one route may be worth checking.','Choose your coverage to see the payment routes that may fit. No account needed.',1)
 s=s.replace('<div class="relief-source-status drug-source-status"','<div data-payment-results hidden><div class="relief-source-status drug-source-status"',1)
 s=s.replace('</p>\n </section>\n <section id="your-savings"','</p></div>\n </section>\n <section id="your-savings"',1)
 # Cash route in the result cards now leads to the dedicated comparison section.
 cash=re.search(r'<article class="drug-option drug-option-cash".*?</article>',s,re.S)[0]
 newcash=re.sub(r'<a class="drug-button.*?</a>','<a class="drug-button drug-button-light" href="#pharmacy-prices">Compare pharmacy prices ↓</a>',cash,count=1,flags=re.S)
 newcash=re.sub(r'<a class="drug-text-link drug-cash-secondary".*?</a>','',newcash,flags=re.S)
 newcash=newcash.replace(' data-drug-cash',' data-card-cash')
 s=s.replace(cash,newcash)
 old_pilot=re.search(r'<section id="enroll-help".*?</section>',s,re.S)
 if old_pilot:s=s.replace(old_pilot[0],'')
 email_details=re.search(r'<details class="drug-email-details">.*?</details>',s,re.S)[0]
 email_form=re.search(r'<form.*?</form>',email_details,re.S)[0]
 s=s.replace(email_details,'')
 conversion=f'''<section id="enroll-help" class="drug-conversion" aria-labelledby="ehTitle"><div class="drug-conversion-copy"><p class="drug-eyebrow">A LITTLE HELP WITH THE NEXT STEP</p><h2 id="ehTitle">Ready to get your {name} savings?</h2><p>A SaveRx guide can help you check which program may fit and work through the official enrollment steps.</p><ul><li>Help understanding program requirements</li><li>Guidance through the application process</li><li>A clear next step if you get stuck</li></ul><a id="eh-assist" class="drug-button" data-guided-placement="main" href="/get-help/?drug={slug}">Get Guided Enrollment Help ↗</a><p class="drug-small">Early access · Review available services and fees before requesting help. Eligibility and savings are not guaranteed.</p><a id="eh-official" data-program-link="self" class="drug-text-link" href="#payment-options" aria-disabled="true">Or enroll yourself on the official site ↗</a></div><div class="drug-email-panel" id="save-options"><p class="drug-eyebrow">NOT READY JUST YET?</p><h3>Keep the next step in your inbox.</h3><p>Get the official program link plus medication-related savings emails and follow-ups. Unsubscribe anytime.</p>{email_form}<label class="drug-email-consent"><input type="checkbox" required form="footerForm"> Email me the program link and medication-related savings updates. I can unsubscribe anytime.</label><p class="drug-small">Submitting opens the official program site. You can also use the direct link without sharing your email.</p></div></section>'''
 pharmacy=f'''<section id="pharmacy-prices" class="drug-section drug-pharmacy" aria-labelledby="pharmacy-title"><div><p class="drug-eyebrow">ANOTHER WAY TO COMPARE</p><h2 id="pharmacy-title">Compare Cash Prices at Your Pharmacy</h2><p>Compare quotes for the same dose, quantity, and supply. A pharmacy discount may not combine with insurance or count toward your deductible.</p><p class="drug-small">Prices vary by location and availability. The pharmacy confirms your final price.</p></div><div class="drug-pharmacy-action"><span class="drug-pharmacy-icon" aria-hidden="true">↔</span><h3>Find a local cash quote.</h3><p>Check current pharmacy prices for {name} on GoodRx.</p><a class="drug-button drug-button-light js-grx-all" href="https://www.goodrx.com/{slug}" target="_blank" rel="noopener sponsored">Compare pharmacy prices ↗</a><a class="drug-text-link" data-program-link="cash" hidden href="#program-sources">Manufacturer cash-pay route ↗</a><p class="drug-small" data-drug-cash>External price comparison. SaveRx does not provide a pharmacy quote.</p></div></section>'''
 s=s.replace('<section id="your-savings"',conversion+'\n'+pharmacy+'\n<section id="your-savings"',1)
 # Preserve the form markup; conversion script sets the button label.
 details='<details id="medication-details"><summary>More about this medication & safety <span aria-hidden="true">+</span></summary><p>Follow your prescription and the official medication guide. Ask your prescriber about uses, side effects, interactions, and how to take this medication. Discuss treatment changes with your care team.</p><a class="drug-text-link" data-full-drug-info href="#program-sources">View official information ↗</a></details>'
 s=s.replace('<section class="drug-details-section">','<section class="drug-details-section">'+details,1)
 sticky=f'''<aside class="drug-sticky" data-drug-sticky hidden aria-label="Enrollment help"><div><strong>A little help getting started.</strong><span>Review guided enrollment services and fees.</span></div><a class="drug-button" data-guided-placement="sticky" href="/get-help/?drug={slug}">Get Guided Enrollment Help ↗</a><button type="button" data-sticky-close aria-label="Dismiss enrollment reminder">×</button></aside><dialog class="drug-save-prompt" id="drug-save-prompt" aria-labelledby="save-prompt-title"><button type="button" data-save-dismiss aria-label="Dismiss email reminder">×</button><p class="drug-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2 id="save-prompt-title">Keep your next step handy.</h2><p>Get the official {name} program link and medication-related savings emails. No account needed. Unsubscribe anytime.</p><button class="drug-button" type="button" data-save-email>Email me the link ↗</button><button class="drug-prompt-later" type="button" data-save-dismiss>No thanks</button></dialog>'''
 s=s.replace('</main>',sticky+'</main>',1)
 s=s.replace('</body>','<script src="/assets/js/drug-conversion.js" defer></script></body>',1)
 s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/drug-conversion.css"></head>',1)
 s=s.replace('d = d || {};','d = d || {};\n          const pageProfile = JSON.parse(document.getElementById("drug-page-profile")?.textContent || "{}");\n          if (/^https:\\/\\//.test(pageProfile.copay?.url || "")) d.manufacturerUrl = pageProfile.copay.url;',1)
 consent=re.search(r'<label class="drug-email-consent">.*?</label>',s,re.S)[0]
 s=s.replace(consent,'',1).replace('<button id="footerSubmit"',consent+'\n<button id="footerSubmit"',1)
 s=s.replace('\n \n','\n\n')
 p.write_text(s)
print('Updated identity-first drug pages with enrollment, email and pharmacy sections.')

# New and existing pages finish with the approved at-a-glance summary.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/"scripts/upgrade-drug-summary.py")],check=True)
