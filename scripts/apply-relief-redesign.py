#!/usr/bin/env python3
"""Idempotently render relief discovery pages and upgrade legacy page shells.
No API calls, framework, backend changes, or deployment. Run from any directory.
"""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'templates/relief'
ESC = html.escape
CATEGORIES = json.loads((ROOT / 'data/categories.json').read_text())['categories']
ITEMS = json.loads((ROOT / 'data/drugs.json').read_text())['items']
ITEMS = [m for m in ITEMS if re.fullmatch(r'[a-z0-9-]+', m.get('slug', '')) and (ROOT / 'drugs' / m['slug'] / 'index.html').exists()]
HEADER = (TEMPLATES / 'header.html').read_text()
FOOTER = (TEMPLATES / 'footer.html').read_text().rstrip()
# Existing category mappings occasionally use aliases instead of directory slugs.
ALIASES = {'trelegy': 'trelegy-ellipta', 'nurtec': 'nurtec-odt'}
def category_slugs(cat):
    return {ALIASES.get(slug, slug) for slug in cat['drugs']}

def newsletter(source):
    form = re.search(r'<form\b[^>]*(?:data-newsletter|id="newsletter-form")[^>]*>.*?</form>', source, re.S)
    if not form:
        return ''
    # Reuse exact field names and IDs expected by the existing submission handler.
    markup = re.sub(r'<input(?![^>]*aria-label)([^>]*type="email"[^>]*)>', r'<input aria-label="Email address"\1>', form[0])
    extra = ''
    if 'id="newsletter-form"' in form[0]:
        extra = '<p id="newsMsg" role="status" aria-live="polite"></p>'
    return '<div class="relief-newsletter"><p>Savings tips in your inbox</p>'+markup+extra+'</div>'

def head_for(original, title=None, path=None):
    head = re.search(r'<head>(.*?)</head>', original, re.S).group(1) if original else (TEMPLATES / 'head.html').read_text()
    head = re.sub(r'<style>.*?</style>', '', head, flags=re.S)
    head = re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>', '', head)
    if title:
        head = re.sub(r'<title>.*?</title>', '<title>'+ESC(title)+' | SaveRx.ai</title>', head, flags=re.S)
    if path:
        url = 'https://saverx.ai'+path
        head = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>', '', head)
        head += '<link rel="canonical" href="'+url+'">'
    head = re.sub(r'<script(?: id="relief-api")?>window.SAVERX_FORM_API = window.SAVERX_FORM_API \|\| .*?</script>', '', head)
    head += '<script id="relief-api">window.SAVERX_FORM_API = window.SAVERX_FORM_API || '+json.dumps('https://script.google.com/macros/s/AKfycbxFzCPGBdOz215LTi97zqgyCAzd2fACiVcBh4Ic6emYhfoL9JcH0Ns09cvbpWZ-qJs6sA/exec')+';</script>'
    return re.sub(r'\n\s*\n', '\n', head).strip() + '\n<link rel="stylesheet" href="/assets/css/tokens.css"><link rel="stylesheet" href="/assets/css/relief.css"><link rel="stylesheet" href="/assets/css/relief-chrome.css">'

def save_new(path, body, original='', title=None, extra=''):
    target = ROOT/path
    url = '/'+path.replace('index.html', '')
    head = head_for(original, title, url)
    # Newly added hubs inherit the same consent and analytics setup as the homepage.
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('<!doctype html>\n<html lang="en"><head>'+head+'</head><body class="relief">'+HEADER+body.replace('id="main"','id="main-content"')+FOOTER.replace('{{NEWSLETTER}}',newsletter(original))+'<script defer src="/assets/js/relief.js"></script>'+extra+'</body></html>')

def card(m):
    name = m.get('brand') or m['name']
    categories = [c for c in CATEGORIES if m['slug'] in category_slugs(c)]
    label = ' · '.join(c['short_name'] for c in categories) or 'Manufacturer savings information'
    attrs = ' '.join(c['slug'] for c in categories)
    return '<a class="drug" data-name="'+ESC((name+' '+m.get('generic','')).lower(),quote=True)+'" data-categories="'+ESC(attrs)+'" href="/drugs/'+m['slug']+'/"><div class="drug-top"><span class="drug-badge" aria-hidden="true">✳</span><small>Medication savings</small></div><h3>'+ESC(name)+'</h3><p>'+ESC(label)+'</p><div class="drug-bottom"><span>Explore savings options</span><b aria-hidden="true">↗</b></div></a>'

