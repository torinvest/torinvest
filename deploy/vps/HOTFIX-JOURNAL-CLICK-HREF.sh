#!/usr/bin/env bash
# DEPRECATED — DO NOT RUN.
# Use ONLY: HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh on branch cursor/journal-nav-fix-691a (v15 navFix).
# Old v13/v14 hotfixes break menu nav (Calendrier/Historique → site principal).
echo 'DEPRECATED: refuse to run. Use HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (v15 navFix, branch cursor/journal-nav-fix-691a).' >&2
exit 99

# HOTFIX — clic trade → détail (location.href) — deploy ALL copies
#
# Échec précédent : écriture seulement dans $APP_DIR/routes-*.js alors que
# la-forge require() charge une autre copie (à côté de routes-formation-auth.js).
# Ping restait version:11 sans hrefClickFix.
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
echo "#  HOTFIX CLICK HREF v12b — find+overwrite ALL copies     #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR: APP_DIR introuvable: $APP_DIR"
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Download…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'hrefClickFix' "$TMP/bridge.js" || { echo "ÉCHEC: download bridge sans hrefClickFix"; exit 1; }
grep -q 'getOwnPropertyDescriptor(Location.prototype, "href")' "$TMP/bridge.js" || {
  echo "ÉCHEC: download bridge sans patch Location.href"; exit 1
}
grep -q 'hrefClickFix' "$TMP/routes.js" || { echo "ÉCHEC: download routes sans hrefClickFix"; exit 1; }
grep -q 'version: 12' "$TMP/bridge.js" || { echo "ÉCHEC: bridge version != 12"; exit 1; }
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"

cat > "$TMP/js-stub.js" <<'STUB'
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

echo "→ Inventaire copies existantes…"
find "$APP_DIR" -name 'routes-formation-auth.js' 2>/dev/null | sed 's/^/  auth: /' || true
find "$APP_DIR" -name 'routes-journal-bridge.js' 2>/dev/null | sed 's/^/  bridge: /' || true
find "$APP_DIR" -name 'routes-journal-trade-screens.js' 2>/dev/null | sed 's/^/  screens: /' || true

echo "→ Overwrite ALL copies (comme 502-restore)…"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
cp -f "$TMP/bridge.js" "$APP_DIR/routes-journal-bridge.js" 2>/dev/null || true
cp -f "$TMP/js-stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"

# Primary: next to every routes-formation-auth.js (what Node require() loads)
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  echo "  → auth-sibling @ $dir"
  grep -q 'hrefClickFix' "$dir/routes-journal-bridge.js" || {
    echo "ÉCHEC: write bridge sans hrefClickFix @ $dir"; exit 1
  }
  grep -q 'hrefClickFix' "$dir/routes-journal-trade-screens.js" || {
    echo "ÉCHEC: write routes sans hrefClickFix @ $dir"; exit 1
  }
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/bridge.js" "$f"
  echo "  → bridge @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes.js" "$f"
  echo "  → screens @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js-stub.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

# Prove disk has v12 before restart
echo "→ Pre-restart disk check…"
FOUND=0
while IFS= read -r -d '' f; do
  if grep -q 'hrefClickFix' "$f" && grep -q 'version: 12' "$f"; then
    echo "  OK disk $f"
    FOUND=1
  else
    echo "  BAD disk $f"
    exit 1
  fi
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
[[ "$FOUND" -eq 1 ]] || { echo "ÉCHEC: aucune routes-journal-bridge.js trouvée"; exit 1; }

if [[ -f "$APP_DIR/server.js" ]]; then
  node --check "$APP_DIR/server.js" || {
    echo "ÉCHEC: server.js invalide — abort"
    exit 1
  }
fi

echo "→ pm2 restart la-forge (delete+start si besoin)…"
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart la-forge
else
  pm2 restart formation --update-env 2>/dev/null \
    || pm2 restart torinvest-formation --update-env 2>/dev/null \
    || pm2 restart all --update-env
fi

# Wait until ping reflects disk (require cache cleared by process restart)
ok=0
for i in 1 2 3 4 5 6 7 8; do
  sleep 1
  PING="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-trade-screens/ping 2>/dev/null || true)"
  BRIDGE="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-bridge/ping 2>/dev/null || true)"
  if echo "$PING" | grep -q 'hrefClickFix' && echo "$BRIDGE" | grep -q 'hrefClickFix'; then
    ok=1
    break
  fi
  echo "  …attente ping v12 ($i) screens=$(echo "$PING" | head -c 80)"
done

pm2 list || true
echo "PING screens: $PING"
echo "PING bridge:  $BRIDGE"

if [[ "$ok" -ne 1 ]]; then
  echo ""
  echo "ÉCHEC: process encore sur ancien code. Debug:"
  echo "→ which file does node load?"
  pm2 jlist 2>/dev/null | python3 -c '
import json,sys
apps=json.load(sys.stdin)
for a in apps:
  if str(a.get("name"))=="la-forge":
    env=a.get("pm2_env") or {}
    print("cwd:", env.get("pm_cwd"))
    print("script:", env.get("pm_exec_path") or env.get("script"))
    break
' || true
  echo "→ grep hrefClickFix on disk:"
  grep -Rnl 'hrefClickFix' "$APP_DIR" --include='routes-journal*.js' 2>/dev/null | head -20 || true
  echo "→ grep version: 11 still live in auth siblings:"
  find "$APP_DIR" -name 'routes-formation-auth.js' -exec dirname {} \; 2>/dev/null | while read -r d; do
    echo "--- $d ---"
    grep -n 'version:' "$d/routes-journal-trade-screens.js" 2>/dev/null | head -3 || true
  done
  exit 1
fi

LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login.html 2>/dev/null || echo 000)"
echo "login.html → $LOGIN_CODE"

echo ""
echo "############################################################"
echo "#  OK — hrefClickFix v12 live                              #"
echo "#  Ctrl+Shift+R → clic trade → détail lecture              #"
echo "############################################################"
