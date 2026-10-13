#!/usr/bin/env bash
# HOTFIX UNLOCK LOT 2 — one-shot VPS (index autonome + scripts injectés)
#
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/hotfix-unlock-lot2-deploy-691a/deploy/vps/HOTFIX-UNLOCK-LOT2-NOW.sh" -o /tmp/hul.sh
#   bash /tmp/hul.sh
#
set -euo pipefail

APP_DIR="${1:-${APP_DIR:-$HOME/torinvest-formation}}"
REF="${REF:-cursor/hotfix-unlock-lot2-deploy-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
STAMP=$(date +%s)

echo "======== HOTFIX UNLOCK LOT 2 (inline index) ========"
echo "APP=$APP_DIR REF=$REF"

[[ -d "$APP_DIR/public/js" ]] || { echo "ERREUR: $APP_DIR/public/js introuvable"; exit 1; }

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/course"

curl -fsSL "$BASE/la-forge/js/forge-unlock.js" -o "$APP_DIR/public/js/forge-unlock.js"
curl -fsSL "$BASE/la-forge/js/course-index.js" -o "$APP_DIR/public/js/course-index.js"
curl -fsSL "$BASE/la-forge/js/progress.js" -o "$APP_DIR/public/js/progress.js"
curl -fsSL "$BASE/la-forge/js/course-data.js" -o "$APP_DIR/public/js/course-data.js"

INDEX="$APP_DIR/public/course/index.html"
# Prefer shell officiel ; sinon garde l'existant et injecte
if curl -fsSL "$BASE/deploy/vps/app-shells/course/index.html" -o "$INDEX.tmp"; then
  mv "$INDEX.tmp" "$INDEX"
else
  echo "WARN: shell index distant KO — patch in-place"
  [[ -f "$INDEX" ]] || { echo "ERREUR: $INDEX introuvable"; exit 1; }
fi

# Injecter scripts manquants avant </body>
python3 - "$INDEX" "$STAMP" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
stamp = sys.argv[2]
t = p.read_text(encoding="utf-8", errors="replace")

def ensure(script_src_base, tag):
    global t
    if script_src_base.split("?")[0] in t and "course-index" not in script_src_base:
        # rewrite cache bust for existing
        t = re.sub(
            re.escape(script_src_base.split("?")[0]) + r"[^\"']*",
            script_src_base,
            t,
            count=1,
        )
        return
    if script_src_base.split("?")[0] in t:
        t = re.sub(
            re.escape(script_src_base.split("?")[0]) + r"[^\"']*",
            script_src_base,
            t,
            count=1,
        )
        return
    # insert before </body>
    t = t.replace("</body>", tag + "\n</body>", 1)

needed = [
    ("/js/progress.js", f'<script src="/js/progress.js?v=lot2i-{stamp}"></script>'),
    ("/js/course-data.js", f'<script src="/js/course-data.js?v=lot2i-{stamp}"></script>'),
    ("/js/forge-unlock.js", f'<script src="/js/forge-unlock.js?v=lot2i-{stamp}"></script>'),
    ("/js/course-index.js", f'<script src="/js/course-index.js?v=lot2i-{stamp}"></script>'),
]
for base, tag in needed:
    if base not in t:
        print("inject", base)
        t = t.replace("</body>", "  " + tag + "\n</body>", 1)
    else:
        t = re.sub(re.escape(base) + r"[^\"']*", f"{base}?v=lot2i-{stamp}", t, count=1)
        print("cachebust", base)

# unlock-banner si absent
if 'id="unlock-banner"' not in t and 'id="overall-text"' in t:
    t = t.replace(
        'id="overall-text"',
        'id="overall-text"',
        1,
    )
    # after overall-text paragraph, inject banner sibling if possible
    t = re.sub(
        r'(<p[^>]*id="overall-text"[^>]*>.*?</p>)',
        r'\1\n      <p id="unlock-banner" class="alert" style="margin-top:0.75rem;font-size:0.88rem;border-color:rgba(255,180,0,.35)"></p>',
        t,
        count=1,
        flags=re.S,
    )
    print("inject unlock-banner")

if 'id="module-list"' not in t:
    print("ERREUR: module-list absent de index.html — page pas un index formation")
    sys.exit(3)

p.write_text(t, encoding="utf-8")
print("OK index patched")
PY

echo ""
echo "=== VERIF ==="
FAIL=0
grep -q 'computeMaxUnlockedIndex\|AUTO-CONTENUE' "$APP_DIR/public/js/course-index.js" && echo "OK course-index inline unlock" || { echo "FAIL course-index"; FAIL=1; }
grep -q 'forge-unlock.js' "$INDEX" && echo "OK index → forge-unlock.js" || { echo "FAIL index sans forge-unlock"; FAIL=1; }
grep -q 'course-index.js' "$INDEX" && echo "OK index → course-index.js" || { echo "FAIL index sans course-index"; FAIL=1; }
grep -q 'module-list' "$INDEX" && echo "OK module-list" || { echo "FAIL module-list"; FAIL=1; }
wc -c "$APP_DIR/public/js/course-index.js" "$APP_DIR/public/js/forge-unlock.js" "$INDEX"
grep -nE 'script src=.*course-index|script src=.*forge-unlock|module-list|unlock-banner' "$INDEX" | head -20

[[ "$FAIL" -eq 0 ]] || exit 3

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe la-forge >/dev/null 2>&1; then
    pm2 restart la-forge && echo "OK pm2 restart la-forge"
  elif pm2 describe torinvest-formation >/dev/null 2>&1; then
    pm2 restart torinvest-formation && echo "OK pm2 restart torinvest-formation"
  fi
fi

echo ""
echo "======== DONE ========"
echo "1) Ouvre (fenêtre privée) :"
echo "   https://app.torinvest-trading.com/course/index.html?unlock_debug=1"
echo "2) Ctrl+Shift+R"
echo "3) Tu dois voir la bannière : « N / 37 modules ouverts » avec N≥6 si lot 1 Validé"
echo "4) F3 / F4 / F5 sous Partie I"
echo ""
echo "Console : ligne [La Forge unlock] open=…"
