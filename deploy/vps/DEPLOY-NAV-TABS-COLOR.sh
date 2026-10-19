#!/usr/bin/env bash
# Déploie menu + onglets colorés / animés (dashboard + forge-brand + main.css)
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${NAV_TABS_REF:-cursor/forge-nav-tabs-color-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
echo "======== DEPLOY NAV TABS COLOR ($REF) ========"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css"
curl -fsSL "$RAW/deploy/vps/app-shells/dashboard.html" -o "$APP_DIR/public/dashboard.html"
curl -fsSL "$RAW/la-forge/js/forge-brand.js" -o "$APP_DIR/public/js/forge-brand.js"
curl -fsSL "$RAW/la-forge/css/main.css" -o "$APP_DIR/public/css/main.css"
echo "→ Ctrl+Shift+R https://app.torinvest-trading.com/dashboard.html"
echo "======== DONE ========"
