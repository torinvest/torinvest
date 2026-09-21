#!/usr/bin/env bash
# Hotfix rapide : met à jour lesson-core pour charger les onglets Mode d'emploi / Questions.
#   curl -fsSL URL -o /tmp/h.sh && bash /tmp/h.sh
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/module-guide-qa-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== HOTFIX MODULE TABS AUTOLOAD ========"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css"

curl -fsSL "$RAW/la-forge/js/lesson-core.js" -o "$APP_DIR/public/js/lesson-core.js"
curl -fsSL "$RAW/la-forge/js/forge-module-guides.js" -o "$APP_DIR/public/js/forge-module-guides.js"
curl -fsSL "$RAW/la-forge/js/forge-module-tabs.js" -o "$APP_DIR/public/js/forge-module-tabs.js"
curl -fsSL "$RAW/la-forge/js/forge-module-qa-admin.js" -o "$APP_DIR/public/js/forge-module-qa-admin.js"
curl -fsSL "$RAW/la-forge/css/forge-module-tabs.css" -o "$APP_DIR/public/css/forge-module-tabs.css"
curl -fsSL "$RAW/deploy/vps/app-shells/module-qa.html" -o "$APP_DIR/public/module-qa.html"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-module-qa.js" -o "$APP_DIR/server-patches/routes-module-qa.js"

# ensure API wired
if [[ -f "$APP_DIR/wire-formation-server-patches.js" ]]; then
  curl -fsSL "$RAW/deploy/vps/wire-formation-server-patches.js" -o "$APP_DIR/wire-formation-server-patches.js"
  node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR" || true
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || true
fi

grep -n "ensureModuleTabsAssets" "$APP_DIR/public/js/lesson-core.js" | head -3
echo "OK — hard refresh un module (Ctrl+F5)"
echo "Admin inbox : https://app.torinvest-trading.com/module-qa.html"
echo "======== DONE ========"
