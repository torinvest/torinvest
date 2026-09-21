#!/usr/bin/env bash
# Déploie Mode d'emploi + Questions par élève (tous les modules).
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/module-guide-qa-691a/deploy/vps/DEPLOY-MODULE-GUIDE-QA.sh -o /tmp/d-mqa.sh && bash /tmp/d-mqa.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-guide-qa-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MODULE GUIDE + QA ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" "$APP_DIR/data/module-qa"

pull() {
  local url="$1" dest="$2"
  echo "← $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
}

pull "$RAW/la-forge/js/forge-module-guides.js" "$APP_DIR/public/js/forge-module-guides.js"
pull "$RAW/la-forge/js/forge-module-tabs.js" "$APP_DIR/public/js/forge-module-tabs.js"
pull "$RAW/la-forge/js/forge-module-qa-admin.js" "$APP_DIR/public/js/forge-module-qa-admin.js"
pull "$RAW/la-forge/css/forge-module-tabs.css" "$APP_DIR/public/css/forge-module-tabs.css"
pull "$RAW/deploy/vps/app-shells/module-qa.html" "$APP_DIR/public/module-qa.html"
pull "$RAW/deploy/vps/formation-server/routes-module-qa.js" "$APP_DIR/server-patches/routes-module-qa.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"

echo "==> Wire server.js"
node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"

echo "==> Inject assets dans les leçons course/*.html"
python3 - "$APP_DIR" <<'PY'
import re, sys
from pathlib import Path

app = Path(sys.argv[1])
roots = [
    app / "private" / "course",
    app / "public" / "course",
]
css_tag = '  <link rel="stylesheet" href="/css/forge-module-tabs.css?v=1" />\n'
js_block = (
    '  <script src="/js/forge-module-guides.js?v=1"></script>\n'
    '  <script src="/js/forge-module-tabs.js?v=1"></script>\n'
)
mark = "FORGE_MODULE_TABS"

n = 0
for root in roots:
    if not root.is_dir():
        continue
    for html in sorted(root.glob("*.html")):
        if html.name.lower() in ("index.html",):
            continue
        text = html.read_text(encoding="utf-8", errors="ignore")
        if mark in text and "forge-module-tabs.js" in text:
            continue
        # remove old injection if partial
        text = re.sub(
            r"\s*<!--\s*" + mark + r"_START\s*-->.*?<!--\s*" + mark + r"_END\s*-->\s*",
            "\n",
            text,
            flags=re.S,
        )
        text = re.sub(
            r'\s*<link[^>]+forge-module-tabs\.css[^>]*>\s*',
            "\n",
            text,
            flags=re.I,
        )
        text = re.sub(
            r'\s*<script[^>]+forge-module-(?:guides|tabs)\.js[^>]*>\s*</script>\s*',
            "\n",
            text,
            flags=re.I,
        )

        head_inj = f"<!-- {mark}_START -->\n{css_tag}<!-- {mark}_END -->\n"
        if re.search(r"</head>", text, flags=re.I):
            text = re.sub(r"</head>", head_inj + "</head>", text, count=1, flags=re.I)
        else:
            text = head_inj + text

        body_inj = f"<!-- {mark}_JS_START -->\n{js_block}<!-- {mark}_JS_END -->\n"
        if re.search(r"</body>", text, flags=re.I):
            text = re.sub(r"</body>", body_inj + "</body>", text, count=1, flags=re.I)
        else:
            text = text + "\n" + body_inj

        html.write_text(text, encoding="utf-8")
        n += 1
        print("patched", html)
print("lessons patched:", n)
PY

# Nav admin on dashboard if present
if [[ -f "$APP_DIR/public/dashboard.html" ]]; then
  python3 - "$APP_DIR/public/dashboard.html" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8", errors="ignore")
if "module-qa.html" in t and "Questions modules" in t:
    print("dashboard: lien Q&A déjà présent")
else:
    link = (
        '<a href="/module-qa.html" data-mqa-admin-nav hidden '
        'style="display:none" class="nav-admin-only">Questions modules</a>'
    )
    # best effort: near coaching-fiches link
    if "coaching-fiches.html" in t:
        t = t.replace(
            "coaching-fiches.html",
            "coaching-fiches.html",
            1,
        )
        # inject after first coaching fiches anchor closing
        t2 = re.sub(
            r'(<a[^>]+coaching-fiches\.html[^>]*>.*?</a>)',
            r"\1\n          " + link,
            t,
            count=1,
            flags=re.I | re.S,
        )
        if t2 != t:
            t = t2
            p.write_text(t, encoding="utf-8")
            print("dashboard: lien Q&A ajouté")
        else:
            print("dashboard: pas d'ancre coaching-fiches pour injecter")
    else:
        print("dashboard: pas de coaching-fiches — skip nav")
PY
fi

# Show admin nav via small boot in module-qa-admin already; also expose on dashboard via brand if needed
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart all --update-env || true
fi

echo ""
echo "Vérif :"
curl -sS -o /dev/null -w "module-qa.html %{http_code}\n" "http://127.0.0.1:3001/module-qa.html" || true
curl -sS -o /dev/null -w "forge-module-tabs.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-module-tabs.js" || true
ls -lh "$APP_DIR/server-patches/routes-module-qa.js" "$APP_DIR/public/js/forge-module-tabs.js"
grep -n "createModuleQaRouter\|routes-module-qa" "$APP_DIR/server.js" 2>/dev/null | head -5 || true
echo ""
echo "→ Élève : onglets Mode d'emploi + Mes questions dans chaque module"
echo "→ Admin : https://app.torinvest-trading.com/module-qa.html"
echo "======== DONE ========"
