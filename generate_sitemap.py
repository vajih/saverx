#!/usr/bin/env python3
"""
Generate sitemap.xml for SaveRx.ai
Includes all drug pages, core pages, and proper lastmod dates
"""
import os
from datetime import datetime
from pathlib import Path


def main():
    base_url = "https://saverx.ai"
    today = datetime.now().strftime("%Y-%m-%d")

    # Core pages with priorities
    core_pages = [
        ("/", "1.0", today),
        ("/about.html", "0.8", today),
        ("/contact.html", "0.7", today),
        ("/drugs/", "0.9", today),
        ("/list.html", "0.6", today),
        ("/privacy.html", "0.3", today),
        ("/terms.html", "0.3", today),
    ]

    # Find all drug folders
    drugs_dir = Path("drugs")
    drug_folders = sorted(
        [
            d.name
            for d in drugs_dir.iterdir()
            if d.is_dir() and (d / "index.html").exists()
        ]
    )

    print(f"Found {len(drug_folders)} drug pages")

    # Generate XML
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f"<!-- SaveRx.ai sitemap generated {today} -->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    # Add core pages
    for path, priority, lastmod in core_pages:
        xml_lines.extend(
            [
                "  <url>",
                f"    <loc>{base_url}{path}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )

    # Add drug pages
    for slug in drug_folders:
        xml_lines.extend(
            [
                "  <url>",
                f"    <loc>{base_url}/drugs/{slug}/</loc>",
                f"    <lastmod>{today}</lastmod>",
                "    <priority>0.8</priority>",
                "  </url>",
            ]
        )

    xml_lines.append("</urlset>")

    # Write sitemap
    sitemap_path = Path("sitemap.xml")
    sitemap_path.write_text("\n".join(xml_lines), encoding="utf-8")

    print(f"✓ Generated sitemap.xml with {len(core_pages) + len(drug_folders)} URLs")
    print(f"  - {len(core_pages)} core pages")
    print(f"  - {len(drug_folders)} drug pages")


if __name__ == "__main__":
    main()
