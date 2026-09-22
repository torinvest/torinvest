#!/usr/bin/env bash
# Déploie Atlas Indicateurs sur le VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/indicateurs-atlas-691a/deploy/vps/DEPLOY-INDICATEURS-ATLAS.sh -o /tmp/d-ind.sh && bash /tmp/d-ind.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/indicateurs-atlas-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY ATLAS INDICATEURS ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/public/img" "$APP_DIR/public/course"

pull() {
  echo "  → $2"
  curl -fsSL "$1" -o "$2"
}

pull "$RAW/deploy/vps/app-shells/indicateurs-atlas.html" "$APP_DIR/public/indicateurs-atlas.html"
pull "$RAW/la-forge/js/forge-indicateurs-atlas.js" "$APP_DIR/public/js/forge-indicateurs-atlas.js"
pull "$RAW/la-forge/css/forge-indicateurs-atlas.css" "$APP_DIR/public/css/forge-indicateurs-atlas.css"
pull "$RAW/la-forge/img/indicateurs-atlas-icon.svg" "$APP_DIR/public/img/indicateurs-atlas-icon.svg"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/deploy/vps/app-shells/course/index.html" "$APP_DIR/public/course/index.html"

ls -lah \
  "$APP_DIR/public/indicateurs-atlas.html" \
  "$APP_DIR/public/js/forge-indicateurs-atlas.js" \
  "$APP_DIR/public/css/forge-indicateurs-atlas.css" \
  "$APP_DIR/public/img/indicateurs-atlas-icon.svg"

echo ""
curl -sS -o /dev/null -w "indicateurs-atlas.html %{http_code}\n" "http://127.0.0.1:3001/indicateurs-atlas.html" || true
curl -sS -o /dev/null -w "forge-indicateurs-atlas.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-indicateurs-atlas.js" || true
echo ""
echo "→ https://app.torinvest-trading.com/indicateurs-atlas.html"
echo "======== DONE ========"
