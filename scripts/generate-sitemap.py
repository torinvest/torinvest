#!/usr/bin/env python3
"""Génère sitemap.xml à partir des pages HTML publiques."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://torinvest.fr"

EXCLUDE = {
    "indexOLD.html", "index1.html", "index3.html", "indexx.html",
    "AITORINVEST2.html", "dev-access.html", "ai-access.html",
    "accompagnement-access.html", "activation.html",
    "activation-accompagnement.html", "merci.html",
}

PRIORITY = {
    "index.html": "1.0",
    "crypto.html": "0.9",
    "faq.html": "0.8",
    "roadmap.html": "0.8",
    "formation.html": "0.8",
    "torpass.html": "0.8",
    "premium.html": "0.7",
}

lines = ['<?xml version="1.0" encoding="UTF-8"?>']
lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

for path in sorted(ROOT.glob("*.html")):
    if path.name in EXCLUDE:
        continue
    priority = PRIORITY.get(path.name, "0.6")
    url = f"{SITE_URL}/{path.name}"
    lines.append("  <url>")
    lines.append(f"    <loc>{url}</loc>")
    lines.append(f"    <changefreq>weekly</changefreq>")
    lines.append(f"    <priority>{priority}</priority>")
    lines.append("  </url>")

# Module PHP crypto-radar
lines.append("  <url>")
lines.append(f"    <loc>{SITE_URL}/crypto-radar/</loc>")
lines.append("    <changefreq>daily</changefreq>")
lines.append("    <priority>0.85</priority>")
lines.append("  </url>")

lines.append("</urlset>")
(ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Sitemap généré : {len([l for l in lines if '<loc>' in l])} URLs")
