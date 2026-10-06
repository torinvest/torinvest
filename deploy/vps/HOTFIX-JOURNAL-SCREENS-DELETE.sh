#!/usr/bin/env bash
# HOTFIX — « JE PEUX PAS EFFACER LES SCREENS » (TJ Pro journal)
#
# Cause: stopPropagation en capture sur le panel bloquait le clic ✕ Effacer.
# Fix: bubble-only + DELETE + POST /delete fallback + inject v=8.
#
# Sur le VPS, tape exactement :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-screens-delete-fix-691a/deploy/vps/HOTFIX-JOURNAL-SCREENS-DELETE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-screens-delete-fix-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=8"
EXPECTED_PING_VERSION='"version":6'

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX SCREENS DELETE ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/js.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

# Fail clearly until files are correct
grep -q 'Effacer' "$TMP/js.js" || { echo "ÉCHEC: JS sans bouton Effacer"; exit 1; }
grep -q 'deleteScreen' "$TMP/js.js" || { echo "ÉCHEC: deleteScreen manquant"; exit 1; }
grep -q '/delete' "$TMP/js.js" || { echo "ÉCHEC: POST /delete fallback manquant côté client"; exit 1; }
python3 - "$TMP/js.js" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
bad = re.search(
    r'addEventListener\(\s*["\']click["\']\s*,\s*function\s*\([^)]*\)\s*\{[^}]*stopPropagation\(\)[^}]*\}\s*,\s*true\s*\)',
    src,
)
if bad:
    print("ÉCHEC: capture-phase click stopPropagation détecté")
    sys.exit(1)
if "deleteScreen" not in src or "/delete" not in src:
    print("ÉCHEC: deleteScreen /delete manquant")
    sys.exit(1)
print("OK client: pas de capture click stopPropagation")
PY

grep -q "$EXPECTED_INJECT" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans $EXPECTED_INJECT"
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
grep -q 'version: 6' "$TMP/routes.js" || {
  echo "ÉCHEC: ping version 6 manquant"
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
echo "$PING" | grep -q '"deleteFix":true\|"deleteFix": true' || echo "$PING" | grep -q 'deleteFix' || {
  echo "ÉCHEC: ping sans deleteFix — mauvais routes déployés?"
  exit 1
}
echo "$PING" | grep -q '"version":6\|"version": 6' || {
  echo "ÉCHEC: ping version != 6 ($PING)"
  exit 1
}

echo ""
echo "OK — Effacer screens déployé (inject v=8, ping v6)."
echo "→ Sur ton PC : Ctrl+Shift+R sur le journal, puis ✕ Effacer sur un screen"
echo "======== DONE ========"
