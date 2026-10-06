#!/usr/bin/env bash
# HOTFIX — « JE PEUX PAS CLIQUER UN TRADE POUR OUVRIR LE DÉTAIL » (TJ Pro journal)
#
# Cause: inject screens montait le panel hors « Ajouter un trade » (faux positif
# sidebar + colonnes liste) + stopPropagation / overlays pouvaient manger les clics.
# Fix: détection stricte add-trade, plus de stopPropagation click panel,
# overlays pointer-events:none fermés, inject v=9, ping v7.
#
# Sur le VPS, tape exactement :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-detail-fix-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-DETAIL.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-detail-fix-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=9"
EXPECTED_PING_VERSION='"version":7'

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX CLICK DETAIL ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/js.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'Effacer' "$TMP/js.js" || { echo "ÉCHEC: JS sans bouton Effacer"; exit 1; }
grep -q 'deleteScreen' "$TMP/js.js" || { echo "ÉCHEC: deleteScreen manquant"; exit 1; }
grep -q 'findAddTradeForm\|looksLikeTradeListPage\|clickDetailFix\|isAddTradePage' "$TMP/js.js" || {
  echo "ÉCHEC: détection add-trade / click-detail manquante"
  exit 1
}
grep -q 'pointer-events:none' "$TMP/js.js" || {
  echo "ÉCHEC: pointer-events:none overlays manquant"
  exit 1
}
python3 - "$TMP/js.js" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
# Capture-phase click + stopPropagation on panel must stay gone
bad = re.search(
    r'addEventListener\(\s*["\']click["\']\s*,\s*function\s*\([^)]*\)\s*\{[^}]*stopPropagation\(\)[^}]*\}\s*,\s*true\s*\)',
    src,
)
if bad:
    print("ÉCHEC: capture-phase click stopPropagation détecté")
    sys.exit(1)
# Panel must NOT stopPropagation on every click (bubble blanket)
if re.search(
    r'panel\.addEventListener\(\s*["\']click["\']\s*,\s*function\s*\([^)]*\)\s*\{\s*[^}]*stopPropagation',
    src,
):
    print("ÉCHEC: panel click stopPropagation blanket encore présent")
    sys.exit(1)
if "findAddTradeForm" not in src or "looksLikeTradeListPage" not in src:
    print("ÉCHEC: findAddTradeForm / looksLikeTradeListPage manquant")
    sys.exit(1)
if "document.addEventListener" in src and re.search(
    r'document\.addEventListener\(\s*["\']change["\']', src
):
    print("ÉCHEC: document-level change listener encore présent")
    sys.exit(1)
print("OK client: click-detail hardening")
PY

grep -q "$EXPECTED_INJECT" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans $EXPECTED_INJECT"
  exit 1
}
grep -q 'clickDetailFix: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping clickDetailFix manquant"
  exit 1
}
grep -q 'version: 7' "$TMP/routes.js" || {
  echo "ÉCHEC: ping version 7 manquant"
  exit 1
}
grep -q 'images/:imageId/delete' "$TMP/routes.js" || {
  echo "ÉCHEC: route POST .../delete manquante"
  exit 1
}
grep -q 'deleteFix: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping deleteFix manquant"
  exit 1
}

cp -f "$TMP/js.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 2
PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
echo "ping: $PING"
echo "$PING" | grep -q '"ok"' || { echo "ÉCHEC ping"; exit 1; }
echo "$PING" | grep -q 'clickDetailFix' || {
  echo "ÉCHEC: ping sans clickDetailFix — mauvais routes déployés?"
  exit 1
}
echo "$PING" | grep -q '"version":7\|"version": 7' || {
  echo "ÉCHEC: ping version != 7 ($PING)"
  exit 1
}

echo ""
echo "OK — Click→détail trade déployé (inject v=9, ping v7)."
echo "→ Sur ton PC : Ctrl+Shift+R sur le journal, puis clique un trade → détail lecture"
echo "======== DONE ========"
