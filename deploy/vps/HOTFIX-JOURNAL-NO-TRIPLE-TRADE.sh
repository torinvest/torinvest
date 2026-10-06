#!/usr/bin/env bash
# HOTFIX — Empêche la création de 3 trades identiques (panel screens hors form + anti double-submit)
#
# Sur le VPS :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-triple-trade-fix-691a/deploy/vps/HOTFIX-JOURNAL-NO-TRIPLE-TRADE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF 2>/dev/null || true
BRANCH="cursor/journal-triple-trade-fix-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
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

echo "======== HOTFIX NO TRIPLE TRADE ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$APP_DIR/public/js/forge-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$APP_DIR/server-patches/routes-journal-bridge.js"

grep -q 'jtsSubmitGuard\|hors du <form>\|afterend' "$APP_DIR/public/js/forge-journal-trade-screens.js"
grep -q 'forge-journal-trade-screens.js?v=7' "$APP_DIR/server-patches/routes-journal-bridge.js"

while IFS= read -r -d '' f; do
  cp -f "$APP_DIR/server-patches/routes-journal-bridge.js" "$(dirname "$f")/routes-journal-bridge.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$APP_DIR/public/js/forge-journal-trade-screens.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 1

echo "OK — inject v=7 (plus de triple submit)."
echo "→ Ctrl+Shift+R sur https://app.torinvest-trading.com/journal.html"
echo "→ Pour supprimer/éditer les 3 doublons : sidebar Historique → ouvre chaque trade → modifier/supprimer"
echo "======== DONE ========"
