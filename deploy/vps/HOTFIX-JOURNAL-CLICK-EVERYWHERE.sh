#!/usr/bin/env bash
# HOTFIX — clic trade PARTOUT (liste + calendrier TJ) v14 NUCLEAR + verify strict
#
# Audit 2026-10-06: prod était coincée sur v13 partielle (#188) parce que le
# vérificateur acceptait clickEverywhere sans exiger cspStrip.
#
# v14:
#   - STRIP CSP entier sur /journal-embed/*
#   - MutationObserver + bubble openTrade
#   - assets relatifs → radar
#   - deep-link SSO /api/journal-bridge/radar-url
#   - ping DOIT contenir cspStrip + tradeRowObserver + version:14
#   - CSP header DOIT être absente sur /journal-embed/ après restart
#
# UNE commande VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-journal-complet-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="${JOURNAL_HOTFIX_BRANCH:-cursor/audit-journal-complet-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

# Resolve the directory Node actually loads (pm2 cwd + script path walk)
PM2_META="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  name=str(a.get("name") or "")
  if name in ("la-forge","formation","torinvest-formation","forge"):
    env=a.get("pm2_env") or {}
    print((env.get("pm_cwd") or "").strip())
    print((env.get("pm_exec_path") or env.get("script") or "").strip())
    break
' 2>/dev/null || true)"
PM2_CWD="$(echo "$PM2_META" | sed -n '1p')"
PM2_SCRIPT="$(echo "$PM2_META" | sed -n '2p')"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo ""
echo "############################################################"
echo "#  HOTFIX CLICK EVERYWHERE v14 — NUCLEAR + STRICT VERIFY  #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"
echo "PM2_CWD=$PM2_CWD"
echo "PM2_SCRIPT=$PM2_SCRIPT"

[[ -d "$APP_DIR" ]] || { echo "ERREUR: APP_DIR introuvable"; exit 1; }
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Download…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"
curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js"
curl -fsSL "$RAW/deploy/vps/app-shells/journal.html" -o "$TMP/journal.html"

grep -q 'clickEverywhere' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans clickEverywhere"; exit 1; }
grep -q 'MutationObserver' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans MutationObserver"; exit 1; }
grep -q '__tjCspStripped' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans CSP strip"; exit 1; }
grep -q 'keepInFrame' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans keepInFrame"; exit 1; }
grep -q 'version: 14' "$TMP/bridge.js" || { echo "ÉCHEC: bridge version != 14"; exit 1; }
grep -q 'radar-url' "$TMP/bridge.js" || { echo "ÉCHEC: bridge sans radar-url deep-link"; exit 1; }
grep -q 'clickEverywhere' "$TMP/routes.js" || { echo "ÉCHEC: routes sans clickEverywhere"; exit 1; }
grep -q 'cspStrip' "$TMP/routes.js" || { echo "ÉCHEC: routes sans cspStrip"; exit 1; }
grep -q 'version: 14' "$TMP/routes.js" || { echo "ÉCHEC: routes version != 14"; exit 1; }
grep -q 'radar-url' "$TMP/forge-journal.js" || { echo "ÉCHEC: forge-journal sans radar-url"; exit 1; }

echo "→ node --check…"
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"

