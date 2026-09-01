#!/usr/bin/env bash
# Pont Premium La Forge → Fondamental (/api/fondamental-bridge + iframe).
#
# Usage VPS formation :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-fondamental-bridge-now.sh" | bash -s -- ~/torinvest-formation
#
# Secret (identique ai_access_hmac_secret dans radar api/config.local.php) :
#   FORGE_FONDAMENTAL_BRIDGE_SECRET='...' curl -fsSL "..." | bash -s -- ~/torinvest-formation

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
SHA="${SHA:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  exit 1
fi

echo "==> deploy-fondamental-bridge → $APP_DIR"

dl() {
  curl -fsSL "$BASE/$1" -o "$2"
  echo "  $(basename "$2")"
}

mkdir -p "$APP_DIR/deploy/vps" "$APP_DIR/server-patches"

dl "deploy/vps/wire-formation-server-patches.js" "$APP_DIR/deploy/vps/wire-formation-server-patches.js"
dl "deploy/vps/wire-fondamental-bridge-only.js" "$APP_DIR/deploy/vps/wire-fondamental-bridge-only.js"
dl "deploy/vps/formation-server/fondamental-bridge-lib.js" "$APP_DIR/server-patches/fondamental-bridge-lib.js"
dl "deploy/vps/formation-server/routes-fondamental-bridge.js" "$APP_DIR/server-patches/routes-fondamental-bridge.js"
dl "deploy/vps/app-shells/fondamental.html" "$APP_DIR/public/fondamental.html"
dl "la-forge/js/forge-fondamental.js" "$APP_DIR/public/js/forge-fondamental.js"

echo "==> wire server.js (paywall + fondamental-bridge)"
node "$APP_DIR/deploy/vps/wire-formation-server-patches.js" "$APP_DIR"

if [[ -n "${FORGE_FONDAMENTAL_BRIDGE_SECRET:-}" ]]; then
  export FORGE_FONDAMENTAL_BRIDGE_SECRET
  grep -q FORGE_FONDAMENTAL_BRIDGE_SECRET ~/.profile 2>/dev/null || \
    echo "export FORGE_FONDAMENTAL_BRIDGE_SECRET=\"$FORGE_FONDAMENTAL_BRIDGE_SECRET\"" >> ~/.profile
fi

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true

sleep 2
echo "==> test /api/fondamental-bridge (sans login → JSON login_required)"
curl -s https://app.torinvest-trading.com/api/fondamental-bridge | head -c 120
echo ""

if [[ -z "${FORGE_FONDAMENTAL_BRIDGE_SECRET:-}" ]]; then
  echo ""
  echo "IMPORTANT — ajoute dans ~/.profile (valeur = ai_access_hmac_secret radar) :"
  echo "  export FORGE_FONDAMENTAL_BRIDGE_SECRET='...'"
  echo "  pm2 restart la-forge --update-env"
fi

echo "OK — fondamental bridge deploy"
