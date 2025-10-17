#!/usr/bin/env python3
"""
SaveRx — one-at-a-time drug page generator.

- Fetches a SMALL list of slugs from your new Slug API (separate Apps Script).
- Iterates one slug at a time.
- For each slug: creates ./drugs/<slug>/ and writes index.html from a local template.
- Optionally fills {{SLUG}} and {{NAME}} placeholders.
- Optional: git add/commit/push.

Usage (dry run first):
  python generate_drug_pages.py \
    --slugs-url "https://YOUR-NEW-APPS-SCRIPT/exec?mode=slugs&source=drugs" \
    --template "templates/index.html" \
    --drugs-dir "drugs" \
    --limit 5 \
    --dry-run
"""

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "untitled"


def http_get_json(url: str, params: dict | None = None) -> dict:
    p = dict(params or {})
    p["_"] = str(int(time.time()))  # cache-buster
    resp = requests.get(url, params=p, timeout=30, headers={"User-Agent": "SaveRx-generator/1.0"})
    resp.raise_for_status()
    return resp.json()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Create /drugs/<slug>/index.html from a template, one slug at a time.")
    ap.add_argument("--slugs-url", required=True, help="Slug API URL, e.g. https://.../exec?mode=slugs&source=drugs")
    ap.add_argument("--template", default="templates/index.html", help="Path to local template (default: templates/index.html)")
    ap.add_argument("--drugs-dir", default="drugs", help="Output base directory (default: drugs)")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of slugs to process (0 = all)")
    ap.add_argument("--force", action="store_true", help="Overwrite existing index.html if present")
    ap.add_argument("--dry-run", action="store_true", help="Show actions without writing files")
    ap.add_argument("--details-url", default=None, help="Optional per-drug details URL with {slug}, e.g. https://.../exec?mode=drug&slug={slug}")
    ap.add_argument("--git-commit", action="store_true", help="git add/commit changed files at the end")
    ap.add_argument("--git-push", action="store_true", help="git push after commit")
    ap.add_argument("--pause", type=float, default=0.0, help="Pause seconds between slugs")
    args = ap.parse_args()

    template_path = Path(args.template)
    if not template_path.is_file():
        print(f"ERROR: Template not found: {template_path}", file=sys.stderr)
        sys.exit(1)
    template_html = template_path.read_text(encoding="utf-8")

    # 1) Fetch a SMALL list of slugs (just identifiers; not heavy data)
    print(f"Fetching slugs from: {args.slugs_url}")
    try:
        data = http_get_json(args.slugs_url)
    except Exception as e:
        print("ERROR: Could not fetch slug list:", e, file=sys.stderr)
        sys.exit(1)

    # Our standalone Slug API returns: { source, count, slugs: [...] }
    slugs = data.get("slugs") or []
    if not isinstance(slugs, list):
        print("ERROR: Unexpected JSON format (no 'slugs' array). Full response below:", file=sys.stderr)
        print(json.dumps(data, indent=2))
        sys.exit(1)

    if args.limit > 0:
        slugs = slugs[: args.limit]

    out_base = Path(args.drugs_dir)
    created = 0
    skipped = 0
    changed_dirs: set[Path] = set()

    for i, raw in enumerate(slugs, 1):
        if not raw:
            continue
        slug = slugify(str(raw))
        folder = out_base / slug
        dest = folder / "index.html"

        # Build page content
        html = template_html.replace("{{SLUG}}", slug)

        # Fill {{NAME}} if possible
        if "{{NAME}}" in html:
            name_val = slug.replace("-", " ").title()  # fallback
            if args.details_url:
                details_url = args.details_url.format(slug=slug)
                try:
                    detail = http_get_json(details_url)
                    item = detail.get("item") or detail.get("data") or detail
                    if isinstance(item, dict):
                        for key in ("brand", "name", "drug", "title"):
                            if key in item and str(item[key]).strip():
                                name_val = str(item[key]).strip()
                                break
                except Exception:
                    pass
            html = html.replace("{{NAME}}", name_val)

        # Write or skip
        if dest.exists() and not args.force:
            print(f"[{i}/{len(slugs)}] SKIP (exists): {dest}")
            skipped += 1
        else:
            if args.dry_run:
                print(f"[{i}/{len(slugs)}] CREATE: {dest}")
            else:
                ensure_dir(folder)
                write_text(dest, html)
                changed_dirs.add(folder)
                print(f"[{i}/{len(slugs)}] CREATED: {dest}")
            created += 1

        if args.pause > 0:
            time.sleep(args.pause)

    print(f"\nDone. Created/updated: {created}, Skipped: {skipped}")

    # Optional git add/commit/push
    if not args.dry_run and args.git_commit:
        try:
            import subprocess
            to_add = [str(d) for d in sorted(changed_dirs)] or [str(out_base)]
            subprocess.run(["git", "add"] + to_add, check=False)
            subprocess.run(["git", "commit", "-m", f"chore(drugs): generate {created} pages"], check=False)
            if args.git_push:
                subprocess.run(["git", "push"], check=False)
            print("Git commit complete." + (" Pushed." if args.git_push else ""))
        except Exception as e:
            print("WARNING: git commit/push failed:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