def catalog(selected=None):
    items = sorted(ITEMS, key=lambda m:(m.get('brand') or m['name']).lower())
    if selected:
        items = [m for m in items if m['slug'] in category_slugs(selected)]
    filters = '<button class="active" aria-pressed="true" data-filter="all">All medications</button>'+''.join('<button aria-pressed="false" data-filter="'+c['slug']+'">'+ESC(c['name'])+'</button>' for c in CATEGORIES)
    if selected:
        filters = '<a class="text-link" href="/drugs/">← All medications</a>'+''.join('<p><a class="fine" href="/categories/'+c['slug']+'/">'+ESC(c['name'])+' ↗</a></p>' for c in CATEGORIES)
    return '<div class="catalog-layout"><aside><p class="filter-label">Explore by condition</p><div class="filters">'+filters+'</div></aside><div><label class="catalog-search">⌕ <input id="q" type="search" aria-label="Search medications" placeholder="Search a medication"></label><div class="result-meta"><span id="count" role="status">'+str(len(items))+' medications</span><span>Listed alphabetically</span></div><div class="grid">'+''.join(card(m) for m in items)+'<div id="empty" class="empty" hidden><strong>No matching medications.</strong><p class="fine">Try a shorter name or another condition. You can also <a href="/contact.html">request a medication</a>.</p></div></div><div class="note-box">Your insurance, coverage, and the manufacturer’s current terms determine whether you qualify. Explore a medication to find its program information.</div></div></div>'

def main_from(template):
    return re.search(r'<main\b.*?</main>', (TEMPLATES/template).read_text(), re.S).group(0)

# Home uses the approved composition with the production request/newsletter/chat integrations.
home = ROOT/'index.html'
old = home.read_text()
body = main_from('home.html')
body = body.replace('Eligibility explained upfront', 'Eligibility varies by program')
body = body.replace('No account needed', 'No account needed to search')
body = body.replace('https://saverx.ai/', '/')
body = body.replace('<input id="medication"', '<input name="q" id="medication"')
body = body.replace('id="search-form"', 'id="search-form" action="/drugs/" method="get"')
alert = '<section class="section relief-alert"><div><div class="eyebrow">A little help finding it</div><h2>Missing a medication?</h2><p class="fine">Tell us what you’re looking for.</p></div><form id="med-alert-form"><label for="drugName">Medication name</label><input id="drugName" name="drug" required autocomplete="off" placeholder="Medication name"><label for="alertEmail">Email address</label><input id="alertEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com"><button type="submit" class="primary">Notify me ↗</button><p id="alertMsg" role="status" aria-live="polite"></p></form></section>'
body += alert
save_new('index.html', body, old, extra='<link rel="stylesheet" href="/assets/css/relief-chat.css">'+(TEMPLATES/'integrations.html').read_text())
# Directory is rendered from all existing local records, with usable HTML when JS is disabled.
p = ROOT/'drugs/index.html';old=p.read_text();body=main_from('directory.html')
body=re.sub(r'<div class="catalog-layout">.*?(?=</main>)',catalog(),body,flags=re.S)
save_new('drugs/index.html',body,old)
# Condition pages use the existing category membership, not the prototype’s sample list.
for cat in CATEGORIES:
    p=ROOT/'categories'/cat['slug']/'index.html';old=p.read_text()
    count=len([m for m in ITEMS if m['slug'] in category_slugs(cat)])
    body='<main id="main" class="page"><div class="crumb"><a href="/">Home</a> / <a href="/categories/">Conditions</a> / '+ESC(cat['name'])+'</div><div class="eyebrow">Savings by condition</div><h1 class="page-title">'+ESC(cat['name'])+'.<br><em>A little more clarity.</em></h1><p class="deck">Explore '+str(count)+' medication'+('s' if count!=1 else '')+' in this category. Choose a name to see savings information and next steps.</p>'+catalog(cat)+'</main>'
    signup = '<section class="relief-category-signup"><h2>A little heads-up on savings.</h2><p class="fine">Get savings updates for this category.</p><form id="catEmailForm"><div class="visually-hidden" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div><input name="email" type="email" required autocomplete="email" aria-label="Email address" placeholder="you@example.com"><input type="hidden" name="drug" value="'+ESC(cat['name'])+'"><input type="hidden" name="source" value="SaveRx Category - '+cat['slug']+'"><button type="submit" class="primary">Get savings alerts ↗</button><p class="form-msg" role="status" aria-live="polite"></p></form><p class="fine">Unsubscribe anytime.</p></section>'
    body=body.replace('</main>',signup+'</main>')
    save_new(str(p.relative_to(ROOT)),body,old,extra='<script>if(typeof gtag === "function")gtag("event","view_category",{category:'+json.dumps(cat['slug'])+'});</script>')
