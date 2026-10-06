#!/usr/bin/env bash
# HOTFIX — Journal v16 : ouverture SSO DIRECTE radar (plus d’iframe par défaut)
#
# Les menus Calendrier/Historique + clic trade marchent sur le TJ natif radar.
# L’iframe /journal-embed/ reste en option (« Mode intégré »).
#
# UNE commande VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-sso-direct-691a/deploy/vps/HOTFIX-JOURNAL-SSO-DIRECT.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-sso-direct-691a"
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
echo "#  HOTFIX JOURNAL SSO DIRECT v16                          #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"
[[ -d "$APP_DIR" ]] || { echo "ERREUR: APP_DIR"; exit 1; }

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js"
curl -fsSL "$RAW/deploy/vps/app-shells/journal.html" -o "$TMP/journal.html"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'ssoDirect\|openRadarDirect\|v=16\|forge-journal.js?v=16' "$TMP/forge-journal.js" "$TMP/journal.html" || true
grep -q 'openRadarDirect' "$TMP/forge-journal.js" || { echo "ÉCHEC: forge-journal sans openRadarDirect"; exit 1; }
grep -q 'forge-journal.js?v=16' "$TMP/journal.html" || { echo "ÉCHEC: journal.html cache bust != v16"; exit 1; }
grep -q 'ssoDirect: true' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans ssoDirect"; exit 1; }
grep -q 'version: 16' "$TMP/bridge.js" || { echo "ÉCHEC: bridge version != 16"; exit 1; }
grep -q 'ssoDirect: true' "$TMP/routes.js" || { echo "ÉCHEC: routes sans ssoDirect"; exit 1; }
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"
node --check "$TMP/forge-journal.js"

echo "→ Install…"
cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js"
cp -f "$TMP/journal.html" "$APP_DIR/public/journal.html"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  echo "  → auth-sibling $dir"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do cp -f "$TMP/bridge.js" "$f"; done \
  < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do cp -f "$TMP/routes.js" "$f"; done \
  < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do cp -f "$TMP/forge-journal.js" "$f"; done \
  < <(find "$APP_DIR" -name 'forge-journal.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do cp -f "$TMP/journal.html" "$f"; done \
  < <(find "$APP_DIR/public" -name 'journal.html' -print0 2>/dev/null || true)

[[ -f "$APP_DIR/server.js" ]] && node --check "$APP_DIR/server.js"

echo "→ pm2 restart…"
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart formation --update-env 2>/dev/null || pm2 restart all --update-env

ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  BRIDGE="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-bridge/ping 2>/dev/null || true)"
  PING="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-trade-screens/ping 2>/dev/null || true)"
  if echo "$BRIDGE" | grep -q 'ssoDirect' && echo "$BRIDGE" | grep -q '"version":16\|"version": 16'; then
    ok=1
    break
  fi
  echo "  …attente v16 ($i)"
done

echo "PING bridge: $BRIDGE"
echo "PING screens: $PING"
[[ "$ok" -eq 1 ]] || { echo "ÉCHEC: ping sans ssoDirect/version:16"; exit 1; }

# Static files
grep -q 'openRadarDirect' "$APP_DIR/public/js/forge-journal.js" || { echo "ÉCHEC: public forge-journal pas à jour"; exit 1; }
grep -q 'forge-journal.js?v=16' "$APP_DIR/public/journal.html" || { echo "ÉCHEC: public journal.html pas à jour"; exit 1; }

echo ""
echo "############################################################"
echo "#  OK — ssoDirect v16                                      #"
echo "#  Va sur /journal.html → redirection radar TJ natif       #"
echo "#  Calendrier / Historique / détail trade = natifs         #"
echo "############################################################"
