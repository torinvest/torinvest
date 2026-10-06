#!/usr/bin/env bash
# HOTFIX — Enlever la barre bleue « Déposer des screens » au-dessus du Journal.
# Remet journal.html = iframe TJ Pro uniquement (comme avant).
# Screens JPG/PNG = menu « Screens trades » DANS le Journal Pro blanc.
#
# Sur le VPS :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-remove-blue-bar-691a/deploy/vps/HOTFIX-REMOVE-JOURNAL-BLUE-BAR.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF 2>/dev/null || true
RAW="https://raw.githubusercontent.com/torinvest/torinvest/main"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX REMOVE BLUE BAR ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
curl -fsSL "$RAW/deploy/vps/app-shells/journal.html" -o "$TMP/journal.html"
curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js"
curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/forge-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/routes-journal-bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" -o "$TMP/routes-formation-auth.js"

# Interdit : barre bleue
if grep -qE 'journal-screens-bar|Déposer des screens|jts-dropzone|showJournalWithScreens' "$TMP/journal.html" "$TMP/forge-journal.js"; then
  echo "ÉCHEC: GitHub main contient encore la barre bleue — abort"
  exit 1
fi
grep -q 'journal-frame' "$TMP/journal.html"
grep -q 'forge-journal.js?v=14' "$TMP/journal.html" || grep -q 'forge-journal.js?v=12' "$TMP/journal.html"
grep -q 'journal-embed\|JOURNAL_APP' "$TMP/forge-journal.js"

# Écraser partout
cp -f "$TMP/journal.html" "$APP_DIR/public/journal.html"
cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js"
cp -f "$TMP/forge-journal-trade-screens.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/routes-journal-bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes-formation-auth.js" "$dir/routes-formation-auth.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/journal.html" "$f"
done < <(find "$APP_DIR" -name 'journal.html' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/forge-journal.js" "$f"
done < <(find "$APP_DIR" -path '*/public/js/forge-journal.js' -print0 2>/dev/null || true)

if grep -qE 'journal-screens-bar|Déposer des screens' "$APP_DIR/public/journal.html"; then
  echo "ÉCHEC: journal.html local encore avec barre bleue"
  exit 1
fi

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 2
curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true
echo ""

echo "local journal.html bytes=$(wc -c < "$APP_DIR/public/journal.html")"
grep -n "forge-journal.js" "$APP_DIR/public/journal.html" | head -2
rm -rf "$TMP"

echo ""
echo "→ Ctrl+Shift+R : https://app.torinvest-trading.com/journal.html"
echo "→ Attendu : PLUS de bande bleue — seulement le Journal Pro blanc"
echo "→ Screens : menu « Screens trades » dans le Journal Pro"
echo "======== DONE ========"
