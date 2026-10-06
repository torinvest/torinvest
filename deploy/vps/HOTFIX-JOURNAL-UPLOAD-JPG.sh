#!/usr/bin/env bash
# HOTFIX — Upload JPG/PNG dans TJ Pro (inject) + clé trade réelle
#
# Corrige :
#   • « Image invalide (JPG ou PNG) » — dataUrl normalisé côté client + MIME loose serveur
#   • clé trade « add_trade_trade_na_add_trade » — lecture DOM TJ (pair/date/direction)
#   • inject script ?v=3
#
# Sur le VPS (UNE seule commande) :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-upload-jpg-fix-691a/deploy/vps/HOTFIX-JOURNAL-UPLOAD-JPG.sh" | bash
#
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF 2>/dev/null || true
SCRIPT_REF="${SCRIPT_REF:-cursor/journal-upload-jpg-fix-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=3"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX JOURNAL UPLOAD JPG/PNG ($SCRIPT_REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/forge-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/routes-journal-bridge.js"

# Sanity artefacts
grep -q 'normalizeDataUrl\|canvasToCleanDataUrl' "$TMP/forge-journal-trade-screens.js"
grep -q 'parseImageDataUrl\|mimeLoose' "$TMP/routes-journal-trade-screens.js"
grep -q "$EXPECTED_INJECT" "$TMP/routes-journal-bridge.js"
grep -q 'draft-\|cleanField' "$TMP/forge-journal-trade-screens.js"
# Pas de barre bleue Forge dans ces artefacts
if grep -qE 'journal-screens-bar|showJournalWithScreens|jts-dropzone' "$TMP/forge-journal-trade-screens.js"; then
  echo "ÉCHEC: artefact contient encore UI shell screens"
  exit 1
fi

cp -f "$TMP/forge-journal-trade-screens.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes-journal-bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true

while IFS= read -r -d '' f; do
  case "$f" in
    */public/js/forge-journal-trade-screens.js|*/js/forge-journal-trade-screens.js)
      cp -f "$TMP/forge-journal-trade-screens.js" "$f"
      echo "→ $f"
      ;;
  esac
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  echo "→ sync routes @ $dir/"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes-journal-trade-screens.js" "$f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

# express.json 12mb pour dataUrl
python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re, sys
app = Path(sys.argv[1])
for p in [app / "server.js", *sorted(app.glob("**/server.js"))]:
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\'](?:12|20)mb["\']', t):
        print(f"express.json OK: {p}")
        break
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)', t):
        t2 = re.sub(
            r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)',
            'express.json({ limit: "12mb" })',
            t,
            count=1,
        )
        p.write_text(t2, encoding="utf-8")
        print(f"express.json → 12mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
        print(f"express.json() → 12mb ({p})")
    break
PY

echo "ref=${SCRIPT_REF} inject=${EXPECTED_INJECT} at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$APP_DIR/public/journal-upload-jpg.deploy.txt"

pm2 stop la-forge 2>/dev/null || true
sleep 1
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || pm2 restart all || true
sleep 2
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true

echo ""
echo "=== ping API ==="
PING="$(curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "$PING"
echo "$PING" | grep -q '"ok"' || { echo "ÉCHEC ping"; exit 1; }
echo "$PING" | grep -q 'mimeLoose\|"version":3\|version.:3' || echo "(warn: ping sans mimeLoose — cache require?)"

echo ""
echo "=== sanity inject bridge ==="
grep -n "$EXPECTED_INJECT" "$APP_DIR/server-patches/routes-journal-bridge.js" | head -3
grep -q 'parseImageDataUrl' "$APP_DIR/server-patches/routes-journal-trade-screens.js"
grep -q 'normalizeDataUrl' "$APP_DIR/public/js/forge-journal-trade-screens.js"

echo ""
echo "OK — upload JPG/PNG fix déployé."
echo "→ Hard refresh Ctrl+Shift+R : https://app.torinvest-trading.com/journal.html"
echo "→ Attendu dans TJ « Ajouter un trade » :"
echo "  • zone Screenshots JPG/PNG"
echo "  • clé trade = draft-… OU date_pair_direction (plus de add_trade_*)"
echo "  • upload JPG/PNG → « N screen(s) enregistré(s) » (plus d’alerte Image invalide)"
echo "======== DONE ========"
