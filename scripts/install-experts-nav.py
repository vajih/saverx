#!/usr/bin/env python3
"""Install the Experts route in existing public desktop/mobile navs and templates."""
from pathlib import Path
import re, subprocess
ROOT = Path(__file__).resolve().parents[1]
count = 0
for name in subprocess.check_output(['git','ls-files','*.html'],cwd=ROOT,text=True).splitlines():
    p = ROOT/name
    if any(x in p.relative_to(ROOT).parts for x in ['emails','staging','mockups','test','saverx-chat-proxy']): continue
    source = p.read_text()
    def update(match):
        nav = match[0]
        if 'href="/experts/"' in nav: return nav
        if 'aria-label="Main navigation"' not in nav and 'id="relief-navigation"' not in nav: return nav
        anchor = '<a href="/experts/">Experts</a>'
        if '<a href="/about.html"' in nav: return nav.replace('<a href="/about.html"',anchor+'<a href="/about.html"',1)
        return nav.replace('</nav>', anchor+'</nav>')
    updated = re.sub(r'<nav\b[^>]*>.*?</nav>',update,source,flags=re.S)
    if updated != source: p.write_text(updated); count += 1
print(f'Updated Experts navigation in {count} public pages/templates.')
