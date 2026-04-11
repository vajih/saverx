#!/usr/bin/env python3
"""
scripts/fetch-drug-images.py
────────────────────────────
Fetches branded drug product images and saves them to assets/img/drugs/{slug}.jpg.
Updates data/drugs.json with hero_landscape paths for each drug that gets an image.

Image sources (tried in order):
  1. Google Custom Search Images API  — ~95% hit rate, returns real product photos
  2. Wikipedia REST API               — fallback, ~12% hit rate

Usage:
    python3 scripts/fetch-drug-images.py            # dry-run
    python3 scripts/fetch-drug-images.py --save     # download + update drugs.json
    python3 scripts/fetch-drug-images.py --save --limit 20   # first 20 drugs only
    python3 scripts/fetch-drug-images.py --save --skip-existing  # skip drugs already done

Setup for Google Custom Search (recommended):
  1. Create a search engine at programmablesearchengine.google.com
     - Search the entire web; note the Search Engine ID (cx)
  2. Enable "Custom Search API" at console.cloud.google.com and create an API key
  3. Add to .env (or export before running):
       GOOGLE_CSE_KEY=AIza...
       GOOGLE_CSE_CX=a1b2c3d4e...

Without those env vars the script falls back to Wikipedia only.

Requirements: Python 3.8+, stdlib only (uses certifi if installed for SSL)
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
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DRUGS_JSON = REPO_ROOT / "data" / "drugs.json"
IMG_DIR = REPO_ROOT / "assets" / "img" / "drugs"

# ── API endpoints ──────────────────────────────────────────────────────────
GOOGLE_CSE_URL = (
    "https://www.googleapis.com/customsearch/v1"
    "?key={key}&cx={cx}&q={q}&searchType=image"
    "&imgType=photo&imgSize=large&num=5&safe=active"
)
WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
WIKI_SEARCH = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&srlimit=3&format=json"
USER_AGENT = "SaveRx.ai/1.0 (https://saverx.ai; info@saverx.ai) drug-image-fetcher"

# ── Google CSE credentials (loaded from env) ───────────────────────────────
# Load .env file if present (simple KEY=VALUE parser, no dotenv package needed)
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

GOOGLE_CSE_KEY = os.environ.get("GOOGLE_CSE_KEY", "")
GOOGLE_CSE_CX = os.environ.get("GOOGLE_CSE_CX", "")

# ── Image quality heuristics ───────────────────────────────────────────────
SKIP_EXTENSIONS = {".svg", ".gif", ".tiff", ".bmp"}
SKIP_KEYWORDS = {
    "structure",
    "molecule",
    "formula",
    "binding",
    "mechanism",
    "protein",
    "crystal",
    "synthesis",
    "chemical",
    "receptor",
    "enzyme",
    "pathway",
    "diagram",
    "skeleton",
    "stereochem",
    "conformation",
    "fab_fragment",
    "isomer",
    "enantiomer",
    "pharmacophore",
    "3d_",
    "_3d",
    "-3d",
    "ball-and",
    "_ball",
    "stick_",
    "-stick",
    "space-fill",
    "space_fill",
    "insulin_",
    "aspirin",
    "metformin",
    "4-amino",
}
# Domains that host good pharmaceutical product photos
PREFERRED_DOMAINS = {
    "rxlist.com",
    "drugs.com",
    "goodrx.com",
    "pdr.net",
    "cvs.com",
    "walgreens.com",
    "optum.com",
    "wikimedia.org",  # product photos on Wikipedia Commons
}
# Domains to avoid (usually molecular diagrams or low-quality)
SKIP_DOMAINS = {
    "chemspider.com",
    "pubchem.ncbi.nlm.nih.gov",
    "rcsb.org",
    "embl.de",
    "uniprot.org",
}


def is_product_image(image_url: str) -> bool:
    """Return True if the URL looks like a product/package photo."""
    if not image_url:
        return False
    parsed = urllib.parse.urlparse(image_url)
    domain = parsed.netloc.lower().lstrip("www.")
    path = parsed.path.lower()
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1]

    if ext in SKIP_EXTENSIONS:
        return False
    for dom in SKIP_DOMAINS:
        if dom in domain:
            return False
    for kw in SKIP_KEYWORDS:
        if kw in name:
            return False
    return ext in {".jpg", ".jpeg", ".png", ".webp"}


def _fetch_url(url: str) -> bytes | None:
    """Fetch with certifi SSL; return bytes or None on error."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as resp:
            return resp.read()
    except Exception:
        return None


# ── Source 1: Google Custom Search Images ─────────────────────────────────


def google_cse_image(drug_name: str) -> str | None:
    """
    Query Google Custom Search for drug product images.
    Returns the best image URL or None.
    Requires GOOGLE_CSE_KEY and GOOGLE_CSE_CX env vars.
    """
    if not GOOGLE_CSE_KEY or not GOOGLE_CSE_CX:
        return None

    # Search for official product packaging/pen photo
    query = f"{drug_name} medication drug prescription pen"
    url = GOOGLE_CSE_URL.format(
        key=urllib.parse.quote(GOOGLE_CSE_KEY),
        cx=urllib.parse.quote(GOOGLE_CSE_CX),
        q=urllib.parse.quote(query),
    )
    body = _fetch_url(url)
    if not body:
        return None
    try:
        data = json.loads(body)
        items = data.get("items", [])
    except json.JSONDecodeError:
        return None

    # Prefer images from trusted pharmaceutical domains
    for item in items:
        img_url = item.get("link", "")
        if not is_product_image(img_url):
            continue
        domain = urllib.parse.urlparse(img_url).netloc.lower().lstrip("www.")
        if any(pref in domain for pref in PREFERRED_DOMAINS):
            return img_url

    # Fall back to any passing image from the results
    for item in items:
        img_url = item.get("link", "")
        if is_product_image(img_url):
            return img_url

    return None


