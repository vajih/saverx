#!/usr/bin/env python3
"""
scripts/fetch-drug-images.py
────────────────────────────
Automatically fetches branded drug images from the Wikipedia REST API and
saves them locally in assets/img/drugs/{slug}.jpg.

Then updates data/drugs.json with a hero_landscape path for each drug
that gets an image.

Usage:
    python3 scripts/fetch-drug-images.py            # dry-run (prints what it would do)
    python3 scripts/fetch-drug-images.py --save     # downloads images + updates drugs.json
    python3 scripts/fetch-drug-images.py --save --limit 20   # first 20 drugs only

Requirements: Python 3.8+, no extra packages needed (uses stdlib urllib only)

Image quality filter:
  - Skips SVG files (usually chemical structures)
  - Skips images whose filename contains known scientific keywords
    (structure, molecule, formula, binding, mechanism, protein, etc.)
  - Keeps .jpg / .jpeg / .png images that look like product photos

License: Wikipedia images are CC-licensed. Attribution is embedded in
the image filename via the Wikipedia URL. For commercial use, verify the
individual image license at commons.wikimedia.org before publishing.
"""

import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

# ── Paths ──────────────────────────────────────────────────────────────────
REPO_ROOT  = pathlib.Path(__file__).resolve().parent.parent
DRUGS_JSON = REPO_ROOT / "data" / "drugs.json"
IMG_DIR    = REPO_ROOT / "assets" / "img" / "drugs"

WIKI_API    = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
WIKI_SEARCH = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&srlimit=3&format=json"
USER_AGENT  = "SaveRx.ai/1.0 (https://saverx.ai; info@saverx.ai) drug-image-fetcher"

# ── Heuristics: skip images that are scientific diagrams, not product photos ──
SKIP_EXTENSIONS = {".svg"}
SKIP_KEYWORDS = {
    "structure", "molecule", "formula", "binding", "mechanism", "protein",
    "crystal", "synthesis", "chemical", "receptor", "enzyme", "pathway",
    "diagram", "skeleton", "stereochem", "conformation", "fab_fragment",
    "isomer", "enantiomer", "pharmacophore",
    # 3-D molecular model images
    "3d_", "_3d", "-3d", "ball-and", "_ball", "stick_", "-stick",
    "space-fill", "space_fill",
    # Generic drug ingredient filenames (not branded product photos)
    "insulin_", "aspirin", "metformin", "4-amino",
}

def is_product_image(image_url: str) -> bool:
    """Return True if the URL looks like a product/package photo."""
    if not image_url:
        return False
    parsed   = urllib.parse.urlparse(image_url)
    path     = parsed.path.lower()
    name     = os.path.basename(path)
    ext      = os.path.splitext(name)[1]
    if ext in SKIP_EXTENSIONS:
        return False
    for kw in SKIP_KEYWORDS:
        if kw in name:
            return False
    return ext in {".jpg", ".jpeg", ".png", ".webp"}

