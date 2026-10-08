#!/usr/bin/env bash
# Déploie la rubrique Stratégies (LP Reversal) sur le VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/strategies-lp-reversal-691a/deploy/vps/DEPLOY-STRATEGIES.sh -o /tmp/d-str.sh && bash /tmp/d-str.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/strategies-lp-reversal-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY STRATÉGIES ($REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/public/img" "$APP_DIR/public/course"

pull() {
  echo "  → $2"
  curl -fsSL "$1" -o "$2"
}

pull "$RAW/deploy/vps/app-shells/strategies.html" "$APP_DIR/public/strategies.html"
pull "$RAW/la-forge/js/forge-strategies.js" "$APP_DIR/public/js/forge-strategies.js"
pull "$RAW/la-forge/css/forge-strategies.css" "$APP_DIR/public/css/forge-strategies.css"
pull "$RAW/la-forge/img/strategies-icon.svg" "$APP_DIR/public/img/strategies-icon.svg"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/deploy/vps/app-shells/course/index.html" "$APP_DIR/public/course/index.html"

ls -lah \
  "$APP_DIR/public/strategies.html" \
  "$APP_DIR/public/js/forge-strategies.js" \
  "$APP_DIR/public/css/forge-strategies.css" \
  "$APP_DIR/public/img/strategies-icon.svg"

echo ""
curl -sS -o /dev/null -w "strategies.html %{http_code}\n" "http://127.0.0.1:3001/strategies.html" || true
curl -sS -o /dev/null -w "forge-strategies.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-strategies.js" || true
echo ""
echo "→ https://app.torinvest-trading.com/strategies.html"
echo "→ https://app.torinvest-trading.com/strategies.html#lp-reversal"
echo "======== DONE ========"
