"""Refresh the embedded drug-page-profile JSON on already-migrated drug pages from data/drug-option-profiles.json.

build-drug-options.py embeds a profile only when it first migrates a page and then skips that page, so later edits to
data/drug-option-profiles.json do not reach pages that were already built. This script closes that gap, idempotently.

Scope: by default only slugs whose profile has a "program" (verified manufacturer benefit terms). Pass slugs to override:
    python3 scripts/sync-drug-profiles.py                 # all slugs with a program
    python3 scripts/sync-drug-profiles.py keytruda phesgo # just these
Only the <script type="application/json" id="drug-page-profile"> element is rewritten; nothing else on the page changes.
"""
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
profiles = json.loads((ROOT / 'data/drug-option-profiles.json').read_text())
items = {x['slug']: x for x in json.loads((ROOT / 'data/drugs.json').read_text())['items']}
PATTERN = re.compile(r'(<script type="application/json" id="drug-page-profile">)(.*?)(</script>)', re.S)

def embedded(slug):
    item = items.get(slug, {})
    name = item.get('brand') or item.get('name') or slug.replace('-', ' ').title()
    return json.dumps({'brand': name, **profiles[slug]}, ensure_ascii=False).replace('<', '\\u003c')

def main(argv):
    slugs = argv or [s for s, p in profiles.items() if 'program' in p]
    changed = 0
    for slug in slugs:
        if slug not in profiles:
            raise SystemExit(f'No profile for {slug} in data/drug-option-profiles.json')
        page = ROOT / 'drugs' / slug / 'index.html'
        html = page.read_text()
        if len(PATTERN.findall(html)) != 1:
            raise SystemExit(f'{page}: expected exactly one drug-page-profile element')
        new = PATTERN.sub(lambda m: m.group(1) + embedded(slug) + m.group(3), html, count=1)
        if new != html:
            page.write_text(new); changed += 1
    print(f'Synced {changed} of {len(slugs)} page(s): {", ".join(slugs)}')

if __name__ == '__main__':
    main(sys.argv[1:])