def _fetch_url(url: str) -> bytes | None:
    """Fetch url using certifi-backed SSL; return bytes or None on error."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as resp:
            return resp.read()
    except Exception:
        return None


def _summary_image(title: str) -> str | None:
    """Call Wikipedia summary API for exact title; return filtered image URL or None."""
    url  = WIKI_API.format(title=urllib.parse.quote(title.replace(" ", "_"), safe=""))
    body = _fetch_url(url)
    if not body:
        return None
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    img = (data.get("thumbnail") or {}).get("source", "")
    if not img:
        return None
    # Upsample from thumbnail to larger/original
    if "/thumb/" in img:
        parts = img.split("/thumb/")
        sub   = parts[1]
        pieces = sub.rsplit("/", 1)
        img = parts[0] + "/" + pieces[0]
    return img if is_product_image(img) else None


def _search_title(query: str) -> str | None:
    """Use Wikipedia search API to find the best matching article title."""
    url  = WIKI_SEARCH.format(q=urllib.parse.quote(query))
    body = _fetch_url(url)
    if not body:
        return None
    try:
        data = json.loads(body)
        hits = data.get("query", {}).get("search", [])
        return hits[0]["title"] if hits else None
    except (json.JSONDecodeError, IndexError, KeyError):
        return None


def wikipedia_image(drug_name: str) -> str | None:
    """Try multiple title strategies then Wikipedia search; return image URL or None."""
    # Direct title candidates
    base = drug_name.replace("-", " ").strip()
    candidates = [
        base,
        base + " (medication)",
        base + " (drug)",
        base.split()[0],                  # first word only (e.g. "Ozempic")
    ]
    seen: set[str] = set()
    for title in candidates:
        t = title.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        img = _summary_image(t)
        if img:
            return img
        time.sleep(0.2)

    # Fallback: Wikipedia search
    found_title = _search_title(base)
    if found_title and found_title not in seen:
        seen.add(found_title)
        img = _summary_image(found_title)
        if img:
            return img

    return None

def download_image(url: str, dest: pathlib.Path) -> bool:
    """Download url to dest using certifi SSL. Returns True on success."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
            data = resp.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"    ✗ Download failed: {e}")
        return False

def ext_from_url(url: str) -> str:
    path = urllib.parse.urlparse(url).path
    ext  = os.path.splitext(path)[1].lower()
    return ext if ext in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    save_mode = "--save" in sys.argv
    limit_arg = next((sys.argv[i+1] for i, a in enumerate(sys.argv) if a == "--limit" and i+1 < len(sys.argv)), None)
    limit     = int(limit_arg) if limit_arg else None

    if not save_mode:
        print("DRY RUN — pass --save to actually download images and update drugs.json\n")

    data  = json.loads(DRUGS_JSON.read_text())
    items = data.get("items", data) if isinstance(data, dict) else data

    if limit:
        items = items[:limit]

    found = skipped = already = 0
    results = []  # list of (slug, local_path) tuples

    for drug in items:
        slug  = drug.get("slug") or (drug.get("brand") or drug.get("name") or "").lower().replace(" ", "-")
        name  = drug.get("brand") or drug.get("name") or slug

        # Check if already has a non-fallback image
        existing = drug.get("hero_landscape", "")
        if existing and "hero-1200" not in existing:
            print(f"  SKIP  {name} — already has image: {existing}")
            already += 1
            continue

        print(f"  {name:<35}", end="", flush=True)
        img_url = wikipedia_image(name)

        if not img_url:
            print("  ✗ no suitable image found")
            skipped += 1
            continue

        ext       = ext_from_url(img_url)
        dest_name = f"{slug}{ext}"
        local_rel = f"/assets/img/drugs/{dest_name}"
        dest_abs  = IMG_DIR / dest_name

        if save_mode:
            ok = download_image(img_url, dest_abs)
            if ok:
                drug["hero_landscape"] = local_rel
                results.append((name, local_rel))
                print(f"  ✓ saved → {local_rel}")
                found += 1
            else:
                skipped += 1
        else:
            print(f"  → would save {img_url[:60]}…")
            found += 1

        time.sleep(0.5)  # polite rate limit

    if save_mode and results:
        # Write updated drugs.json
        out = json.dumps(data if isinstance(data, dict) else {"items": items},
                         indent=2, ensure_ascii=False)
        DRUGS_JSON.write_text(out)
        print(f"\nUpdated {DRUGS_JSON.name}")

    print(f"\n{'─'*50}")
    print(f"  Found images : {found}")
    print(f"  No image     : {skipped}")
    print(f"  Already had  : {already}")
    if save_mode:
        print(f"\nNext steps:")
        print(f"  git add assets/img/drugs/ data/drugs.json")
        print(f"  git commit -m 'feat: add drug product images'")
        print(f"  git push origin main")
    else:
        print(f"\nRe-run with --save to download images.")

if __name__ == "__main__":
    main()