# ── Source 2: Wikipedia (fallback) ────────────────────────────────────────


def _summary_image(title: str) -> str | None:
    url = WIKI_API.format(title=urllib.parse.quote(title.replace(" ", "_"), safe=""))
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
    if "/thumb/" in img:
        parts = img.split("/thumb/")
        pieces = parts[1].rsplit("/", 1)
        img = parts[0] + "/" + pieces[0]
    return img if is_product_image(img) else None


def _search_title(query: str) -> str | None:
    url = WIKI_SEARCH.format(q=urllib.parse.quote(query))
    body = _fetch_url(url)
    if not body:
        return None
    try:
        hits = json.loads(body).get("query", {}).get("search", [])
        return hits[0]["title"] if hits else None
    except (json.JSONDecodeError, IndexError, KeyError):
        return None


def wikipedia_image(drug_name: str) -> str | None:
    base = drug_name.replace("-", " ").strip()
    candidates = [base, base + " (medication)", base + " (drug)", base.split()[0]]
    seen: set[str] = set()
    for title in candidates:
        t = title.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        img = _summary_image(t)
        if img:
            return img
        time.sleep(0.15)
    found_title = _search_title(base)
    if found_title and found_title not in seen:
        img = _summary_image(found_title)
        if img:
            return img
    return None


# ── Combined lookup ────────────────────────────────────────────────────────


def find_drug_image(drug_name: str) -> tuple[str | None, str]:
    """Try Google CSE first, then Wikipedia. Returns (url, source_label)."""
    if GOOGLE_CSE_KEY and GOOGLE_CSE_CX:
        img = google_cse_image(drug_name)
        if img:
            return img, "google"
        time.sleep(0.2)  # polite pause between API calls

    img = wikipedia_image(drug_name)
    if img:
        return img, "wikipedia"

    return None, "none"


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
    ext = os.path.splitext(path)[1].lower()
    return ext if ext in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"


# ── Main ───────────────────────────────────────────────────────────────────


def main():
    save_mode = "--save" in sys.argv
    skip_existing = "--skip-existing" in sys.argv
    limit_arg = next(
        (
            sys.argv[i + 1]
            for i, a in enumerate(sys.argv)
            if a == "--limit" and i + 1 < len(sys.argv)
        ),
        None,
    )
    limit = int(limit_arg) if limit_arg else None

    using_google = bool(GOOGLE_CSE_KEY and GOOGLE_CSE_CX)
    source_label = (
        "Google CSE + Wikipedia fallback"
        if using_google
        else "Wikipedia only (set GOOGLE_CSE_KEY + GOOGLE_CSE_CX for better results)"
    )

    if not save_mode:
        print(
            f"DRY RUN — pass --save to actually download images and update drugs.json"
        )
    print(f"Image source : {source_label}\n")

    data = json.loads(DRUGS_JSON.read_text())
    items = data.get("items", data) if isinstance(data, dict) else data

    working_items = items[:limit] if limit else items

    found = skipped = already = 0

    for drug in working_items:
        slug = drug.get("slug") or (
            drug.get("brand") or drug.get("name") or ""
        ).lower().replace(" ", "-")
        name = drug.get("brand") or drug.get("name") or slug

        # Skip if already has a real image (not the fallback)
        existing = drug.get("hero_landscape", "")
        if existing and "hero-1200" not in existing:
            if skip_existing:
                already += 1
                continue
            print(f"  SKIP  {name:<33} already has: {existing}")
            already += 1
            continue

        print(f"  {name:<35}", end="", flush=True)
        img_url, source = find_drug_image(name)

        if not img_url:
            print("  ✗ not found")
            skipped += 1
            continue

        ext = ext_from_url(img_url)
        dest_name = f"{slug}{ext}"
        local_rel = f"/assets/img/drugs/{dest_name}"
        dest_abs = IMG_DIR / dest_name

        if save_mode:
            ok = download_image(img_url, dest_abs)
            if ok:
                drug["hero_landscape"] = local_rel
                print(f"  ✓ [{source}] → {local_rel}")
                found += 1
            else:
                skipped += 1
        else:
            short = img_url[:65] + "…" if len(img_url) > 65 else img_url
            print(f"  → [{source}] {short}")
            found += 1

        time.sleep(0.4)  # polite rate limit

    if save_mode and found:
        out = json.dumps(
            data if isinstance(data, dict) else {"items": items},
            indent=2,
            ensure_ascii=False,
        )
        DRUGS_JSON.write_text(out)
        print(f"\nUpdated {DRUGS_JSON.name}")

    print(f"\n{'─'*56}")
    print(f"  Found images : {found}")
    print(f"  Not found    : {skipped}")
    print(f"  Already had  : {already}")
    if not using_google:
        print(f"\n  TIP: Set GOOGLE_CSE_KEY + GOOGLE_CSE_CX in .env for ~95% coverage.")
    if save_mode and found:
        print(f"\nNext steps:")
        print(f"  git add assets/img/drugs/ data/drugs.json")
        print(f"  git commit -m 'feat: add drug product images'")
        print(f"  git push origin main")
    elif not save_mode:
        print(f"\nRe-run with --save to download images.")


if __name__ == "__main__":
    main()
