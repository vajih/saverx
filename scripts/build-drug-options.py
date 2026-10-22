"""Migrate standard data-bound medication pages to the options-first UI."""
from pathlib import Path
import re,json,html
ROOT=Path(__file__).resolve().parents[1]
profiles=json.loads((ROOT/'data/drug-option-profiles.json').read_text())
items={x['slug']:x for x in json.loads((ROOT/'data/drugs.json').read_text())['items']}
template=(ROOT/'templates/relief/drug/options.html').read_text()
pages=list((ROOT/'drugs').glob('*/index.html'))+[ROOT/'templates/index.html']
count=0
for p in pages:
 s=p.read_text()
 if 'SaveRxDrugData.load' not in s or 'drug-options-page' in s:continue
 slug=p.parent.name if p.parent.name!='templates' else 'medication'
 name=items.get(slug,{}).get('brand') or items.get(slug,{}).get('name') or slug.replace('-',' ').title()
 profile={'brand':name,**profiles.get(slug,{})}
 begin=s.index('<main ');end=s.index('  <!-- Modal',begin)
 old=s[begin:end]
 form=re.search(r'<form\b[^>]*id="footerForm".*?</form>',old,re.S)
 if not form:raise ValueError(f'Missing footer form {p}')
 scripts='\n'.join(re.findall(r'<script\b.*?</script>',old,re.S))
 pilot=re.search(r'<section\b[^>]*id="enroll-help".*?</section>',old,re.S)
 pilot_html=''
 if pilot:
  pilot_html=f'''<section id="enroll-help" class="drug-help-pilot" aria-labelledby="ehTitle"><div><p class="drug-eyebrow">A LITTLE EXTRA HELP</p><h2 id="ehTitle">Hit a snag with enrollment?</h2><p>SaveRx offers an early-access guided-help route. Review its scope and any fees before submitting a request.</p></div><div><a id="eh-assist" class="drug-button" href="/get-help/?drug={slug}">Explore guided help ↗</a><a id="eh-official" class="drug-text-link" href="#payment-options">Open official program ↗</a><p class="drug-small">SaveRx is independent. Enrollment takes place through the official program.</p></div></section>'''
 affiliate=re.search(r'<section\b[^>]*class="affiliate-cta".*?</section>',old,re.S)
 affiliate_html='<details class="drug-affiliate"><summary>Other paid services <span aria-hidden="true">+</span></summary>'+affiliate[0]+'</details>' if affiliate else ''
 main=template.replace('__NAME__',html.escape(name)).replace('__GOODRX__',f'https://www.goodrx.com/{slug}').replace('__EMAIL_FORM__',form[0]).replace('__PILOT__',pilot_html).replace('__AFFILIATE__',affiliate_html).replace('__PRESERVED_SCRIPTS__',scripts)
 if profile.get('generic'):
  main=main.replace('data-drug-identity>Prescription medication','data-drug-identity>'+html.escape(' · '.join(filter(None,[profile.get('generic'),profile.get('manufacturer')]))))
 s=s[:begin]+main+s[end:]
 s=re.sub(r'(<body\b[^>]*class=")([^"]*)',lambda m:m[1]+m[2]+' drug-options-page',s,count=1)
 s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/drug-options.css"></head>',1)
 s=s.replace('</body>','<script src="/assets/js/drug-options.js" defer></script></body>',1)
 record='<script type="application/json" id="drug-page-profile">'+json.dumps(profile,ensure_ascii=False).replace('<','\\u003c')+'</script>'
 s=s.replace('<main id="main-content" class="drug-main">',record+'\n<main id="main-content" class="drug-main">',1)
 # Publish the existing read-only response to the shared UI, without a second request.
 s=s.replace('d = d || {};','d = d || {};\n          window.__saverxDrugRecord = d;',1)
 s=s.replace('// ── End GoodRx section',"window.dispatchEvent(new CustomEvent('saverx:drug-data', {detail:d}));\n          // ── End GoodRx section",1)
 # Do not create six repeated outbound pharmacy cards; the new UI has one comparison route.
 # Existing guarded rendering finds no rx-ph-grid and leaves the API/forms unchanged.
 p.write_text(s);count+=1
print(f'Migrated {count} standard drug pages/templates.')

# Apply the conversion layout after migrating any newly generated pages.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/"scripts/upgrade-drug-conversion.py")],check=True)