cat > "$TMP/js-stub.js" <<'STUB'
/**
 * STUB — screens HARD OFF (clickEverywhere v14 nuclear).
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectHardOff = true;
  window.__forgeJtsClickEverywhere = true;
  window.__forgeJtsCspStrip = true;
  window.__forgeJtsVersion = 14;
})();
STUB

echo "→ Inventaire copies existantes…"
find "$APP_DIR" -name 'routes-formation-auth.js' 2>/dev/null | sed 's/^/  auth: /' || true
find "$APP_DIR" -name 'routes-journal-bridge.js' 2>/dev/null | sed 's/^/  bridge: /' || true

OVERWRITE_DIRS=()

if [[ -n "${PM2_SCRIPT}" && -e "${PM2_SCRIPT}" ]]; then
  d="$(dirname "$PM2_SCRIPT")"
  while [[ "$d" != "/" ]]; do
    if [[ -f "$d/routes-formation-auth.js" || -f "$d/routes-journal-bridge.js" || -d "$d/server-patches" ]]; then
      OVERWRITE_DIRS+=("$d")
      echo "  → pm2-walk hit: $d"
      break
    fi
    if [[ -f "$d/server-patches/routes-journal-bridge.js" ]]; then
      OVERWRITE_DIRS+=("$d")
      echo "  → pm2-walk server-patches parent: $d"
      break
    fi
    d="$(dirname "$d")"
  done
fi

OVERWRITE_DIRS+=("$APP_DIR")
[[ -d "$APP_DIR/server-patches" ]] && OVERWRITE_DIRS+=("$APP_DIR/server-patches")

while IFS= read -r -d '' f; do
  OVERWRITE_DIRS+=("$(dirname "$f")")
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

mapfile -t OVERWRITE_DIRS < <(printf '%s\n' "${OVERWRITE_DIRS[@]}" | awk 'NF && !seen[$0]++')

echo "→ Overwrite ALL copies…"
WRITTEN=()
for dir in "${OVERWRITE_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  if [[ "$(basename "$dir")" == "server-patches" ]]; then
    cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
    cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
    WRITTEN+=("$dir/routes-journal-bridge.js")
    WRITTEN+=("$dir/routes-journal-trade-screens.js")
    echo "  → $dir/routes-journal-bridge.js"
    echo "  → $dir/routes-journal-trade-screens.js"
  else
    mkdir -p "$dir"
    cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
    cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
    WRITTEN+=("$dir/routes-journal-bridge.js")
    WRITTEN+=("$dir/routes-journal-trade-screens.js")
    echo "  → $dir/routes-journal-bridge.js"
    echo "  → $dir/routes-journal-trade-screens.js"
    if [[ -d "$dir/server-patches" ]]; then
      cp -f "$TMP/bridge.js" "$dir/server-patches/routes-journal-bridge.js"
      cp -f "$TMP/routes.js" "$dir/server-patches/routes-journal-trade-screens.js"
      WRITTEN+=("$dir/server-patches/routes-journal-bridge.js")
      WRITTEN+=("$dir/server-patches/routes-journal-trade-screens.js")
      echo "  → $dir/server-patches/routes-journal-bridge.js"
    fi
    if [[ -d "$dir/public/js" ]]; then
      cp -f "$TMP/js-stub.js" "$dir/public/js/forge-journal-trade-screens.js"
      cp -f "$TMP/forge-journal.js" "$dir/public/js/forge-journal.js"
      echo "  → $dir/public/js/forge-journal-trade-screens.js"
      echo "  → $dir/public/js/forge-journal.js"
    fi
    if [[ -d "$dir/public" ]]; then
      cp -f "$TMP/journal.html" "$dir/public/journal.html"
      echo "  → $dir/public/journal.html"
    fi
  fi
done

while IFS= read -r -d '' f; do
  cp -f "$TMP/bridge.js" "$f"
  WRITTEN+=("$f")
  echo "  → find-bridge $f"
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do
  cp -f "$TMP/routes.js" "$f"
  WRITTEN+=("$f")
  echo "  → find-screens $f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)
while IFS= read -r -d '' f; do
  cp -f "$TMP/js-stub.js" "$f"
  echo "  → find-stub $f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

echo "→ Pre-restart disk verify…"
FOUND=0
while IFS= read -r -d '' f; do
  if grep -q 'clickEverywhere' "$f" && grep -q 'version: 14' "$f" && grep -q 'MutationObserver' "$f" && grep -q '__tjCspStripped' "$f" && grep -q 'radar-url' "$f"; then
    echo "  OK disk $f"
    FOUND=1
  else
    echo "  BAD disk $f"
    exit 1
  fi
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)
[[ "$FOUND" -eq 1 ]] || { echo "ÉCHEC: aucune routes-journal-bridge.js"; exit 1; }

if [[ -f "$APP_DIR/server.js" ]]; then
  node --check "$APP_DIR/server.js" || { echo "ÉCHEC: server.js invalide"; exit 1; }
fi

echo "→ Files overwritten (unique):"
printf '%s\n' "${WRITTEN[@]}" | awk 'NF && !seen[$0]++' | sed 's/^/  /'

echo "→ pm2 restart la-forge…"
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart la-forge
else
  pm2 restart formation --update-env 2>/dev/null \
    || pm2 restart torinvest-formation --update-env 2>/dev/null \
    || pm2 restart all --update-env
fi

ok=0
PING=""; BRIDGE=""
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 1
  PING="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-trade-screens/ping 2>/dev/null || true)"
  BRIDGE="$(curl -sS --connect-timeout 3 http://127.0.0.1:3001/api/journal-bridge/ping 2>/dev/null || true)"
  if echo "$PING" | grep -q 'clickEverywhere' \
    && echo "$BRIDGE" | grep -q 'clickEverywhere' \
    && echo "$PING" | grep -q 'cspStrip' \
    && echo "$BRIDGE" | grep -q 'cspStrip' \
    && echo "$PING" | grep -q 'tradeRowObserver' \
    && echo "$BRIDGE" | grep -q 'tradeRowObserver' \
    && echo "$PING" | grep -qE '"version":\s*1[4-9]' \
    && echo "$BRIDGE" | grep -qE '"version":\s*1[4-9]'; then
    ok=1
    break
  fi
  echo "  …attente ping v14 cspStrip ($i) bridge=$(echo "$BRIDGE" | head -c 120)"
done

pm2 list || true
echo "PING screens: $PING"
echo "PING bridge:  $BRIDGE"

if [[ "$ok" -ne 1 ]]; then
  echo ""
  echo "ÉCHEC: process encore sur ancien code (cspStrip/version:14 manquants)."
  echo "→ pm2 describe la-forge (script path):"
  pm2 describe la-forge 2>/dev/null | head -40 || true
  echo "→ grep version/cspStrip on disk:"
  find "$APP_DIR" -name 'routes-journal-bridge.js' -print 2>/dev/null | while read -r f; do
    echo "--- $f ---"
    grep -n 'version:\|clickEverywhere\|cspStrip\|tradeRowObserver' "$f" | head -15 || true
  done
  exit 1
fi

echo "→ Verify CSP stripped on /journal-embed/…"
EMBED_HEADERS="$(curl -sS -D - -o /dev/null --connect-timeout 5 http://127.0.0.1:3001/journal-embed/ 2>/dev/null || true)"
if echo "$EMBED_HEADERS" | grep -qi '^Content-Security-Policy:'; then
  echo "ÉCHEC: CSP encore présente sur /journal-embed/ — nuclear strip non actif"
  echo "$EMBED_HEADERS" | grep -i content-security-policy | head -3
  exit 1
fi
echo "OK — pas de Content-Security-Policy sur /journal-embed/"

LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/login.html 2>/dev/null || echo 000)"
echo "login.html → $LOGIN_CODE"

echo ""
echo "############################################################"
echo "#  OK — clickEverywhere v14 NUCLEAR live                   #"
echo "#  Attendu ping: version:14 clickEverywhere:true           #"
echo "#                cspStrip:true tradeRowObserver:true       #"
echo "#  CSP /journal-embed/ : ABSENTE                           #"
echo "#  Ctrl+Shift+R → clic trade OU calendrier TJ → détail     #"
echo "#  Secours: bouton « onglet radar SSO » sur journal.html   #"
echo "############################################################"
