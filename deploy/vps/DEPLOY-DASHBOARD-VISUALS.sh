#!/usr/bin/env bash
# Déploie les bandeaux visuels du dashboard espace membre.
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/dashboard-card-visuals-691a/deploy/vps/DEPLOY-DASHBOARD-VISUALS.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/dashboard-card-visuals-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DASHBOARD CARD VISUALS ========"
echo "APP=$APP_DIR REF=$REF"

mkdir -p "$APP_DIR/public/img" "$APP_DIR/public/css" "$APP_DIR/public/la-forge/img"

echo "==> CSS"
curl -fsSL "$RAW/la-forge/css/main.css" -o "$APP_DIR/public/css/main.css"
cp "$APP_DIR/public/css/main.css" "$APP_DIR/public/la-forge/css/main.css" 2>/dev/null || true

echo "==> Dashboard"
curl -fsSL "$RAW/deploy/vps/app-shells/dashboard.html" -o "$APP_DIR/public/dashboard.html"

echo "==> Images"
for f in forge-anvil.png live-trading-banner.png ict-atlas-icon.svg styles-atlas-icon.svg psycho-atlas-icon.svg \
         dash-journal.svg dash-books.svg dash-atlas.svg dash-resources.svg dash-fonda.svg; do
  curl -fsSL "$RAW/la-forge/img/$f" -o "$APP_DIR/public/img/$f"
  cp "$APP_DIR/public/img/$f" "$APP_DIR/public/la-forge/img/$f" 2>/dev/null || true
  echo "  $f"
done

echo ""
echo "================ SUCCESS ================"
echo "Hard refresh : https://app.torinvest-trading.com/dashboard.html"
echo "========================================="
