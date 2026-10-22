#!/usr/bin/env python3
"""Render supporting pages without changing existing backend/analytics scripts."""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
T=ROOT/'templates/relief/support'
PAGES={
 'comparisons.html':('comparisons.html','Compare prescription savings programs','Understand manufacturer copay cards and patient assistance, then explore medication savings guides.'),
 'learn/index.html':('learn.html','Prescription savings guides','Practical guides to prescription savings, copay cards, patient assistance, and insurance.'),
 'about.html':('about.html','Our story','The story behind SaveRx and a clearer path to official prescription savings programs.'),
 'contact.html':('contact.html','Contact SaveRx','Ask a savings question, report a link, or start a partnership conversation with SaveRx.'),
 'request-medication.html':('request.html','Request a medication','Tell SaveRx which medication you could not find and request medication-related savings emails.'),
}
for dest,(source,title,description) in PAGES.items():
 p=ROOT/dest
 original=p.read_text() if p.exists() else (ROOT/'contact.html').read_text()
 head=re.search(r'<head>(.*?)</head>',original,re.S)[1]
 head=re.sub(r'<style\b[^>]*>.*?</style>','',head,flags=re.S)
 head=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',head)
 # Existing metadata is replaced once, avoiding inherited homepage article/schema claims.
 head=re.sub(r'<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>','',head,flags=re.S)
 head=re.sub(r'<title>.*?</title>','<title>'+title+' | SaveRx.ai</title>',head,flags=re.S)
 head=re.sub(r'<meta\b[^>]*(?:name="description"|property="og:(?:title|description|url)")[^>]*>','',head)
 head=re.sub(r'<link\b[^>]*rel="canonical"[^>]*>','',head)
 path='/'+dest.replace('index.html','')
 head+='<meta name="description" content="'+description+'"><meta property="og:title" content="'+title+' | SaveRx.ai"><meta property="og:description" content="'+description+'"><meta property="og:url" content="https://saverx.ai'+path+'"><link rel="canonical" href="https://saverx.ai'+path+'">'
 head+=''.join('<link rel="stylesheet" href="/assets/css/'+css+'">' for css in ['tokens.css','relief.css','relief-chrome.css','support-pages.css'])
 head=re.sub(r'\n\s*\n','\n',head).strip()
 header=(ROOT/'templates/relief/header.html').read_text()
 footer=re.search(r'<footer class="relief-footer">.*?</footer>',original,re.S)[0]
 if dest=='request-medication.html':footer=(ROOT/'templates/relief/footer.html').read_text().replace('{{NEWSLETTER}}','')
 tail=original[original.rfind('</footer>')+len('</footer>'):]
 tail=re.sub(r'</body>\s*</html>\s*$','',tail).strip()
 if dest=='request-medication.html':tail='<script defer src="/assets/js/relief.js"></script>'
 # One deferred behavior script, even after rerendering.
 tail=re.sub(r'<script\b[^>]*src="/assets/js/support-pages.js"[^>]*></script>','',tail)
 tail=tail.strip()
 tail+='<script defer src="/assets/js/support-pages.js"></script>'
 noscript='<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MVZBBF7R" height="0" width="0" hidden title="Google Tag Manager"></iframe></noscript>'
 html='<!doctype html>\n<html lang="en"><head>'+head+'</head><body class="relief support-page">'+noscript+header+(T/source).read_text()+footer+tail+'</body></html>\n'
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text('\n'.join(line.rstrip() for line in html.splitlines())+'\n')
# Keep existing learning articles and their content, with a matching reading layout.
for p in (ROOT/'learn').glob('*.html'):
 if p.name=='index.html':continue
 s=p.read_text()
 if 'support-article' not in s:
  s=s.replace('design-relief','design-relief support-article',1)
  s=s.replace('</head>','<link rel="stylesheet" href="/assets/css/support-pages.css"></head>',1)
 p.write_text(s)
# Existing Request links get a real destination; no other footer content is changed.
for p in ROOT.rglob('*.html'):
 if any(part in p.parts for part in ['.git','node_modules','staging','mockups','emails']):continue
 s=p.read_text();new=s.replace('href="/contact.html">Request a medication','href="/request-medication.html">Request a medication')
 if s!=new:p.write_text(new)
print('Rendered five supporting pages; retained contact handlers and guide content.')

# Keep individual guides on the current reading UI after hub generation.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/"scripts/build-article-pages.py")],check=True)
