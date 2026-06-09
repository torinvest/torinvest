#!/usr/bin/env python3
"""Injecte le script RGPD avant </body> sur toutes les pages HTML."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = '  <script src="/assets/torinvest-rgpd.js" defer></script>\n'
SKIP = {"indexOLD.html", "index1.html", "index3.html", "indexx.html"}

for path in sorted(ROOT.glob("*.html")):
    if path.name in SKIP:
        continue
    text = path.read_text(encoding="utf-8")
    if "torinvest-rgpd.js" in text:
        continue
    if "</body>" not in text:
        continue
    text = text.replace("</body>", SCRIPT + "</body>", 1)
    path.write_text(text, encoding="utf-8")
    print("✓", path.name)
