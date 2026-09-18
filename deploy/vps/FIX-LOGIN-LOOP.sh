#!/usr/bin/env bash
# Stoppe la boucle login ↔ dashboard (page qui « saute »).
# À lancer SUR LE VPS :
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-login-page-jump-691a/deploy/vps/FIX-LOGIN-LOOP.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fix-login-page-jump-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== FIX LOGIN LOOP (plus de saut) ========"
echo "APP=$APP_DIR REF=$REF HOST=$(hostname)"

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: tu es sur Windows/WSL. SSH sur le VPS puis relance."
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches"

echo "==> 1) auth.js (coupe auto-redirect boucle)"
curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js"
cp "$APP_DIR/public/js/auth.js" "$APP_DIR/public/la-forge/js/auth.js" 2>/dev/null || true

echo "==> 2) forge-brand + CSS anti-saut"
curl -fsSL "$RAW/la-forge/js/forge-brand.js" -o "$APP_DIR/public/js/forge-brand.js"
curl -fsSL "$RAW/la-forge/css/main.css" -o "$APP_DIR/public/css/main.css"
cp "$APP_DIR/public/js/forge-brand.js" "$APP_DIR/public/la-forge/js/forge-brand.js" 2>/dev/null || true
cp "$APP_DIR/public/css/main.css" "$APP_DIR/public/la-forge/css/main.css" 2>/dev/null || true

echo "==> 3) login.html"
curl -fsSL "$RAW/deploy/vps/app-shells/login.html" -o "$APP_DIR/public/login.html"
sed -i 's|auth\.js?v=[^"]*|auth.js?v=noloop2|g; s|auth\.js"|auth.js?v=noloop2"|g' "$APP_DIR/public/login.html" || true
sed -i 's|main\.css?v=[^"]*|main.css?v=noloop2|g; s|main\.css"|main.css?v=noloop2"|g' "$APP_DIR/public/login.html" || true
sed -i 's|forge-brand\.js?v=[^"]*|forge-brand.js?v=noloop2|g; s|forge-brand\.js"|forge-brand.js?v=noloop2"|g' "$APP_DIR/public/login.html" || true

echo "==> 4) shim session tôt + auth patches"
curl -fsSL "$RAW/deploy/vps/formation-server/forge-session-shim.js" \
  -o "$APP_DIR/server-patches/forge-session-shim.js"
curl -fsSL "$RAW/deploy/vps/ensure-forge-session-early.js" -o /tmp/ensure-forge-session-early.js
node /tmp/ensure-forge-session-early.js "$APP_DIR"

echo "==> 5) Restart"
pm2 restart la-forge --update-env
sleep 3

echo "==> 6) Vérif : dashboard sans cookie = 302 login (OK) ; login = 200 (OK)"
DASH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/dashboard.html' || true)"
LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/login.html?next=%2Fdashboard.html' || true)"
echo "dashboard=$DASH_CODE login=$LOGIN_CODE"
[[ "$LOGIN_CODE" == "200" ]] || { echo "ERREUR login pas 200"; exit 1; }

echo ""
echo "================ SUCCESS ================"
echo "Ouvre (Ctrl+F5) :"
echo "  https://app.torinvest-trading.com/login.html"
echo "La page ne doit PLUS boucler. Connecte-toi puis tu arrives sur Premiers pas / start."
echo "========================================="
