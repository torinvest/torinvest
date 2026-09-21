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
# bust caches navigateur
touch "$APP_DIR/public/js/lesson-core.js" "$APP_DIR/public/js/forge-module-tabs.js" "$APP_DIR/public/css/forge-module-tabs.css"
ls -lh "$APP_DIR/public/js/forge-module-tabs.js" "$APP_DIR/public/js/lesson-core.js"
grep -n "fmt-tabs--sticky\|guessModuleId\|ensureModuleTabsAssets" "$APP_DIR/public/js/forge-module-tabs.js" "$APP_DIR/public/js/lesson-core.js" | head -15
