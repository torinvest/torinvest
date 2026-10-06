#!/usr/bin/env bash
# HOTFIX — clic trade → détail lecture (location.href)
#
# Contexte live (vérifié) :
#   - Site UP, CSP script-src-attr 'unsafe-inline' OK (v11 / cspClickFix)
#   - Screens inject HARD OFF
#   - Mais openTrade() fait souvent location.href = "trading_journal.php?..."
#   - Sur app.* ce path → nginx 404 (seul /journal-embed/ est proxifié)
#   - Le shim patchait assign/replace mais PAS le setter href
#
# Fix : patch location.href + redirect Express /trading_journal.php → /journal-embed/
#
# UNE commande VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-href-fix-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-HREF.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-href-fix-691a"
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
echo "#  HOTFIX CLICK HREF — openTrade → /journal-embed/        #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR: APP_DIR introuvable: $APP_DIR"
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches" || true
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Download bridge + routes…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'hrefClickFix' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans hrefClickFix"; exit 1; }
grep -q 'getOwnPropertyDescriptor(Location.prototype, "href")' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans patch Location.href"
  exit 1
}
grep -q 'version: 12' "$TMP/bridge.js" || { echo "ÉCHEC: bridge version != 12"; exit 1; }
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"

# Keep screens stub (no inject)
cat > "$TMP/stub.js" <<'STUB'
/**
 * STUB — forge-journal-trade-screens HARD OFF (hrefClickFix v12).
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectDisabled = true;
  window.__forgeJtsInjectHardOff = true;
  window.__forgeJtsHrefClickFix = true;
})();
STUB

ts="$(date +%Y%m%d%H%M%S)"
for f in \
  "$APP_DIR/routes-journal-bridge.js" \
  "$APP_DIR/server/routes-journal-bridge.js" \
  "$APP_DIR/formation-server/routes-journal-bridge.js"
do
  [[ -f "$f" ]] || continue
  cp -f "$f" "$f.bak.href.$ts"
done

deploy_bridge() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cp -f "$TMP/bridge.js" "$dest"
  echo "  wrote $dest"
}
deploy_routes() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cp -f "$TMP/routes.js" "$dest"
  echo "  wrote $dest"
}

echo "→ Install files…"
# Common layouts used by prior hotfixes
for base in "$APP_DIR" "$APP_DIR/server" "$APP_DIR/formation-server" "$APP_DIR/deploy/vps/formation-server"; do
  [[ -d "$base" ]] || continue
  if [[ -f "$base/routes-journal-bridge.js" ]] || [[ "$base" == "$APP_DIR" ]]; then
    deploy_bridge "$base/routes-journal-bridge.js"
  fi
  if [[ -f "$base/routes-journal-trade-screens.js" ]] || [[ "$base" == "$APP_DIR" ]]; then
    deploy_routes "$base/routes-journal-trade-screens.js"
  fi
done
cp -f "$TMP/stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
echo "  wrote $APP_DIR/public/js/forge-journal-trade-screens.js"

echo "→ node --check server.js…"
if [[ -f "$APP_DIR/server.js" ]]; then
  node --check "$APP_DIR/server.js" || {
    echo "ÉCHEC: server.js invalide — abort restart"
    exit 1
  }
fi

echo "→ pm2 restart…"
pm2 restart la-forge --update-env 2>/dev/null \
  || pm2 restart formation --update-env 2>/dev/null \
  || pm2 restart torinvest-formation --update-env 2>/dev/null \
  || pm2 restart all --update-env
sleep 2

PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping 2>/dev/null || true)"
BRIDGE="$(curl -sS http://127.0.0.1:3001/api/journal-bridge/ping 2>/dev/null || true)"
echo "PING screens: $PING"
echo "PING bridge:  $BRIDGE"

echo "$PING" | grep -q 'hrefClickFix' || { echo "ÉCHEC: ping sans hrefClickFix"; exit 1; }
echo "$PING" | grep -q '"version":12\|"version": 12' || echo "$BRIDGE" | grep -q '"version":12\|"version": 12' || {
  echo "ÉCHEC: version 12 attendue"
  exit 1
}
echo "$BRIDGE" | grep -q 'hrefClickFix' || { echo "ÉCHEC: bridge ping sans hrefClickFix"; exit 1; }

LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login.html 2>/dev/null || echo 000)"
echo "login.html → $LOGIN_CODE"
[[ "$LOGIN_CODE" == "200" ]] || echo "WARN: login local non-200 (nginx peut servir le static)"

echo ""
echo "############################################################"
echo "#  OK — hrefClickFix v12 déployé                           #"
echo "#  Vérif: Ctrl+Shift+R → clic trade → détail lecture       #"
echo "#  Ping: version:12, hrefClickFix:true                     #"
echo "############################################################"
