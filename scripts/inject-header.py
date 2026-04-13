#!/usr/bin/env python3
"""
inject-header.py — SaveRx.ai build-time header injector

Reads assets/components/header.html and replaces the <header class="header">
block in every page with the canonical version. Also ensures
<script src="/assets/js/nav.js"> is present before </body>.

Run this whenever you change assets/components/header.html:
  python3 scripts/inject-header.py

Safe to re-run multiple times (idempotent).
"""

import re
import pathlib
import sys

ROOT      = pathlib.Path(__file__).parent.parent
HEADER_SRC = ROOT / "assets/components/header.html"
NAV_SCRIPT = '  <script src="/assets/js/nav.js"></script>'

# ── Read the canonical header ──────────────────────────────────────────
if not HEADER_SRC.exists():
    sys.exit(f"ERROR: {HEADER_SRC} not found")

# Strip the HTML comment block at the top of header.html
raw = HEADER_SRC.read_text(encoding="utf-8")
header_html = re.sub(r'^<!--[\s\S]*?-->\s*\n?', '', raw).strip()

# Build the indented replacement block
HEADER_REPLACEMENT = (
    "  <!-- =======================\n"
    "       Header / Primary Nav\n"
    "       ======================= -->\n"
    + "\n".join("  " + line if line.strip() else line
                for line in header_html.splitlines())
)

# ── Collect all pages ──────────────────────────────────────────────────
PATTERNS = [
    ROOT.glob("*.html"),
    ROOT.glob("categories/**/*.html"),
    (ROOT / "drugs").glob("index.html"),
    (ROOT / "drugs").glob("*/index.html"),
    iter([ROOT / "templates/index.html"]),
]
EXCLUDE = {"staging", "newmockupApril6", "list.html"}

pages = []
for pattern in PATTERNS:
    for f in pattern:
        if not any(ex in str(f) for ex in EXCLUDE):
            pages.append(f)

# ── Regex to match existing <header class="header"> blocks ────────────
HEADER_BLOCK_RE = re.compile(
    r'(?:[ \t]*<!--[^\n]*-->\s*\n)?'   # optional preceding comment line
    r'[ \t]*<header class="header">[\s\S]*?</header>',
    re.DOTALL
)

# ── Process each page ──────────────────────────────────────────────────
updated = already_ok = skipped = 0

for f in sorted(pages):
    src = f.read_text(encoding="utf-8")
    out = src

    # 1. Replace header block
    m = HEADER_BLOCK_RE.search(out)
    if m:
        out = out[:m.start()] + HEADER_REPLACEMENT + out[m.end():]
    else:
        # No existing header — insert after <body ...> line
        out = re.sub(
            r'(<body[^>]*>\s*(?:<!--.*?-->\s*)?(?:<noscript>[\s\S]*?</noscript>\s*)?)',
            r'\1' + HEADER_REPLACEMENT + '\n',
            out, count=1, flags=re.DOTALL
        )

    # 2. Ensure nav.js is present before </body>
    if NAV_SCRIPT not in out:
        out = out.replace('</body>', NAV_SCRIPT + '\n</body>', 1)

    # 3. Remove any old inline hamburger / dropdown JS blocks
    out = re.sub(
        r'\s*<script>\s*\(function\(\)\{\s*var btn = document\.querySelector\(\'\.nav-toggle\'\)'
        r'[\s\S]*?\}\)\(\);\s*</script>',
        '', out
    )
    out = re.sub(
        r'\s*<script>\s*/\* ----? Nav dropdown ----? \*/[\s\S]*?\}\)\(\);\s*</script>',
        '', out
    )

    if out == src:
        already_ok += 1
        continue

    f.write_text(out, encoding="utf-8")
    updated += 1

print(f"✓ Updated : {updated}")
print(f"  Already OK: {already_ok}")
print(f"  Skipped   : {skipped}")
print(f"\nTo deploy: wrangler pages deploy . --project-name saverx")
