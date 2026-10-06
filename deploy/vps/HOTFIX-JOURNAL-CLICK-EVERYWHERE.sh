#!/usr/bin/env bash
# HOTFIX — clic trade PARTOUT (liste + calendrier TJ) v13
#
# v12 était live (hrefClickFix) mais clic toujours mort.
# v13: rewrite top/parent.location (break-out iframe → 404),
#      CSP radar assets, absolutize root-relative src/href.
#
# UNE commande :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-everywhere-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-everywhere-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  name=str(a.get("name") or "")
  if name in ("la-forge","formation","torinvest-formation","forge"):
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo ""
echo "############################################################"
echo "#  HOTFIX CLICK EVERYWHERE v13 — list + calendar          #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"

[[ -d "$APP_DIR" ]] || { echo "ERREUR: APP_DIR introuvable"; exit 1; }
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'clickEverywhere' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans clickEverywhere"; exit 1; }
grep -q 'keepInFrame' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans keepInFrame top/parent"; exit 1; }
grep -q 'version: 13' "$TMP/bridge.js" || { echo "ÉCHEC: bridge version != 13"; exit 1; }
grep -q 'clickEverywhere' "$TMP/routes.js" || { echo "ÉCHEC: routes sans clickEverywhere"; exit 1; }
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"

cat > "$TMP/js-stub.js" <<'STUB'
/**
 * STUB — screens HARD OFF (clickEverywhere v13).
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectHardOff = true;
  window.__forgeJtsClickEverywhere = true;
})();
STUB

echo "→ Inventaire…"
find "$APP_DIR" -name 'routes-formation-auth.js' 2>/dev/null | sed 's/^/  auth: /' || true

echo "→ Overwrite ALL copies…"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/bridge.js" "$APP_DIR/routes-journal-bridge.js" 2>/dev/null || true
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
cp -f "$TMP/js-stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  echo "  → auth-sibling @ $dir"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do cp -f "$TMP/bridge.js" "$f"; echo "  → $f"; done \
  < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do cp -f "$TMP/routes.js" "$f"; done \
  < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do cp -f "$TMP/js-stub.js" "$f"; done \
  < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

FOUND=0
while IFS= read -r -d '' f; do
  grep -q 'clickEverywhere' "$f" && grep -q 'version: 13' "$f" || { echo "BAD $f"; exit 1; }
  echo "  OK disk $f"
  FOUND=1
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
[[ "$FOUND" -eq 1 ]] || { echo "ÉCHEC: aucune bridge trouvée"; exit 1; }

[[ -f "$APP_DIR/server.js" ]] && node --check "$APP_DIR/server.js"

echo "→ pm2 restart…"
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart formation --update-env 2>/dev/null || pm2 restart all --update-env

ok=0
PING=""; BRIDGE=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  PING="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-trade-screens/ping 2>/dev/null || true)"
  BRIDGE="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-bridge/ping 2>/dev/null || true)"
  if echo "$PING" | grep -q 'clickEverywhere' && echo "$BRIDGE" | grep -q 'clickEverywhere'; then
    ok=1; break
  fi
  echo "  …attente v13 ($i)"
done

pm2 list || true
echo "PING screens: $PING"
echo "PING bridge:  $BRIDGE"
[[ "$ok" -eq 1 ]] || { echo "ÉCHEC: ping sans clickEverywhere"; exit 1; }

echo ""
echo "############################################################"
echo "#  OK — clickEverywhere v13                                #"
echo "#  Ctrl+Shift+R → clic trade (liste OU calendrier)         #"
echo "############################################################"