p=ROOT/'categories/index.html';old=p.read_text();body=main_from('conditions.html')
body=body.replace('https://saverx.ai/', '/')
save_new('categories/index.html',body,old)
# New guidance hub routes to existing educational URLs; articles keep their full content.
learn_body=main_from('learn.html')
for old_url,new_url in {
 '/learn/copay-cards/':'/learn/how-copay-cards-work.html',
 '/learn/patient-assistance/':'/learn/copay-cards-vs-patient-assistance-programs.html',
 '/learn/pharmacy-checklist/':'/learn/how-to-reduce-prescription-costs.html',
}.items():learn_body=learn_body.replace(old_url,new_url)
save_new('learn/index.html',learn_body,title='A little guidance',extra='<script defer src="/assets/scripts.js?v=relief-1"></script>')

# Port the shared identity onto existing editorial and transactional pages.
paths = [ROOT/p for p in ['about.html','contact.html','comparisons.html','ozempic-vs-wegovy.html','mounjaro-vs-ozempic.html','wegovy-vs-mounjaro.html','privacy.html','terms.html','pharmacy.html']]
paths += [p for p in (ROOT/'learn').glob('*.html') if p.name != 'index.html'] + list((ROOT/'conditions').glob('*/index.html'))
paths += [p for p in (ROOT/'drugs').rglob('*.html') if p != ROOT/'drugs/index.html']
paths += [ROOT/'templates/index.html', ROOT/'get-help/index.html']
changed=0
for p in paths:
    if p.relative_to(ROOT).as_posix() in {'about.html', 'contact.html', 'comparisons.html', 'ozempic-vs-wegovy.html', 'mounjaro-vs-ozempic.html', 'wegovy-vs-mounjaro.html'}:
        continue
    s=p.read_text()
    if 'design-relief' in s:continue
    s=re.sub(r'<body([^>]*)class="([^"]*)"',r'<body\1class="\2 design-relief"',s,count=1)
    if 'design-relief' not in s:s=s.replace('<body>','<body class="design-relief">',1)
    s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/relief-legacy.css"><link rel="stylesheet" href="/assets/css/relief-chrome.css"></head>',1)
    s=re.sub(r'<header\b[^>]*>.*?</header>',HEADER,s,count=1,flags=re.S)
    # Reuse the old newsletter fields. Nested blockquote footers must not be replaced.
    match=re.search(r'<footer\b[^>]*class="[^"]*footer[^"]*"[^>]*>.*?</footer>',s,re.S)
    if match:s=s[:match.start()]+FOOTER.replace('{{NEWSLETTER}}',newsletter(match[0]))+s[match.end():]
    if '<main' in s:
        s=re.sub(r'<main\b(?![^>]*\bid=)([^>]*)>',r'<main id="main-content"\1>',s,count=1)
        s=s.replace('href="#main-content"','href="#'+(re.search(r'<main[^>]*id="([^"]+)"',s).group(1))+'"',1)
    else:s=s.replace('href="#main-content"','href="#top"',1).replace('<body ', '<body id="top" ',1)
    s=s.replace('</body>','<script defer src="/assets/js/relief.js"></script></body>',1)
    # Restructure only standard, data-bound drug pages. All scripts and form IDs stay intact.
    is_drug = 'data-saverx-insurance-accordion' in s and 'class="rx-hero"' in s
    if is_drug:
        insurance=re.search(r'<section class="insurance-accordion".*?</section>',s,re.S)
        hero=re.search(r'<section class="rx-hero">.*?</section>',s,re.S)
        if insurance and hero:
            replacement='<div class="relief-drug-layout">'+insurance[0]+hero[0].replace('</section>','<p class="relief-source-note">Manufacturer savings are subject to eligibility and program limits. Confirm the current terms on the official program website.</p></section>')+'</div>'
            s=s[:insurance.start()]+s[insurance.end():]
            s=s.replace(hero[0],replacement,1)
        s=s.replace('<section class="rx-lede">','<section class="rx-lede"><div class="relief-breadcrumb"><a href="/">Home</a> / <a href="/drugs/">Medications</a> / <span data-bind="brand">'+ESC(p.parent.name.replace('-',' ').title())+'</span></div>',1)
        s=s.replace('<h1 class="rx-title"><span data-bind="brand"></span></h1>','<h1 class="rx-title"><span data-bind="brand"></span><span class="relief-drug-subtitle">Let’s explore your options.</span></h1>',1)
    p.write_text(s);changed+=1
print(f'Rendered {len(ITEMS)} directory records and {len(CATEGORIES)} categories; upgraded {changed} existing pages.')

