"""Idempotent drug-page polish and compact directory. No API calls or deployments."""
from pathlib import Path
import re,json,html
ROOT=Path(__file__).resolve().parents[1]
DIALOG='''<dialog class="drug-email-gate" id="drug-email-gate" aria-labelledby="gate-title"><button class="gate-close" type="button" data-gate-close aria-label="Close email step">×</button><p class="drug-eyebrow">A LITTLE LESS TO KEEP TRACK OF</p><h2 id="gate-title">Your next step, <em>saved.</em></h2><p id="gate-description">Share your email before continuing. We’ll send medication-related savings emails and follow-ups. Unsubscribe anytime.</p><div class="gate-destination"><span>YOU’RE HEADING TO</span><strong id="gate-destination"></strong><small id="gate-domain"></small></div><form id="drug-outbound-form"><label for="gate-email">Your email address</label><input id="gate-email" type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required><input type="text" name="website" class="hp" tabindex="-1" aria-hidden="true" autocomplete="off"><label class="gate-consent"><input id="gate-consent" type="checkbox" required><span>Email me medication-related savings information and follow-ups. I can unsubscribe anytime.</span></label><button class="drug-button" type="submit">Share email &amp; continue ↗</button><p id="gate-status" role="status" aria-live="polite"></p><p class="drug-small">SaveRx is independent. This isn’t enrollment in a manufacturer program. <a href="/privacy.html">Privacy policy</a> · <a href="/terms.html">Terms</a></p></form></dialog>'''
count=0
for p in list((ROOT/'drugs').glob('*/index.html'))+[ROOT/'templates/index.html']:
 s=p.read_text()
 if 'drug-options-page' not in s:continue
 s=s.replace('02 / PUT IT IN YOUR TERMS','PUT IT IN YOUR TERMS').replace('04 / ONE SMALL STEP AT A TIME','ONE SMALL STEP AT A TIME')
 category=re.search(r'\s*<p class="drug-category-link">.*?</p>',s,re.S)
 if category:
  content=category.group(0).strip()
  s=s[:category.start()]+s[category.end():]
  s=s.replace('<p class="drug-identity" data-drug-identity>Prescription medication</p>','<p class="drug-identity" data-drug-identity>Prescription medication</p>'+content,1)
 s=s.replace('Submitting opens the official program site. You can also use the direct link without sharing your email.','Share your email to continue to the official program. You’ll receive medication-related savings emails and can unsubscribe anytime.')
 if 'id="drug-email-gate"' not in s:s=s.replace('</main>',DIALOG+'</main>',1)
 if '/assets/css/drug-polish.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/drug-polish.css"></head>',1)
 if '/assets/js/drug-outbound.js' not in s:s=s.replace('</body>','<script defer src="/assets/js/drug-outbound.js"></script></body>',1)
 p.write_text(s);count+=1
# Enrich compact cards with existing metadata only; never publish stale price data.
metadata={}
for item in json.loads((ROOT/'data/featured-drugs.json').read_text()):
 metadata[item['name'].lower()]={k:item[k] for k in ['generic','manufacturer'] if item.get(k)}
profiles=json.loads((ROOT/'data/drug-option-profiles.json').read_text())
for slug,item in profiles.items():metadata[(item.get('brand') or slug).lower()]={**metadata.get((item.get('brand') or slug).lower(),{}),**{k:item[k] for k in ['generic','manufacturer'] if item.get(k)}}
p=ROOT/'drugs/index.html';s=p.read_text()
def card(m):
 raw=m.group(0);name=html.unescape(re.search(r'<h3>(.*?)</h3>',raw,re.S)[1]);meta=metadata.get(name.lower(),{})
 category=re.search(r'<p(?: class="drug-card-category")?>(.*?)</p>',raw,re.S);label=category[1] if category else 'Medication savings'
 if 'drug-card-category' in raw:
  # Read the original category from its explicit marker on subsequent runs.
  label=re.search(r'<p class="drug-card-category">(.*?)</p>',raw,re.S)[1]
 opening=raw[:raw.index('>')+1]
 search=re.search(r'data-name="([^"]*)"',opening)
 if search:
  enriched=' '.join([name,meta.get('generic',''),meta.get('manufacturer','')]).lower().strip()
  opening=opening[:search.start(1)]+html.escape(enriched,quote=True)+opening[search.end(1):]
 generic=html.escape(meta.get('generic','Prescription medication'))
 maker='<span class="drug-card-maker">'+html.escape(meta['manufacturer'])+'</span>' if meta.get('manufacturer') else ''
 return opening+'<div class="drug-card-heading"><h3>'+html.escape(name)+'</h3><span aria-hidden="true">↗</span></div><p class="drug-card-generic">'+generic+'</p><p class="drug-card-category">'+label+'</p>'+maker+'<div class="drug-card-paths"><span>Program options</span><span>Pharmacy prices</span></div></a>'
s=re.sub(r'<a class="drug"(?=\s).*?</a>',card,s,flags=re.S)
if 'directory-compact' not in s:s=s.replace('class="relief"','class="relief directory-compact"',1)
if '/assets/css/drug-polish.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/drug-polish.css"></head>',1)
s=s.replace('placeholder="Search a medication"','placeholder="Search brand, generic, or manufacturer"')
if '/assets/js/drug-directory.js' not in s:s=s.replace('</body>','<script defer src="/assets/js/drug-directory.js"></script></body>',1)
p.write_text(s)
print(f'Polished {count} drug pages/templates and the medication directory.')
