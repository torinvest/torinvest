#!/usr/bin/env bash
# HOTFIX — « Lecture image impossible » + JPG dans TJ Pro
#
# Sur le VPS, tape exactement :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-jpg-read-fix-691a/deploy/vps/HOTFIX-JOURNAL-UPLOAD-JPG.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-jpg-read-fix-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=6"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX JPG READ ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/js.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" -o "$TMP/auth.js"

grep -q 'CSP blob' "$TMP/js.js"
grep -q 'normalizeDataUrl' "$TMP/js.js"
grep -q "$EXPECTED_INJECT" "$TMP/bridge.js"
grep -q 'sniffImageMime' "$TMP/routes.js"

cp -f "$TMP/js.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/auth.js" "$dir/routes-formation-auth.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 2
PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
echo "ping: $PING"
echo "$PING" | grep -q '"ok"' || { echo "ÉCHEC ping"; exit 1; }

echo ""
echo "OK — inject v=6 déployé (FileReader d'abord)."
echo "→ Sur ton PC : Ctrl+Shift+R puis dépose un JPG"
echo "======== DONE ========"