# Upgrade duplicate legacy loaders through one shared read-only adapter.
for p in list((ROOT/'drugs').glob('*/index.html')) + [ROOT/'templates/index.html']:
    s = p.read_text()
    if 'const API = window.SAVERX_API;' not in s or 'SaveRxDrugData.load' in s:
        continue
    s = s.replace('</head>', '<script src="/assets/js/drug-data.js"></script></head>', 1)
    start = s.find('          const u = `${API}?mode=drug&slug=')
    end = s.find('          d = d || {};', start)
    if start < 0 or end < 0:
        raise ValueError('Unrecognized data loader in '+str(p))
    s = s[:start] + '          let d = await window.SaveRxDrugData.load(API, slug);\n' + s[end:]
    s = s.replace('const f = Number(n);', 'const f = window.SaveRxDrugData.amount(n);')
    s = s.replace('const cash = Number(d.cash_price);', 'const cash = window.SaveRxDrugData.amount(d.cash_price);')
    s = s.replace('const copay = Number(d.copay_price);', 'const copay = window.SaveRxDrugData.amount(d.copay_price);')
    s = s.replace("          window.__manufacturerUrl = d.manufacturerUrl || '/';", r"""          // Do not let an unavailable program silently route to the homepage.
          const sourceReady = /^https?:\/\//i.test(String(d.manufacturerUrl || ''));
          const sourceStatus = document.querySelector('.relief-source-status');
          if (sourceStatus) {
            sourceStatus.hidden = sourceReady;
            sourceStatus.textContent = 'Current savings information is unavailable. Please try again later or contact help@saverx.ai. No price or eligibility is confirmed.';
          }
          document.querySelectorAll('.js-check-savings, .js-accordion-cta, #footerSubmit').forEach(el => {
            if (el.tagName === 'BUTTON') el.disabled = !sourceReady;
            el.setAttribute('aria-disabled', String(!sourceReady));
            if (!sourceReady && el.tagName === 'A') {
              el.setAttribute('tabindex', '-1');
              el.addEventListener('click', event => event.preventDefault(), {capture:true});
              el.onclick = () => false;
            }
          });
          window.__manufacturerUrl = sourceReady ? d.manufacturerUrl : '';""")
    s = s.replace('      // Modal lead submit', r"""      // No form should open a misleading destination when the data source fails.
      for (const formId of ['modal-lead-form', 'footerForm']) {
        document.getElementById(formId)?.addEventListener('submit', event => {
          if (!/^https?:\/\//i.test(String(window.__manufacturerUrl || ''))) {
            event.preventDefault(); event.stopImmediatePropagation();
          }
        }, {capture:true});
      }
      // Modal lead submit""")
    s = s.replace('<section class="rx-lede">', '<div class="relief-source-status" role="status" aria-live="polite">Loading current program information…</div><section class="rx-lede">', 1)
    s = re.sub(r'<div class="rx-testimonial">.*?</div>\s*</div>', '', s, flags=re.S)
    # Render a meaningful medication heading even before the remote API responds.
    slug = p.parent.name
    item = next((m for m in ITEMS if m['slug'] == slug), None)
    if item:
        name = ESC(item.get('brand') or item['name'])
        s = s.replace('<span data-bind="brand"></span>', '<span data-bind="brand">'+name+'</span>')
    p.write_text(s)

# Keep the shared footer current even on pages already migrated to the redesign.
# Internal tools, email templates, prototypes, and test fixtures use separate shells.
footer_paths = set(paths + [ROOT/'index.html', ROOT/'drugs/index.html',
    ROOT/'categories/index.html', ROOT/'learn/index.html', ROOT/'conditions/index.html',
    ROOT/'get-glp1.html'] + list((ROOT/'categories').glob('*/index.html')))
for p in footer_paths:
    source = p.read_text()
    match = re.search(r'<footer\b[^>]*class="[^"]*(?:relief-footer|footer)[^"]*"[^>]*>.*?</footer>', source, re.S)
    shared = FOOTER.replace('{{NEWSLETTER}}', newsletter(match[0]) if match else '')
    if match:
        source = source[:match.start()] + shared + source[match.end():]
    else:
        source = source.replace('</body>', shared + '</body>', 1)
    if '/assets/css/relief-chrome.css' not in source:
        source = source.replace('</head>', '<link rel="stylesheet" href="/assets/css/relief-chrome.css"></head>', 1)
    p.write_text(source)

# Stable formatting keeps generated changes reviewable and reruns byte-identical.
for p in footer_paths | set(paths + [ROOT/'index.html', ROOT/'drugs/index.html', ROOT/'categories/index.html', ROOT/'learn/index.html'] + list((ROOT/'categories').glob('*/index.html'))):
    if p.exists():
        p.write_text('\n'.join(line.rstrip() for line in p.read_text().splitlines())+'\n')

# Supporting-page templates own their structure after the base migration.
import subprocess, sys
subprocess.run([sys.executable, str(ROOT / "scripts/build-support-pages.py")], check=True)

# Apply the options-first layout to new standard drug pages.
subprocess.run([sys.executable,str(ROOT/"scripts/build-drug-options.py")],check=True)

# Restore shared browser/sharing identity after page generation.
import subprocess, sys
subprocess.run([sys.executable, str(ROOT / "scripts/build-brand-assets.py")], check=True)
