#!/usr/bin/env python3
"""Patch forge-brand.js (app formation) : bouton ← Site principal."""
from __future__ import annotations

import sys
from pathlib import Path

HELPERS = """
function forgeMainSiteHref() {
  return "https://www.torinvest-trading.com/";
}
function forgeBackHomeNavHtml() {
  return '<a href="' + forgeMainSiteHref() + '" class="forge-back-home-nav" aria-label="Retour au site principal TORINVEST">\\u2190 Site principal</a>';
}
function initForgeBackHome() {
  if (document.getElementById("forge-back-home-btn")) return;
  if (!document.getElementById("forge-back-home-style")) {
    var style = document.createElement("style");
    style.id = "forge-back-home-style";
    style.textContent =
      ".forge-back-home-nav{color:#e8b84a!important;font-weight:700;padding:.35rem .7rem;border:1px solid rgba(232,184,74,.45);border-radius:999px;text-decoration:none!important}" +
      ".forge-back-home-btn{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));left:max(14px,env(safe-area-inset-left));z-index:10000;padding:9px 14px;font-size:12px;font-weight:700;text-decoration:none;border-radius:999px;background:rgba(8,12,20,.92);border:1px solid rgba(232,184,74,.5);color:#facc15}";
    document.head.appendChild(style);
  }
  var a = document.createElement("a");
  a.id = "forge-back-home-btn";
  a.className = "forge-back-home-btn";
  a.href = forgeMainSiteHref();
  a.setAttribute("aria-label", "Retour au site principal TORINVEST");
  a.textContent = "\\u2190 Site principal";
  document.body.appendChild(a);
}

"""


def patch(text: str) -> str:
    if "initForgeBackHome" in text:
        return text

    helpers = HELPERS.replace("\\u2190", "←")

    if "function forgeLogoHtml" not in text:
        raise SystemExit("ERROR: forgeLogoHtml introuvable")
    text = text.replace("function forgeLogoHtml", helpers + "function forgeLogoHtml", 1)

    old_nav = "  let navHtml = nav\n    .map((n) =>"
    new_nav = "  let navHtml = forgeBackHomeNavHtml() + nav\n    .map((n) =>"
    if old_nav not in text:
        # variante espaces
        old_nav = "  let navHtml = nav\r\n    .map((n) =>"
        new_nav = "  let navHtml = forgeBackHomeNavHtml() + nav\r\n    .map((n) =>"
    if old_nav not in text:
        raise SystemExit("ERROR: bloc navHtml introuvable")
    text = text.replace(old_nav, new_nav, 1)

    old_m = "  const nav =\n    '<a href=\"/dashboard.html\""
    new_m = "  const nav =\n    forgeBackHomeNavHtml() +\n    '<a href=\"/dashboard.html\""
    if old_m not in text:
        old_m = "  const nav =\r\n    '<a href=\"/dashboard.html\""
        new_m = "  const nav =\r\n    forgeBackHomeNavHtml() +\r\n    '<a href=\"/dashboard.html\""
    if old_m not in text:
        raise SystemExit("ERROR: bloc initMemberHeader introuvable")
    text = text.replace(old_m, new_m, 1)

    old_dom = "  initLiveSection();\n});"
    new_dom = "  initLiveSection();\n  initForgeBackHome();\n});"
    if old_dom not in text:
        old_dom = "  initLiveSection();\r\n});"
        new_dom = "  initLiveSection();\r\n  initForgeBackHome();\r\n});"
    if old_dom not in text:
        raise SystemExit("ERROR: DOMContentLoaded introuvable")
    text = text.replace(old_dom, new_dom, 1)

    return text


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "public/js/forge-brand.js")
    if not path.is_file():
        raise SystemExit(f"ERROR: fichier introuvable: {path}")
    bak = path.with_suffix(path.suffix + ".bak")
    if not bak.exists():
        bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"backup → {bak}")
    original = path.read_text(encoding="utf-8")
    if "initForgeBackHome" in original:
        print("déjà patché")
        return
    path.write_text(patch(original), encoding="utf-8")
    print(f"OK → {path}")
    print("grep:", "Site principal" in path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
