#!/usr/bin/env python3
"""Install supplied brand exports and consistent icon/sharing metadata.
Uses checked-in artwork; no rendering dependencies or network access required.
"""
from pathlib import Path
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'relief-20261022'
for source, target in [
    ('assets/img/favicon.svg', 'assets/img/favicon-relief.svg'),
    ('assets/img/favicon.png', 'assets/img/favicon-relief-32.png'),
    ('assets/img/apple-touch-icon.png', 'assets/img/apple-touch-relief.png'),
    ('assets/img/favicon.ico', 'favicon.ico'),
]:
    shutil.copyfile(ROOT / source, ROOT / target)

manifest = {
    'name': 'SaveRx.ai', 'short_name': 'SaveRx', 'start_url': '/',
    'display': 'browser', 'background_color': '#f8f7f2', 'theme_color': '#313dc5',
    'icons': [
        {'src': f'/assets/img/icon-relief-{size}.png?v={VERSION}',
         'sizes': f'{size}x{size}', 'type': 'image/png'}
        for size in (192, 512)
    ],
}
(ROOT / 'site.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n')
image = f'https://saverx.ai/assets/img/share-relief.png?v={VERSION}'
metadata = f'''<!-- SaveRx browser and sharing identity -->
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon-relief.svg?v={VERSION}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-relief-32.png?v={VERSION}">
<link rel="shortcut icon" href="/favicon.ico?v={VERSION}">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-relief.png?v={VERSION}">
<link rel="manifest" href="/site.webmanifest?v={VERSION}">
<meta property="og:image" content="{image}">
<meta property="og:image:secure_url" content="{image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SaveRx.ai — A little less out of pocket. Find your way to prescription savings.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{image}">
<meta name="twitter:image:alt" content="SaveRx.ai — A little less out of pocket. Find your way to prescription savings.">
'''
files = subprocess.check_output(['git', 'ls-files', '*.html'], cwd=ROOT, text=True).splitlines()
count = 0
for name in files:
    p = ROOT / name
    if any(part in {'emails', 'staging', 'mockups', 'test', 'saverx-chat-proxy', 'node_modules'} for part in p.relative_to(ROOT).parts):
        continue
    source = p.read_text()
    match = re.search(r'<head\b[^>]*>(.*?)</head>', source, re.S | re.I)
    if not match:
        continue
    head = match[1]
    head = head.replace('<!-- SaveRx browser and sharing identity -->', '')
    def keep_link(m):
        rel = re.search(r'\brel\s*=\s*["\x27]([^"\x27]+)', m[0], re.I)
        return '' if rel and any(r in {'icon', 'apple-touch-icon', 'apple-touch-icon-precomposed', 'mask-icon', 'manifest'} for r in rel[1].lower().split()) else m[0]
    head = re.sub(r'<link\b[^>]*>', keep_link, head, flags=re.I)
    def keep_meta(m):
        key = re.search(r'\b(?:property|name)\s*=\s*["\x27]([^"\x27]+)', m[0], re.I)
        return '' if key and (key[1].lower().startswith(('og:image', 'twitter:image')) or key[1].lower() == 'twitter:card') else m[0]
    head = re.sub(r'<meta\b[^>]*>', keep_meta, head, flags=re.I)
    head = head.rstrip() + '\n' + metadata
    # Strip blank metadata slots so repeated runs are byte-identical.
    head = '\n'.join(line.rstrip() for line in head.split('\n'))
    head = re.sub(r'\n(?:[ \t]*\n)+', '\n', head)
    updated = source[:match.start(1)] + head + source[match.end(1):]
    if updated != source:
        p.write_text(updated)
    count += 1
print(f'Installed supplied brand icons and sharing metadata on {count} public pages/templates.')
