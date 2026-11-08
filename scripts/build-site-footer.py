#!/usr/bin/env python3
"""Refresh shared footers, preserving page-specific newsletter forms verbatim."""
from pathlib import Path
import re,subprocess
ROOT=Path(__file__).resolve().parents[1]
TEMPLATE=(ROOT/'templates/relief/footer.html').read_text().rstrip()
INTRO='<div class="relief-newsletter-intro"><h2>Prescription savings updates</h2><p>Receive savings information and practical guidance by email.</p></div>'
count=0
for name in subprocess.check_output(['git','ls-files','*.html'],cwd=ROOT,text=True).splitlines():
 p=ROOT/name
 if name=='templates/relief/footer.html':continue
 s=p.read_text();match=re.search(r'<footer class="relief-footer">.*?</footer>',s,re.S)
 if not match:continue
 old=match[0];form=re.search(r'<form\b[^>]*(?:data-newsletter|id="newsletter-form")[^>]*>.*?</form>',old,re.S)
 newsletter=''
 if form:
  extra='<p id="newsMsg" role="status" aria-live="polite"></p>' if 'id="newsletter-form"' in form[0] else ''
  newsletter='<div class="relief-newsletter">'+INTRO+form[0]+extra+'</div>'
 footer=TEMPLATE.replace('{{NEWSLETTER}}',newsletter)
 updated=s[:match.start()]+footer+s[match.end():]
 if updated!=s:p.write_text(updated);count+=1
print(f'Refreshed {count} shared footers; original newsletter forms retained.')
