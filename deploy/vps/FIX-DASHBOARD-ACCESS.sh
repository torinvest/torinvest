#!/usr/bin/env bash
# Rétablit l'accès dashboard pour les sessions forge.
#
# SUR LE VPS (déjà connecté en SSH) — colle EXACTEMENT :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-dashboard-vps-redeploy-691a/deploy/vps/FIX-DASHBOARD-ACCESS.sh | bash
#
# Depuis ton PC :
#   ssh ubuntu@164.132.46.191
#   puis la commande curl ci-dessus (SANS remettre ssh ni guillemets autour)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fix-dashboard-vps-redeploy-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== FIX DASHBOARD ACCESS ========"
echo "APP=$APP_DIR REF=$REF HOST=$(hostname)"

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: tu es sur Windows/WSL. SSH sur le VPS puis relance."
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" \
  "$APP_DIR/public/la-forge/js" "$APP_DIR/public/la-forge/css"

echo "==> 0) dashboard.html (OBLIGATOIRE sous public/)"
curl -fsSL "$RAW/deploy/vps/app-shells/dashboard.html" -o "$APP_DIR/public/dashboard.html"
cp "$APP_DIR/public/dashboard.html" "$APP_DIR/public/la-forge/dashboard.html" 2>/dev/null || true
[[ -s "$APP_DIR/public/dashboard.html" ]] || { echo "ERREUR: dashboard.html vide/absent"; exit 1; }
ls -la "$APP_DIR/public/dashboard.html"

echo "==> 1) auth.js"
curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js"
cp "$APP_DIR/public/js/auth.js" "$APP_DIR/public/la-forge/js/auth.js" 2>/dev/null || true

echo "==> 2) forge-session-shim + early mount"
curl -fsSL "$RAW/deploy/vps/formation-server/forge-session-shim.js" \
  -o "$APP_DIR/server-patches/forge-session-shim.js"
curl -fsSL "$RAW/deploy/vps/ensure-forge-session-early.js" -o /tmp/ensure-forge-session-early.js
node /tmp/ensure-forge-session-early.js "$APP_DIR"

echo "==> 3) patch requireAuth + middleware dashboard prioritaire"
curl -fsSL "$RAW/deploy/vps/patch-require-auth-forge.js" -o /tmp/patch-require-auth-forge.js
node /tmp/patch-require-auth-forge.js "$APP_DIR"

echo "==> 4) login.html cache-bust"
if curl -fsSL "$RAW/deploy/vps/app-shells/login.html" -o "$APP_DIR/public/login.html"; then
  sed -i 's|auth\.js?v=[^"]*|auth.js?v=dashfix2|g; s|auth\.js"|auth.js?v=dashfix2"|g' "$APP_DIR/public/login.html" || true
fi

echo "==> 5) Marqueurs server.js"
grep -n 'TORINVEST_DASHBOARD_PUBLIC_BEGIN\|TORINVEST_FORGE_SESSION_SHIM_BEGIN\|TORINVEST_FORGE_REQUIRE_AUTH_BEGIN' "$APP_DIR/server.js" | head -20 || true

echo "==> 6) Syntax + restart"
node --check "$APP_DIR/server.js"
pm2 restart la-forge --update-env
sleep 4

echo "==> 7) Vérifs locales (dashboard DOIT être 200)"
LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/login.html' || true)"
START_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/start.html' || true)"
DASH_ANON="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/dashboard.html' || true)"
echo "login=$LOGIN_CODE start=$START_CODE dashboard_anon=$DASH_ANON"

[[ "$LOGIN_CODE" == "200" ]] || { echo "ERREUR login pas 200"; exit 1; }
[[ "$START_CODE" == "200" ]] || { echo "ERREUR start pas 200"; exit 1; }
[[ "$DASH_ANON" == "200" ]] || {
  echo "ERREUR dashboard encore $DASH_ANON"
  echo "--- debug Location ---"
  curl -sSI 'http://127.0.0.1:3001/dashboard.html' | head -20 || true
  echo "--- grep redirect dashboard dans server.js ---"
  grep -n 'dashboard' "$APP_DIR/server.js" | head -40 || true
  exit 1
}

echo ""
echo "================ SUCCESS ================"
echo "dashboard.html = 200. Ctrl+F5 puis reconnecte-toi :"
echo "  https://app.torinvest-trading.com/login.html"
echo "========================================="
