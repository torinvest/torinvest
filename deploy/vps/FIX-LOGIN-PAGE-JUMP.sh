#!/usr/bin/env bash
# Corrige le « saut » de la page login formation (CSS + forge-brand).
# À lancer SUR LE VPS (ubuntu@vps-...), pas sur le PC Windows/WSL.
#
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-login-page-jump-691a/deploy/vps/FIX-LOGIN-PAGE-JUMP.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fix-login-page-jump-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== FIX LOGIN PAGE JUMP ========"
echo "APP=$APP_DIR REF=$REF HOST=$(hostname)"

if [[ "$(hostname)" == DESKTOP* ]] || [[ -d /mnt/c/Windows ]]; then
  echo "ATTENTION: tu sembles être sur Windows/WSL — ce script doit tourner sur le VPS."
  echo "SSH puis relance la même commande."
fi

mkdir -p "$APP_DIR/public/css" "$APP_DIR/public/js" "$APP_DIR/public/la-forge/css" "$APP_DIR/public/la-forge/js"

echo "==> CSS main.css"
curl -fsSL "$RAW/la-forge/css/main.css" -o "$APP_DIR/public/css/main.css"
cp "$APP_DIR/public/css/main.css" "$APP_DIR/public/la-forge/css/main.css" 2>/dev/null || true

echo "==> JS forge-brand.js"
curl -fsSL "$RAW/la-forge/js/forge-brand.js" -o "$APP_DIR/public/js/forge-brand.js"
cp "$APP_DIR/public/js/forge-brand.js" "$APP_DIR/public/la-forge/js/forge-brand.js" 2>/dev/null || true

echo "==> login.html (cache bust auth)"
curl -fsSL "$RAW/deploy/vps/app-shells/login.html" -o "$APP_DIR/public/login.html" || \
  curl -fsSL "$RAW/la-forge/login.html" -o "$APP_DIR/public/login.html"

# bump query on css/js in login if present
if grep -q 'main.css' "$APP_DIR/public/login.html"; then
  sed -i 's|/css/main.css[^"]*|/css/main.css?v=loginjump1|g' "$APP_DIR/public/login.html"
  sed -i 's|/js/forge-brand.js[^"]*|/js/forge-brand.js?v=loginjump1|g' "$APP_DIR/public/login.html"
fi

echo ""
echo "================ SUCCESS ================"
echo "Hard refresh : https://app.torinvest-trading.com/login.html"
echo "========================================="
